'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { GeminiAlternativeDiscovery, discoverLowerCost, lowerCostMatches } = require('../../src/services/medicineIdentifier/alternativeDiscovery');

const original = {
    row: { release_type: 'standard' },
    detail: { brand_name: 'Original', ingredients: [{ ingredient: 'Aceclofenac', strength: '100 mg' }], strength: '100 mg', dosage_form: 'Tablet', medicine_type: 'allopathic' }
};
const comparison = {
    original: original.detail, original_package_comparison: { estimated_per_unit: '4.0000' },
    original_purchase_estimate: { estimated_cost: '40.0000' }, limitation: null, warnings: ['Professional confirmation is required'],
    alternatives: [
        { medicine: { medicine_id: 'cheap' }, package_comparison: { estimated_per_unit: '3.0000' }, purchase_estimate: { estimated_cost: '30.0000' } },
        { medicine: { medicine_id: 'costly' }, package_comparison: { estimated_per_unit: '5.0000' }, purchase_estimate: { estimated_cost: '50.0000' } }
    ]
};

test('catalogue comparison returns only actually cheaper recorded products and does not call Gemini', async () => {
    const calls = [];
    const result = await discoverLowerCost('original', 10, {
        catalogue: { alternatives: async () => comparison, medicineById: async () => { calls.push('lookup'); return original; } },
        db: {}, provider: { find: async () => { calls.push('gemini'); return { status: 'unverified_leads', brands: ['Other'] }; } }
    });
    assert.deepEqual(result.alternatives.map(row => row.medicine.medicine_id), ['cheap']);
    assert.equal(result.basis, 'purchase_cost');
    assert.equal(result.gemini.status, 'not_used');
    assert.deepEqual(calls, []);
});

test('unknown quantity uses unit price; Gemini is consulted only after no verified cheaper match', async () => {
    assert.deepEqual(lowerCostMatches({ ...comparison, original_purchase_estimate: null }).alternatives.map(row => row.medicine.medicine_id), ['cheap']);
    let called = 0;
    const result = await discoverLowerCost('original', 10, {
        catalogue: { alternatives: async () => ({ ...comparison, alternatives: [comparison.alternatives[1]] }), medicineById: async () => original },
        db: {}, provider: { find: async record => { called += 1; assert.equal(record.detail.brand_name, 'Original'); return { status: 'unverified_leads', brands: ['Possible brand'] }; } }
    });
    assert.equal(called, 1);
    assert.deepEqual(result.alternatives, []);
    assert.deepEqual(result.gemini.brands, ['Possible brand']);
});

test('unsupported or unpriced medicines do not trigger model-based substitution suggestions', async () => {
    let called = false;
    const provider = { find: async () => { called = true; return {}; } };
    for (const result of [
        { ...comparison, alternatives: [], limitation: 'Modified-release medicines are excluded.' },
        { ...comparison, alternatives: [], original_package_comparison: null, original_purchase_estimate: null }
    ]) {
        const output = await discoverLowerCost('original', null, { catalogue: { alternatives: async () => result }, db: {}, provider });
        assert.equal(output.gemini.status, 'not_used');
    }
    const missingIngredients = await discoverLowerCost('original', null, {
        catalogue: { alternatives: async () => ({ ...comparison, alternatives: [] }), medicineById: async () => ({ ...original, detail: { ...original.detail, ingredients: [] } }) },
        db: {}, provider
    });
    assert.equal(missingIngredients.gemini.status, 'not_used');
    assert.equal(called, false);
});

test('Gemini discovery sends only catalogue specification, never prices or patient data, and validates output', async () => {
    const before = process.env.GEMINI_ENABLED;
    process.env.GEMINI_ENABLED = 'true';
    try {
        const client = { interactions: { create: async request => {
            assert.equal(request.store, false);
            assert.equal(request.response_format.mime_type, 'application/json');
            assert.match(request.input[0].text, /Aceclofenac/);
            assert.doesNotMatch(request.input[0].text, /patient|40\.0000/i);
            return { output_text: JSON.stringify({ brands: ['Original', 'Possible brand', 'Possible brand'] }) };
        } } };
        const provider = new GeminiAlternativeDiscovery({ apiKey: 'test-only', client });
        assert.deepEqual(await provider.find(original), { status: 'unverified_leads', brands: ['Possible brand'] });
        const bad = new GeminiAlternativeDiscovery({ apiKey: 'test-only', client: { interactions: { create: async () => ({ output_text: '{bad' }) } } });
        assert.deepEqual(await bad.find(original), { status: 'unavailable', brands: [] });
    } finally { if (before === undefined) delete process.env.GEMINI_ENABLED; else process.env.GEMINI_ENABLED = before; }
});
