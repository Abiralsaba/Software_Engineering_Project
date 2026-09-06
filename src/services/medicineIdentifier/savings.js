'use strict';

const Decimal = require('decimal.js');

function decimal(value, label) {
    try {
        const result = new Decimal(value);
        if (!result.isFinite() || result.isNegative()) throw new Error();
        return result;
    } catch {
        throw new Error(`${label} must be a non-negative decimal`);
    }
}

function priceOptions(packages) {
    return packages.flatMap(row => {
        if (!row.amount || !row.savings_calculation_eligible) return [];
        const size = row.units_per_package || row.package_quantity;
        if (!size || new Decimal(size).lte(0)) return [];
        return [{
            package_id: row.package_id,
            package_original: row.package_original,
            units: decimal(size, 'package units'),
            price: decimal(row.amount, 'package price'),
            currency: row.currency || 'BDT'
        }];
    });
}

// Exact unbounded package choice. Catalogue package sizes are integral for the
// supported tablet/capsule comparison set. Liquids are handled as decimal ml.
function cheapestCover(packages, requiredQuantity) {
    const required = decimal(requiredQuantity, 'required quantity');
    if (required.lte(0)) return null;
    const options = priceOptions(packages);
    if (!options.length) return null;

    const maxUnits = Decimal.max(...options.map(option => option.units));
    const scale = options.concat([{ units: required }]).reduce((max, option) => {
        const places = option.units.decimalPlaces();
        return Math.max(max, places);
    }, 0);
    if (scale > 3) return null;
    const multiplier = new Decimal(10).pow(scale);
    const target = required.mul(multiplier).ceil().toNumber();
    const max = target + maxUnits.mul(multiplier).ceil().toNumber();
    if (!Number.isSafeInteger(max) || max > 100000) return null;

    const dp = Array(max + 1).fill(null);
    dp[0] = { cost: new Decimal(0), counts: Array(options.length).fill(0) };
    for (let quantity = 0; quantity <= max; quantity += 1) {
        if (!dp[quantity]) continue;
        options.forEach((option, index) => {
            const units = option.units.mul(multiplier).toNumber();
            if (!Number.isSafeInteger(units) || units <= 0) return;
            const next = Math.min(max, quantity + units);
            const candidateCost = dp[quantity].cost.plus(option.price);
            if (!dp[next] || candidateCost.lt(dp[next].cost)) {
                const counts = [...dp[quantity].counts];
                counts[index] += 1;
                dp[next] = { cost: candidateCost, counts };
            }
        });
    }

    let best = null;
    for (let quantity = target; quantity <= max; quantity += 1) {
        const candidate = dp[quantity];
        if (!candidate) continue;
        const waste = new Decimal(quantity - target).div(multiplier);
        if (!best || candidate.cost.lt(best.cost) || (candidate.cost.eq(best.cost) && waste.lt(best.waste))) {
            best = { ...candidate, quantity: new Decimal(quantity).div(multiplier), waste };
        }
    }
    if (!best) return null;
    return {
        required_quantity: required.toFixed(), covered_quantity: best.quantity.toFixed(), waste: best.waste.toFixed(),
        estimated_cost: best.cost.toFixed(4), currency: options[0].currency,
        selected_packages: options.flatMap((option, index) => best.counts[index] ? [{
            package_id: option.package_id, package_original: option.package_original,
            count: best.counts[index], units_each: option.units.toFixed(), price_each: option.price.toFixed(4)
        }] : [])
    };
}

function requiredQuantity({ doseAmount, frequencyPerDay, durationDays, totalQuantity, dosageForm, doseUnit }) {
    if (totalQuantity !== undefined && totalQuantity !== null && totalQuantity !== '') {
        return decimal(totalQuantity, 'total quantity').toFixed();
    }
    if ([doseAmount, frequencyPerDay, durationDays].some(value => value === undefined || value === null || value === '')) return null;
    const form = String(dosageForm || '').toLowerCase().trim();
    const unit = String(doseUnit || '').toLowerCase().trim();
    if (form && ['tablet', 'capsule'].includes(form) && !['tablet', 'tablets', 'tab', 'tabs', 'capsule', 'capsules', 'cap', 'caps'].includes(unit)) return null;
    if (form && ['syrup', 'suspension'].includes(form) && !['ml', 'millilitre', 'millilitres', 'milliliter', 'milliliters'].includes(unit)) return null;
    return decimal(doseAmount, 'dose amount').mul(decimal(frequencyPerDay, 'frequency')).mul(decimal(durationDays, 'duration')).toFixed();
}

function positiveSaving(originalCost, alternativeCost) {
    if (originalCost === null || alternativeCost === null) return null;
    const saving = new Decimal(originalCost).minus(alternativeCost);
    return saving.gt(0) ? saving.toFixed(4) : '0.0000';
}

module.exports = { cheapestCover, requiredQuantity, positiveSaving };
