'use strict';
require('dotenv').config({ quiet: true });
const { execFileSync } = require('node:child_process');
const { health } = require('../../src/assistant/whisperProvider');
(async () => {
  let ffmpeg = false;
  try { execFileSync(process.env.FFMPEG_BIN || 'ffmpeg', ['-version'], { stdio: 'ignore' }); ffmpeg = true; } catch {}
  const result = { ...await health(), ffmpeg, geminiConfigured: Boolean(process.env.GEMINI_API_KEY) && process.env.GEMINI_ENABLED === 'true', geminiModel: process.env.GEMINI_ASSISTANT_MODEL || process.env.GEMINI_MODEL || 'gemini-3.5-flash' };
  console.log(result);
  if (!result.whisper || !ffmpeg || !result.geminiConfigured) process.exitCode = 1;
})();
