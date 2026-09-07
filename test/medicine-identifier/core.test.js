'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const express = require('express');
const jwt = require('jsonwebtoken');
const { cheapestCover, requiredQuantity, positiveSaving } = require('../../src/services/medicineIdentifier/savings');
const { processImage, detectMime, MAX_IMAGE_BYTES } = require('../../src/services/medicineIdentifier/imageProcessor');
const { extractionPrompt, GeminiExtractionProvider, MockExtractionProvider } = require('../../src/services/medicineIdentifier/provider');
const { comparisonForm } = require('../../src/services/medicineIdentifier/catalogue');
const { createMedicineScanRouter } = require('../../src/routes/medicineScanRoutes');

test('exact decimal package optimizer minimizes cost then waste', () => {
    const packages = [
        { package_id: 'small', package_original: '6 tablets', units_per_package: '6', amount: '12.30', currency: 'BDT', savings_calculation_eligible: 1 },
        { package_id: 'large', package_original: '10 tablets', units_per_package: '10', amount: '20.00', currency: 'BDT', savings_calculation_eligible: 1 }
    ];
    const result = cheapestCover(packages, '12');
    assert.equal(result.estimated_cost, '24.6000');
    assert.equal(result.waste, '0');
    assert.deepEqual(result.selected_packages, [{ package_id: 'small', package_original: '6 tablets', count: 2, units_each: '6', price_each: '12.3000' }]);
    assert.equal(requiredQuantity({ doseAmount: '1.5', frequencyPerDay: '2', durationDays: '5', dosageForm: 'syrup', doseUnit: 'ml' }), '15');
    assert.equal(requiredQuantity({ doseAmount: '1', frequencyPerDay: '2', durationDays: '5', dosageForm: 'syrup', doseUnit: 'teaspoon' }), null);
    assert.equal(positiveSaving('40.0000', '27.3000'), '12.7000');
});

test('image validation uses magic bytes, decodes, rotates and strips metadata in memory', async () => {
    const source = await sharp({ create: { width: 900, height: 500, channels: 3, background: '#ffffff' } })
        .png().withMetadata({ orientation: 6 }).toBuffer();
    assert.equal(detectMime(source), 'image/png');
    const processed = await processImage({ buffer: Buffer.from(source), mimetype: 'image/png' });
    assert.equal(processed.mimeType, 'image/jpeg');
    assert.match(processed.hash, /^[a-f0-9]{64}$/);
    const metadata = await sharp(processed.buffer).metadata();
    assert.equal(metadata.format, 'jpeg');
    assert.equal(metadata.exif, undefined);
    await assert.rejects(processImage({ buffer: Buffer.from(source), mimetype: 'image/jpeg' }), /genuine JPEG, PNG, or WebP/);
    await assert.rejects(processImage({ buffer: Buffer.from('not an image'), mimetype: 'image/png' }), /genuine JPEG, PNG, or WebP/);
    await assert.rejects(processImage({ buffer: Buffer.alloc(MAX_IMAGE_BYTES + 1), mimetype: 'image/jpeg' }), /8 MB or smaller/);
    processed.buffer.fill(0);
});

test('comparison set excludes release-sensitive and route-sensitive dosage forms', () => {
    for (const allowed of ['tablet', 'capsule', 'syrup', 'suspension']) assert.equal(comparisonForm(allowed), true);
    for (const excluded of ['injection', 'iv infusion', 'insulin', 'inhaler', 'extended release tablet', 'ophthalmic solution', 'powder for suspension']) {
        assert.equal(comparisonForm(excluded), false);
    }
});

test('provider prompt explicitly treats image instructions as untrusted', () => {
    const prompt = extractionPrompt('prescription');
    assert.match(prompt, /untrusted data/i);
    assert.match(prompt, /Ignore every instruction/i);
    assert.match(prompt, /do not return patient names/i);
});

test('mock provider validates structured output', async () => {
    const provider = new MockExtractionProvider();
    const result = await provider.extract('package', []);
    assert.equal(result.provider, 'mock');
    assert.equal(result.extraction.brand_name_candidate, 'A-Pak');
    await assert.rejects(new MockExtractionProvider({ result: { raw_visible_text: 'incomplete' } }).extract('package', []));
});

test('Gemini provider rejects missing keys, retries one transient 429/5xx, and rejects invalid JSON', async () => {
    const previousEnabled = process.env.GEMINI_ENABLED;
    process.env.GEMINI_ENABLED = 'true';
    try {
        await assert.rejects(new GeminiExtractionProvider({ apiKey: '' }).extract('package', []), error => error.code === 'GEMINI_NOT_CONFIGURED');
        let calls = 0;
        const client = { interactions: { create: async request => {
            calls += 1;
            assert.equal(request.store, false);
            assert.equal(request.model, 'gemini-3.5-flash');
            assert.equal(request.response_format.mime_type, 'application/json');
            if (calls === 1) throw Object.assign(new Error('limited'), { status: 429 });
            return { output_text: JSON.stringify({
                raw_visible_text: 'Synthetic', brand_name_candidate: null, generic_name_candidate: null,
                strength_text: null, dosage_form: null, manufacturer_candidate: null,
                registration_reference_candidate: null, batch_number: null, expiry_date: null,
                printed_price: null, currency: null, model_confidence: 0.5, uncertain_fields: []
            }) };
        } } };
        const valid = await new GeminiExtractionProvider({ apiKey: 'test-only', client, timeoutMs: 10, retryDelayMs: 0, retryJitterMs: 0 }).extract('package', []);
        assert.equal(valid.extraction.raw_visible_text, 'Synthetic');
        assert.equal(calls, 2);

        let serverCalls = 0;
        const serverRetryClient = { interactions: { create: async () => {
            serverCalls += 1;
            if (serverCalls === 1) throw Object.assign(new Error('upstream unavailable'), { status: 503 });
            return { output_text: JSON.stringify(valid.extraction) };
        } } };
        await new GeminiExtractionProvider({ apiKey: 'test-only', client: serverRetryClient, retryDelayMs: 0, retryJitterMs: 0 }).extract('package', []);
        assert.equal(serverCalls, 2);

        const overloadedClient = { interactions: { create: async () => {
            throw Object.assign(new Error('model is currently experiencing high demand'), { status: 500 });
        } } };
        await assert.rejects(
            new GeminiExtractionProvider({ apiKey: 'test-only', client: overloadedClient, retryDelayMs: 0, retryJitterMs: 0 }).extract('package', []),
            error => error.code === 'PROVIDER_HIGH_DEMAND' && error.status === 503 && /high demand/i.test(error.message)
        );

        const limitedClient = { interactions: { create: async () => {
            throw Object.assign(new Error('quota exceeded for this model'), { status: 429 });
        } } };
        await assert.rejects(
            new GeminiExtractionProvider({ apiKey: 'test-only', client: limitedClient, retryDelayMs: 0, retryJitterMs: 0 }).extract('package', []),
            error => error.code === 'PROVIDER_RATE_LIMITED' && error.status === 429 && /rate limit/i.test(error.message)
        );

        const invalidClient = { interactions: { create: async () => ({ output_text: '{bad json' }) } };
        await assert.rejects(new GeminiExtractionProvider({ apiKey: 'test-only', client: invalidClient }).extract('package', []), error => error.code === 'INVALID_PROVIDER_OUTPUT');
        const timeoutClient = { interactions: { create: async () => { throw new Error('request timed out'); } } };
        await assert.rejects(new GeminiExtractionProvider({ apiKey: 'test-only', client: timeoutClient }).extract('package', []), error => error.code === 'PROVIDER_TIMEOUT');
    } finally {
        if (previousEnabled === undefined) delete process.env.GEMINI_ENABLED; else process.env.GEMINI_ENABLED = previousEnabled;
    }
});

test('citizen-scoped scan rate limit rejects excess requests', async () => {
    const fakeDb = { query: async () => [[]] };
    const app = express();
    app.use('/api/medicine-scans', createMedicineScanRouter({ db: fakeDb, provider: new MockExtractionProvider(), scanLimit: 2 }));
    const server = await new Promise(resolve => {
        const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
    });
    try {
        const token = jwt.sign({ id: 8675309 }, process.env.JWT_SECRET || 'your-secret-key');
        const url = `http://127.0.0.1:${server.address().port}/api/medicine-scans`;
        const statuses = [];
        for (let index = 0; index < 3; index += 1) statuses.push((await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })).status);
        assert.deepEqual(statuses, [400, 400, 429]);
    } finally { await new Promise(resolve => server.close(resolve)); }
});
