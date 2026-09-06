'use strict';

const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');

process.env.DB_NAME = 'central_govt_db_test';
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

if (process.env.DB_NAME !== 'central_govt_db_test') {
    throw new Error('Health/water API tests refuse to run outside central_govt_db_test');
}

const db = require('../../src/config/db');
const healthRoutes = require('../../src/routes/healthRoutes');
const waterRoutes = require('../../src/routes/waterRoutes');
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const marker = 'TST React Health Water';
let server;
let baseUrl;
let alice;
let bob;
let aliceToken;
let bobToken;

function tokenFor(user) {
    return jwt.sign({ id: user.id, username: user.name, nid: user.nid }, JWT_SECRET, { expiresIn: '1h' });
}

async function request(method, route, token, body) {
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
        try { data = JSON.parse(text); } catch { data = text; }
    }
    return { status: response.status, data };
}

async function cleanup() {
    if (!alice || !bob) return;
    const ids = [alice.id, bob.id];
    await db.query('DELETE FROM water_bill_payments WHERE user_id IN (?) AND transaction_id LIKE ?', [ids, `${marker}%`]);
    await db.query('DELETE FROM water_quality_reports WHERE user_id IN (?) AND description LIKE ?', [ids, `${marker}%`]);
    await db.query('DELETE FROM water_complaints WHERE user_id IN (?) AND description LIKE ?', [ids, `${marker}%`]);
    await db.query('DELETE FROM water_connections WHERE user_id IN (?) AND holder_name LIKE ?', [ids, `${marker}%`]);
    await db.query('DELETE FROM health_vaccinations WHERE user_id IN (?) AND vaccine_name LIKE ?', [ids, `${marker}%`]);
    await db.query('DELETE FROM health_appointments WHERE user_id IN (?) AND patient_name LIKE ?', [ids, `${marker}%`]);
    await db.query('DELETE FROM health_ambulance_requests WHERE user_id IN (?) AND patient_name LIKE ?', [ids, `${marker}%`]);
    await db.query('DELETE FROM health_complaints WHERE user_id IN (?) AND description LIKE ?', [ids, `${marker}%`]);
    await db.query('DELETE FROM health_cards WHERE user_id IN (?) AND full_name LIKE ?', [ids, `${marker}%`]);
}

test('React health/water API regression', async t => {
    [[alice]] = await db.query("SELECT id, name, nid FROM reg_info WHERE email = 'alice.demo@nationx.test'");
    [[bob]] = await db.query("SELECT id, name, nid FROM reg_info WHERE email = 'bob.demo@nationx.test'");
    assert.ok(alice && bob, 'synthetic citizen fixtures must exist');
    aliceToken = tokenFor(alice);
    bobToken = tokenFor(bob);
    await cleanup();

    const app = express();
    app.use(express.json());
    app.use('/api/health', healthRoutes);
    app.use('/api/water', waterRoutes);
    await new Promise(resolve => {
        server = app.listen(0, '127.0.0.1', () => {
            baseUrl = `http://127.0.0.1:${server.address().port}`;
            resolve();
        });
    });

    try {
        await t.test('protected service endpoints deny missing authentication while public directories remain public', async () => {
            for (const route of ['/api/health/my-stats', '/api/water/my-stats']) {
                const denied = await request('GET', route);
                assert.ok([401, 403].includes(denied.status), `${route} must deny missing auth`);
            }
            assert.equal((await request('GET', '/api/health/hospitals/browse')).status, 200);
            assert.equal((await request('GET', '/api/water/projects/browse')).status, 200);
        });

        await t.test('health card duplicate prevention and citizen isolation', async () => {
            const payload = {
                full_name: `${marker} Alice`, father_name: 'Synthetic Parent', mother_name: 'Synthetic Parent',
                nid_number: alice.nid, date_of_birth: '1995-01-01', gender: 'Female', blood_group: 'O+',
                phone: '01700000001', emergency_contact: '01700000002', division: 'DEMO DATA — Test Division',
                district: 'DEMO DATA — Test District', upazila: 'DEMO DATA — Test Upazila',
                address: 'DEMO DATA address', allergies: '', chronic_diseases: '', disability: 'None'
            };
            const first = await request('POST', '/api/health/health-card/apply', aliceToken, payload);
            assert.equal(first.status, 200);
            const duplicate = await request('POST', '/api/health/health-card/apply', aliceToken, payload);
            assert.equal(duplicate.status, 400);
            const aliceCards = await request('GET', '/api/health/health-card/my', aliceToken);
            const bobCards = await request('GET', '/api/health/health-card/my', bobToken);
            assert.ok(aliceCards.data.some(row => row.card_number === first.data.card_number));
            assert.ok(!bobCards.data.some(row => row.card_number === first.data.card_number));
        });

        await t.test('health writes remain owner-scoped and appointments cannot be cancelled cross-user', async () => {
            const aliceCards = await request('GET', '/api/health/health-card/my', aliceToken);
            const ownedCard = aliceCards.data.find(row => row.full_name === `${marker} Alice`);
            assert.ok(ownedCard);
            assert.equal((await request('POST', '/api/health/vaccination/register', bobToken, {
                health_card_id: ownedCard.id, vaccine_name: `${marker} Foreign Card`, vaccine_type: 'COVID-19'
            })).status, 403);
            assert.equal((await request('POST', '/api/health/vaccination/register', aliceToken, {
                health_card_id: ownedCard.id, vaccine_name: `${marker} Vaccine`, vaccine_type: 'COVID-19', dose_number: 1,
                vaccination_date: '2026-09-01', vaccination_center: 'DEMO DATA Center'
            })).status, 200);
            const appointment = await request('POST', '/api/health/appointment/book', aliceToken, {
                patient_name: `${marker} Patient`, patient_age: 30, patient_gender: 'Female', phone: '01700000001',
                department: 'Medicine', appointment_date: '2026-09-20', urgency: 'Normal'
            });
            assert.equal(appointment.status, 200);
            const aliceAppointments = await request('GET', '/api/health/appointment/my', aliceToken);
            const created = aliceAppointments.data.find(row => row.patient_name === `${marker} Patient`);
            assert.ok(created);
            assert.equal((await request('PUT', `/api/health/appointment/cancel/${created.id}`, bobToken, {})).status, 400);
            assert.equal((await request('PUT', `/api/health/appointment/cancel/${created.id}`, aliceToken, {})).status, 200);
            assert.equal((await request('POST', '/api/health/ambulance/request', aliceToken, {
                patient_name: `${marker} Ambulance`, phone: '01700000001', emergency_type: 'Accident',
                pickup_address: 'DEMO DATA address', division: 'DEMO DATA — Test Division',
                district: 'DEMO DATA — Test District', urgency: 'Urgent', ambulance_type: 'Basic'
            })).status, 200);
            assert.equal((await request('POST', '/api/health/complaint/submit', aliceToken, {
                complaint_type: 'Hospital Service', hospital_name: 'DEMO DATA Hospital',
                description: `${marker} complaint`, division: 'DEMO DATA — Test Division', district: 'DEMO DATA — Test District'
            })).status, 200);
            const bobActivity = await request('GET', '/api/health/my-activity', bobToken);
            assert.ok(!bobActivity.data.some(row => String(row.type).includes(marker)));
        });

        await t.test('water connection, quality, and complaint writes remain isolated by citizen', async () => {
            const connection = await request('POST', '/api/water/connection/apply', aliceToken, {
                holder_name: `${marker} Holder`, nid_number: alice.nid, phone: '01700000001',
                connection_type: 'Residential', pipe_size: '0.5 inch', division: 'DEMO DATA — Test Division',
                district: 'DEMO DATA — Test District', upazila: 'DEMO DATA — Test Upazila',
                address: 'DEMO DATA address', ward_no: '1', wasa_region: 'DPHE Regional'
            });
            assert.equal(connection.status, 200);
            const aliceConnections = await request('GET', '/api/water/connection/my-connections', aliceToken);
            const bobConnections = await request('GET', '/api/water/connection/my-connections', bobToken);
            assert.ok(aliceConnections.data.some(row => row.connection_number === connection.data.connection_number));
            assert.ok(!bobConnections.data.some(row => row.connection_number === connection.data.connection_number));
            assert.equal((await request('POST', '/api/water/bill/pay', bobToken, {
                connection_number: connection.data.connection_number, billing_month: '2026-08',
                amount: 100, total_amount: 100, payment_method: 'Cash', transaction_id: `${marker} FOREIGN`
            })).status, 403);
            assert.equal((await request('POST', '/api/water/bill/pay', aliceToken, {
                connection_number: connection.data.connection_number, billing_month: '2026-08',
                amount: 100, total_amount: 100, payment_method: 'Cash', transaction_id: `${marker} OWNER`
            })).status, 200);
            assert.equal((await request('POST', '/api/water/quality/report', aliceToken, {
                source_type: 'Tube Well', division: 'DEMO DATA — Test Division', district: 'DEMO DATA — Test District',
                upazila: 'DEMO DATA — Test Upazila', location_details: 'DEMO DATA location', issue_type: 'Iron Content',
                severity: 'Medium', description: `${marker} quality`, affected_people: 3
            })).status, 200);
            assert.equal((await request('POST', '/api/water/complaint/submit', aliceToken, {
                complaint_type: 'Pipeline Leakage', priority: 'High', division: 'DEMO DATA — Test Division',
                district: 'DEMO DATA — Test District', upazila: 'DEMO DATA — Test Upazila',
                address: 'DEMO DATA address', description: `${marker} water complaint`, contact_phone: '01700000001'
            })).status, 200);
            const [bobQuality, bobComplaints] = await Promise.all([
                request('GET', '/api/water/quality/my-reports', bobToken),
                request('GET', '/api/water/complaint/my-complaints', bobToken)
            ]);
            assert.ok(!bobQuality.data.some(row => String(row.description).startsWith(marker)));
            assert.ok(!bobComplaints.data.some(row => String(row.description).startsWith(marker)));
        });
    } finally {
        await cleanup();
        await new Promise(resolve => server.close(resolve));
        await db.end();
    }
});
