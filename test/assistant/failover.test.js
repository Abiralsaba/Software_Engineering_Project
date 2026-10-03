'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { ConsecutiveFailureCircuit } = require('../../src/services/aiFailover');
const { GroqJsonClient } = require('../../src/services/groqClient');
const { GroqIntentProvider } = require('../../src/assistant/groqIntentProvider');
const { ResilientIntentProvider } = require('../../src/assistant/resilientIntentProvider');

const validIntent = {
  schema_version: 'nationx-assistant-intent-v1', language: 'bn', service: 'NID',
  intent: 'CREATE_NID_APPLICATION', entities: {}, clarification_required: false
};

function transientFailure() {
  return Object.assign(new Error('synthetic upstream timeout'), { status: 503, transient: true });
}

test('circuit uses fallback on the third transient failure and during cooldown', async () => {
  let now = 1000;
  const circuit = new ConsecutiveFailureCircuit({ threshold: 3, cooldownMs: 30000, clock: () => now });
  let primaryCalls = 0;
  let fallbackCalls = 0;
  const run = () => circuit.run({
    primary: async () => { primaryCalls += 1; throw transientFailure(); },
    fallback: async () => { fallbackCalls += 1; return 'fallback'; }
  });
  await assert.rejects(run(), /synthetic upstream timeout/);
  await assert.rejects(run(), /synthetic upstream timeout/);
  assert.equal(await run(), 'fallback');
  assert.equal(await run(), 'fallback');
  assert.equal(primaryCalls, 3);
  assert.equal(fallbackCalls, 2);
  now += 30001;
  await assert.rejects(run(), /synthetic upstream timeout/);
  assert.equal(primaryCalls, 4);
});

test('non-transient validation failures neither open the circuit nor invoke fallback', async () => {
  const circuit = new ConsecutiveFailureCircuit({ threshold: 3 });
  let fallbackCalls = 0;
  const invalid = Object.assign(new Error('invalid structure'), { transient: false });
  for (let count = 0; count < 4; count += 1) {
    await assert.rejects(circuit.run({
      primary: async () => { throw invalid; },
      fallback: async () => { fallbackCalls += 1; }
    }), /invalid structure/);
  }
  assert.equal(fallbackCalls, 0);
  assert.equal(circuit.snapshot().failures, 0);
});

test('persistent primary configuration failures use the configured fallback immediately', async () => {
  const circuit = new ConsecutiveFailureCircuit({ threshold: 3, cooldownMs: 30000 });
  let fallbackCalls = 0;
  const value = await circuit.run({
    primary: async () => { throw Object.assign(new Error('invalid primary credentials'), { status: 401, transient: false, fallbackEligible: true }); },
    fallback: async () => { fallbackCalls += 1; return 'fallback'; }
  });
  assert.equal(value, 'fallback');
  assert.equal(fallbackCalls, 1);
  assert.equal(circuit.snapshot().open, true);
});

test('Groq client sends a backend-only strict JSON schema request', async () => {
  let request;
  const client = new GroqJsonClient({ apiKey: 'synthetic-test-key', model: 'openai/gpt-oss-120b', fetch: async (url, options) => {
    request = { url, options };
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify(validIntent) } }] }) };
  } });
  const content = await client.complete({
    system: 'Classify safely.', user: 'New NID', schemaName: 'intent',
    jsonSchema: { type: 'object', properties: {}, additionalProperties: false, required: [] }
  });
  assert.deepEqual(JSON.parse(content), validIntent);
  assert.equal(request.url, 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(request.options.headers.Authorization, 'Bearer synthetic-test-key');
  const body = JSON.parse(request.options.body);
  assert.equal(body.model, 'openai/gpt-oss-120b');
  assert.equal(body.response_format.json_schema.strict, true);
  assert.equal(body.store, false);
});

test('Groq intent fallback redacts identifiers and validates the shared contract', async () => {
  let prompt;
  const provider = new GroqIntentProvider({ client: {
    model: 'openai/gpt-oss-120b', isConfigured: () => true,
    complete: async request => { prompt = request.user; return JSON.stringify(validIntent); }
  } });
  assert.deepEqual(await provider.classify('New NID 01712345678'), validIntent);
  assert.doesNotMatch(prompt, /01712345678/);
  assert.match(prompt, /\[IDENTIFIER\]/);
});

test('resilient intent provider switches only after repeated transient Gemini failures', async () => {
  let primaryCalls = 0;
  let fallbackCalls = 0;
  const provider = new ResilientIntentProvider({
    primary: { isConfigured: () => true, classify: async () => { primaryCalls += 1; throw transientFailure(); } },
    fallback: { isConfigured: () => true, classify: async () => { fallbackCalls += 1; return validIntent; } },
    circuitOptions: { threshold: 3, cooldownMs: 30000 }
  });
  await assert.rejects(provider.classify('New NID'));
  await assert.rejects(provider.classify('New NID'));
  assert.deepEqual(await provider.classify('New NID'), validIntent);
  assert.deepEqual(await provider.classify('New NID'), validIntent);
  assert.equal(primaryCalls, 3);
  assert.equal(fallbackCalls, 2);
});
