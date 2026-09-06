'use strict';

const Decimal = require('decimal.js');
const db = require('../../config/db');
const { normalizeText, normalizeStrength, boundedPositiveInt } = require('./normalization');
const { cheapestCover, positiveSaving } = require('./savings');

const PUBLIC_SELECT = `
    SELECT m.medicine_id,m.brand_name,m.brand_normalized,m.generic_original,m.generic_signature,
           m.strength_original,m.strength_signature,m.release_type,m.medicine_type,m.intended_use,m.tier,
           m.reason_codes,
           m.identification_eligible,m.structured_comparison_eligible,m.price_comparison_eligible,
           m.savings_calculation_eligible,m.requires_professional_confirmation,
           d.display_name AS dosage_form,d.normalized_name AS dosage_form_normalized,
           mf.display_name AS manufacturer,mf.normalized_name AS manufacturer_normalized
    FROM medicines m
    JOIN medicine_dosage_forms d ON d.dosage_form_id=m.dosage_form_id
    JOIN medicine_manufacturers mf ON mf.manufacturer_id=m.manufacturer_id`;

function publicMedicine(row) {
    return {
        medicine_id: row.medicine_id, brand_name: row.brand_name, generic_name: row.generic_original,
        strength: row.strength_original, dosage_form: row.dosage_form, manufacturer: row.manufacturer,
        medicine_type: row.medicine_type, intended_use: row.intended_use, tier: row.tier,
        identification_eligible: Boolean(row.identification_eligible),
        structured_comparison_eligible: Boolean(row.structured_comparison_eligible),
        price_comparison_eligible: Boolean(row.price_comparison_eligible),
        savings_calculation_eligible: Boolean(row.savings_calculation_eligible),
        requires_professional_confirmation: Boolean(row.requires_professional_confirmation)
    };
}

async function registrationsFor(ids, connection = db) {
    if (!ids.length) return new Map();
    const [rows] = await connection.query(
        `SELECT medicine_id,registration_reference,registration_kind
         FROM medicine_registrations WHERE medicine_id IN (?) ORDER BY registration_reference`, [ids]
    );
    const result = new Map(ids.map(id => [id, []]));
    rows.forEach(row => result.get(row.medicine_id)?.push({ reference: row.registration_reference, kind: row.registration_kind }));
    return result;
}

async function ingredientsFor(ids, connection = db) {
    if (!ids.length) return new Map();
    const [rows] = await connection.query(
        `SELECT pi.medicine_id,i.display_name AS ingredient,pi.strength_value,pi.strength_unit,
                pi.denominator_value,pi.denominator_unit,pi.strength_original
         FROM medicine_product_ingredients pi JOIN medicine_ingredients i ON i.ingredient_id=pi.ingredient_id
         WHERE pi.medicine_id IN (?) ORDER BY pi.medicine_id,pi.ingredient_order`, [ids]
    );
    const result = new Map(ids.map(id => [id, []]));
    rows.forEach(row => result.get(row.medicine_id)?.push({
        ingredient: row.ingredient, strength: row.strength_original,
        strength_value: row.strength_value, strength_unit: row.strength_unit,
        denominator_value: row.denominator_value, denominator_unit: row.denominator_unit
    }));
    return result;
}

async function attachPublicDetails(rows, connection = db) {
    const ids = rows.map(row => row.medicine_id);
    const [registrations, ingredients] = await Promise.all([registrationsFor(ids, connection), ingredientsFor(ids, connection)]);
    return rows.map(row => ({ ...publicMedicine(row), ingredients: ingredients.get(row.medicine_id) || [], registrations: registrations.get(row.medicine_id) || [] }));
}

async function search(options, connection = db) {
    const page = boundedPositiveInt(options.page, 1, 10000);
    const limit = boundedPositiveInt(options.limit, 10, 25);
    const offset = (page - 1) * limit;
    const q = normalizeText(options.q);
    const brand = normalizeText(options.brand);
    const ingredient = normalizeText(options.ingredient);
    const strength = normalizeStrength(options.strength);
    const form = normalizeText(options.form);
    const manufacturer = normalizeText(options.manufacturer);
    const registration = String(options.registration || '').trim();
    const tier = ['A', 'B'].includes(options.tier) ? options.tier : null;
    if (![q, brand, ingredient, strength, form, manufacturer, registration].some(Boolean)) {
        throw Object.assign(new Error('Provide a brand, ingredient, strength, form, manufacturer, registration, or search term.'), { status: 400 });
    }

    const where = ['m.identification_eligible=1', "m.tier IN ('A','B')"];
    const params = [];
    if (tier) { where.push('m.tier=?'); params.push(tier); }
    if (brand) { where.push('(m.brand_normalized=? OR m.brand_normalized LIKE ?)'); params.push(brand, `${brand}%`); }
    if (ingredient) {
        where.push(`EXISTS (SELECT 1 FROM medicine_product_ingredients spi JOIN medicine_ingredients si ON si.ingredient_id=spi.ingredient_id
                           WHERE spi.medicine_id=m.medicine_id AND (si.normalized_name=? OR si.normalized_name LIKE ?))`);
        params.push(ingredient, `${ingredient}%`);
    }
    if (strength) { where.push('m.strength_signature=?'); params.push(strength); }
    if (form) { where.push('d.normalized_name=?'); params.push(form); }
    if (manufacturer) { where.push('(mf.normalized_name=? OR mf.normalized_name LIKE ?)'); params.push(manufacturer, `${manufacturer}%`); }
    if (registration) {
        where.push('EXISTS (SELECT 1 FROM medicine_registrations sr WHERE sr.medicine_id=m.medicine_id AND sr.registration_reference=?)');
        params.push(registration);
    }
    if (q) {
        where.push(`(m.brand_normalized=? OR m.brand_normalized LIKE ? OR m.generic_signature=? OR m.generic_signature LIKE ?
            OR EXISTS (SELECT 1 FROM medicine_registrations qr WHERE qr.medicine_id=m.medicine_id AND qr.registration_reference=?))`);
        params.push(q, `${q}%`, q, `${q}%`, options.q.trim());
    }
    const orderParams = q ? [q, `${q}%`, q] : brand ? [brand, `${brand}%`, ''] : ['', '', ''];
    const [countRows] = await connection.query(`SELECT COUNT(*) AS total FROM medicines m
        JOIN medicine_dosage_forms d ON d.dosage_form_id=m.dosage_form_id
        JOIN medicine_manufacturers mf ON mf.manufacturer_id=m.manufacturer_id WHERE ${where.join(' AND ')}`, params);
    const [rows] = await connection.query(`${PUBLIC_SELECT} WHERE ${where.join(' AND ')}
        ORDER BY CASE WHEN m.brand_normalized=? THEN 0 WHEN m.brand_normalized LIKE ? THEN 1 WHEN m.generic_signature=? THEN 2 ELSE 3 END,
                 m.brand_normalized,m.strength_signature,d.normalized_name LIMIT ? OFFSET ?`, [...params, ...orderParams, limit, offset]);
    return { page, limit, total: Number(countRows[0].total), medicines: await attachPublicDetails(rows, connection) };
}

async function medicineById(medicineId, connection = db, { alternativesOnly = false } = {}) {
    const eligibility = alternativesOnly
        ? "AND m.tier='A' AND m.intended_use='human' AND m.structured_comparison_eligible=1 AND m.savings_calculation_eligible=1"
        : "AND m.identification_eligible=1 AND m.tier IN ('A','B')";
    const [rows] = await connection.query(`${PUBLIC_SELECT} WHERE m.medicine_id=? ${eligibility} LIMIT 1`, [medicineId]);
    if (!rows.length) return null;
    const [detail] = await attachPublicDetails(rows, connection);
    return { row: rows[0], detail };
}

async function packagesFor(medicineId, connection = db) {
    const [rows] = await connection.query(
        `SELECT p.package_id,p.container_type,p.package_quantity,p.package_unit,p.units_per_package,p.package_original,
                pr.price_id,pr.amount,pr.currency,pr.price_basis,
                pr.price_comparison_eligible,pr.savings_calculation_eligible
         FROM medicine_packages p LEFT JOIN medicine_prices pr ON pr.package_id=p.package_id
         WHERE p.medicine_id=? ORDER BY (pr.amount IS NULL),pr.amount,p.units_per_package`, [medicineId]
    );
    return rows.map(row => ({ ...row,
        price_comparison_eligible: Boolean(row.price_comparison_eligible),
        savings_calculation_eligible: Boolean(row.savings_calculation_eligible)
    }));
}

async function candidateRows(extracted, connection = db) {
    const brand = normalizeText(extracted.brand_name_candidate);
    const generic = normalizeText(extracted.generic_name_candidate);
    const strength = normalizeStrength(extracted.strength_text);
    const form = normalizeText(extracted.dosage_form);
    const manufacturer = normalizeText(extracted.manufacturer_candidate);
    const registration = String(extracted.registration_reference_candidate || '').trim();
    const fuzzyPrefix = brand.slice(0, Math.min(3, brand.length));
    if (![brand, generic, strength, form, manufacturer, registration].some(Boolean)) return [];
    const clauses = [];
    const params = [];
    if (registration) { clauses.push('EXISTS (SELECT 1 FROM medicine_registrations cr WHERE cr.medicine_id=m.medicine_id AND cr.registration_reference=?)'); params.push(registration); }
    if (brand) {
        clauses.push('(m.brand_normalized=? OR m.brand_normalized LIKE ? OR m.brand_normalized LIKE ?)');
        params.push(brand, `${brand}%`, `${fuzzyPrefix}%`);
    }
    if (generic) { clauses.push('(m.generic_signature=? OR m.generic_signature LIKE ?)'); params.push(generic, `${generic}%`); }
    if (strength) { clauses.push('m.strength_signature=?'); params.push(strength); }
    if (form) { clauses.push('d.normalized_name=?'); params.push(form); }
    if (manufacturer) {
        clauses.push(`(mf.normalized_name=? OR mf.normalized_name LIKE ? OR EXISTS
            (SELECT 1 FROM medicine_manufacturer_aliases ma WHERE ma.manufacturer_id=m.manufacturer_id AND ma.alias_normalized=?))`);
        params.push(manufacturer, `${manufacturer}%`, manufacturer);
    }
    const [rows] = await connection.query(`${PUBLIC_SELECT}
        WHERE m.identification_eligible=1 AND m.tier IN ('A','B') AND (${clauses.join(' OR ')})
        ORDER BY CASE
            WHEN ?<>'' AND EXISTS (SELECT 1 FROM medicine_registrations rr WHERE rr.medicine_id=m.medicine_id AND rr.registration_reference=?) THEN 0
            WHEN m.brand_normalized=? THEN 1 WHEN ?<>'' AND m.brand_normalized LIKE ? THEN 2
            WHEN m.generic_signature=? THEN 3 WHEN m.strength_signature=? AND d.normalized_name=? THEN 4 ELSE 5 END,
            m.brand_normalized LIMIT 40`, [...params, registration, registration, brand, fuzzyPrefix, `${fuzzyPrefix}%`, generic, strength, form]);
    const registrationMap = await registrationsFor(rows.map(row => row.medicine_id), connection);
    return rows.map(row => {
        const evidence = [];
        const conflicts = [];
        let score = 0;
        const refs = registrationMap.get(row.medicine_id) || [];
        if (registration && refs.some(ref => ref.reference === registration)) { evidence.push('Registration-like reference matched'); score += 1000; }
        if (brand && row.brand_normalized === brand) { evidence.push('Brand matched'); score += 200; }
        else if (brand && row.brand_normalized.startsWith(brand)) { evidence.push('Brand prefix matched'); score += 120; }
        else if (brand) {
            const distance = levenshtein(row.brand_normalized, brand);
            const similarity = 1 - (distance / Math.max(row.brand_normalized.length, brand.length, 1));
            if (similarity >= 0.6) { evidence.push('Bounded fuzzy brand retrieval'); score += Math.round(similarity * 80); }
            else conflicts.push('Brand differs');
        }
        if (generic && row.generic_signature === generic) { evidence.push('Ingredient matched'); score += 100; }
        else if (generic) conflicts.push('Ingredient missing or differs');
        if (strength && row.strength_signature === strength) { evidence.push('Strength matched'); score += 60; }
        else if (strength) conflicts.push('Strength missing or differs');
        if (form && row.dosage_form_normalized === form) { evidence.push('Form matched'); score += 40; }
        else if (form) conflicts.push('Dosage form missing or differs');
        if (manufacturer && row.manufacturer_normalized === manufacturer) { evidence.push('Manufacturer matched'); score += 20; }
        else if (manufacturer) conflicts.push('Manufacturer missing or differs');
        return { row, refs, score, evidence, conflicts };
    }).filter(match => match.score > 0)
        .sort((left, right) => right.score - left.score || left.row.brand_normalized.localeCompare(right.row.brand_normalized)).slice(0, 5);
}

function levenshtein(left, right) {
    const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let i = 1; i <= left.length; i += 1) {
        let diagonal = previous[0];
        previous[0] = i;
        for (let j = 1; j <= right.length; j += 1) {
            const above = previous[j];
            previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (left[i - 1] === right[j - 1] ? 0 : 1));
            diagonal = above;
        }
    }
    return previous[right.length];
}

async function matchExtracted(extracted, connection = db) {
    const matches = await candidateRows(extracted, connection);
    const detailed = await attachPublicDetails(matches.map(match => match.row), connection);
    return matches.map((match, index) => ({
        rank: index + 1, score: match.score, medicine: detailed[index],
        evidence: match.evidence, conflicts_or_missing: match.conflicts
    }));
}

function comparisonForm(normalized) {
    return ['tablet', 'capsule', 'syrup', 'suspension'].includes(normalized);
}

function unitComparison(packages) {
    const options = packages.flatMap(row => {
        if (!row.amount || !row.savings_calculation_eligible || !(row.units_per_package || row.package_quantity)) return [];
        const units = new Decimal(row.units_per_package || row.package_quantity);
        if (units.lte(0)) return [];
        return [{ package_id: row.package_id, package_original: row.package_original,
            amount: String(row.amount), currency: row.currency || 'BDT', estimated_per_unit: new Decimal(row.amount).div(units).toFixed(4) }];
    });
    return options.sort((a, b) => new Decimal(a.estimated_per_unit).cmp(b.estimated_per_unit))[0] || null;
}

async function alternatives(medicineId, quantity, connection = db) {
    const warnings = ['Dataset-derived estimated price', 'Current pharmacy price may differ', 'Professional confirmation is required'];
    const original = await medicineById(medicineId, connection, { alternativesOnly: true });
    if (!original || !comparisonForm(original.row.dosage_form_normalized)) return { original: original?.detail || null, alternatives: [], limitation: 'This medicine is outside the supported structured comparison set.', warnings };
    if (/AMBIGUOUS|INCOMPLETE|PARSE_FAILED/i.test(original.row.reason_codes || '')) return { original: original.detail, alternatives: [], limitation: 'Incomplete or ambiguous ingredient mapping is excluded.', warnings };
    if (original.row.release_type && !/^(standard|immediate)$/i.test(original.row.release_type)) return { original: original.detail, alternatives: [], limitation: 'Modified-release medicines are excluded.', warnings };
    const [rows] = await connection.query(`${PUBLIC_SELECT}
        WHERE m.medicine_id<>? AND m.tier='A' AND m.intended_use='human' AND m.structured_comparison_eligible=1
          AND m.medicine_type=? AND m.generic_signature=? AND m.strength_signature=?
          AND m.reason_codes NOT REGEXP 'AMBIGUOUS|INCOMPLETE|PARSE_FAILED'
          AND m.dosage_form_id=(SELECT dosage_form_id FROM medicines WHERE medicine_id=?)
          AND m.release_type <=> ?
          AND NOT EXISTS (SELECT 1 FROM medicine_conflicts mc WHERE mc.medicine_id=m.medicine_id AND mc.status<>'RESOLVED')
          AND NOT EXISTS (SELECT 1 FROM medicine_product_ingredients pi WHERE pi.medicine_id=m.medicine_id AND pi.parse_status<>'PARSED')
          AND EXISTS (SELECT 1 FROM medicine_prices pr JOIN medicine_packages pp ON pp.package_id=pr.package_id
                      WHERE pr.medicine_id=m.medicine_id AND pr.savings_calculation_eligible=1 AND pr.amount>0 AND pp.parse_status='PARSED')
        ORDER BY m.brand_normalized LIMIT 25`, [medicineId, original.row.medicine_type, original.row.generic_signature,
        original.row.strength_signature, medicineId, original.row.release_type]);
    const originalPackages = await packagesFor(medicineId, connection);
    const originalCost = quantity ? cheapestCover(originalPackages, quantity) : null;
    const publicRows = await attachPublicDetails(rows, connection);
    const output = [];
    for (let index = 0; index < rows.length; index += 1) {
        const packages = await packagesFor(rows[index].medicine_id, connection);
        const cost = quantity ? cheapestCover(packages, quantity) : null;
        output.push({
            medicine: publicRows[index],
            label: 'Possible lower-cost product with the same recorded specifications',
            matching_specifications: ['Complete ingredient set', 'Ingredient-strength associations', 'Strength/concentration', 'Dosage form', 'Medicine type', 'Release type'],
            package_comparison: unitComparison(packages), purchase_estimate: cost,
            estimated_saving: originalCost && cost ? positiveSaving(originalCost.estimated_cost, cost.estimated_cost) : null,
            calculation: cost ? `Lowest dataset-derived package cost covering ${cost.required_quantity}; ${cost.waste} unit(s) estimated waste.` : 'Dose, frequency and duration are incomplete; package comparison only.'
        });
    }
    output.sort((a, b) => {
        if (a.estimated_saving !== null && b.estimated_saving !== null) return new Decimal(b.estimated_saving).cmp(a.estimated_saving);
        return new Decimal(a.package_comparison?.estimated_per_unit || Infinity).cmp(b.package_comparison?.estimated_per_unit || Infinity);
    });
    return {
        original: original.detail, original_package_comparison: unitComparison(originalPackages), original_purchase_estimate: originalCost,
        alternatives: output.slice(0, 10), limitation: null,
        warnings
    };
}

module.exports = { search, medicineById, packagesFor, matchExtracted, alternatives, publicMedicine, comparisonForm };
