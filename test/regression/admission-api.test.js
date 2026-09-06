'use strict';

const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

process.env.DB_NAME = 'central_govt_db_test';
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
if (process.env.DB_NAME !== 'central_govt_db_test') throw new Error('Admission API tests refuse to run outside central_govt_db_test');

const db = require('../../src/config/db');
const universityRoutes = require('../../src/routes/universityRoutes');
const marker = 'TST React Admission';
const roll = 'TST-ADM-2026';
let server;
let baseUrl;
let postId;

async function request(method, route, body) {
    const response = await fetch(`${baseUrl}${route}`, { method, headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
    const text = await response.text(); let data = null;
    if (text) { try { data = JSON.parse(text); } catch { data = text; } }
    return { status: response.status, data, location: response.headers.get('location') };
}

async function cleanup() {
    await db.query('DELETE FROM university_applications WHERE hsc_roll = ?', [roll]);
    if (postId) await db.query('DELETE FROM admission_posts WHERE id = ?', [postId]);
    await db.query('DELETE FROM admission_posts WHERE unit_name = ?', [marker]);
    await db.query('DELETE FROM hsc_results WHERE roll_number = ? AND exam_year = 2026', [roll]);
}

test('React admission/application API regression', async t => {
    try {
        await cleanup();
        const [[university]] = await db.query('SELECT id FROM universities WHERE is_active = 1 ORDER BY id LIMIT 1');
        const [[board]] = await db.query('SELECT id FROM education_boards ORDER BY id LIMIT 1');
        assert.ok(university && board, 'university and education board reference data must exist');
        await db.query(`INSERT INTO hsc_results (roll_number,registration_number,exam_year,student_name,father_name,mother_name,date_of_birth,institution_name,board_id,exam_group,gpa,result_status) VALUES (?,?,'2026',?,?,?,'2008-01-01',?,?,?,'5.00','Passed')`, [roll, 'TST-ADM-REG', `${marker} Student`, 'Synthetic Father', 'Synthetic Mother', `${marker} College`, board.id, 'Science']);
        const [post] = await db.query(`INSERT INTO admission_posts (university_id,session,unit_code,unit_name,min_gpa,required_group,application_fee,start_date,end_date,total_seats,status,requirements) VALUES (?,'2026-27','TST',?, '4.00','Science','500.00',CURDATE(),DATE_ADD(CURDATE(), INTERVAL 30 DAY),50,'Active','Synthetic test fixture')`, [university.id, marker]);
        postId = post.insertId;
        const app = express(); app.use(express.json()); app.use('/api/university', universityRoutes);
        await new Promise(resolve => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; resolve(); }); });

        await t.test('admission list filters and detail keep the public catalogue contract', async () => {
            const list = await request('GET', `/api/university/admissions?status=Active&university=${university.id}`);
            assert.equal(list.status, 200); assert.ok(list.data.some(row => row.id === postId && row.unit_name === marker));
            const detail = await request('GET', `/api/university/admissions/${postId}`);
            assert.equal(detail.status, 200); assert.equal(detail.data.application_fee, '500.00');
        });

        await t.test('HSC verification preserves eligibility and exact synthetic identity fields', async () => {
            const verified = await request('GET', `/api/university/verify-hsc/${roll}/2026?admissionId=${postId}`);
            assert.equal(verified.status, 200); assert.equal(verified.data.eligible, true);
            assert.equal(verified.data.hscData.student_name, `${marker} Student`); assert.equal(verified.data.hscData.gpa, '5.00');
        });

        await t.test('application remains Draft/Pending, rejects duplicate, and is retrievable by established paths', async () => {
            const payload = { admissionPostId: postId, hscRoll: roll, hscYear: 2026, mobile: '01700000000', email: 'synthetic@example.test', presentAddress: 'DEMO DATA' };
            const created = await request('POST', '/api/university/apply', payload);
            assert.equal(created.status, 200); assert.match(created.data.applicationId, /-TST-2026-/); assert.equal(created.data.paymentAmount, '500.00');
            assert.equal((await request('POST', '/api/university/apply', payload)).status, 400);
            const application = await request('GET', `/api/university/application/${created.data.applicationId}`);
            assert.equal(application.status, 200); assert.equal(application.data.application_status, 'Draft'); assert.equal(application.data.payment_status, 'Pending');
            const mine = await request('GET', `/api/university/my-applications/${roll}/2026`);
            assert.equal(mine.status, 200); assert.equal(mine.data.filter(row => row.application_id === created.data.applicationId).length, 1);
        });

        await t.test('missing and invalid application inputs fail without payment state changes', async () => {
            assert.equal((await request('POST', '/api/university/apply', { admissionPostId: postId })).status, 400);
            assert.equal((await request('GET', '/api/university/verify-hsc/UNKNOWN/2026?admissionId=999999')).status, 404);
            const [[state]] = await db.query('SELECT payment_status,application_status FROM university_applications WHERE hsc_roll = ?', [roll]);
            assert.deepEqual(state, { payment_status: 'Pending', application_status: 'Draft' });
        });
    } finally {
        await cleanup();
        if (server) await new Promise(resolve => server.close(resolve));
        await db.end();
    }
});
