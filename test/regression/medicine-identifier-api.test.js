'use strict';

const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const sharp = require('sharp');

process.env.DB_NAME = 'central_govt_db_test';
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
if (process.env.DB_NAME !== 'central_govt_db_test') throw new Error('Medicine Identifier tests refuse to run outside central_govt_db_test');

const db = require('../../src/config/db');
const medicineRoutes = require('../../src/routes/medicineRoutes');
const scanModule = require('../../src/routes/medicineScanRoutes');
const { MockExtractionProvider } = require('../../src/services/medicineIdentifier/provider');
const catalogue = require('../../src/services/medicineIdentifier/catalogue');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
let server;
let baseUrl;
let alice;
let bob;
let aliceToken;
let bobToken;

function tokenFor(user) { return jwt.sign({ id: user.id, username: user.name, nid: user.nid }, JWT_SECRET, { expiresIn: '1h' }); }

async function jsonRequest(method, route, token, body) {
    const response = await fetch(`${baseUrl}${route}`, {
        method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    const data = await response.json();
    return { status: response.status, data };
}

async function uploadScan(token, { mode = 'prescription', consent = true, files = 1, spoof = false } = {}) {
    const form = new FormData();
    form.set('mode', mode);
    form.set('consent', String(consent));
    const png = await sharp({ create: { width: 800, height: 450, channels: 3, background: '#ffffff' } }).png().toBuffer();
    for (let index = 0; index < files; index += 1) form.append('images', new Blob([png], { type: spoof ? 'image/jpeg' : 'image/png' }), `synthetic-${index}.png`);
    const response = await fetch(`${baseUrl}/api/medicine-scans`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
    return { status: response.status, data: await response.json() };
}

async function cleanup() {
    if (alice && bob) await db.query('DELETE FROM medicine_scan_sessions WHERE user_id IN (?,?)', [alice.id, bob.id]);
}

test('Medicine Identifier catalogue and scan API regression', async t => {
    [[alice]] = await db.query("SELECT id,name,nid FROM reg_info WHERE email='alice.demo@nationx.test'");
    [[bob]] = await db.query("SELECT id,name,nid FROM reg_info WHERE email='bob.demo@nationx.test'");
    assert.ok(alice && bob);
    aliceToken = tokenFor(alice); bobToken = tokenFor(bob);
    await cleanup();

    const app = express();
    app.use(express.json());
    app.use('/api/medicines', medicineRoutes);
    app.use('/api/medicine-scans', scanModule.createMedicineScanRouter({ provider: new MockExtractionProvider(), scanLimit: 1000 }));
    await new Promise(resolve => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; resolve(); }); });
    try {
        await t.test('authentication, filters, pagination and Tier C exclusion', async () => {
            assert.ok([401, 403].includes((await jsonRequest('GET', '/api/medicines/search?brand=A-Pak')).status));
            const result = await jsonRequest('GET', '/api/medicines/search?brand=A-Pak&strength=100%20mg&form=tablet&limit=5', aliceToken);
            assert.equal(result.status, 200);
            assert.ok(result.data.medicines.length > 0 && result.data.medicines.length <= 5);
            assert.ok(result.data.medicines.every(row => ['A', 'B'].includes(row.tier)));
            assert.ok(result.data.medicines.every(row => row.identification_eligible));
            const injection = await jsonRequest('GET', `/api/medicines/search?brand=${encodeURIComponent("A-Pak' OR 1=1 --")}`, aliceToken);
            assert.equal(injection.status, 200);
            const [[stillThere]] = await db.query('SELECT COUNT(*) count FROM medicines');
            assert.equal(Number(stillThere.count), 53987);
            const [[tierC]] = await db.query("SELECT brand_name,generic_original,strength_original FROM medicines WHERE tier='C' LIMIT 1");
            const hidden = await jsonRequest('GET', `/api/medicines/search?brand=${encodeURIComponent(tierC.brand_name)}&strength=${encodeURIComponent(tierC.strength_original)}`, aliceToken);
            assert.ok(hidden.data.medicines.every(row => row.tier !== 'C'));
            const fuzzy = await jsonRequest('GET', '/api/medicines/search?brand=A-Pak', aliceToken);
            const exact = fuzzy.data.medicines.find(row => row.brand_name === 'A-Pak' && row.strength === '100 mg');
            const directRegistration = await jsonRequest('GET', `/api/medicines/search?registration=${encodeURIComponent(exact.registrations[0].reference)}`, aliceToken);
            assert.equal(directRegistration.data.medicines[0].medicine_id, exact.medicine_id);
            const fuzzyCandidates = await catalogue.matchExtracted({ brand_name_candidate: 'A-Pka', generic_name_candidate: 'Aceclofenac', strength_text: '100 mg', dosage_form: 'Tablet' }, db);
            assert.ok(fuzzyCandidates.some(candidate => candidate.medicine.medicine_id === exact.medicine_id));
            assert.ok(fuzzyCandidates.every(candidate => candidate.medicine.tier !== 'C'));
        });

        await t.test('deterministic detail, package and alternative constraints', async () => {
            const search = await jsonRequest('GET', '/api/medicines/search?brand=A-Pak&strength=100%20mg&form=tablet', aliceToken);
            const original = search.data.medicines.find(row => row.brand_name === 'A-Pak' && row.tier === 'A');
            assert.ok(original);
            const detail = await jsonRequest('GET', `/api/medicines/${original.medicine_id}`, aliceToken);
            assert.equal(detail.status, 200);
            assert.ok(detail.data.ingredients.length);
            assert.ok(!('reason_codes' in detail.data));
            const packages = await jsonRequest('GET', `/api/medicines/${original.medicine_id}/packages`, aliceToken);
            assert.equal(packages.status, 200);
            assert.ok(packages.data.packages.every(row => !('source_record_id' in row)));
            const alternatives = await jsonRequest('GET', `/api/medicines/${original.medicine_id}/alternatives?quantity=10`, aliceToken);
            assert.equal(alternatives.status, 200);
            assert.ok(alternatives.data.alternatives.length);
            for (const alternative of alternatives.data.alternatives) {
                assert.equal(alternative.medicine.tier, 'A');
                assert.equal(alternative.medicine.intended_use, 'human');
                assert.equal(alternative.medicine.generic_name, original.generic_name);
                assert.equal(alternative.medicine.strength, original.strength);
                assert.equal(alternative.medicine.dosage_form, original.dosage_form);
                assert.match(alternative.label, /Possible lower-cost product/);
            }
        });

        await t.test('secure scan validates consent/content/count and never auto-confirms', async () => {
            assert.ok([401, 403].includes((await uploadScan('', {})).status));
            assert.equal((await uploadScan(aliceToken, { consent: false })).status, 400);
            assert.equal((await uploadScan(aliceToken, { mode: 'package', files: 3 })).status, 400);
            assert.equal((await uploadScan(aliceToken, { spoof: true })).status, 400);
            const created = await uploadScan(aliceToken);
            assert.equal(created.status, 201);
            assert.equal(created.data.status, 'WAITING_CONFIRMATION');
            assert.equal(created.data.provider_name, 'mock');
            assert.equal(created.data.items.length, 1);
            assert.ok(created.data.items[0].candidates.length > 0 && created.data.items[0].candidates.length <= 5);
            assert.equal(created.data.items[0].confirmation, null);
            const [[stored]] = await db.query('SELECT image_hashes,image_metadata FROM medicine_scan_sessions WHERE scan_id=?', [created.data.scan_id]);
            assert.ok(stored.image_hashes);
            assert.ok(!Object.keys(stored).some(key => /image_data|raw_image|buffer/.test(key)));

            const item = created.data.items[0];
            const foreignRead = await jsonRequest('GET', `/api/medicine-scans/${created.data.scan_id}`, bobToken);
            assert.equal(foreignRead.status, 403);
            const confirmed = await jsonRequest('POST', `/api/medicine-scans/${created.data.scan_id}/items/${item.item_id}/confirm`, aliceToken, {
                selection_type: 'CATALOGUE', medicine_id: item.candidates[0].medicine.medicine_id,
                corrections: { total_quantity: 10, brand_name_candidate: 'A-Pak' }
            });
            assert.equal(confirmed.status, 200);
            assert.equal(confirmed.data.items[0].confirmation.selection_type, 'CATALOGUE');
            assert.equal(confirmed.data.items[0].structured_extraction.brand_name_candidate, 'A-Pak');
            assert.equal(confirmed.data.items[0].user_corrections.total_quantity, 10);
            const alternatives = await jsonRequest('GET', `/api/medicine-scans/${created.data.scan_id}/items/${item.item_id}/alternatives`, aliceToken);
            assert.equal(alternatives.status, 200);
            assert.ok(alternatives.data.warnings.includes('Professional confirmation is required'));
            assert.equal((await jsonRequest('DELETE', `/api/medicine-scans/${created.data.scan_id}`, bobToken)).status, 403);
            assert.equal((await jsonRequest('DELETE', `/api/medicine-scans/${created.data.scan_id}`, aliceToken)).status, 200);
            assert.equal((await jsonRequest('GET', `/api/medicine-scans/${created.data.scan_id}`, aliceToken)).status, 404);
        });
    } finally {
        await cleanup();
        await new Promise(resolve => server.close(resolve));
        await db.end();
    }
});
