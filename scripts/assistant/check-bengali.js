'use strict';
// Live local providers, synthetic speech only. Does not access the database.
require('dotenv').config({ quiet: true });
const assert = require('node:assert/strict');
const { synthesize } = require('../../src/assistant/bengaliSpeech');
const { transcribe } = require('../../src/assistant/whisperProvider');
(async () => {
  for (const [spoken, expected] of [
    ['আমার আবেদন কোথায় আছে?', ['আমার', 'আবেদন']],
    ['আমার নাম আবির।', ['আমার', 'নাম', 'আবির']],
    ['আমি জাতীয় পরিচয়পত্রের জন্য আবেদন করতে চাই।', ['পরিচয়পত্র', 'আবেদন']]
  ]) {
    const voice = await synthesize(spoken);
    const heard = await transcribe({ buffer: Buffer.from(voice.audio, 'base64'), mimetype: 'audio/wav' }, { language: 'bn' });
    console.log(JSON.stringify({ spoken, transcript: heard.transcript }));
    for (const word of expected) assert.ok(heard.transcript.normalize('NFC').includes(word.normalize('NFC')), `Missing expected Bengali word: ${word}`);
  }
  console.log('PASS: synthetic Bengali speech generated and transcribed. Live microphone accuracy still depends on the recording.');
})().catch(error => { console.error(error.code || error.message); process.exitCode = 1; });
