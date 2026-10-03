'use strict';
require('dotenv').config({ quiet: true });
const { execFileSync } = require('node:child_process');
const { health } = require('../../src/assistant/whisperProvider');
(async () => {
  let ffmpeg = false;
  try { execFileSync(process.env.FFMPEG_BIN || 'ffmpeg', ['-version'], { stdio: 'ignore' }); ffmpeg = true; } catch {}
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY) && process.env.GEMINI_ENABLED === 'true';
  const groqConfigured = Boolean(process.env.GROQ_API_KEY) && process.env.GROQ_ENABLED !== 'false';
  const result = { ...await health(), ffmpeg, geminiConfigured,
    geminiModel: process.env.GEMINI_ASSISTANT_MODEL || process.env.GEMINI_MODEL || 'gemini-3.5-flash',
    groqConfigured, groqModel: process.env.GROQ_ASSISTANT_MODEL || process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
    failoverThreshold: Math.min(5, Math.max(3, Number(process.env.AI_FAILOVER_THRESHOLD) || 3)),
    medicineImageFallback: false };
  console.log(result);
  if (!result.whisper || !ffmpeg || (!geminiConfigured && !groqConfigured)) process.exitCode = 1;
})();
