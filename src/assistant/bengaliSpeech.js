'use strict';
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { promisify } = require('node:util');
const run = promisify(require('node:child_process').execFile);
const { fail } = require('./rules');
let active = 0;

// Local teacher-demo speech. No text is sent to an external provider.
async function synthesize(text, { signal } = {}) {
  if (typeof text !== 'string' || !text.trim() || text.length > 600 || /[\u0000-\u0008]/u.test(text)) throw fail(400, 'INVALID_SPEECH_TEXT');
  if (process.platform !== 'darwin') throw fail(503, 'BENGALI_VOICE_UNAVAILABLE', 'Local Bengali speech requires the configured Mac voice.');
  if (active >= 2) throw fail(429, 'SPEECH_BUSY', 'Speech is busy. Please try again.');
  active++;
  let directory;
  try {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'nationx-speech-'));
    await fs.chmod(directory, 0o700);
    const input = path.join(directory, 'text.txt'), output = path.join(directory, 'voice.wav');
    await fs.writeFile(input, text.replace(/\bNID\b/g, 'এন আই ডি'), { mode: 0o600 });
    await run('/usr/bin/say', ['-v', 'Piya', '-r', '155', '-f', input, '-o', output, '--data-format=LEI16@22050'], { signal, timeout: 30000, maxBuffer: 1024 });
    const bytes = await fs.readFile(output);
    if (bytes.length < 44 || bytes.length > 6 * 1024 * 1024) throw new Error('Invalid speech output');
    return { mime: 'audio/wav', audio: bytes.toString('base64') };
  } catch (error) {
    if (error.status) throw error;
    throw fail(503, 'BENGALI_VOICE_UNAVAILABLE', 'বাংলা কণ্ঠ চালু করা যায়নি। আবার চেষ্টা করুন।');
  } finally {
    if (directory) await fs.rm(directory, { recursive: true, force: true });
    active--;
  }
}
module.exports = { synthesize };
