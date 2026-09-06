'use strict';

const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');

process.env.DB_NAME = 'central_govt_db_test';
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
if (process.env.DB_NAME !== 'central_govt_db_test') throw new Error('NID admin tests refuse to run outside central_govt_db_test');

const db = require('../../src/config/db');
const nidRoutes = require('../../src/routes/nidRoutes');
const secret = process.env.JWT_SECRET || 'your-secret-key';
const refA = 'COR-TST-ADMIN-NID-A';
const refB = 'COR-TST-ADMIN-NID-B';
let server;
let baseUrl;
let alice;
let bob;

async function request(method, route, token, body) {
    const response = await fetch(`${baseUrl}${route}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await response.text(); let data = null;
    if (text) { try { data = JSON.parse(text); } catch { data = text; } }
    return { status: response.status, data };
}

async function cleanup() {
    await db.query('DELETE FROM nid_activity_log WHERE activity_details LIKE ?', ['%COR-TST-ADMIN-NID-%']);
    await db.query('DELETE FROM nid_correction_requests WHERE request_no IN (?, ?)', [refA, refB]);
}

test('React NID admin API regression', async t => {
    try {
        await cleanup();
        [[alice]] = await db.query("SELECT id,name,nid FROM reg_info WHERE email='alice.demo@nationx.test'");
        [[bob]] = await db.query("SELECT id,name,nid FROM reg_info WHERE email='bob.demo@nationx.test'");
        const [[admin]] = await db.query("SELECT id,name,email FROM admins WHERE email='admin.demo@nationx.test' AND status='approved'");
        assert.ok(alice && bob && admin, 'synthetic citizen/admin fixtures must exist');
        await db.query(`INSERT INTO nid_correction_requests (user_id,request_no,nid_number,correction_category,current_value,corrected_value,status) VALUES (?,?,?,'Name','Old A','New A','Submitted'),(?,?,?,'Name','Old B','New B','Submitted')`, [alice.id, refA, alice.nid, bob.id, refB, bob.nid]);
        const citizenToken = jwt.sign({ id: alice.id, username: alice.name, nid: alice.nid }, secret, { expiresIn: '1h' });
        const nonAdminToken = jwt.sign({ id: admin.id, email: admin.email, isAdmin: false }, secret, { expiresIn: '1h' });
        const adminToken = jwt.sign({ id: admin.id, email: admin.email, name: admin.name, isAdmin: true }, secret, { expiresIn: '1h' });
        const app = express(); app.use(express.json()); app.use('/api/nid', nidRoutes);
        await new Promise(resolve => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; resolve(); }); });

        await t.test('missing, citizen, and non-admin tokens are denied for reads and mutations', async () => {
            for (const token of [undefined, citizenToken, nonAdminToken]) {
                assert.ok([401, 403].includes((await request('GET', '/api/nid/admin/stats', token)).status));
                assert.ok([401, 403].includes((await request('POST', '/api/nid/admin/update-status', token, { refNo: refA, sourceTable: 'nid_correction_requests', status: 'Approved' })).status));
            }
            const [[a], [b]] = await Promise.all([
                db.query('SELECT status FROM nid_correction_requests WHERE request_no = ?', [refA]).then(([rows]) => rows),
                db.query('SELECT status FROM nid_correction_requests WHERE request_no = ?', [refB]).then(([rows]) => rows)
            ]);
            assert.equal(a.status, 'Submitted'); assert.equal(b.status, 'Submitted');
        });

        await t.test('approved admin sees unified records and stats while filtering remains client-side', async () => {
            const stats = await request('GET', '/api/nid/admin/stats', adminToken);
            const apps = await request('GET', '/api/nid/admin/applications?status=Rejected&type=Reissue', adminToken);
            assert.equal(stats.status, 200); assert.equal(apps.status, 200);
            assert.ok(apps.data.some(row => row.ref_no === refA));
            assert.ok(apps.data.some(row => row.ref_no === refB));
        });

        await t.test('detail lookup restricts source tables and returns the selected reference', async () => {
            assert.equal((await request('GET', `/api/nid/admin/application/${refA}?table=admins`, adminToken)).status, 400);
            const detail = await request('GET', `/api/nid/admin/application/${refA}?table=nid_correction_requests`, adminToken);
            assert.equal(detail.status, 200); assert.equal(detail.data.request_no, refA); assert.equal(detail.data.user_nid, alice.nid);
        });

        await t.test('status update affects only the selected record and preserves correction remarks', async () => {
            const update = await request('POST', '/api/nid/admin/update-status', adminToken, { refNo: refA, sourceTable: 'nid_correction_requests', status: 'Approved', remarks: 'Synthetic verified correction' });
            assert.equal(update.status, 200); assert.equal(update.data.success, true);
            const [[a], [b]] = await Promise.all([
                db.query('SELECT status,admin_remarks FROM nid_correction_requests WHERE request_no = ?', [refA]).then(([rows]) => rows),
                db.query('SELECT status,admin_remarks FROM nid_correction_requests WHERE request_no = ?', [refB]).then(([rows]) => rows)
            ]);
            assert.deepEqual(a, { status: 'Approved', admin_remarks: 'Synthetic verified correction' });
            assert.deepEqual(b, { status: 'Submitted', admin_remarks: null });
            assert.equal((await request('POST', '/api/nid/admin/update-status', adminToken, { refNo: refB, sourceTable: 'admins', status: 'Approved' })).status, 400);
        });
    } finally {
        await cleanup();
        if (server) await new Promise(resolve => server.close(resolve));
        await db.end();
    }
});
