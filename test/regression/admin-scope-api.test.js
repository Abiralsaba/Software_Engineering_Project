'use strict';

const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const path = require('node:path');
const test = require('node:test');

process.env.DB_NAME = 'central_govt_db_test';
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
if (process.env.DB_NAME !== 'central_govt_db_test') throw new Error('Admin scope tests refuse to run outside central_govt_db_test');

const db = require('../../src/config/db');
const adminWorkRoutes = require('../../src/routes/adminWorkRoutes');
const secret = process.env.JWT_SECRET || 'your-secret-key';
const marker = 'TST-RBAC-SCOPE';

async function request(baseUrl, method, route, token, body) {
    const response = await fetch(`${baseUrl}${route}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined
    });
    return { status: response.status, data: await response.json() };
}

test('divisional admin queues are isolated by both service responsibility and division', async () => {
    let server;
    const created = { admins: [], subsidies: [] };
    try {
        await db.query('DELETE FROM agri_subsidies WHERE farmer_name LIKE ?', [`${marker}%`]);
        await db.query('DELETE FROM admins WHERE email LIKE ?', [`${marker.toLowerCase()}-%`]);
        const [divisions] = await db.query("SELECT id, name FROM divisions WHERE name NOT LIKE 'DEMO DATA — %' ORDER BY id LIMIT 2");
        const [[citizen], [superAdmin]] = await Promise.all([
            db.query("SELECT id FROM reg_info WHERE email = 'alice.demo@nationx.test'").then(([rows]) => rows),
            db.query(`SELECT a.id FROM admins a JOIN admin_role_assignments r ON r.admin_id = a.id WHERE r.role_type = 'SUPER_ADMIN' AND r.is_active = 1 LIMIT 1`).then(([rows]) => rows)
        ]);
        assert.equal(divisions.length, 2);
        assert.ok(citizen && superAdmin);

        for (const [suffix, domain] of [['AGRI', 'agriculture'], ['HEALTH', 'health']]) {
            const [result] = await db.query(
                `INSERT INTO admins (name, email, password, nid, status, approved_by, approved_at)
                 VALUES (?, ?, 'not-used', ?, 'approved', ?, NOW())`,
                [`${marker} ${suffix}`, `${marker.toLowerCase()}-${suffix.toLowerCase()}@nationx.test`, `${Date.now()}${suffix}`, superAdmin.id]
            );
            created.admins.push(result.insertId);
            await db.query(
                `INSERT INTO admin_role_assignments (admin_id, role_type, domain_code, division_id, assigned_by)
                 VALUES (?, 'DIVISION_ADMIN', ?, ?, ?)`,
                [result.insertId, domain, divisions[0].id, superAdmin.id]
            );
        }

        for (const [index, division] of divisions.entries()) {
            const [result] = await db.query(
                `INSERT INTO agri_subsidies
                    (user_id, farmer_name, subsidy_type, amount_requested, division_id, status)
                 VALUES (?, ?, 'Seeds', 1000, ?, 'Pending')`,
                [citizen.id, `${marker} Farmer ${index + 1}`, division.id]
            );
            created.subsidies.push(result.insertId);
        }

        const app = express(); app.use(express.json()); app.use('/api/admin/work', adminWorkRoutes);
        await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
        const baseUrl = `http://127.0.0.1:${server.address().port}`;
        const agricultureToken = jwt.sign({ id: created.admins[0], isAdmin: true }, secret, { expiresIn: '1h' });
        const healthToken = jwt.sign({ id: created.admins[1], isAdmin: true }, secret, { expiresIn: '1h' });

        const ownQueue = await request(baseUrl, 'GET', '/api/admin/work/agriculture?resource=subsidies', agricultureToken);
        assert.equal(ownQueue.status, 200);
        assert.deepEqual(ownQueue.data.items.map(item => item.id), [created.subsidies[0]]);
        assert.equal(ownQueue.data.scope.divisionId, divisions[0].id);

        const wrongService = await request(baseUrl, 'GET', '/api/admin/work/agriculture', healthToken);
        assert.equal(wrongService.status, 403);
        assert.equal(wrongService.data.code, 'ADMIN_SCOPE_DENIED');

        const crossDivisionUpdate = await request(
            baseUrl, 'PUT', `/api/admin/work/agriculture/subsidies/${created.subsidies[1]}/status`,
            agricultureToken, { status: 'Approved' }
        );
        assert.equal(crossDivisionUpdate.status, 404);
        const [[untouched]] = await db.query('SELECT status FROM agri_subsidies WHERE id = ?', [created.subsidies[1]]);
        assert.equal(untouched.status, 'Pending');
    } finally {
        if (server) await new Promise(resolve => server.close(resolve));
        if (created.subsidies.length) await db.query('DELETE FROM agri_subsidies WHERE id IN (?)', [created.subsidies]);
        if (created.admins.length) await db.query('DELETE FROM admins WHERE id IN (?)', [created.admins]);
        await db.end();
    }
});
