'use strict';

const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');

process.env.DB_NAME = 'central_govt_db_test';
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
if (process.env.DB_NAME !== 'central_govt_db_test') throw new Error('Health admin tests refuse to run outside central_govt_db_test');

const db = require('../../src/config/db');
const healthRoutes = require('../../src/routes/healthRoutes');
const secret = process.env.JWT_SECRET || 'your-secret-key';
const marker = 'TST-ADMIN-HEALTH';
const cardMarker = 'HC-TST-ADM';
let server;
let baseUrl;
const ids = {};

async function request(method, route, token, body) {
    const response = await fetch(`${baseUrl}${route}`, {
        method,
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await response.text(); let data = null;
    if (text) { try { data = JSON.parse(text); } catch { data = text; } }
    return { status: response.status, data };
}

async function cleanup() {
    await db.query('DELETE FROM health_complaints WHERE description LIKE ?', [`%${marker}%`]);
    await db.query('DELETE FROM health_ambulance_requests WHERE pickup_address LIKE ?', [`%${marker}%`]);
    await db.query('DELETE FROM health_appointments WHERE patient_name LIKE ?', [`%${marker}%`]);
    await db.query('DELETE FROM health_vaccinations WHERE vaccine_name LIKE ?', [`%${marker}%`]);
    await db.query('DELETE FROM health_cards WHERE card_number LIKE ?', [`${cardMarker}%`]);
    await db.query('DELETE FROM health_hospitals WHERE name LIKE ?', [`${marker}%`]);
}

test('React health admin API regression', async t => {
    try {
        await cleanup();
        const [[alice]] = await db.query("SELECT id,name,nid FROM reg_info WHERE email='alice.demo@nationx.test'");
        const [[bob]] = await db.query("SELECT id,name,nid FROM reg_info WHERE email='bob.demo@nationx.test'");
        const [[admin]] = await db.query("SELECT id,name,email FROM admins WHERE email='admin.demo@nationx.test' AND status='approved'");
        assert.ok(alice && bob && admin, 'synthetic citizen/admin fixtures must exist');

        const [hospitalA] = await db.query(`INSERT INTO health_hospitals (name,hospital_type,division,district,total_beds,icu_beds,available_beds,available_icu_beds,is_active) VALUES (?,'District Hospital','Demo Division','Demo District',10,2,8,1,1)`, [`${marker}-HOSPITAL-A`]);
        const [hospitalB] = await db.query(`INSERT INTO health_hospitals (name,hospital_type,division,district,total_beds,icu_beds,available_beds,available_icu_beds,is_active) VALUES (?,'District Hospital','Demo Division','Demo District',20,4,15,2,1)`, [`${marker}-HOSPITAL-B`]);
        const [hospitalDelete] = await db.query(`INSERT INTO health_hospitals (name,hospital_type,division,district,is_active) VALUES (?,'Community Clinic','Demo Division','Demo District',1)`, [`${marker}-HOSPITAL-DELETE`]);
        ids.hospitalA = hospitalA.insertId; ids.hospitalB = hospitalB.insertId; ids.hospitalDelete = hospitalDelete.insertId;

        const cardSql = `INSERT INTO health_cards (user_id,card_number,full_name,nid_number,date_of_birth,gender,phone,division,district,upazila,status) VALUES (?,?,?,?,?,'Male','01700000000','Demo Division','Demo District','Demo Upazila','Pending')`;
        const [cardA] = await db.query(cardSql, [alice.id, `${cardMarker}-A`, `${marker} Card A`, alice.nid, '1990-01-01']);
        const [cardB] = await db.query(cardSql, [bob.id, `${cardMarker}-B`, `${marker} Card B`, bob.nid, '1991-01-01']);
        ids.cardA = cardA.insertId; ids.cardB = cardB.insertId;

        const [vaccinationA] = await db.query(`INSERT INTO health_vaccinations (user_id,health_card_id,vaccine_name,vaccine_type,status) VALUES (?,?,?,'Other','Registered')`, [alice.id, ids.cardA, `${marker} Vaccine A`]);
        const [vaccinationB] = await db.query(`INSERT INTO health_vaccinations (user_id,health_card_id,vaccine_name,vaccine_type,status) VALUES (?,?,?,'Other','Registered')`, [bob.id, ids.cardB, `${marker} Vaccine B`]);
        ids.vaccinationA = vaccinationA.insertId; ids.vaccinationB = vaccinationB.insertId;

        const appointmentSql = `INSERT INTO health_appointments (user_id,hospital_id,patient_name,phone,department,appointment_date,status) VALUES (?,?,?,'01700000000','Medicine','2026-08-29','Pending')`;
        const [appointmentA] = await db.query(appointmentSql, [alice.id, ids.hospitalA, `${marker} Patient A`]);
        const [appointmentB] = await db.query(appointmentSql, [bob.id, ids.hospitalB, `${marker} Patient B`]);
        ids.appointmentA = appointmentA.insertId; ids.appointmentB = appointmentB.insertId;

        const ambulanceSql = `INSERT INTO health_ambulance_requests (user_id,patient_name,phone,emergency_type,pickup_address,division,district,status) VALUES (?,?,'01700000000','Other',?,'Demo Division','Demo District','Requested')`;
        const [ambulanceA] = await db.query(ambulanceSql, [alice.id, `${marker} Ambulance A`, `${marker} pickup A`]);
        const [ambulanceB] = await db.query(ambulanceSql, [bob.id, `${marker} Ambulance B`, `${marker} pickup B`]);
        ids.ambulanceA = ambulanceA.insertId; ids.ambulanceB = ambulanceB.insertId;

        const complaintSql = `INSERT INTO health_complaints (user_id,complaint_type,hospital_name,description,status) VALUES (?,'Other',?,?,'Submitted')`;
        const [complaintA] = await db.query(complaintSql, [alice.id, `${marker} Hospital A`, `${marker} complaint A`]);
        const [complaintB] = await db.query(complaintSql, [bob.id, `${marker} Hospital B`, `${marker} complaint B`]);
        ids.complaintA = complaintA.insertId; ids.complaintB = complaintB.insertId;

        const citizenToken = jwt.sign({ id: alice.id, username: alice.name, nid: alice.nid }, secret, { expiresIn: '1h' });
        const nonAdminToken = jwt.sign({ id: admin.id, email: admin.email, isAdmin: false }, secret, { expiresIn: '1h' });
        const adminToken = jwt.sign({ id: admin.id, email: admin.email, name: admin.name, isAdmin: true }, secret, { expiresIn: '1h' });
        const app = express(); app.use(express.json()); app.use('/api/health', healthRoutes);
        await new Promise(resolve => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; resolve(); }); });

        await t.test('missing, citizen, and isAdmin:false tokens are denied across admin mutations', async () => {
            const actions = [
                [`/api/health/admin/health-cards/${ids.cardA}`, { status: 'Approved' }],
                [`/api/health/admin/vaccinations/${ids.vaccinationA}`, { status: 'Completed' }],
                [`/api/health/admin/appointments/${ids.appointmentA}`, { status: 'Confirmed' }],
                [`/api/health/admin/ambulance/${ids.ambulanceA}`, { status: 'Dispatched' }],
                [`/api/health/admin/complaints/${ids.complaintA}`, { status: 'Resolved' }]
            ];
            for (const token of [undefined, citizenToken, nonAdminToken]) {
                assert.ok([401, 403].includes((await request('GET', '/api/health/admin/stats', token)).status));
                for (const [route, body] of actions) assert.ok([401, 403].includes((await request('PUT', route, token, body)).status));
                assert.ok([401, 403].includes((await request('DELETE', `/api/health/admin/hospitals/${ids.hospitalDelete}`, token)).status));
            }
        });

        await t.test('approved admin filters every queue and reads selected details', async () => {
            const cases = [
                [`/api/health/admin/health-cards?status=Pending&search=${cardMarker}-A`, 'cards', ids.cardA],
                [`/api/health/admin/vaccinations?status=Registered&search=${marker}+Vaccine+A`, 'vaccinations', ids.vaccinationA],
                [`/api/health/admin/appointments?status=Pending&date=2026-08-29&search=${marker}+Patient+A`, 'appointments', ids.appointmentA],
                [`/api/health/admin/ambulance?status=Requested&search=${marker}+Ambulance+A`, 'requests', ids.ambulanceA],
                [`/api/health/admin/complaints?status=Submitted&search=${marker}+complaint+A`, 'complaints', ids.complaintA]
            ];
            for (const [route, key, id] of cases) {
                const response = await request('GET', route, adminToken); assert.equal(response.status, 200); assert.deepEqual(response.data[key].map(row => row.id), [id]);
            }
            assert.equal((await request('GET', `/api/health/admin/health-cards/${ids.cardA}`, adminToken)).data.card.id, ids.cardA);
            assert.equal((await request('GET', '/api/health/admin/stats', adminToken)).status, 200);
        });

        await t.test('all five workflow updates affect only selected A records', async () => {
            const updates = [
                [`/api/health/admin/health-cards/${ids.cardA}`, { status: 'Approved', admin_note: 'Synthetic card review' }],
                [`/api/health/admin/vaccinations/${ids.vaccinationA}`, { status: 'Completed', vaccination_date: '2026-08-29', vaccination_center: 'Demo Center', batch_number: 'BATCH-TST', administered_by: 'Demo Clinician', next_dose_date: '', certificate_number: 'CERT-TST', admin_remarks: 'Synthetic vaccination review' }],
                [`/api/health/admin/appointments/${ids.appointmentA}`, { status: 'Confirmed', doctor_name: 'Dr Demo', appointment_time: '10:30', prescription: '', admin_remarks: 'Synthetic appointment review' }],
                [`/api/health/admin/ambulance/${ids.ambulanceA}`, { status: 'Dispatched', driver_name: 'Demo Driver', driver_phone: '01711111111', vehicle_number: 'DHAKA-TST', estimated_arrival: '15 minutes', admin_remarks: 'Synthetic ambulance review' }],
                [`/api/health/admin/complaints/${ids.complaintA}`, { status: 'Resolved', admin_response: 'Synthetic resolution' }]
            ];
            for (const [route, body] of updates) { const response = await request('PUT', route, adminToken, body); assert.equal(response.status, 200); assert.equal(response.data.success, true); }
            const checks = [
                ['health_cards', ids.cardA, ids.cardB, 'Approved', 'Pending'], ['health_vaccinations', ids.vaccinationA, ids.vaccinationB, 'Completed', 'Registered'],
                ['health_appointments', ids.appointmentA, ids.appointmentB, 'Confirmed', 'Pending'], ['health_ambulance_requests', ids.ambulanceA, ids.ambulanceB, 'Dispatched', 'Requested'],
                ['health_complaints', ids.complaintA, ids.complaintB, 'Resolved', 'Submitted']
            ];
            for (const [table, selectedId, untouchedId, selectedStatus, untouchedStatus] of checks) {
                const [[selected], [untouched]] = await Promise.all([
                    db.query(`SELECT status FROM ${table} WHERE id = ?`, [selectedId]).then(([rows]) => rows),
                    db.query(`SELECT status FROM ${table} WHERE id = ?`, [untouchedId]).then(([rows]) => rows)
                ]);
                assert.equal(selected.status, selectedStatus); assert.equal(untouched.status, untouchedStatus);
            }
        });

        await t.test('hospital update and delete target only their selected numeric ids', async () => {
            const body = { name: `${marker}-HOSPITAL-A-UPDATED`, name_bn: '', hospital_type: 'District Hospital', division: 'Demo Division', district: 'Demo District', upazila: 'Demo Upazila', address: 'Demo address', phone: '', emergency_phone: '', email: '', total_beds: 11, icu_beds: 2, available_beds: 9, available_icu_beds: 1, departments: 'Medicine', facilities: 'X-Ray', ambulance_available: true, blood_bank: false, is_active: 1 };
            assert.equal((await request('PUT', `/api/health/admin/hospitals/${ids.hospitalA}`, adminToken, body)).status, 200);
            let [[a], [b]] = await Promise.all([
                db.query('SELECT name,total_beds FROM health_hospitals WHERE id = ?', [ids.hospitalA]).then(([rows]) => rows),
                db.query('SELECT name,total_beds FROM health_hospitals WHERE id = ?', [ids.hospitalB]).then(([rows]) => rows)
            ]);
            assert.deepEqual(a, { name: `${marker}-HOSPITAL-A-UPDATED`, total_beds: 11 }); assert.deepEqual(b, { name: `${marker}-HOSPITAL-B`, total_beds: 20 });
            assert.equal((await request('DELETE', `/api/health/admin/hospitals/${ids.hospitalDelete}`, adminToken)).status, 200);
            [[a], [b]] = await Promise.all([
                db.query('SELECT id FROM health_hospitals WHERE id = ?', [ids.hospitalDelete]).then(([rows]) => rows),
                db.query('SELECT id FROM health_hospitals WHERE id = ?', [ids.hospitalB]).then(([rows]) => rows)
            ]);
            assert.equal(a, undefined); assert.equal(b.id, ids.hospitalB);
        });

        await t.test('unknown update/delete ids currently return false success', async () => {
            assert.equal((await request('PUT', '/api/health/admin/health-cards/999999999', adminToken, { status: 'Approved', admin_note: 'missing' })).status, 200);
            assert.equal((await request('DELETE', '/api/health/admin/hospitals/999999999', adminToken)).status, 200);
        });
    } finally {
        await cleanup();
        if (server) await new Promise(resolve => server.close(resolve));
        await db.end();
    }
});
