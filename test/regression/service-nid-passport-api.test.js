'use strict';

const fs = require('fs/promises');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');

process.env.DB_NAME = 'central_govt_db_test';
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
if (process.env.DB_NAME !== 'central_govt_db_test') throw new Error('NID/passport API tests refuse to run outside central_govt_db_test');

const db = require('../../src/config/db');
const nidRoutes = require('../../src/routes/nidRoutes');
const passportRoutes = require('../../src/routes/passportRoutes');
const secret = process.env.JWT_SECRET || 'your-secret-key';
const marker = 'TST React NID Passport';
let server;
let baseUrl;
let alice;
let bob;
let geo;
let center;
let office;
let activityBaseline = 0;
const smartReferences = [];
const generatedNidUploads = new Set();

function tokenFor(user) { return jwt.sign({ id: user.id, username: user.name, nid: user.nid }, secret, { expiresIn: '1h' }); }
async function request(method, route, token, body) {
    const isForm = body instanceof FormData;
    const response = await fetch(`${baseUrl}${route}`, {
        method,
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined || isForm ? {} : { 'Content-Type': 'application/json' }) },
        body: body === undefined ? undefined : (isForm ? body : JSON.stringify(body)),
        redirect: 'manual'
    });
    const text = await response.text(); let data = null;
    if (text) { try { data = JSON.parse(text); } catch { data = text; } }
    return { status: response.status, data, location: response.headers.get('location') };
}

async function cleanup() {
    if (!alice || !bob) return;
    const ids = [alice.id, bob.id];
    const [profiles] = await db.query('SELECT photo_url,signature_url FROM nid_profiles WHERE user_id IN (?) AND name_en LIKE ?', [ids, `${marker}%`]);
    profiles.forEach(row => { if (row.photo_url) generatedNidUploads.add(row.photo_url); if (row.signature_url) generatedNidUploads.add(row.signature_url); });
    await db.query("DELETE FROM passport_status_history WHERE application_id IN (SELECT id FROM passport_applications WHERE user_id IN (?) AND full_name_en LIKE ?)", [ids, `${marker}%`]);
    await db.query('DELETE FROM passport_applications WHERE user_id IN (?) AND full_name_en LIKE ?', [ids, `${marker}%`]);
    await db.query('DELETE FROM nid_verification_requests WHERE user_id IN (?) AND purpose = ?', [ids, marker]);
    await db.query('DELETE FROM nid_biometric_appointments WHERE user_id IN (?) AND related_application_id = 987654', [ids]);
    await db.query('DELETE FROM nid_address_changes WHERE user_id IN (?) AND old_address = ?', [ids, marker]);
    if (smartReferences.length) await db.query('DELETE FROM nid_smart_card_applications WHERE application_no IN (?)', [smartReferences]);
    await db.query("DELETE FROM nid_smart_card_applications WHERE user_id IN (?) AND biometric_appointment = '2026-12-20'", [ids]);
    await db.query('DELETE FROM nid_reissue_requests WHERE user_id IN (?) AND reason_details = ?', [ids, marker]);
    await db.query('DELETE FROM nid_correction_requests WHERE user_id IN (?) AND current_value = ?', [ids, marker]);
    await db.query('DELETE FROM nid_family_members WHERE user_id IN (?) AND member_name LIKE ?', [ids, `${marker}%`]);
    await db.query('DELETE FROM nid_profiles WHERE user_id IN (?) AND name_en LIKE ?', [ids, `${marker}%`]);
    await db.query('DELETE FROM nid_activity_log WHERE user_id IN (?) AND id > ?', [ids, activityBaseline]);
    for (const relative of generatedNidUploads) {
        if (!/^\/uploads\/nid\/\d+-\d+\.(png|jpe?g|pdf)$/i.test(relative)) throw new Error(`Refusing to remove unexpected upload path: ${relative}`);
        await fs.unlink(path.resolve(__dirname, '../../public', relative.replace(/^\//, ''))).catch(error => { if (error.code !== 'ENOENT') throw error; });
    }
    generatedNidUploads.clear();
}

test('React NID/passport API regression', async t => {
    try {
        [[alice]] = await db.query("SELECT id,name,nid FROM reg_info WHERE email='alice.demo@nationx.test'");
        [[bob]] = await db.query("SELECT id,name,nid FROM reg_info WHERE email='bob.demo@nationx.test'");
        [[geo]] = await db.query("SELECT v.id division_id,v.name division,d.id district_id,d.name district,u.id upazila_id,u.name upazila FROM divisions v JOIN districts d ON d.division_id=v.id JOIN upazilas u ON u.district_id=d.id WHERE v.name='DEMO DATA — Test Division' LIMIT 1");
        [[center]] = await db.query('SELECT id FROM nid_collection_centers WHERE is_active = 1 ORDER BY id LIMIT 1');
        [[office]] = await db.query('SELECT office_code FROM passport_offices WHERE is_active = 1 ORDER BY id LIMIT 1');
        [[{ maxId: activityBaseline }]] = await db.query('SELECT COALESCE(MAX(id), 0) maxId FROM nid_activity_log');
        assert.ok(alice && bob && geo && center && office, 'synthetic users and reference fixtures must exist');
        await cleanup();
        await db.query(`INSERT INTO nid_profiles (user_id,nid_number,name_bn,name_en,date_of_birth,gender,profile_status) VALUES (?,?,?,?,'1990-01-01','Male','Active')`, [alice.id, alice.nid, 'সিন্থেটিক নাগরিক', `${marker} Alice`]);
        const aliceToken = tokenFor(alice); const bobToken = tokenFor(bob);
        const app = express(); app.use(express.json()); app.use('/api/nid', nidRoutes); app.use('/api/passport', passportRoutes);
        await new Promise(resolve => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; resolve(); }); });

        await t.test('public catalogues remain public while citizen records require authentication', async () => {
            for (const route of ['/api/nid/centers', '/api/nid/fees', '/api/passport/offices', '/api/passport/fees']) assert.equal((await request('GET', route)).status, 200);
            for (const route of ['/api/nid/dashboard', '/api/nid/corrections', '/api/passport/my-applications', '/api/passport/stats']) assert.ok([401, 403].includes((await request('GET', route)).status));
        });

        await t.test('NID multipart requests preserve fields, Submitted status, and owner-scoped histories', async () => {
            const profile = new FormData();
            for (const [key, value] of Object.entries({ name_bn: 'সিন্থেটিক নাগরিক', name_en: `${marker} Alice`, date_of_birth: '1990-01-01', gender: 'Male' })) profile.append(key, value);
            profile.append('photo', new Blob(['synthetic profile image'], { type: 'image/png' }), 'profile.png');
            profile.append('signature', new Blob(['synthetic signature image'], { type: 'image/png' }), 'signature.png');
            const savedProfile = await request('POST', '/api/nid/profile', aliceToken, profile);
            assert.equal(savedProfile.status, 200);
            assert.match(savedProfile.data.uploaded.photo, /^\/uploads\/nid\//);
            assert.match(savedProfile.data.uploaded.signature, /^\/uploads\/nid\//);
            const [[storedProfile]] = await db.query('SELECT photo_url,signature_url FROM nid_profiles WHERE user_id=?', [alice.id]);
            assert.equal(storedProfile.photo_url, savedProfile.data.uploaded.photo);
            assert.equal(storedProfile.signature_url, savedProfile.data.uploaded.signature);

            const rejectedUpload = new FormData();
            rejectedUpload.append('nid_number', alice.nid); rejectedUpload.append('correction_type', 'Name');
            rejectedUpload.append('current_value', marker); rejectedUpload.append('corrected_value', marker);
            rejectedUpload.append('documents', new Blob(['not an allowed document'], { type: 'text/plain' }), 'synthetic.exe');
            assert.equal((await request('POST', '/api/nid/corrections', aliceToken, rejectedUpload)).status, 500);
            const correction = new FormData();
            for (const [key, value] of Object.entries({ nid_number: alice.nid, correction_type: 'Name', current_value: marker, corrected_value: `${marker} Corrected`, document_description: marker })) correction.append(key, value);
            assert.equal((await request('POST', '/api/nid/corrections', aliceToken, correction)).status, 200);
            const reissue = new FormData();
            for (const [key, value] of Object.entries({ nid_number: alice.nid, reason: 'Lost', details: marker, gd_number: 'TST-GD', delivery_type: 'Collection Center', collection_center_id: String(center.id) })) reissue.append(key, value);
            assert.equal((await request('POST', '/api/nid/reissue', aliceToken, reissue)).status, 200);
            const address = new FormData();
            for (const [key, value] of Object.entries({ nid_number: alice.nid, address_type: 'Present', old_address: marker, new_division_id: String(geo.division_id), new_district_id: String(geo.district_id), new_upazila_id: String(geo.upazila_id), new_post_office: 'DEMO PO', new_post_code: '1000', new_ward: '1', new_village: 'DEMO Village', change_reason: marker, document_type: 'Utility Bill' })) address.append(key, value);
            assert.equal((await request('POST', '/api/nid/address-change', aliceToken, address)).status, 200);
            const [aliceCorrection, bobCorrection, aliceReissue, bobAddress] = await Promise.all([
                request('GET', '/api/nid/corrections', aliceToken), request('GET', '/api/nid/corrections', bobToken),
                request('GET', '/api/nid/reissue', aliceToken), request('GET', '/api/nid/address-change', bobToken)
            ]);
            assert.equal(aliceCorrection.data.find(row => row.current_value === marker).status, 'Submitted');
            assert.ok(!bobCorrection.data.some(row => row.current_value === marker));
            assert.equal(aliceReissue.data.find(row => row.reason_details === marker).status, 'Submitted');
            assert.ok(!bobAddress.data.some(row => row.old_address === marker));
        });

        await t.test('NID smart-card, appointment, family, delete, and tracking operations remain owner-scoped', async () => {
            const smart = await request('POST', '/api/nid/smart-card', aliceToken, { nid_number: alice.nid, current_card_type: 'Standard', include_driving_license: true, include_passport_info: true, include_health_id: false, include_bank_account: false, collection_center_id: center.id, biometric_appointment: '2026-12-20' });
            assert.equal(smart.status, 200);
            smartReferences.push(smart.data.application_no);
            const appointment = await request('POST', '/api/nid/appointments', aliceToken, { application_type: 'Smart Card', related_application_id: 987654, center_id: center.id, appointment_date: '2026-12-21', time_slot: '09:00-10:00' });
            assert.equal(appointment.status, 200);
            assert.equal((await request('POST', '/api/nid/family', aliceToken, { relation: 'Father', member_name: `${marker} Father`, member_nid: '99900000000000998', is_dependent: true })).status, 200);
            const [aliceSmart, bobSmart, aliceFamily, bobAppointments] = await Promise.all([
                request('GET', '/api/nid/smart-card', aliceToken), request('GET', '/api/nid/smart-card', bobToken),
                request('GET', '/api/nid/family', aliceToken), request('GET', '/api/nid/appointments', bobToken)
            ]);
            const smartRow = aliceSmart.data.find(row => row.application_no === smart.data.application_no);
            assert.equal(smartRow.status, 'Submitted');
            assert.ok(!bobSmart.data.some(row => row.application_no === smart.data.application_no));
            assert.ok(!bobAppointments.data.some(row => row.related_application_id === 987654));
            assert.equal((await request('GET', `/api/nid/track/${smart.data.application_no}`, bobToken)).status, 404);
            assert.equal((await request('GET', `/api/nid/track/${smart.data.application_no}`, aliceToken)).status, 200);
            const familyRow = aliceFamily.data.find(row => row.member_name === `${marker} Father`);
            assert.ok(familyRow);
            assert.equal((await request('DELETE', `/api/nid/family/${familyRow.id}`, bobToken)).status, 200);
            assert.ok((await request('GET', '/api/nid/family', aliceToken)).data.some(row => row.id === familyRow.id), 'cross-owner delete must not remove the row');
            assert.equal((await request('DELETE', `/api/nid/family/${familyRow.id}`, aliceToken)).status, 200);
        });

        await t.test('passport application duplicate prevention, tracking, detail, upload ownership, and cancellation are isolated', async () => {
            const payload = user => ({ service_type: 'New', passport_type: 'Ordinary', page_count: '48', validity_years: '5', delivery_type: 'Regular', full_name_en: `${marker} ${user.name}`, father_name_en: 'Synthetic Father', mother_name_en: 'Synthetic Mother', date_of_birth: '1990-01-01', gender: 'Male', religion: 'Islam', marital_status: 'Single', nationality: 'Bangladeshi', nid_number: user.nid, present_upazila: geo.upazila, present_district: geo.district, present_division: geo.division, same_as_present: true, mobile_number: '01700000000', preferred_office: office.office_code });
            assert.equal((await request('POST', '/api/passport/apply', aliceToken, payload(bob))).status, 403);
            const aliceApply = await request('POST', '/api/passport/apply', aliceToken, payload(alice));
            const bobApply = await request('POST', '/api/passport/apply', bobToken, payload(bob));
            assert.equal(aliceApply.status, 200); assert.equal(bobApply.status, 200);
            assert.equal((await request('POST', '/api/passport/apply', aliceToken, payload(alice))).status, 400);
            const aliceApps = await request('GET', '/api/passport/my-applications', aliceToken);
            const bobApps = await request('GET', '/api/passport/my-applications', bobToken);
            const aliceRow = aliceApps.data.find(row => row.application_number === aliceApply.data.applicationNumber);
            const bobRow = bobApps.data.find(row => row.application_number === bobApply.data.applicationNumber);
            assert.ok(aliceRow && bobRow);
            assert.ok(!bobApps.data.some(row => row.application_number === aliceRow.application_number));
            assert.equal((await request('GET', `/api/passport/track/${aliceRow.application_number}`, bobToken)).status, 404);
            assert.equal((await request('GET', `/api/passport/application/${aliceRow.id}`, aliceToken)).status, 200);
            assert.equal((await request('GET', `/api/passport/application/${aliceRow.id}`, bobToken)).status, 404);
            assert.equal((await request('POST', `/api/passport/upload-documents/${aliceRow.id}`, bobToken, new FormData())).status, 404);
            assert.equal((await request('POST', `/api/passport/upload-documents/${aliceRow.id}`, aliceToken, new FormData())).status, 400);
            const rejectedUpload = new FormData(); rejectedUpload.append('photo', new Blob(['not an image'], { type: 'text/plain' }), 'synthetic.exe');
            assert.equal((await request('POST', `/api/passport/upload-documents/${aliceRow.id}`, aliceToken, rejectedUpload)).status, 500);
            assert.equal((await request('PUT', `/api/passport/application/${aliceRow.id}/cancel`, bobToken, {})).status, 404);
            assert.equal((await request('PUT', `/api/passport/application/${aliceRow.id}/cancel`, aliceToken, {})).status, 200);
            const [[aliceState], [bobState]] = await Promise.all([
                db.query('SELECT status FROM passport_applications WHERE id = ?', [aliceRow.id]).then(([rows]) => rows),
                db.query('SELECT status FROM passport_applications WHERE id = ?', [bobRow.id]).then(([rows]) => rows)
            ]);
            assert.equal(aliceState.status, 'Cancelled'); assert.equal(bobState.status, 'Submitted');
        });
    } finally {
        await cleanup();
        if (server) await new Promise(resolve => server.close(resolve));
        await db.end();
    }
});
