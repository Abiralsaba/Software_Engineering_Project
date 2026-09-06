'use strict';

const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');

process.env.DB_NAME = 'central_govt_db_test';
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
if (process.env.DB_NAME !== 'central_govt_db_test') throw new Error('Tax/education API tests refuse to run outside central_govt_db_test');

const db = require('../../src/config/db');
const taxRoutes = require('../../src/routes/taxRoutes');
const educationRoutes = require('../../src/routes/educationRoutes');
const stipendRoutes = require('../../src/routes/stipendRoutes');
const secret = process.env.JWT_SECRET || 'your-secret-key';
const marker = 'TST React Tax Education';
let server;
let baseUrl;
let alice;
let bob;
let aliceToken;
let bobToken;
let stipend;

function tokenFor(user) { return jwt.sign({ id: user.id, username: user.name, nid: user.nid }, secret, { expiresIn: '1h' }); }

async function request(method, route, token, body) {
    const response = await fetch(`${baseUrl}${route}`, {
        method,
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await response.text();
    let data = null;
    if (text) { try { data = JSON.parse(text); } catch { data = text; } }
    return { status: response.status, data };
}

async function cleanup() {
    if (!alice || !bob) return;
    const ids = [alice.id, bob.id];
    await db.query('DELETE FROM stipend_applications WHERE user_id IN (?) AND application_no LIKE ?', [ids, 'STP-%']);
    await db.query('DELETE FROM nbr_tax_payments WHERE user_id IN (?) AND transaction_id LIKE ?', [ids, `${marker}%`]);
    await db.query('DELETE FROM nbr_tax_returns WHERE user_id IN (?) AND assessment_year = ?', [ids, 'TST-2026-27']);
    await db.query('DELETE FROM nbr_tax_notices WHERE user_id IN (?) AND subject LIKE ?', [ids, `${marker}%`]);
    await db.query('DELETE FROM nbr_tax_challan WHERE user_id IN (?) AND tax_zone = ?', [ids, marker]);
    await db.query('DELETE FROM nbr_vat_registrations WHERE user_id IN (?) AND business_name LIKE ?', [ids, `${marker}%`]);
    await db.query('DELETE FROM nbr_tin_registrations WHERE user_id IN (?) AND taxpayer_name LIKE ?', [ids, `${marker}%`]);
}

test('React tax/education API regression', async t => {
    [[alice]] = await db.query("SELECT id, name, nid FROM reg_info WHERE email='alice.demo@nationx.test'");
    [[bob]] = await db.query("SELECT id, name, nid FROM reg_info WHERE email='bob.demo@nationx.test'");
    [[stipend]] = await db.query('SELECT id, min_gpa, max_income FROM stipends WHERE is_active = TRUE ORDER BY id LIMIT 1');
    assert.ok(alice && bob && stipend, 'synthetic identities and an active stipend must exist');
    aliceToken = tokenFor(alice); bobToken = tokenFor(bob);
    await cleanup();

    const app = express(); app.use(express.json());
    app.use('/api/tax', taxRoutes); app.use('/api/education', educationRoutes); app.use('/api/stipends', stipendRoutes);
    await new Promise(resolve => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; resolve(); }); });

    try {
        await t.test('tax and stipend endpoints require auth while education result lookups remain public', async () => {
            for (const route of ['/api/tax/dashboard', '/api/stipends', '/api/stipends/my-applications']) {
                const denied = await request('GET', route);
                assert.ok([401, 403].includes(denied.status), `${route} must deny missing auth`);
            }
            const result = await request('GET', '/api/education/results/ssc/2024/234567');
            assert.equal(result.status, 200);
            assert.equal(result.data.student.rollNumber, '234567');
            assert.equal((await request('GET', '/api/education/results/invalid/2024/1')).status, 400);
            assert.equal((await request('GET', '/api/education/results/ssc/1900/not-found')).status, 404);
        });

        await t.test('TIN and VAT reject duplicate active applications and remain citizen-scoped', async () => {
            const tinPayload = { taxpayer_name: `${marker} Alice`, father_name: 'Synthetic', mother_name: 'Synthetic', date_of_birth: '1990-01-01', nid_number: alice.nid, mobile: '01700000001', present_address: 'DEMO DATA', permanent_address: 'DEMO DATA', taxpayer_type: 'Individual', source_of_income: 'Synthetic' };
            assert.equal((await request('POST', '/api/tax/tin/apply', aliceToken, tinPayload)).status, 200);
            assert.equal((await request('POST', '/api/tax/tin/apply', aliceToken, tinPayload)).status, 400);
            const [aliceTin, bobTin] = await Promise.all([request('GET', '/api/tax/tin/status', aliceToken), request('GET', '/api/tax/tin/status', bobToken)]);
            assert.equal(aliceTin.data.taxpayer_name, `${marker} Alice`);
            assert.notEqual(bobTin.data?.taxpayer_name, `${marker} Alice`);

            const vatPayload = { business_name: `${marker} Business`, business_type: 'Service Provider', business_address: 'DEMO DATA', annual_turnover: 1000, contact_person: 'Synthetic', contact_phone: '01700000001' };
            assert.equal((await request('POST', '/api/tax/vat/register', aliceToken, vatPayload)).status, 200);
            assert.equal((await request('POST', '/api/tax/vat/register', aliceToken, vatPayload)).status, 400);
            assert.equal((await request('GET', '/api/tax/vat/status', aliceToken)).data.business_name, `${marker} Business`);
        });

        await t.test('return computation, pending payment records, and challans preserve owner scope and status meaning', async () => {
            const filed = await request('POST', '/api/tax/returns/file', aliceToken, {
                assessment_year: 'TST-2026-27', income_year: '2025-26', return_type: 'Normal',
                salary_income: 1000000, house_property_income: 0, agriculture_income: 0, business_income: 0,
                capital_gains: 0, other_income: 0, tax_exempted_income: 50000, tax_rebate: 15000,
                tax_paid_advance: 5000, tax_deducted_source: 10000, total_assets: 200000,
                total_liabilities: 50000, total_expenditure: 100000
            });
            assert.equal(filed.status, 200);
            assert.equal(filed.data.tax_computed.total_income, 1000000);
            assert.equal(filed.data.tax_computed.taxable_income, 950000);
            assert.equal(filed.data.tax_computed.tax_on_income, 60000);
            assert.equal(filed.data.tax_computed.net_tax, 45000);
            assert.equal(filed.data.tax_computed.tax_due, 30000);
            const bobReturns = await request('GET', '/api/tax/returns', bobToken);
            assert.ok(!bobReturns.data.some(row => row.submission_ref === filed.data.submission_ref));
            const aliceReturn = (await request('GET', '/api/tax/returns', aliceToken)).data.find(row => row.submission_ref === filed.data.submission_ref);
            assert.ok(aliceReturn);
            assert.equal((await request('POST', '/api/tax/payments/pay', bobToken, {
                return_id: aliceReturn.id, payment_type: 'Income Tax', amount: 1,
                transaction_id: `${marker} FOREIGN`, fiscal_year: '2025-26'
            })).status, 403);

            const payment = await request('POST', '/api/tax/payments/pay', aliceToken, { payment_type: 'Income Tax', amount: 30000, payment_method: 'Bank Transfer', bank_name: 'DEMO DATA Bank', branch_name: 'DEMO', transaction_id: `${marker} TXN`, fiscal_year: '2025-26' });
            assert.equal(payment.status, 200);
            const alicePayments = await request('GET', '/api/tax/payments', aliceToken);
            const record = alicePayments.data.find(row => row.receipt_no === payment.data.receipt_no);
            assert.equal(record.status, 'Pending');
            assert.ok(!(await request('GET', '/api/tax/payments', bobToken)).data.some(row => row.receipt_no === payment.data.receipt_no));

            const challan = await request('POST', '/api/tax/challan', aliceToken, { tin_number: 'DEMO-TIN', assessment_year: '2026-27', tax_zone: marker, deposit_type: 'Income Tax', amount: 30000, bank_name: 'DEMO DATA Bank', branch_name: 'DEMO' });
            assert.equal(challan.status, 200);
            const row = (await request('GET', '/api/tax/challan', aliceToken)).data.find(item => item.challan_no === challan.data.challan_no);
            assert.equal(row.status, 'Generated');
        });

        await t.test('notice read updates affect only the authenticated citizen record', async () => {
            const [insert] = await db.query("INSERT INTO nbr_tax_notices (user_id,notice_type,subject,message,priority,status) VALUES (?,'Information',?,?,'Medium','Issued')", [alice.id, `${marker} Notice`, 'DEMO DATA notice']);
            assert.equal((await request('PUT', `/api/tax/notices/${insert.insertId}/read`, bobToken)).status, 200);
            let [[row]] = await db.query('SELECT status FROM nbr_tax_notices WHERE id=?', [insert.insertId]);
            assert.equal(row.status, 'Issued');
            assert.equal((await request('PUT', `/api/tax/notices/${insert.insertId}/read`, aliceToken)).status, 200);
            [[row]] = await db.query('SELECT status FROM nbr_tax_notices WHERE id=?', [insert.insertId]);
            assert.equal(row.status, 'Read');
        });

        await t.test('stipend eligibility, duplicate prevention, workflow status, and citizen isolation hold', async () => {
            const eligibleGpa = Math.max(Number(stipend.min_gpa || 0), 5);
            const eligibleIncome = stipend.max_income ? Math.min(Number(stipend.max_income), 1000) : 1000;
            const payload = { stipendId: stipend.id, studentDetails: { gpa: eligibleGpa, institution: 'DEMO DATA College' }, financialInfo: { monthlyIncome: eligibleIncome, members: 4, land: 0 }, guardianInfo: {}, bankDetails: { method: 'Mobile Banking', accountNo: '01700000000' } };
            const first = await request('POST', '/api/stipends/apply', aliceToken, payload);
            assert.equal(first.status, 200);
            assert.equal((await request('POST', '/api/stipends/apply', aliceToken, payload)).status, 400);
            const aliceRows = await request('GET', '/api/stipends/my-applications', aliceToken);
            const created = aliceRows.data.find(row => row.application_no === first.data.applicationNo);
            assert.equal(created.status, 'Submitted');
            assert.ok(!(await request('GET', '/api/stipends/my-applications', bobToken)).data.some(row => row.application_no === first.data.applicationNo));
        });
    } finally {
        await cleanup();
        await new Promise(resolve => server.close(resolve));
        await db.end();
    }
});
