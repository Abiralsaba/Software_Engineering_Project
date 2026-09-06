'use strict';

const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');

process.env.DB_NAME = 'central_govt_db_test';
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

if (process.env.DB_NAME !== 'central_govt_db_test') {
    throw new Error('Regression tests refuse to run outside central_govt_db_test');
}

const db = require('../../src/config/db');
const dashboardRoutes = require('../../src/routes/dashboardRoutes');
const departmentRoutes = require('../../src/routes/departmentRoutes');
const shopRoutes = require('../../src/routes/shopRoutes');
const stipendRoutes = require('../../src/routes/stipendRoutes');
const adminRoutes = require('../../src/routes/adminRoutes');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

let server;
let baseUrl;
let alice;
let bob;
let carol;
let admin;
let geo;
let shopItem;
let stipend;
let aliceToken;
let bobToken;
let adminToken;

function citizenToken(user) {
    return jwt.sign(
        { id: user.id, username: user.name, nid: user.nid },
        JWT_SECRET,
        { expiresIn: '1h' }
    );
}

function makeAdminToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email, name: user.name, isAdmin: true },
        JWT_SECRET,
        { expiresIn: '1h' }
    );
}

async function api(method, route, token, body) {
    const response = await fetch(`${baseUrl}${route}`, {
        method,
        headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
        },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await response.text();
    let data = null;
    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = text;
        }
    }
    return { status: response.status, data };
}

async function cleanSyntheticTestWrites() {
    const [userRows] = await db.query(
        `SELECT id FROM reg_info
         WHERE email IN (
             'alice.demo@nationx.test',
             'bob.demo@nationx.test',
             'carol.regression@nationx.test'
         )`
    );
    const userIds = userRows.map(row => row.id);

    if (userIds.length) {
        await db.query("DELETE FROM audit_log WHERE table_name = 'land_mutations_v2'");
        await db.query("DELETE FROM admin_actions_log WHERE target_table = 'land_mutations_v2'");
        await db.query('DELETE FROM notifications WHERE user_id IN (?)', [userIds]);
        await db.query('DELETE FROM service_requests WHERE user_id IN (?)', [userIds]);
        await db.query('DELETE FROM stipend_applications WHERE user_id IN (?)', [userIds]);
        await db.query('DELETE FROM todos WHERE user_id IN (?)', [userIds]);
        await db.query(
            `DELETE FROM addto_cart
             WHERE user_nid IN (
                 '99900000000000001',
                 '99900000000000002',
                 '99900000000000003'
             )`
        );
        await db.query('DELETE FROM land_mutations_v2 WHERE user_id IN (?)', [userIds]);
        await db.query(
            "DELETE FROM my_land_record WHERE user_id IN (?) AND khatian_no LIKE 'TST-%'",
            [userIds]
        );
    }

    await db.query("DELETE FROM landtax WHERE transaction_id LIKE 'TST-%'");
    await db.query("DELETE FROM reg_info WHERE email = 'carol.regression@nationx.test'");
}

async function loadFixtures() {
    [[alice]] = await db.query(
        "SELECT id, name, email, nid FROM reg_info WHERE email = 'alice.demo@nationx.test'"
    );
    [[bob]] = await db.query(
        "SELECT id, name, email, nid FROM reg_info WHERE email = 'bob.demo@nationx.test'"
    );
    [[admin]] = await db.query(
        "SELECT id, name, email FROM admins WHERE email = 'admin.demo@nationx.test'"
    );
    [[geo]] = await db.query(
        `SELECT v.id AS division_id, d.id AS district_id, u.id AS upazila_id
         FROM divisions v
         JOIN districts d ON d.division_id = v.id
         JOIN upazilas u ON u.district_id = d.id
         WHERE v.name = 'DEMO DATA — Test Division'
           AND d.name = 'DEMO DATA — Test District'
           AND u.name = 'DEMO DATA — Test Upazila'`
    );
    [[shopItem]] = await db.query('SELECT id, name FROM shop_items ORDER BY id LIMIT 1');
    [[stipend]] = await db.query(
        'SELECT id, title FROM stipends WHERE is_active = TRUE AND deadline >= CURDATE() ORDER BY deadline LIMIT 1'
    );

    assert.ok(alice && bob && admin && geo && shopItem && stipend, 'synthetic fixtures must exist');

    const [carolResult] = await db.query(
        `INSERT INTO reg_info (name, address, nid, mobile, email, password, dob, gender)
         SELECT
             'Synthetic Regression Citizen Carol',
             'DEMO DATA — Test Address C',
             '99900000000000003',
             '01990000003',
             'carol.regression@nationx.test',
             password,
             '1992-04-10',
             'Female'
         FROM reg_info WHERE id = ?`,
        [alice.id]
    );
    carol = {
        id: carolResult.insertId,
        name: 'Synthetic Regression Citizen Carol',
        email: 'carol.regression@nationx.test',
        nid: '99900000000000003'
    };
    await db.query(
        `INSERT INTO user_info (user_id, name, email, nid, mobile, dob, address, gender)
         VALUES (?, ?, ?, ?, '01990000003', '1992-04-10', 'DEMO DATA — Test Address C', 'Female')`,
        [carol.id, carol.name, carol.email, carol.nid]
    );

    aliceToken = citizenToken(alice);
    bobToken = citizenToken(bob);
    adminToken = makeAdminToken(admin);
}

async function insertLand(khatian, dag, size = 100) {
    const [result] = await db.query(
        `INSERT INTO my_land_record (
            user_id, owner_name, nid, khatian_no, dag_no, mouza, land_size,
            ownership_description, status, division_id, district_id, upazila_id,
            deed_no, land_price
         ) VALUES (?, ?, ?, ?, ?, 'DEMO DATA — Regression Mouza', ?,
                   'DEMO DATA — Regression parcel', 'Approved', ?, ?, ?, ?, 100000)`,
        [
            alice.id, alice.name, alice.nid, khatian, dag, size,
            geo.division_id, geo.district_id, geo.upazila_id,
            `DEED-${khatian}`
        ]
    );
    return result.insertId;
}

async function submitMutation(khatian, dag, amount, buyer = bob) {
    const result = await api('POST', '/api/departments/land/mutation_v2', aliceToken, {
        divId: geo.division_id,
        distId: geo.district_id,
        upaId: geo.upazila_id,
        appNid: alice.nid,
        buyerNid: buyer.nid,
        khatian,
        dag,
        amount,
        price: 50000,
        deed: `DEED-${khatian}`,
        ownType: 'Own'
    });
    assert.equal(result.status, 200, JSON.stringify(result.data));

    const [[mutation]] = await db.query(
        'SELECT * FROM land_mutations_v2 WHERE tracking_number = ?',
        [result.data.trackingNumber]
    );
    assert.ok(mutation);
    return mutation;
}

async function insertDirectMutation(khatian, dag, amount, buyer = bob) {
    const tracking = `TST-${khatian}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const [result] = await db.query(
        `INSERT INTO land_mutations_v2 (
            user_id, division_id, district_id, upazila_id,
            khatian_no, dag_no, land_amount, land_price, deed_no,
            ownership_type, buyer_nid, buyer_id, tracking_number, status
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 50000, ?, 'Own', ?, ?, ?, 'Pending')`,
        [
            alice.id, geo.division_id, geo.district_id, geo.upazila_id,
            khatian, dag, String(amount), `DEED-${khatian}`,
            buyer.nid, buyer.id, tracking
        ]
    );
    await db.query(
        `INSERT INTO service_requests (user_id, service_type, details, status, notification_read)
         VALUES (?, 'Land Mutation', ?, 'pending', 0)`,
        [alice.id, `ID: ${tracking} - Mutation for Khatian: ${khatian}, Dag: ${dag}`]
    );
    const [[mutation]] = await db.query('SELECT * FROM land_mutations_v2 WHERE id = ?', [result.insertId]);
    return mutation;
}

async function approveMutation(id, token = adminToken) {
    return api('PUT', `/api/admin/land-mutations/${id}/approve`, token, {});
}

test('NationX database baseline regression', async t => {
    await cleanSyntheticTestWrites();
    await loadFixtures();

    const app = express();
    app.use(express.json());
    app.use('/api/dashboard', dashboardRoutes);
    app.use('/api/departments', departmentRoutes);
    app.use('/api/shop', shopRoutes);
    app.use('/api/stipends', stipendRoutes);
    app.use('/api/admin', adminRoutes);

    await new Promise(resolve => {
        server = app.listen(0, '127.0.0.1', () => {
            baseUrl = `http://127.0.0.1:${server.address().port}`;
            resolve();
        });
    });

    try {
        await t.test('todos persist an optional due_date and remain user-scoped', async () => {
            const created = await api('POST', '/api/dashboard/todos', aliceToken, {
                title: 'Synthetic regression todo',
                description: 'DEMO DATA',
                due_date: '2026-12-15 10:30:00'
            });
            assert.equal(created.status, 200);

            const [[row]] = await db.query('SELECT * FROM todos WHERE id = ?', [created.data.id]);
            assert.ok(row.due_date);

            const bobTodos = await api('GET', '/api/dashboard/todos', bobToken);
            assert.equal(bobTodos.status, 200);
            assert.equal(bobTodos.data.some(todo => todo.id === created.data.id), false);
        });

        await t.test('cart ownership is derived from authenticated NID and isolated', async () => {
            const aliceAdd = await api('POST', '/api/shop/cart', aliceToken, {
                item_id: shopItem.id,
                quantity: 2
            });
            assert.equal(aliceAdd.status, 200);

            const aliceCart = await api('GET', '/api/shop/cart', aliceToken);
            const bobEmptyCart = await api('GET', '/api/shop/cart', bobToken);
            assert.equal(aliceCart.data.length, 1);
            assert.equal(bobEmptyCart.data.length, 0);

            const aliceCartId = aliceCart.data[0].cart_id;
            const bobCrossDelete = await api('DELETE', `/api/shop/cart/${aliceCartId}`, bobToken);
            assert.equal(bobCrossDelete.status, 200);
            const aliceStillOwns = await api('GET', '/api/shop/cart', aliceToken);
            assert.equal(aliceStillOwns.data.length, 1);

            await api('POST', '/api/shop/cart', bobToken, { item_id: shopItem.id, quantity: 1 });
            await api('DELETE', `/api/shop/cart/${aliceCartId}`, aliceToken);
            const [aliceAfter, bobAfter] = await Promise.all([
                api('GET', '/api/shop/cart', aliceToken),
                api('GET', '/api/shop/cart', bobToken)
            ]);
            assert.equal(aliceAfter.data.length, 0);
            assert.equal(bobAfter.data.length, 1);
        });

        await t.test('stipend submission and review use the documented lifecycle', async () => {
            const applied = await api('POST', '/api/stipends/apply', aliceToken, {
                stipendId: stipend.id,
                studentDetails: { gpa: 5.0, institution: 'DEMO DATA — Test College' },
                financialInfo: { monthlyIncome: 1000 },
                guardianInfo: { name: 'Synthetic Guardian' },
                bankDetails: { account: 'DEMO-ACCOUNT' }
            });
            assert.equal(applied.status, 200, JSON.stringify(applied.data));

            const [[application]] = await db.query(
                'SELECT * FROM stipend_applications WHERE application_no = ?',
                [applied.data.applicationNo]
            );
            assert.equal(application.status, 'Submitted');

            const underReview = await api(
                'PUT',
                `/api/admin/stipend-applications/${application.id}/status`,
                adminToken,
                { status: 'Under Review' }
            );
            assert.equal(underReview.status, 200);
            const approved = await api(
                'PUT',
                `/api/admin/stipend-applications/${application.id}/status`,
                adminToken,
                { status: 'Approved' }
            );
            assert.equal(approved.status, 200);
            const [[reviewed]] = await db.query('SELECT status FROM stipend_applications WHERE id = ?', [application.id]);
            assert.equal(reviewed.status, 'Approved');
        });

        await t.test('NID document lookup works while citizen_id stays deliberately unresolved', async () => {
            const documents = await api('GET', '/api/dashboard/documents', aliceToken);
            assert.equal(documents.status, 200, JSON.stringify(documents.data));
            assert.equal(documents.data.nid.nid_number, alice.nid);
            assert.equal(documents.data.nid.citizen_id, null);

            const [[constraint]] = await db.query(
                `SELECT COUNT(*) AS count
                 FROM information_schema.REFERENTIAL_CONSTRAINTS
                 WHERE CONSTRAINT_SCHEMA = DATABASE()
                   AND TABLE_NAME = 'nid_cards'
                   AND CONSTRAINT_NAME = 'nid_cards_ibfk_1'`
            );
            assert.equal(constraint.count, 0);
        });

        await t.test('land tax preserves required applicant identity and registered-user relationship', async () => {
            await db.query(
                `INSERT INTO landtax (
                    transaction_id, user_id, applicant_name, nid, mobile,
                    division_id, district_id, upazila_id, khatian_no, dag_no,
                    land_type, land_size, tax_amount, payment_status
                 ) VALUES (
                    'TST-LANDTAX-1', ?, ?, ?, '01990000001', ?, ?, ?,
                    'TST-TAX-KHATIAN', 'TST-TAX-DAG', 'Residential', 1, 100, 'Pending'
                 )`,
                [alice.id, alice.name, alice.nid, geo.division_id, geo.district_id, geo.upazila_id]
            );
            const [[row]] = await db.query("SELECT * FROM landtax WHERE transaction_id = 'TST-LANDTAX-1'");
            assert.equal(row.user_id, alice.id);
            assert.equal(row.applicant_name, alice.name);
        });

        await t.test('invalid mutation amounts are rejected at the authenticated route', async () => {
            await insertLand('TST-VALIDATION', 'TST-VALIDATION-DAG', 10);
            for (const amount of ['not-a-number', 0, -1, 11]) {
                const result = await api('POST', '/api/departments/land/mutation_v2', aliceToken, {
                    divId: geo.division_id,
                    distId: geo.district_id,
                    upaId: geo.upazila_id,
                    appNid: alice.nid,
                    buyerNid: bob.nid,
                    khatian: 'TST-VALIDATION',
                    dag: 'TST-VALIDATION-DAG',
                    amount,
                    price: 1000,
                    deed: 'TST-VALIDATION-DEED',
                    ownType: 'Own'
                });
                assert.equal(result.status, 400, `amount ${amount} should be rejected`);
            }
        });

        await t.test('full transfer is atomic, precise, authorized, and idempotent', async () => {
            const khatian = 'TST-FULL';
            const dag = 'TST-FULL-DAG';
            await insertLand(khatian, dag, 10);
            const mutation = await submitMutation(khatian, dag, 10);

            await db.query(
                `INSERT INTO service_requests (user_id, service_type, details, status)
                 VALUES (?, 'Land Mutation', 'ID: UNRELATED-TRACKING - Must remain pending', 'pending')`,
                [alice.id]
            );

            const unauthorized = await approveMutation(mutation.id, aliceToken);
            assert.equal(unauthorized.status, 403);
            const [[stillPending]] = await db.query('SELECT status FROM land_mutations_v2 WHERE id = ?', [mutation.id]);
            assert.equal(stillPending.status, 'Pending');

            const [[notificationBefore]] = await db.query(
                'SELECT COALESCE(MAX(id), 0) AS id FROM notifications WHERE user_id = ?',
                [alice.id]
            );
            const approved = await approveMutation(mutation.id);
            assert.equal(approved.status, 200, JSON.stringify(approved.data));

            const [[sellerCount]] = await db.query(
                'SELECT COUNT(*) AS count FROM my_land_record WHERE user_id = ? AND khatian_no = ? AND dag_no = ?',
                [alice.id, khatian, dag]
            );
            const [buyerRows] = await db.query(
                'SELECT land_size FROM my_land_record WHERE user_id = ? AND khatian_no = ? AND dag_no = ?',
                [bob.id, khatian, dag]
            );
            assert.equal(sellerCount.count, 0);
            assert.equal(buyerRows.length, 1);
            assert.equal(Number(buyerRows[0].land_size), 10);

            const [[linked]] = await db.query(
                `SELECT status FROM service_requests
                 WHERE user_id = ? AND details LIKE CONCAT('ID: ', ?, ' -%')`,
                [alice.id, mutation.tracking_number]
            );
            const [[unrelated]] = await db.query(
                "SELECT status FROM service_requests WHERE details = 'ID: UNRELATED-TRACKING - Must remain pending'"
            );
            assert.equal(linked.status, 'approved');
            assert.equal(unrelated.status, 'pending');

            const [newNotifications] = await db.query(
                'SELECT message FROM notifications WHERE user_id = ? AND id > ? ORDER BY id',
                [alice.id, notificationBefore.id]
            );
            assert.deepEqual(newNotifications.map(row => row.message), [
                'Your land mutation request has been approved!'
            ]);

            const [[updateAudit]] = await db.query(
                `SELECT COUNT(*) AS count FROM audit_log
                 WHERE table_name = 'land_mutations_v2' AND record_id = ? AND action = 'UPDATE'`,
                [mutation.id]
            );
            assert.equal(updateAudit.count, 1);

            const repeated = await approveMutation(mutation.id);
            assert.equal(repeated.status, 409);
            const [[buyerAfterRepeat]] = await db.query(
                'SELECT COUNT(*) AS count, SUM(land_size) AS area FROM my_land_record WHERE user_id = ? AND khatian_no = ? AND dag_no = ?',
                [bob.id, khatian, dag]
            );
            assert.equal(buyerAfterRepeat.count, 1);
            assert.equal(Number(buyerAfterRepeat.area), 10);
        });

        await t.test('partial transfer retains the exact seller remainder', async () => {
            const khatian = 'TST-PARTIAL';
            const dag = 'TST-PARTIAL-DAG';
            await insertLand(khatian, dag, 100);
            const mutation = await submitMutation(khatian, dag, 30);
            const approved = await approveMutation(mutation.id);
            assert.equal(approved.status, 200, JSON.stringify(approved.data));

            const [[sellerLand]] = await db.query(
                'SELECT land_size FROM my_land_record WHERE user_id = ? AND khatian_no = ? AND dag_no = ?',
                [alice.id, khatian, dag]
            );
            const [buyerLand] = await db.query(
                'SELECT land_size FROM my_land_record WHERE user_id = ? AND khatian_no = ? AND dag_no = ?',
                [bob.id, khatian, dag]
            );
            assert.equal(Number(sellerLand.land_size), 70);
            assert.equal(buyerLand.length, 1);
            assert.equal(Number(buyerLand[0].land_size), 30);
        });

        await t.test('concurrent approvals cannot transfer more than current ownership', async () => {
            const khatian = 'TST-CONCURRENT';
            const dag = 'TST-CONCURRENT-DAG';
            await insertLand(khatian, dag, 100);
            const first = await submitMutation(khatian, dag, 60, bob);
            const second = await submitMutation(khatian, dag, 60, carol);

            const results = await Promise.all([
                approveMutation(first.id),
                approveMutation(second.id)
            ]);
            assert.deepEqual(results.map(result => result.status).sort(), [200, 500]);

            const [[sellerLand]] = await db.query(
                'SELECT land_size FROM my_land_record WHERE user_id = ? AND khatian_no = ? AND dag_no = ?',
                [alice.id, khatian, dag]
            );
            const [[buyerTotal]] = await db.query(
                `SELECT COUNT(*) AS count, COALESCE(SUM(land_size), 0) AS area
                 FROM my_land_record
                 WHERE user_id IN (?, ?) AND khatian_no = ? AND dag_no = ?`,
                [bob.id, carol.id, khatian, dag]
            );
            const [mutations] = await db.query(
                'SELECT status FROM land_mutations_v2 WHERE id IN (?, ?) ORDER BY id',
                [first.id, second.id]
            );
            assert.equal(Number(sellerLand.land_size), 40);
            assert.equal(buyerTotal.count, 1);
            assert.equal(Number(buyerTotal.area), 60);
            assert.deepEqual(mutations.map(row => row.status).sort(), ['Approved', 'Pending']);
        });

        await t.test('database trigger rejects bypassed invalid amounts without partial writes', async () => {
            const invalidAmounts = ['not-a-number', '0', '-1', '11'];
            for (let index = 0; index < invalidAmounts.length; index += 1) {
                const khatian = `TST-TRIGGER-INVALID-${index}`;
                const dag = `TST-TRIGGER-INVALID-DAG-${index}`;
                await insertLand(khatian, dag, 10);
                const mutation = await insertDirectMutation(khatian, dag, invalidAmounts[index]);
                const result = await approveMutation(mutation.id);
                assert.equal(result.status, 500, `trigger should reject ${invalidAmounts[index]}`);

                const [[state]] = await db.query('SELECT status FROM land_mutations_v2 WHERE id = ?', [mutation.id]);
                const [[sellerLand]] = await db.query(
                    'SELECT land_size FROM my_land_record WHERE user_id = ? AND khatian_no = ? AND dag_no = ?',
                    [alice.id, khatian, dag]
                );
                const [[buyerLand]] = await db.query(
                    'SELECT COUNT(*) AS count FROM my_land_record WHERE user_id = ? AND khatian_no = ? AND dag_no = ?',
                    [bob.id, khatian, dag]
                );
                assert.equal(state.status, 'Pending');
                assert.equal(Number(sellerLand.land_size), 10);
                assert.equal(buyerLand.count, 0);
            }
        });

        await t.test('ambiguous service-request matching aborts and rolls back approval', async () => {
            const khatian = 'TST-AMBIGUOUS';
            const dag = 'TST-AMBIGUOUS-DAG';
            await insertLand(khatian, dag, 20);
            const mutation = await submitMutation(khatian, dag, 10);
            const [[linked]] = await db.query(
                `SELECT details FROM service_requests
                 WHERE user_id = ? AND details LIKE CONCAT('ID: ', ?, ' -%')`,
                [alice.id, mutation.tracking_number]
            );
            await db.query(
                `INSERT INTO service_requests (user_id, service_type, details, status)
                 VALUES (?, 'Land Mutation', ?, 'pending')`,
                [alice.id, linked.details]
            );

            const result = await approveMutation(mutation.id);
            assert.equal(result.status, 500);

            const [[state]] = await db.query('SELECT status FROM land_mutations_v2 WHERE id = ?', [mutation.id]);
            const [[sellerLand]] = await db.query(
                'SELECT land_size FROM my_land_record WHERE user_id = ? AND khatian_no = ? AND dag_no = ?',
                [alice.id, khatian, dag]
            );
            const [[buyerLand]] = await db.query(
                'SELECT COUNT(*) AS count FROM my_land_record WHERE user_id = ? AND khatian_no = ? AND dag_no = ?',
                [bob.id, khatian, dag]
            );
            const [[requestStates]] = await db.query(
                `SELECT COUNT(*) AS total,
                        SUM(status = 'pending') AS pending_count,
                        SUM(status = 'approved') AS approved_count
                 FROM service_requests WHERE user_id = ? AND details = ?`,
                [alice.id, linked.details]
            );
            assert.equal(state.status, 'Pending');
            assert.equal(Number(sellerLand.land_size), 20);
            assert.equal(buyerLand.count, 0);
            assert.equal(requestStates.total, 2);
            assert.equal(Number(requestStates.pending_count), 2);
            assert.equal(Number(requestStates.approved_count), 0);
        });

        await t.test('notification schema is compatible and routine deferral is explicit', async () => {
            const [notificationColumns] = await db.query(
                `SELECT COLUMN_NAME FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications'
                 ORDER BY ORDINAL_POSITION`
            );
            const names = notificationColumns.map(row => row.COLUMN_NAME);
            assert.equal(names.includes('message'), true);
            assert.equal(names.includes('title'), false);

            const [migrationVersions] = await db.query(
                `SELECT version FROM nationx_schema_migrations
                 WHERE version IN ('004', '005') ORDER BY version`
            );
            if (migrationVersions.some(row => row.version === '005')) {
                const [[limitation]] = await db.query(
                    `SELECT COUNT(*) AS count FROM nationx_installation_limitations
                     WHERE limitation_code = 'ROUTINES_DEFERRED_MYSQL_PROC'`
                );
                assert.equal(limitation.count, 1);
            } else {
                assert.deepEqual(migrationVersions.map(row => row.version), ['004']);
            }
        });
    } finally {
        await cleanSyntheticTestWrites();
        await new Promise((resolve, reject) => {
            server.close(error => error ? reject(error) : resolve());
        });
        await db.end();
    }
});
