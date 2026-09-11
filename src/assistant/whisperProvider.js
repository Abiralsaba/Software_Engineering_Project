'use strict';
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { fail } = require('./rules');
const run = promisify(execFile);
const MAX_BYTES = 5 * 1024 * 1024;
function baseUrl() {
  const url = new URL(process.env.WHISPER_BASE_URL || 'http://127.0.0.1:8081');
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw fail(503, 'WHISPER_LOCAL_ONLY');
  return url.origin;
}
function signature(file) {
  if (!file?.buffer?.length || file.buffer.length > MAX_BYTES) throw fail(400, 'AUDIO_SIZE_INVALID');
  const b = file.buffer; const mime = file.mimetype.split(';')[0];
  const valid = ({
    'audio/wav': b.toString('ascii',0,4) === 'RIFF' && b.toString('ascii',8,12) === 'WAVE',
    'audio/x-wav': b.toString('ascii',0,4) === 'RIFF' && b.toString('ascii',8,12) === 'WAVE',
    'audio/webm': b.subarray(0,4).equals(Buffer.from([26,69,223,163])),
    'audio/ogg': b.toString('ascii',0,4) === 'OggS',
    'audio/mp4': b.toString('ascii',4,8) === 'ftyp'
  })[mime];
  if (!valid) throw fail(400, 'UNSUPPORTED_AUDIO', 'Use a genuine WebM, MP4, OGG or WAV recording.');
}
async function health() {
  try {
    const response = await fetch(`${baseUrl()}/health`, { signal: AbortSignal.timeout(2000), redirect: 'error' });
    return { whisper: response.ok, model: process.env.WHISPER_MODEL_PATH?.split('/').pop() || 'not configured' };
  } catch { return { whisper: false, model: 'unavailable' }; }
}
async function transcribe(file, { signal, language = 'bn', tempRoot = os.tmpdir() } = {}) {
  signature(file);
  const directory = await fs.mkdtemp(path.join(tempRoot, 'nationx-audio-'));
  try {
    await fs.chmod(directory, 0o700);
    const input = path.join(directory, 'recording'); const output = path.join(directory, 'normalized.wav');
    await fs.writeFile(input, file.buffer, { mode: 0o600, flag: 'wx' });
    try {
      await run(process.env.FFMPEG_BIN || 'ffmpeg', ['-nostdin','-hide_banner','-loglevel','error','-protocol_whitelist','file,pipe','-i',input,'-map','0:a:0','-vn','-t','16','-ac','1','-ar','16000','-c:a','pcm_s16le',output], { timeout: 15000, maxBuffer: 128000, signal });
    } catch (e) { throw fail(503, e.code === 'ENOENT' ? 'FFMPEG_UNAVAILABLE' : 'AUDIO_CONVERSION_FAILED', 'Audio could not be read. Use text input or record again.'); }
    const wav = await fs.readFile(output);
    let data;
    for (let offset = 12; offset + 8 <= wav.length;) {
      const size = wav.readUInt32LE(offset + 4);
      if (wav.toString('ascii',offset,offset+4) === 'data') { data = wav.subarray(offset+8,offset+8+size); break; }
      offset += 8 + size + (size % 2);
    }
    if (!data || data.length < 3200 || data.length > 15.2 * 32000) throw fail(400, 'AUDIO_DURATION_INVALID', 'Record between 0.1 and 15 seconds.');
    let energy = 0; for (let i=0;i+1<data.length;i+=2) energy += data.readInt16LE(i) ** 2;
    if (Math.sqrt(energy / (data.length / 2)) < 40) throw fail(400, 'SILENT_AUDIO', 'No speech was heard. Please try again or type.');
    const form = new FormData();
    form.append('file', new Blob([wav], { type: 'audio/wav' }), 'speech.wav');
    form.append('language', language === 'en' ? 'en' : 'bn');
    form.append('response_format','json');
    let result;
    try {
      const response = await fetch(`${baseUrl()}/inference`, { method: 'POST', body: form, signal: signal ? AbortSignal.any([signal,AbortSignal.timeout(90000)]) : AbortSignal.timeout(90000), redirect: 'error' });
      if (!response.ok) throw new Error('unavailable');
      const body = await response.text();
      if (body.length > 16000) throw new Error('oversized');
      result = JSON.parse(body);
    } catch { throw fail(503, 'WHISPER_UNAVAILABLE', 'Local speech recognition is unavailable. Please type your answer.'); }
    const transcript = typeof result.text === 'string' ? result.text.trim().slice(0,1000) : '';
    if (!transcript || /^\[.*\]$/.test(transcript)) throw fail(400, 'UNCLEAR_AUDIO', 'Please speak again or type.');
    return { transcript, requires_confirmation: true };
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
}
module.exports = { transcribe, health, signature, baseUrl, MAX_BYTES };
