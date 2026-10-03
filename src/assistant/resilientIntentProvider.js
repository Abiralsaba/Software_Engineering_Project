'use strict';

const { ConsecutiveFailureCircuit } = require('../services/aiFailover');
const { GeminiIntentProvider } = require('./geminiIntentProvider');
const { GroqIntentProvider } = require('./groqIntentProvider');

class ResilientIntentProvider {
  constructor(options = {}) {
    this.primary = options.primary || new GeminiIntentProvider(options.gemini);
    this.fallback = options.fallback || new GroqIntentProvider(options.groq);
    this.circuit = options.circuit || new ConsecutiveFailureCircuit(options.circuitOptions);
  }

  async classify(text) {
    return this.circuit.run({
      primary: () => this.primary.classify(text),
      fallback: () => this.fallback.classify(text),
      primaryConfigured: this.primary.isConfigured?.() !== false,
      fallbackConfigured: this.fallback.isConfigured?.() !== false
    });
  }
}

module.exports = { ResilientIntentProvider };
