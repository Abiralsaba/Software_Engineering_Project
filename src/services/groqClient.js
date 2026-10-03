'use strict';

const { isTransientProviderError, numericStatus } = require('./aiFailover');

function groqConfig(options = {}) {
    return {
        apiKey: options.apiKey !== undefined ? options.apiKey : process.env.GROQ_API_KEY,
        model: options.model || process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
        timeoutMs: Number(options.timeoutMs || process.env.GROQ_TIMEOUT_MS || 30000),
        enabled: options.enabled !== undefined ? options.enabled : process.env.GROQ_ENABLED !== 'false',
        baseUrl: options.baseUrl || process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1'
    };
}

function safeProviderError(error, fallbackCode = 'GROQ_UNAVAILABLE') {
    const status = numericStatus(error) || 502;
    const output = Object.assign(new Error('Additional language processing is temporarily unavailable.'), {
        // Upstream authentication/configuration failures are service failures,
        // not a reason to treat the signed-in NationX citizen as unauthorized.
        status: status === 429 ? 429 : status >= 500 ? 502 : 503,
        code: fallbackCode,
        provider: 'groq',
        transient: isTransientProviderError(error)
    });
    return output;
}

class GroqJsonClient {
    constructor(options = {}) {
        Object.assign(this, groqConfig(options));
        this.fetch = options.fetch || global.fetch;
    }

    isConfigured() {
        return this.enabled && Boolean(this.apiKey);
    }

    async complete({ system, user, jsonSchema, schemaName, maxTokens = 500 }) {
        if (!this.isConfigured()) {
            throw Object.assign(new Error('Additional language processing is not configured.'), {
                status: 503, code: 'GROQ_NOT_CONFIGURED', provider: 'groq', transient: false
            });
        }
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), Math.max(1000, this.timeoutMs));
        try {
            const response = await this.fetch(`${this.baseUrl.replace(/\/$/, '')}/chat/completions`, {
                method: 'POST', signal: controller.signal,
                headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.model,
                    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
                    response_format: { type: 'json_schema', json_schema: { name: schemaName, strict: true, schema: jsonSchema } },
                    reasoning_effort: 'low', include_reasoning: false,
                    max_completion_tokens: maxTokens, temperature: 0.1, store: false
                })
            });
            if (!response.ok) {
                throw Object.assign(new Error('Groq request was not accepted.'), {
                    status: response.status,
                    transient: [408, 429, 498].includes(response.status) || response.status >= 500
                });
            }
            const payload = await response.json();
            const content = payload?.choices?.[0]?.message?.content;
            if (typeof content !== 'string' || !content.trim()) {
                throw Object.assign(new Error('Groq returned no structured content.'), {
                    status: 502, code: 'INVALID_PROVIDER_OUTPUT', transient: false
                });
            }
            return content;
        } catch (error) {
            if (error?.code === 'INVALID_PROVIDER_OUTPUT') throw error;
            if (error?.name === 'AbortError') {
                throw Object.assign(new Error('Additional language processing timed out.'), {
                    status: 504, code: 'GROQ_TIMEOUT', provider: 'groq', transient: true
                });
            }
            throw safeProviderError(error);
        } finally {
            clearTimeout(timer);
        }
    }
}

module.exports = { GroqJsonClient, groqConfig, safeProviderError };
