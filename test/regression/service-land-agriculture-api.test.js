'use strict';

const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');

process.env.DB_NAME = 'central_govt_db_test';
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
if (process.env.DB_NAME !== 'central_govt_db_test') throw new Error('Land/agriculture API tests refuse to run outside central_govt_db_test');

const db = require('../../src/config/db');
const departmentRoutes = require('../../src/routes/departmentRoutes');
const agricultureRoutes = require('../../src/routes/agricultureRoutes');
const secret = process.env.JWT_SECRET || 'your-secret-key';
const marker = 'TST React Land Agriculture';
let server;
let baseUrl;
let alice;
let bob;
let aliceToken;
let bobToken;
let geo;
let program;

function tokenFor(user) { return jwt.sign({ id: user.id, username: user.name, nid: user.nid }, secret, { expiresIn: '1h' }); }
async function request(method, route, token, body) {
    const response = await fetch(`${baseUrl}${route}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await response.text(); let data = null;
    if (text) { try { data = JSON.parse(text); } catch { data = text; } }
    return { status: response.status, data };
}

async function cleanup() {
    if (!alice || !bob) return;
    const ids = [alice.id, bob.id];
    await db.query('DELETE FROM agri_training_registrations WHERE user_id IN (?) AND farmer_name LIKE ?', [ids, `${marker}%`]);
    await db.query('DELETE FROM agri_farmer_market WHERE user_id IN (?) AND product_name LIKE ?', [ids, `${marker}%`]);
    await db.query('DELETE FROM agri_expert_queries WHERE user_id IN (?) AND question LIKE ?', [ids, `${marker}%`]);
    await db.query('DELETE FROM agri_crop_reports WHERE user_id IN (?) AND remarks LIKE ?', [ids, `${marker}%`]);
    await db.query('DELETE FROM agri_subsidies WHERE user_id IN (?) AND farmer_name LIKE ?', [ids, `${marker}%`]);
    await db.query('DELETE FROM my_land_record WHERE user_id IN (?) AND khatian_no LIKE ?', [ids, 'TST-LAND-AGRI-%']);
    await db.query('DELETE FROM land_mutations_v2 WHERE user_id IN (?) AND tracking_number LIKE ?', [ids, 'TST-LAND-STATUS-%']);
    await db.query('DELETE FROM agri_training_programs WHERE title = ?', [`${marker} Program`]);
}

test('React land/agriculture API regression', async t => {
    try {
        [[alice]] = await db.query("SELECT id,name,nid FROM reg_info WHERE email='alice.demo@nationx.test'");
        [[bob]] = await db.query("SELECT id,name,nid FROM reg_info WHERE email='bob.demo@nationx.test'");
        [[geo]] = await db.query("SELECT v.id division_id,d.id district_id,u.id upazila_id FROM divisions v JOIN districts d ON d.division_id=v.id JOIN upazilas u ON u.district_id=d.id WHERE v.name='DEMO DATA — Test Division' LIMIT 1");
        assert.ok(alice && bob && geo, 'synthetic identities and demo geography must exist');
        aliceToken = tokenFor(alice); bobToken = tokenFor(bob); await cleanup();
        const [programResult] = await db.query(`
            INSERT INTO agri_training_programs
                (title, description, category, location, division_id, district_id, start_date, end_date, capacity, trainer_name, trainer_designation, status)
            VALUES (?, ?, 'Modern Farming', 'DEMO DATA — Test Location', ?, ?, DATE_ADD(CURDATE(), INTERVAL 7 DAY), DATE_ADD(CURDATE(), INTERVAL 8 DAY), 10, 'Synthetic Trainer', 'Demo Trainer', 'Upcoming')
        `, [`${marker} Program`, 'Synthetic automated-test fixture', geo.division_id, geo.district_id]);
        program = { id: programResult.insertId };
        const app = express(); app.use(express.json()); app.use('/api/departments', departmentRoutes); app.use('/api/agriculture', agricultureRoutes);
        await new Promise(resolve => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; resolve(); }); });
        await t.test('protected land/agriculture endpoints deny missing auth while intended public catalogues remain public', async () => {
            for (const route of ['/api/departments/land/records', '/api/agriculture/stats']) {
                const denied = await request('GET', route);
                assert.ok([401, 403].includes(denied.status));
            }
            assert.equal((await request('GET', '/api/agriculture/market/browse')).status, 200);
            assert.equal((await request('GET', '/api/agriculture/training/programs')).status, 200);
        });

        await t.test('land records use the active payload and remain owner-scoped', async () => {
            const created = await request('POST', '/api/departments/land/records', aliceToken, {
                division_id: geo.division_id, district_id: geo.district_id, upazila_id: geo.upazila_id,
                khatian: 'TST-LAND-AGRI-K', dag: 'TST-LAND-AGRI-D', mouza: 'DEMO DATA Mouza', land_size: 4.5,
                deed_no: 'TST-LAND-AGRI-DEED', land_price: 1000, description: marker, nid: alice.nid
            });
            assert.equal(created.status, 200);
            assert.equal(created.data.status, 'Pending');
            const [aliceRows, bobRows] = await Promise.all([
                request('GET', '/api/departments/land/records', aliceToken),
                request('GET', '/api/departments/land/records', bobToken)
            ]);
            assert.ok(aliceRows.data.some(row => row.khatian_no === 'TST-LAND-AGRI-K'));
            assert.ok(!bobRows.data.some(row => row.khatian_no === 'TST-LAND-AGRI-K'));

            await db.query(`INSERT INTO land_mutations_v2
                (user_id, applicant_nid, buyer_nid, khatian_no, dag_no, land_amount, tracking_number, status)
                VALUES (?, ?, ?, 'TST-LAND-AGRI-K', 'TST-LAND-AGRI-D', '1', 'TST-LAND-STATUS-ALICE', 'Pending')`,
            [alice.id, alice.nid, bob.nid]);
            assert.equal((await request('GET', '/api/departments/land/mutation/status/TST-LAND-STATUS-ALICE', bobToken)).status, 404);
            assert.equal((await request('GET', '/api/departments/land/mutation/status/TST-LAND-STATUS-ALICE', aliceToken)).status, 200);
        });

        await t.test('subsidy, crop report and expert query writes remain isolated', async () => {
            assert.equal((await request('POST', '/api/agriculture/subsidy/apply', aliceToken, { farmer_name: `${marker} Farmer`, phone: '01700000001', subsidy_type: 'Seeds', amount_requested: 1000, land_size_acres: 1, crop_type: 'Rice', land_ownership: 'Own', division_id: geo.division_id, district_id: geo.district_id, upazila_id: geo.upazila_id, village: 'DEMO DATA', nid_number: alice.nid })).status, 200);
            assert.equal((await request('POST', '/api/agriculture/crop-report/submit', aliceToken, { farmer_name: `${marker} Farmer`, crop_name: 'Rice', season: 'Aman', yield_metric_ton: 2, land_area_acres: 1, irrigation_method: 'Rainfed', division_id: geo.division_id, district_id: geo.district_id, upazila_id: geo.upazila_id, remarks: `${marker} report` })).status, 200);
            assert.equal((await request('POST', '/api/agriculture/expert/ask', aliceToken, { question: `${marker} question`, category: 'Seeds', crop_name: 'Rice' })).status, 200);
            const [bobSubsidies, bobCrops, bobQueries] = await Promise.all([
                request('GET', '/api/agriculture/subsidy/my-history', bobToken),
                request('GET', '/api/agriculture/crop-report/my-reports', bobToken),
                request('GET', '/api/agriculture/expert/my-queries', bobToken)
            ]);
            assert.ok(!bobSubsidies.data.some(row => String(row.farmer_name).startsWith(marker)));
            assert.ok(!bobCrops.data.some(row => String(row.remarks).startsWith(marker)));
            assert.ok(!bobQueries.data.some(row => String(row.question).startsWith(marker)));
        });

        await t.test('market listing and training registration preserve Pending/Registered and duplicate semantics', async () => {
            assert.equal((await request('POST', '/api/agriculture/market/listing', aliceToken, { farmer_name: `${marker} Farmer`, product_name: `${marker} Rice`, product_category: 'Rice', quantity: 2, unit: 'kg', price_per_unit: 50, phone: '01700000001', description: marker })).status, 200);
            const listing = (await request('GET', '/api/agriculture/market/my-listings', aliceToken)).data.find(row => row.product_name === `${marker} Rice`);
            assert.equal(listing.status, 'Pending');
            assert.ok(!(await request('GET', '/api/agriculture/market/my-listings', bobToken)).data.some(row => row.id === listing.id));
            const registrationPayload = { farmer_name: `${marker} Trainee`, phone: '01700000001' };
            assert.equal((await request('POST', `/api/agriculture/training/register/${program.id}`, aliceToken, registrationPayload)).status, 200);
            assert.equal((await request('POST', `/api/agriculture/training/register/${program.id}`, aliceToken, registrationPayload)).status, 400);
            const row = (await request('GET', '/api/agriculture/training/my-registrations', aliceToken)).data.find(item => item.program_id === program.id);
            assert.equal(row.status, 'Registered');
            assert.ok(!(await request('GET', '/api/agriculture/training/my-registrations', bobToken)).data.some(item => item.id === row.id));
        });
    } finally {
        await cleanup();
        if (server) await new Promise(resolve => server.close(resolve));
        await db.end();
    }
});
