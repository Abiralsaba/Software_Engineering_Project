'use strict';

function numericStatus(error) {
    const value = Number(error?.status || error?.statusCode || error?.response?.status);
    return Number.isFinite(value) ? value : null;
}

function isTransientProviderError(error) {
    if (error?.transient === true) return true;
    if (error?.transient === false) return false;
    const status = numericStatus(error);
    if (status !== null) return [408, 429, 498, 500, 502, 503, 504].includes(status);
    return /abort|econnreset|enotfound|fetch failed|network|socket|timed?\s*out|temporar|overload|capacity|rate.?limit/i
        .test(String(error?.message || ''));
}

function boundedNumber(value, fallback, minimum, maximum) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}

class ConsecutiveFailureCircuit {
    constructor(options = {}) {
        this.threshold = Math.trunc(boundedNumber(options.threshold ?? process.env.AI_FAILOVER_THRESHOLD, 3, 3, 5));
        this.cooldownMs = boundedNumber(options.cooldownMs ?? process.env.AI_FAILOVER_COOLDOWN_MS, 300000, 30000, 3600000);
        this.clock = options.clock || Date.now;
        this.failures = 0;
        this.openUntil = 0;
    }

    primaryAvailable() {
        if (!this.openUntil) return true;
        if (this.clock() < this.openUntil) return false;
        this.failures = 0;
        this.openUntil = 0;
        return true;
    }

    recordSuccess() {
        this.failures = 0;
        this.openUntil = 0;
    }

    recordFailure(error) {
        if (error?.fallbackEligible === true) {
            this.failures = this.threshold;
            this.openUntil = this.clock() + this.cooldownMs;
            return true;
        }
        if (!isTransientProviderError(error)) return false;
        this.failures += 1;
        if (this.failures < this.threshold) return false;
        this.openUntil = this.clock() + this.cooldownMs;
        return true;
    }

    async run({ primary, fallback, primaryConfigured = true, fallbackConfigured = true }) {
        if ((!primaryConfigured || !this.primaryAvailable()) && fallbackConfigured) return fallback();
        try {
            const value = await primary();
            this.recordSuccess();
            return value;
        } catch (error) {
            if (this.recordFailure(error) && fallbackConfigured) return fallback();
            throw error;
        }
    }

    snapshot() {
        return { threshold: this.threshold, failures: this.failures, open: !this.primaryAvailable(), openUntil: this.openUntil || null };
    }
}

module.exports = { ConsecutiveFailureCircuit, isTransientProviderError, numericStatus };
