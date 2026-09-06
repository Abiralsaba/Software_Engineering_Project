'use strict';

const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');

process.env.DB_NAME = 'central_govt_db_test';
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
if (process.env.DB_NAME !== 'central_govt_db_test') throw new Error('Passport admin tests refuse to run outside central_govt_db_test');

const db = require('../../src/config/db');
const passportRoutes = require('../../src/routes/passportRoutes');
const secret = process.env.JWT_SECRET || 'your-secret-key';
const appA = 'PP-TST-ADMIN-A';
const appB = 'PP-TST-ADMIN-B';
let server;
let baseUrl;
let alice;
let bob;
let idA;
let idB;
let submittedDate;

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
    await db.query('DELETE FROM passport_applications WHERE application_number IN (?, ?)', [appA, appB]);
}

test('React passport admin API regression', async t => {
    try {
        await cleanup();
        [[alice]] = await db.query("SELECT id,name,nid FROM reg_info WHERE email='alice.demo@nationx.test'");
        [[bob]] = await db.query("SELECT id,name,nid FROM reg_info WHERE email='bob.demo@nationx.test'");
        const [[admin]] = await db.query("SELECT id,name,email FROM admins WHERE email='admin.demo@nationx.test' AND status='approved'");
        const [[office]] = await db.query('SELECT office_code FROM passport_offices ORDER BY office_code LIMIT 1');
        assert.ok(alice && bob && admin && office, 'synthetic citizens/admin and an installed passport office must exist');
        const insertSql = `INSERT INTO passport_applications
            (user_id,application_number,service_type,passport_type,page_count,validity_years,delivery_type,full_name_en,father_name_en,mother_name_en,date_of_birth,gender,marital_status,nid_number,preferred_office,total_fee,status,payment_status)
            VALUES (?,?,'New','Ordinary','48','5','Regular',?,?,?,'1990-01-01','Male','Single',?,?,5750,'Submitted','Unpaid')`;
        const [insertA] = await db.query(insertSql, [alice.id, appA, 'Synthetic Admin Passport A', 'Synthetic Father A', 'Synthetic Mother A', alice.nid, office.office_code]);
        const [insertB] = await db.query(insertSql, [bob.id, appB, 'Synthetic Admin Passport B', 'Synthetic Father B', 'Synthetic Mother B', bob.nid, office.office_code]);
        idA = insertA.insertId; idB = insertB.insertId;
        [[{ submitted_date: submittedDate }]] = await db.query("SELECT DATE_FORMAT(submitted_at, '%Y-%m-%d') AS submitted_date FROM passport_applications WHERE id = ?", [idA]);

        const citizenToken = jwt.sign({ id: alice.id, username: alice.name, nid: alice.nid }, secret, { expiresIn: '1h' });
        const nonAdminToken = jwt.sign({ id: admin.id, email: admin.email, isAdmin: false }, secret, { expiresIn: '1h' });
        const adminToken = jwt.sign({ id: admin.id, email: admin.email, name: admin.name, isAdmin: true }, secret, { expiresIn: '1h' });
        const app = express(); app.use(express.json()); app.use('/api/passport', passportRoutes);
        await new Promise(resolve => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; resolve(); }); });

        await t.test('missing, citizen, and isAdmin:false tokens are denied for reads and updates', async () => {
            for (const token of [undefined, citizenToken, nonAdminToken]) {
                assert.ok([401, 403].includes((await request('GET', '/api/passport/admin/stats', token)).status));
                assert.ok([401, 403].includes((await request('PUT', `/api/passport/admin/application/${idA}/status`, token, { status: 'Approved' })).status));
            }
            const [[a], [b]] = await Promise.all([
                db.query('SELECT status FROM passport_applications WHERE id = ?', [idA]).then(([rows]) => rows),
                db.query('SELECT status FROM passport_applications WHERE id = ?', [idB]).then(([rows]) => rows)
            ]);
            assert.equal(a.status, 'Submitted'); assert.equal(b.status, 'Submitted');
        });

        await t.test('approved admin filters by status, office, date, and search', async () => {
            const route = `/api/passport/admin/applications?status=Submitted&office=${encodeURIComponent(office.office_code)}&date_from=${submittedDate}&date_to=${submittedDate}&search=${appA}`;
            const response = await request('GET', route, adminToken);
            assert.equal(response.status, 200);
            assert.deepEqual(response.data.map(row => row.id), [idA]);
            assert.equal((await request('GET', '/api/passport/admin/stats', adminToken)).status, 200);
        });

        await t.test('detail returns the selected application/history and rejects an unknown id', async () => {
            const detail = await request('GET', `/api/passport/admin/application/${idA}`, adminToken);
            assert.equal(detail.status, 200); assert.equal(detail.data.application.id, idA); assert.equal(detail.data.application.application_number, appA);
            assert.ok(detail.data.status_history.every(entry => entry.application_id === idA));
            assert.equal((await request('GET', '/api/passport/admin/application/999999999', adminToken)).status, 404);
        });

        await t.test('status update changes only selected A and preserves custom workflow date', async () => {
            const update = await request('PUT', `/api/passport/admin/application/${idA}/status`, adminToken, { status: 'Approved', remarks: 'Synthetic passport review', approved_at: '2026-08-29 10:30:00' });
            assert.equal(update.status, 200); assert.equal(update.data.success, true);
            const [[a], [b]] = await Promise.all([
                db.query('SELECT status,admin_remarks,approved_at FROM passport_applications WHERE id = ?', [idA]).then(([rows]) => rows),
                db.query('SELECT status,admin_remarks,approved_at FROM passport_applications WHERE id = ?', [idB]).then(([rows]) => rows)
            ]);
            assert.equal(a.status, 'Approved'); assert.equal(a.admin_remarks, 'Synthetic passport review'); assert.ok(a.approved_at);
            assert.deepEqual(b, { status: 'Submitted', admin_remarks: null, approved_at: null });
            assert.equal((await request('PUT', '/api/passport/admin/application/999999999/status', adminToken, { status: 'Approved' })).status, 404);
        });

        await t.test('installed trigger is the single status audit authority', async () => {
            const [history] = await db.query("SELECT old_status,new_status,changed_by,remarks FROM passport_status_history WHERE application_id = ? AND new_status = 'Approved' ORDER BY id", [idA]);
            assert.equal(history.length, 1, 'one route update must create one trigger-owned history row');
            assert.equal(history[0].old_status, 'Submitted');
            assert.equal(history[0].changed_by, 'System');
        });
    } finally {
        await cleanup();
        if (server) await new Promise(resolve => server.close(resolve));
        await db.end();
    }
});
