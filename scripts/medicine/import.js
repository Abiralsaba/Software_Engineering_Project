#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.resolve(__dirname, '../..', '.env') });

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const SCHEMA_PATH = path.join(PROJECT_ROOT, 'src/database/migrations/006_medicine_catalogue.sql');
const TEST_DATABASE = 'central_govt_db_test';

function argumentsFor(argv) {
    const result = { mode: 'import', target: null, outputDir: null, allowDevelopment: false };
    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        if (argument === '--mode') result.mode = argv[++index];
        else if (argument === '--target') result.target = argv[++index];
        else if (argument === '--output-dir') result.outputDir = path.resolve(argv[++index]);
        else if (argument === '--allow-development') result.allowDevelopment = true;
        else throw new Error(`Unknown argument: ${argument}`);
    }
    if (!['import', 'verify', 'rollback'].includes(result.mode)) throw new Error('mode must be import, verify, or rollback');
    if (!['central_govt_db_test', 'central_govt_db'].includes(result.target)) throw new Error('target must be an allowlisted NationX database');
    if (result.target !== TEST_DATABASE && !result.allowDevelopment) {
        throw new Error('Development import is locked; explicit later approval and --allow-development are required');
    }
    if (!result.outputDir) throw new Error('--output-dir is required');
    return result;
}

function sha256File(filename) {
    return crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
}

function *csvRows(text) {
    let row = [];
    let field = '';
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
        const character = text[index];
        if (quoted) {
            if (character === '"') {
                if (text[index + 1] === '"') {
                    field += '"';
                    index += 1;
                } else {
                    quoted = false;
                }
            } else {
                field += character;
            }
        } else if (character === '"' && field.length === 0) {
            quoted = true;
        } else if (character === ',') {
            row.push(field);
            field = '';
        } else if (character === '\n') {
            row.push(field.endsWith('\r') ? field.slice(0, -1) : field);
            yield row;
            row = [];
            field = '';
        } else {
            field += character;
        }
    }
    if (quoted) throw new Error('CSV ended inside a quoted field');
    if (field || row.length) {
        row.push(field.endsWith('\r') ? field.slice(0, -1) : field);
        yield row;
    }
}

function readCsv(filename) {
    const iterator = csvRows(fs.readFileSync(filename, 'utf8'));
    const first = iterator.next();
    if (first.done) throw new Error(`CSV is empty: ${filename}`);
    const headers = first.value;
    function *records() {
        let line = 1;
        for (const values of iterator) {
            line += 1;
            if (values.length !== headers.length) throw new Error(`${filename}:${line} has ${values.length} fields; expected ${headers.length}`);
            yield Object.fromEntries(headers.map((header, index) => [header, values[index]]));
        }
    }
    return { headers, records: records() };
}

function readAll(filename) {
    return [...readCsv(filename).records];
}

function outputPath(options, filename) {
    const resolved = path.join(options.outputDir, filename);
    if (!fs.existsSync(resolved)) throw new Error(`Required output is missing: ${resolved}`);
    return resolved;
}

function verifyManifest(options) {
    const manifestPath = outputPath(options, 'output_manifest.csv');
    const rows = readAll(manifestPath);
    for (const row of rows) {
        const filename = outputPath(options, row.filename);
        const actual = sha256File(filename);
        if (actual !== row.sha256) throw new Error(`Output hash mismatch for ${row.filename}`);
        if (String(fs.statSync(filename).size) !== row.size_bytes) throw new Error(`Output size mismatch for ${row.filename}`);
    }
    return { rows, sha256: sha256File(manifestPath) };
}

function summaryMap(options) {
    return new Map(readAll(outputPath(options, 'medicine_import_summary.csv')).map(row => [row.metric, Number(row.value)]));
}

function sourceMetadata(options) {
    const rows = readAll(outputPath(options, 'medicine_source_files.csv'));
    const byId = new Map(rows.map(row => [row.source_file_id, row]));
    if (!byId.has('MARKET') || !byId.has('REGISTERED')) throw new Error('Source metadata is incomplete');
    const batchIds = new Set(rows.map(row => row.dataset_version));
    if (batchIds.size !== 1) throw new Error('Source metadata has inconsistent batch identifiers');
    return { market: byId.get('MARKET'), registered: byId.get('REGISTERED'), batchId: rows[0].dataset_version };
}

const connectionOptions = target => ({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: target,
    multipleStatements: true,
    charset: 'utf8mb4',
});

async function assertDatabase(connection, target, operation) {
    const [[row]] = await connection.query('SELECT DATABASE() AS database_name');
    if (!row || row.database_name !== target) throw new Error(`Refusing ${operation}: DATABASE() is ${row && row.database_name}`);
}

const nullable = value => value === '' ? null : value;
const integer = value => value === '' ? null : Number(value);

async function insertCsv(connection, options, specification) {
    await assertDatabase(connection, options.target, `load ${specification.file}`);
    const { records } = readCsv(outputPath(options, specification.file));
    const batch = [];
    let count = 0;
    const flush = async () => {
        if (!batch.length) return;
        await assertDatabase(connection, options.target, `insert ${specification.table}`);
        const escapedColumns = specification.columns.map(column => `\`${column}\``).join(',');
        await connection.query(`INSERT INTO \`${specification.table}\` (${escapedColumns}) VALUES ?`, [batch.splice(0)]);
    };
    for (const record of records) {
        batch.push(specification.map(record));
        count += 1;
        if (batch.length >= (specification.batchSize || 500)) await flush();
    }
    await flush();
    process.stdout.write(`${JSON.stringify({ event: 'table_loaded', table: specification.table, rows: count })}\n`);
    return count;
}

function specifications() {
    return [
        { file: 'medicine_source_files.csv', table: 'medicine_source_files', columns: ['source_file_id','import_batch_id','filename','sha256','file_size','source_format','source_encoding','data_row_count','dataset_version','source_verified','licence_status'], map: (r) => [r.source_file_id,r.dataset_version,r.filename,r.sha256,Number(r.file_size),r.format,r.encoding,Number(r.data_row_count),r.dataset_version,Number(r.source_verified),r.licence_status] },
        { file: 'medicine_source_records.csv', table: 'medicine_source_records', columns: ['source_record_id','source_file_id','import_batch_id','source_row_number','source_record_key','row_sha256','cell_types','outcome'], map: (r) => [r.source_record_id,r.source_file_id,r.import_batch_id,Number(r.source_row_number),r.source_record_key,r.row_sha256,r.cell_types,r.outcome] },
        { file: 'medicine_market_raw.csv', table: 'medicine_market_raw', columns: ['source_record_id','brand_id_original','brand_name_original','medicine_type_original','slug_original','dosage_form_original','generic_original','strength_original','manufacturer_original','package_container_original','package_size_original'], map: (r) => [r.source_record_id,r['brand id'],r['brand name'],r.type,r.slug,r['dosage form'],r.generic,r.strength,r.manufacturer,r['package container'],r['Package Size']] },
        { file: 'registered_drug_raw.csv', table: 'registered_drug_raw', columns: ['source_record_id','sl_original','pharmaceutical_original','name_original','generic_name_original','strength_original','dosages_original','price_original','use_for_original','dar_original'], map: (r) => [r.source_record_id,r.sl,r.pharmaceutical,r.name,r.generic_name,r.strength,r.dosages,r.price,r.use_for,r.dar] },
        { file: 'manufacturers_clean.csv', table: 'medicine_manufacturers', columns: ['manufacturer_id','display_name','normalized_name','source_verified'], map: (r) => [r.manufacturer_id,r.display_name,r.normalized_name,Number(r.source_verified)] },
        { file: 'dosage_forms_clean.csv', table: 'medicine_dosage_forms', columns: ['dosage_form_id','display_name','normalized_name'], map: (r) => [r.dosage_form_id,r.display_name,r.normalized_name] },
        { file: 'ingredients_clean.csv', table: 'medicine_ingredients', columns: ['ingredient_id','display_name','normalized_name'], map: (r) => [r.ingredient_id,r.display_name,r.normalized_name] },
        { file: 'medicines_clean.csv', table: 'medicines', columns: ['medicine_id','import_batch_id','manufacturer_id','dosage_form_id','brand_name','brand_normalized','generic_original','generic_signature','strength_original','strength_signature','release_type','medicine_type','intended_use','tier','catalogue_status','reason_codes','identification_eligible','structured_comparison_eligible','price_comparison_eligible','savings_calculation_eligible','requires_professional_confirmation','source_verified','regulatory_verified'], map: (r) => [r.medicine_id,r.import_batch_id,r.manufacturer_id,r.dosage_form_id,r.brand_name,r.brand_normalized,r.generic_original,r.generic_signature,r.strength_original,r.strength_signature,nullable(r.release_type),r.medicine_type,r.intended_use,r.tier,r.catalogue_status,r.reason_codes,Number(r.identification_eligible),Number(r.structured_comparison_eligible),Number(r.price_comparison_eligible),Number(r.savings_calculation_eligible),Number(r.requires_professional_confirmation),Number(r.source_verified),Number(r.regulatory_verified)] },
        { file: 'manufacturer_aliases_clean.csv', table: 'medicine_manufacturer_aliases', columns: ['manufacturer_alias_id','manufacturer_id','alias_original','alias_normalized','source_record_id','match_method'], map: (r) => [r.manufacturer_alias_id,r.manufacturer_id,r.alias_original,r.alias_normalized,r.source_record_id,r.match_method] },
        { file: 'medicine_ingredients_clean.csv', table: 'medicine_product_ingredients', columns: ['medicine_ingredient_id','medicine_id','ingredient_id','ingredient_order','strength_value','strength_unit','denominator_value','denominator_unit','strength_original','parse_status','parse_reason'], map: (r) => [r.medicine_ingredient_id,r.medicine_id,r.ingredient_id,Number(r.ingredient_order),nullable(r.strength_value),nullable(r.strength_unit),nullable(r.denominator_value),nullable(r.denominator_unit),nullable(r.strength_original),r.parse_status,nullable(r.parse_reason)] },
        { file: 'medicine_packages_clean.csv', table: 'medicine_packages', columns: ['package_id','medicine_id','container_type','package_quantity','package_unit','units_per_package','package_original','source_record_id','parse_status','parse_reason'], map: (r) => [r.package_id,r.medicine_id,nullable(r.container_type),nullable(r.package_quantity),nullable(r.package_unit),nullable(r.units_per_package),r.package_original,r.source_record_id,r.parse_status,nullable(r.parse_reason)] },
        { file: 'medicine_prices_clean.csv', table: 'medicine_prices', columns: ['price_id','medicine_id','package_id','amount','currency','price_basis','price_original','source_record_id','price_source','price_status','price_basis_verified','price_current_verified','price_comparison_eligible','savings_calculation_eligible'], map: (r) => [r.price_id,r.medicine_id,nullable(r.package_id),nullable(r.amount),nullable(r.currency),r.price_basis,r.price_original,r.source_record_id,r.price_source,r.price_status,Number(r.price_basis_verified),Number(r.price_current_verified),Number(r.price_comparison_eligible),Number(r.savings_calculation_eligible)] },
        { file: 'medicine_registrations_clean.csv', table: 'medicine_registrations', columns: ['registration_id','medicine_id','registration_reference','registration_kind','source_record_id','format_status','source_verified','regulatory_verified'], map: (r) => [r.registration_id,r.medicine_id,r.registration_reference,r.registration_kind,r.source_record_id,r.format_status,Number(r.source_verified),Number(r.regulatory_verified)] },
        { file: 'medicine_source_links.csv', table: 'medicine_source_links', columns: ['source_link_id','medicine_id','source_record_id','source_name','source_row_number','source_record_key','outcome','match_method','reason_codes'], map: (r) => [r.source_link_id,nullable(r.medicine_id),r.source_record_id,r.source_name,Number(r.source_row_number),r.source_record_key,r.outcome,r.match_method,r.reason_codes] },
        { file: 'medicine_field_provenance.csv', table: 'medicine_field_provenance', columns: ['field_provenance_id','medicine_id','field_name','source_record_id','original_value','normalized_value','authority_decision'], map: (r) => [r.field_provenance_id,r.medicine_id,r.field_name,r.source_record_id,r.original_value,r.normalized_value,r.authority_decision], batchSize: 300 },
        { file: 'medicine_conflicts.csv', table: 'medicine_conflicts', columns: ['conflict_id','medicine_id','conflict_type','source_record_ids','details','status'], map: (r) => [r.conflict_id,r.medicine_id,r.conflict_type,r.source_record_ids,r.details,r.status] },
        { file: 'medicine_possible_duplicates.csv', table: 'medicine_possible_duplicates', columns: ['possible_duplicate_id','left_medicine_id','right_medicine_id','matching_fields','conflicting_fields','similarity_evidence','reason_code','review_priority','final_status'], map: (r) => [r.possible_duplicate_id,r.left_medicine_id,r.right_medicine_id,r.matching_fields,r.conflicting_fields,r.similarity_evidence,r.reason_code,r.review_priority,r.final_status] },
    ];
}

async function insertReasonCodes(connection, options) {
    await assertDatabase(connection, options.target, 'load classification reason codes');
    const medicines = readAll(outputPath(options, 'medicines_clean.csv'));
    const reasonCodes = [...new Set(medicines.flatMap(row => row.reason_codes.split(';')).filter(Boolean))].sort();
    if (reasonCodes.length) {
        await connection.query('INSERT INTO medicine_reason_codes (reason_code, description, severity) VALUES ?', [
            reasonCodes.map(code => [code, `Deterministic medicine pipeline reason: ${code}`, code.includes('CONFLICT') || code.includes('AMBIGUOUS') || code.includes('SUSPICIOUS') ? 'CRITICAL' : 'INFO'])
        ]);
        const assignments = medicines.flatMap(row => row.reason_codes.split(';').filter(Boolean).map(code => [row.medicine_id, code]));
        for (let index = 0; index < assignments.length; index += 500) {
            await assertDatabase(connection, options.target, 'load classification reason assignments');
            await connection.query('INSERT INTO medicine_classification_reasons (medicine_id, reason_code) VALUES ?', [assignments.slice(index, index + 500)]);
        }
    }
}

async function rollbackBatch(connection, options, batchId, finalStatus = 'ROLLED_BACK') {
    await assertDatabase(connection, options.target, `rollback batch ${batchId}`);
    await connection.beginTransaction();
    try {
        await assertDatabase(connection, options.target, 'delete medicine catalogue batch');
        await connection.query('DELETE FROM medicines WHERE import_batch_id = ?', [batchId]);
        await connection.query('DELETE FROM medicine_source_files WHERE import_batch_id = ?', [batchId]);
        await connection.query('DELETE m FROM medicine_manufacturers m LEFT JOIN medicines x ON x.manufacturer_id = m.manufacturer_id WHERE x.medicine_id IS NULL');
        await connection.query('DELETE d FROM medicine_dosage_forms d LEFT JOIN medicines x ON x.dosage_form_id = d.dosage_form_id WHERE x.medicine_id IS NULL');
        await connection.query('DELETE i FROM medicine_ingredients i LEFT JOIN medicine_product_ingredients x ON x.ingredient_id = i.ingredient_id WHERE x.medicine_ingredient_id IS NULL');
        await connection.query('DELETE r FROM medicine_reason_codes r LEFT JOIN medicine_classification_reasons x ON x.reason_code = r.reason_code WHERE x.reason_code IS NULL');
        await connection.query('UPDATE medicine_import_batches SET status = ?, verified_at = NULL WHERE import_batch_id = ?', [finalStatus, batchId]);
        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    }
}

async function verifyImport(connection, options, batchId, summary) {
    await assertDatabase(connection, options.target, 'verify medicine import');
    const countChecks = {
        medicine_source_records: summary.get('source_rows'),
        medicine_source_links: summary.get('source_links'),
        medicines: summary.get('canonical_medicines'),
        medicine_manufacturers: summary.get('manufacturers'),
        medicine_ingredients: summary.get('ingredients'),
        medicine_product_ingredients: summary.get('medicine_ingredients'),
        medicine_packages: summary.get('packages'),
        medicine_prices: summary.get('prices'),
        medicine_registrations: summary.get('registrations'),
        medicine_conflicts: summary.get('conflicts'),
        medicine_possible_duplicates: summary.get('possible_duplicates'),
    };
    const actual = {};
    for (const [table, expected] of Object.entries(countChecks)) {
        await assertDatabase(connection, options.target, `count ${table}`);
        const [[row]] = await connection.query(`SELECT COUNT(*) AS count FROM \`${table}\``);
        actual[table] = Number(row.count);
        if (actual[table] !== expected) throw new Error(`${table} count ${actual[table]} != ${expected}`);
    }
    const [[tiers]] = await connection.query("SELECT SUM(tier='A') AS tier_a, SUM(tier='B') AS tier_b, SUM(tier='C') AS tier_c, SUM(savings_calculation_eligible=1) AS savings FROM medicines WHERE import_batch_id = ?", [batchId]);
    if (Number(tiers.tier_a) !== summary.get('tier_a') || Number(tiers.tier_b) !== summary.get('tier_b') || Number(tiers.tier_c) !== summary.get('tier_c') || Number(tiers.savings) !== summary.get('savings_eligible_medicines')) throw new Error('tier or savings totals differ from output summary');

    const [[invariants]] = await connection.query(`SELECT
        (SELECT COUNT(*) FROM medicine_source_records r LEFT JOIN medicine_source_links l ON l.source_record_id=r.source_record_id WHERE l.source_record_id IS NULL) AS missing_outcomes,
        (SELECT COUNT(*) FROM medicines m LEFT JOIN medicine_source_links l ON l.medicine_id=m.medicine_id WHERE l.medicine_id IS NULL) AS missing_provenance,
        (SELECT COUNT(*) FROM medicines WHERE tier='C' AND (structured_comparison_eligible=1 OR price_comparison_eligible=1 OR savings_calculation_eligible=1)) AS unsafe_tier_c,
        (SELECT COUNT(*) FROM medicine_prices WHERE price_source='REGISTERED_DATASET_RAW' AND savings_calculation_eligible=1) AS unsafe_registered_prices,
        (SELECT COUNT(*) FROM medicine_prices WHERE amount=0) AS zero_prices,
        (SELECT COUNT(*) FROM medicines WHERE source_verified<>0 OR regulatory_verified<>0) AS incorrectly_verified,
        (SELECT COUNT(*) FROM medicine_registrations WHERE source_verified<>0 OR regulatory_verified<>0) AS verified_registrations,
        (SELECT COUNT(*) FROM medicines m WHERE tier='A' AND (SELECT COUNT(DISTINCT source_name) FROM medicine_source_links l WHERE l.medicine_id=m.medicine_id)<>2) AS tier_a_without_two_sources,
        (SELECT COUNT(*) FROM (SELECT manufacturer_id,brand_normalized,generic_signature,strength_signature,dosage_form_id,medicine_type,intended_use,COUNT(*) c FROM medicines GROUP BY manufacturer_id,brand_normalized,generic_signature,strength_signature,dosage_form_id,medicine_type,intended_use HAVING c>1) d) AS duplicate_canonical_identity`);
    for (const [name, value] of Object.entries(invariants)) {
        if (Number(value) !== 0) throw new Error(`medicine invariant failed: ${name}=${value}`);
    }
    const [searchRows] = await connection.query(`SELECT m.medicine_id,m.brand_name,m.strength_original,d.display_name AS dosage_form FROM medicines m JOIN medicine_dosage_forms d ON d.dosage_form_id=m.dosage_form_id WHERE m.brand_normalized LIKE 'a clox%' ORDER BY m.brand_normalized,m.strength_signature LIMIT 5`);
    return { counts: actual, tiers: Object.fromEntries(Object.entries(tiers).map(([key, value]) => [key, Number(value)])), invariants: Object.fromEntries(Object.entries(invariants).map(([key, value]) => [key, Number(value)])), representativeSearch: searchRows };
}

async function main() {
    const options = argumentsFor(process.argv.slice(2));
    const manifest = verifyManifest(options);
    const metadata = sourceMetadata(options);
    const summary = summaryMap(options);
    const connection = await mysql.createConnection(connectionOptions(options.target));
    try {
        await assertDatabase(connection, options.target, options.mode);
        if (options.mode === 'import') {
            await assertDatabase(connection, options.target, 'create medicine schema');
            await connection.query(fs.readFileSync(SCHEMA_PATH, 'utf8'));
        }
        await assertDatabase(connection, options.target, `inspect batch ${metadata.batchId}`);
        const [[existing]] = await connection.query('SELECT * FROM medicine_import_batches WHERE import_batch_id = ?', [metadata.batchId]);

        if (options.mode === 'rollback') {
            if (!existing) throw new Error(`Batch not found: ${metadata.batchId}`);
            await rollbackBatch(connection, options, metadata.batchId);
            const [[remaining]] = await connection.query('SELECT COUNT(*) AS medicines FROM medicines WHERE import_batch_id = ?', [metadata.batchId]);
            process.stdout.write(`${JSON.stringify({ event: 'rollback_verified', batchId: metadata.batchId, remainingMedicines: Number(remaining.medicines) })}\n`);
            return;
        }
        if (options.mode === 'verify') {
            if (!existing || existing.status !== 'VERIFIED') throw new Error(`Verified batch not found: ${metadata.batchId}`);
            const report = await verifyImport(connection, options, metadata.batchId, summary);
            process.stdout.write(`${JSON.stringify({ event: 'import_verified', batchId: metadata.batchId, ...report })}\n`);
            return;
        }

        if (existing && existing.status === 'VERIFIED') {
            if (existing.market_sha256 !== metadata.market.sha256 || existing.registered_sha256 !== metadata.registered.sha256 || existing.manifest_sha256 !== manifest.sha256) throw new Error('Existing batch metadata differs from requested outputs');
            const report = await verifyImport(connection, options, metadata.batchId, summary);
            process.stdout.write(`${JSON.stringify({ event: 'idempotent_noop_verified', batchId: metadata.batchId, ...report })}\n`);
            return;
        }
        if (existing) await rollbackBatch(connection, options, metadata.batchId, 'IMPORTING');

        await assertDatabase(connection, options.target, 'start medicine import');
        await connection.beginTransaction();
        try {
            if (existing) {
                await connection.query("UPDATE medicine_import_batches SET pipeline_version=?,market_sha256=?,registered_sha256=?,manifest_sha256=?,status='IMPORTING',verified_at=NULL WHERE import_batch_id=?", ['nationx-medicine-v1',metadata.market.sha256,metadata.registered.sha256,manifest.sha256,metadata.batchId]);
            } else {
                await connection.query("INSERT INTO medicine_import_batches (import_batch_id,pipeline_version,market_sha256,registered_sha256,manifest_sha256,status) VALUES (?,?,?,?,?,'IMPORTING')", [metadata.batchId,'nationx-medicine-v1',metadata.market.sha256,metadata.registered.sha256,manifest.sha256]);
            }
            for (const specification of specifications()) await insertCsv(connection, options, specification);
            await insertReasonCodes(connection, options);
            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        }
        const report = await verifyImport(connection, options, metadata.batchId, summary);
        await assertDatabase(connection, options.target, 'mark medicine import verified');
        await connection.query("UPDATE medicine_import_batches SET status='VERIFIED',verified_at=CURRENT_TIMESTAMP WHERE import_batch_id=?", [metadata.batchId]);
        process.stdout.write(`${JSON.stringify({ event: 'import_complete', batchId: metadata.batchId, ...report })}\n`);
    } finally {
        await connection.end();
    }
}

main().catch(error => {
    process.stderr.write(`${JSON.stringify({ event: 'medicine_import_failed', error: error.message })}\n`);
    process.exit(1);
});
