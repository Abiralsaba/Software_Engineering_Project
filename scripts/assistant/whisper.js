'use strict';
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
require('dotenv').config({ quiet: true });
const binary = process.env.WHISPER_SERVER_BIN;
const model = process.env.WHISPER_MODEL_PATH;
// Bengali model: SayedShaun/bengali-whisper-medium-ggml, revision
// 06e5be79bab49db9ebeff3ce8e8fb9d31fd9f800, ggml-model-q4_0.bin (Apache-2.0).
// Original training: tugstugi / team Chimege. Stored outside the repository as
// ggml-bengali-medium-q4_0.bin. SHA256:
// 6ccc65d58a7915f8d9a6d3d45ec2d6d10c784bd2c7b40a5a6b053712040b51d1
if (!binary || !model || !path.isAbsolute(binary) || !path.isAbsolute(model) || !fs.existsSync(binary) || !fs.existsSync(model) || !/^ggml-(small|medium|bengali-medium-q4_0)\.bin$/.test(path.basename(model))) {
  console.error('Set WHISPER_SERVER_BIN and WHISPER_MODEL_PATH to existing absolute paths outside this repository. Bengali uses ggml-bengali-medium-q4_0.bin; multilingual small/medium are also supported.');
  process.exit(1);
}
const { baseUrl } = require('../../src/assistant/whisperProvider');
const url = new URL(baseUrl());
const child = spawn(binary, ['--host','127.0.0.1','--port',url.port || '8081','-m',model,'-l','bn','-nt','-mc','0'], { stdio: ['ignore', 'ignore', 'ignore'], cwd: path.dirname(binary) });
console.log(`Local Whisper starting at ${url.origin}; model ${path.basename(model)}. Transcripts are not logged.`);
child.on('error', () => { console.error('Whisper could not start. Check the executable path.'); process.exitCode = 1; });
child.on('exit', code => { console.log(`Local Whisper stopped (exit ${code ?? 'signal'}).`); process.exitCode = code || 0; });
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => child.kill(signal));
