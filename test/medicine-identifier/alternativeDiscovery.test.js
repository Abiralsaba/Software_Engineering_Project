'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { GeminiAlternativeDiscovery, GroqAlternativeDiscovery, ResilientAlternativeDiscovery, discoverLowerCost, lowerCostMatches, reviewedMatchConflicts } = require('../../src/services/medicineIdentifier/alternativeDiscovery');

test('reviewed scan cannot be priced as a different catalogue brand or strength', () => {
    const medicine = { brand_name: 'Napa Extra', strength: '500 mg+65 mg' };
    assert.deepEqual(reviewedMatchConflicts({ brand_name_candidate: 'Napa Extend', strength_text: '665mg' }, medicine), ['brand', 'strength']);
    assert.deepEqual(reviewedMatchConflicts({ brand_name_candidate: 'Napa Extra', strength_text: '500mg + 65mg' }, medicine), []);
    assert.deepEqual(reviewedMatchConflicts({ brand_name_candidate: null, strength_text: null }, medicine), []);
});

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

test('unsupported or unpriced catalogue comparisons use Gemini only for unverified research leads', async () => {
    let called = 0;
    const provider = { find: async record => { called += 1; assert.equal(record.detail.brand_name, 'Original'); return { status: 'unverified_leads', brands: ['Research lead'] }; } };
    for (const result of [
        { ...comparison, alternatives: [], limitation: 'Modified-release medicines are excluded.' },
        { ...comparison, alternatives: [], original_package_comparison: null, original_purchase_estimate: null }
    ]) {
        const output = await discoverLowerCost('original', null, { catalogue: { alternatives: async () => result, medicineById: async () => original }, db: {}, provider });
        assert.equal(output.source, 'catalogue_then_ai');
        assert.deepEqual(output.gemini.brands, ['Research lead']);
    }
    const missingIngredients = await discoverLowerCost('original', null, {
        catalogue: { alternatives: async () => ({ ...comparison, alternatives: [] }), medicineById: async () => ({ ...original, detail: { ...original.detail, ingredients: [] } }) },
        db: {}, provider
    });
    assert.equal(missingIngredients.gemini.status, 'not_used');
    assert.equal(called, 2);
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
        const output = await provider.find(original);
        assert.equal(output.status, 'unverified_leads');
        assert.deepEqual(output.brands, ['Possible brand']);
        assert.equal(output.provider, 'gemini');
        const bad = new GeminiAlternativeDiscovery({ apiKey: 'test-only', client: { interactions: { create: async () => ({ output_text: '{bad' }) } } });
        const invalid = await bad.find(original);
        assert.equal(invalid.status, 'unavailable');
        assert.equal(invalid.reason, 'invalid_output');
        assert.equal(invalid.transient, false);
    } finally { if (before === undefined) delete process.env.GEMINI_ENABLED; else process.env.GEMINI_ENABLED = before; }
});

test('Groq medicine research uses the same constrained, price-free contract', async () => {
    let request;
    const provider = new GroqAlternativeDiscovery({ client: {
        model: 'openai/gpt-oss-120b', isConfigured: () => true,
        complete: async value => { request = value; return JSON.stringify({ brands: ['Original', 'Research brand'] }); }
    } });
    const result = await provider.find(original);
    assert.equal(result.provider, 'groq');
    assert.deepEqual(result.brands, ['Research brand']);
    assert.match(request.user, /Aceclofenac/);
    assert.doesNotMatch(request.user, /patient|40\.0000/i);
    assert.equal(request.jsonSchema.additionalProperties, false);
});

test('medicine research falls back on the third transient failure but not on no-lead results', async () => {
    let primaryCalls = 0;
    let fallbackCalls = 0;
    const primary = {
        isConfigured: () => true,
        find: async () => { primaryCalls += 1; return { status: 'unavailable', brands: [], provider: 'gemini', transient: true }; }
    };
    const fallback = {
        isConfigured: () => true,
        find: async () => { fallbackCalls += 1; return { status: 'unverified_leads', brands: ['Fallback brand'], provider: 'groq' }; }
    };
    const provider = new ResilientAlternativeDiscovery({ primary, fallback, circuitOptions: { threshold: 3, cooldownMs: 30000 } });
    assert.equal((await provider.find(original)).status, 'unavailable');
    assert.equal((await provider.find(original)).status, 'unavailable');
    assert.deepEqual((await provider.find(original)).brands, ['Fallback brand']);
    assert.deepEqual((await provider.find(original)).brands, ['Fallback brand']);
    assert.equal(primaryCalls, 3);
    assert.equal(fallbackCalls, 2);

    const noLeadsFallback = { isConfigured: () => true, find: async () => { throw new Error('must not run'); } };
    const noLeads = new ResilientAlternativeDiscovery({
        primary: { isConfigured: () => true, find: async () => ({ status: 'no_leads', brands: [], provider: 'gemini' }) },
        fallback: noLeadsFallback,
        circuitOptions: { threshold: 3 }
    });
    assert.equal((await noLeads.find(original)).status, 'no_leads');
});

test('medicine research immediately falls back when the primary credentials are rejected', async () => {
    let fallbackCalls = 0;
    const provider = new ResilientAlternativeDiscovery({
        primary: { isConfigured: () => true, find: async () => ({ status: 'unavailable', brands: [], provider: 'gemini', transient: false, fallbackEligible: true }) },
        fallback: { isConfigured: () => true, find: async () => { fallbackCalls += 1; return { status: 'no_leads', brands: [], provider: 'groq' }; } },
        circuitOptions: { threshold: 3, cooldownMs: 30000 }
    });
    assert.equal((await provider.find(original)).provider, 'groq');
    assert.equal(fallbackCalls, 1);
});
