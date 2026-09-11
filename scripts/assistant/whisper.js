'use strict';
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
require('dotenv').config({ quiet: true });
const binary = process.env.WHISPER_SERVER_BIN;
const model = process.env.WHISPER_MODEL_PATH;
if (!binary || !model || !path.isAbsolute(binary) || !path.isAbsolute(model) || !fs.existsSync(binary) || !fs.existsSync(model) || !/^ggml-(small|medium)\.bin$/.test(path.basename(model))) {
  console.error('Set WHISPER_SERVER_BIN and WHISPER_MODEL_PATH to existing absolute paths outside this repository. Use multilingual ggml-small.bin (or ggml-medium.bin).');
  process.exit(1);
}
const { baseUrl } = require('../../src/assistant/whisperProvider');
const url = new URL(baseUrl());
const child = spawn(binary, ['--host','127.0.0.1','--port',url.port || '8081','-m',model,'-l','auto','-nt','-mc','0'], { stdio: ['ignore', 'ignore', 'ignore'], cwd: path.dirname(binary) });
console.log(`Local Whisper starting at ${url.origin}; model ${path.basename(model)}. Transcripts are not logged.`);
child.on('error', () => { console.error('Whisper could not start. Check the executable path.'); process.exitCode = 1; });
child.on('exit', code => { console.log(`Local Whisper stopped (exit ${code ?? 'signal'}).`); process.exitCode = code || 0; });
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => child.kill(signal));
