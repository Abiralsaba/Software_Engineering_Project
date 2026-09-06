'use strict';

function normalizeText(value) {
    return String(value || '')
        .normalize('NFKC')
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}

function normalizeStrength(value) {
    return String(value || '')
        .normalize('NFKC')
        .toLowerCase()
        .replace(/microgram|mcg/g, 'ug')
        .replace(/milligram/g, 'mg')
        .replace(/millilitre|milliliter/g, 'ml')
        .replace(/gram/g, 'g')
        .replace(/\s*([+/])\s*/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();
}

function boundedPositiveInt(value, fallback, maximum) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 1) return fallback;
    return Math.min(parsed, maximum);
}

module.exports = { normalizeText, normalizeStrength, boundedPositiveInt };
