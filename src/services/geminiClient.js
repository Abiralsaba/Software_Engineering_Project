'use strict';
// One backend configuration path shared with Medicine Identifier; never imported by React.
function geminiConfig(options = {}) {
  return { apiKey: options.apiKey !== undefined ? options.apiKey : process.env.GEMINI_API_KEY,
    model: options.model || process.env.GEMINI_MODEL || 'gemini-3.5-flash',
    timeoutMs: Number(options.timeoutMs || process.env.GEMINI_TIMEOUT_MS || 30000) };
}
async function createGeminiClient(apiKey) {
  const { GoogleGenAI } = await import('@google/genai');
  return new GoogleGenAI({ apiKey });
}
module.exports = { geminiConfig, createGeminiClient };
