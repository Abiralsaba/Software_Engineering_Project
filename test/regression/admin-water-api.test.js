'use strict';

const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');

process.env.DB_NAME = 'central_govt_db_test';
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
if (process.env.DB_NAME !== 'central_govt_db_test') throw new Error('Admin Water tests refuse to run outside central_govt_db_test');

const db = require('../../src/config/db');
const waterRoutes = require('../../src/routes/waterRoutes');
const secret = process.env.JWT_SECRET || 'your-secret-key';
const marker = 'TST ADMIN WATER';
let server; let baseUrl; let alice; const ids = {};

async function request(method, route, token, body) {
    const response = await fetch(`${baseUrl}${route}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await response.text(); let data = null; if (text) { try { data = JSON.parse(text); } catch { data = text; } }
    return { status: response.status, data };
}

async function cleanup() {
    await db.query('DELETE FROM water_bill_payments WHERE transaction_id LIKE ?', [`${marker}%`]);
    await db.query('DELETE FROM water_quality_reports WHERE description LIKE ?', [`${marker}%`]);
    await db.query('DELETE FROM water_complaints WHERE description LIKE ?', [`${marker}%`]);
    await db.query('DELETE FROM water_connections WHERE holder_name LIKE ?', [`${marker}%`]);
    await db.query('DELETE FROM water_projects WHERE project_name LIKE ?', [`${marker}%`]);
}

test('React Admin Water API regression', async t => {
    try {
        [[alice]] = await db.query("SELECT id,name,nid FROM reg_info WHERE email='alice.demo@nationx.test'");
        const [[admin]] = await db.query("SELECT id,name,email FROM admins WHERE email='admin.demo@nationx.test' AND status='approved'");
        assert.ok(alice && admin, 'synthetic citizen and approved admin must exist');
        await cleanup();
        const [connectionA] = await db.query(`INSERT INTO water_connections (user_id,connection_number,holder_name,nid_number,phone,connection_type,division,district,upazila,address,status) VALUES (?, 'TST-WATER-A', ?, ?, '01990000001','Residential','DEMO DATA','DEMO DATA','DEMO DATA','DEMO DATA','Pending')`, [alice.id, `${marker} A`, alice.nid]); ids.connectionA = connectionA.insertId;
        const [connectionB] = await db.query(`INSERT INTO water_connections (user_id,connection_number,holder_name,nid_number,phone,connection_type,division,district,upazila,address,status) VALUES (?, 'TST-WATER-B', ?, ?, '01990000001','Residential','DEMO DATA','DEMO DATA','DEMO DATA','DEMO DATA','Pending')`, [alice.id, `${marker} B`, alice.nid]); ids.connectionB = connectionB.insertId;
        const [bill] = await db.query(`INSERT INTO water_bill_payments (user_id,connection_id,connection_number,billing_month,amount,total_amount,payment_method,transaction_id,status) VALUES (?,?, 'TST-WATER-A','2026-08',100,100,'Cash',?,'Pending')`, [alice.id, ids.connectionA, `${marker} BILL`]); ids.bill = bill.insertId;
        const [quality] = await db.query(`INSERT INTO water_quality_reports (user_id,source_type,division,district,issue_type,severity,description,status) VALUES (?,'Tube Well','DEMO DATA','DEMO DATA','Iron Content','High',?,'Reported')`, [alice.id, `${marker} QUALITY`]); ids.quality = quality.insertId;
        const [complaint] = await db.query(`INSERT INTO water_complaints (user_id,complaint_type,priority,division,district,address,description,status) VALUES (?,'Pipeline Leakage','High','DEMO DATA','DEMO DATA','DEMO DATA',?,'Submitted')`, [alice.id, `${marker} COMPLAINT`]); ids.complaint = complaint.insertId;
        const [project] = await db.query(`INSERT INTO water_projects (project_name,project_type,division,status,description) VALUES (?,'Irrigation','DEMO DATA','Planned',?)`, [`${marker} A`, marker]); ids.project = project.insertId;

        const app = express(); app.use(express.json()); app.use('/api/water', waterRoutes);
        await new Promise(resolve => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; resolve(); }); });
        const citizenToken = jwt.sign({ id: alice.id, username: alice.name, nid: alice.nid }, secret, { expiresIn: '1h' });
        const falseAdminToken = jwt.sign({ id: admin.id, isAdmin: false }, secret, { expiresIn: '1h' });
        const adminToken = jwt.sign({ id: admin.id, email: admin.email, name: admin.name, isAdmin: true }, secret, { expiresIn: '1h' });

        await t.test('all admin Water domains deny missing and citizen authorization', async () => {
            for (const route of ['/api/water/admin/stats', '/api/water/admin/connections', '/api/water/admin/bills', '/api/water/admin/quality', '/api/water/admin/complaints', '/api/water/admin/projects']) {
                for (const token of [undefined, citizenToken, falseAdminToken]) assert.ok([401, 403].includes((await request('GET', route, token)).status), `${route} must deny non-admin access`);
            }
        });

        await t.test('filters and details select only matching records', async () => {
            const connections = await request('GET', `/api/water/admin/connections?status=Pending&search=${encodeURIComponent(marker)}`, adminToken);
            assert.equal(connections.status, 200); assert.deepEqual(connections.data.connections.map(row => row.id).sort((a, b) => a - b), [ids.connectionA, ids.connectionB].sort((a, b) => a - b));
            assert.equal((await request('GET', `/api/water/admin/connections/${ids.connectionA}`, adminToken)).data.connection.id, ids.connectionA);
            assert.equal((await request('GET', `/api/water/admin/bills/${ids.bill}`, adminToken)).data.bill.id, ids.bill);
            assert.equal((await request('GET', `/api/water/admin/quality/${ids.quality}`, adminToken)).data.report.id, ids.quality);
            assert.equal((await request('GET', `/api/water/admin/complaints/${ids.complaint}`, adminToken)).data.complaint.id, ids.complaint);
            assert.equal((await request('GET', `/api/water/admin/projects/${ids.project}`, adminToken)).data.project.id, ids.project);
        });

        await t.test('updates affect only the selected record and preserve installed statuses', async () => {
            assert.equal((await request('PUT', `/api/water/admin/connections/${ids.connectionA}`, adminToken, { status: 'Approved', monthly_rate: 25, admin_remarks: marker })).status, 200);
            assert.equal((await request('PUT', `/api/water/admin/bills/${ids.bill}`, adminToken, { status: 'Paid', admin_remarks: marker })).status, 200);
            assert.equal((await request('PUT', `/api/water/admin/quality/${ids.quality}`, adminToken, { status: 'Under Investigation', test_result: marker, admin_remarks: marker })).status, 200);
            assert.equal((await request('PUT', `/api/water/admin/complaints/${ids.complaint}`, adminToken, { status: 'Assigned', assigned_to: 'Synthetic Officer', resolution: '', admin_remarks: marker })).status, 200);
            const [[a], [b], [bill], [quality], [complaint]] = await Promise.all([
                db.query('SELECT status,monthly_rate FROM water_connections WHERE id=?', [ids.connectionA]).then(([rows]) => rows),
                db.query('SELECT status,monthly_rate FROM water_connections WHERE id=?', [ids.connectionB]).then(([rows]) => rows),
                db.query('SELECT status FROM water_bill_payments WHERE id=?', [ids.bill]).then(([rows]) => rows),
                db.query('SELECT status FROM water_quality_reports WHERE id=?', [ids.quality]).then(([rows]) => rows),
                db.query('SELECT status FROM water_complaints WHERE id=?', [ids.complaint]).then(([rows]) => rows)
            ]);
            assert.equal(a.status, 'Approved'); assert.equal(Number(a.monthly_rate), 25); assert.equal(b.status, 'Pending'); assert.equal(Number(b.monthly_rate), 0);
            assert.equal(bill.status, 'Paid'); assert.equal(quality.status, 'Under Investigation'); assert.equal(complaint.status, 'Assigned');
        });

        await t.test('project create, selected update, and delete use one numeric record', async () => {
            const create = await request('POST', '/api/water/admin/projects', adminToken, { project_name: `${marker} CRUD`, project_type: 'Irrigation', division: 'DEMO DATA', status: 'Planned', description: marker });
            assert.equal(create.status, 200);
            const [[created]] = await db.query('SELECT id FROM water_projects WHERE project_name=?', [`${marker} CRUD`]); assert.ok(created);
            const update = await request('PUT', `/api/water/admin/projects/${created.id}`, adminToken, { project_name: `${marker} CRUD`, project_name_bn: '', project_type: 'Irrigation', implementing_agency: 'Synthetic', division: 'DEMO DATA', district: 'DEMO DATA', budget_crore: 1, start_date: null, expected_completion: null, progress_percent: 10, beneficiaries: 1, description: marker, status: 'Ongoing', is_active: 1 });
            assert.equal(update.status, 200); assert.equal((await db.query('SELECT status FROM water_projects WHERE id=?', [created.id]))[0][0].status, 'Ongoing');
            assert.equal((await request('DELETE', `/api/water/admin/projects/${created.id}`, adminToken)).status, 200); assert.equal((await db.query('SELECT COUNT(*) count FROM water_projects WHERE id=?', [created.id]))[0][0].count, 0);
            assert.equal((await request('PUT', '/api/water/admin/connections/999999999', adminToken, { status: 'Approved' })).status, 404);
            assert.equal((await request('DELETE', '/api/water/admin/projects/999999999', adminToken)).status, 404);
        });
    } finally {
        await cleanup(); if (server) await new Promise(resolve => server.close(resolve)); await db.end();
    }
});
