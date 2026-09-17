'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { synthesize } = require('../../src/assistant/bengaliSpeech');
test('local Bengali speech produces playable WAV and validates input', { skip: process.platform !== 'darwin' }, async () => {
  const result = await synthesize('আপনার নাম কী?');
  const bytes = Buffer.from(result.audio, 'base64');
  assert.equal(result.mime, 'audio/wav');
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(bytes.toString('ascii', 8, 12), 'WAVE');
  assert.ok(bytes.length > 4000);
  await assert.rejects(synthesize(''), { code: 'INVALID_SPEECH_TEXT' });
  await assert.rejects(synthesize('ক'.repeat(601)), { code: 'INVALID_SPEECH_TEXT' });
});
