'use strict';

const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DB_NAME = 'central_govt_db_test';
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
if (process.env.DB_NAME !== 'central_govt_db_test') throw new Error('Medicine catalogue tests refuse to run outside central_govt_db_test');

const db = require('../../src/config/db');

test('verified normalized medicine catalogue retains all safety boundaries', async () => {
    try {
        const [[database]] = await db.query('SELECT DATABASE() AS database_name');
        assert.equal(database.database_name, 'central_govt_db_test');

        const [[batch]] = await db.query("SELECT import_batch_id,status FROM medicine_import_batches WHERE status='VERIFIED' ORDER BY verified_at DESC LIMIT 1");
        assert.ok(batch);
        assert.equal(batch.status, 'VERIFIED');

        const [[counts]] = await db.query(`SELECT
            (SELECT COUNT(*) FROM medicine_source_records) AS source_records,
            (SELECT COUNT(*) FROM medicine_source_links) AS source_links,
            (SELECT COUNT(*) FROM medicines) AS medicines,
            (SELECT SUM(tier='A') FROM medicines) AS tier_a,
            (SELECT SUM(tier='B') FROM medicines) AS tier_b,
            (SELECT SUM(tier='C') FROM medicines) AS tier_c,
            (SELECT SUM(savings_calculation_eligible=1) FROM medicines) AS savings_eligible`);
        assert.deepEqual(Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, Number(value)])), {
            source_records: 57799,
            source_links: 57799,
            medicines: 53987,
            tier_a: 3399,
            tier_b: 41999,
            tier_c: 8589,
            savings_eligible: 3376,
        });

        const [[violations]] = await db.query(`SELECT
            (SELECT COUNT(*) FROM medicine_source_records r LEFT JOIN medicine_source_links l ON l.source_record_id=r.source_record_id WHERE l.source_record_id IS NULL) AS missing_outcome,
            (SELECT COUNT(*) FROM medicines WHERE tier='C' AND (structured_comparison_eligible=1 OR savings_calculation_eligible=1)) AS unsafe_tier_c,
            (SELECT COUNT(*) FROM medicine_prices WHERE price_source='REGISTERED_DATASET_RAW' AND savings_calculation_eligible=1) AS registered_price_used,
            (SELECT COUNT(*) FROM medicine_prices WHERE amount=0) AS zero_price,
            (SELECT COUNT(*) FROM medicines WHERE source_verified<>0 OR regulatory_verified<>0 OR requires_professional_confirmation<>1) AS verification_flag_error,
            (SELECT COUNT(*) FROM medicines m WHERE tier='A' AND (SELECT COUNT(DISTINCT source_name) FROM medicine_source_links l WHERE l.medicine_id=m.medicine_id)<>2) AS tier_a_provenance_error`);
        for (const [name, value] of Object.entries(violations)) assert.equal(Number(value), 0, name);

        const [search] = await db.query(`SELECT m.medicine_id,m.brand_name,m.strength_original,d.display_name dosage_form
            FROM medicines m JOIN medicine_dosage_forms d ON d.dosage_form_id=m.dosage_form_id
            WHERE m.brand_normalized='a clox' ORDER BY m.strength_signature,d.normalized_name`);
        assert.ok(search.length >= 4);
        assert.ok(new Set(search.map(row => row.strength_original)).size > 1);
        assert.ok(new Set(search.map(row => row.dosage_form)).size > 1);
    } finally {
        await db.end();
    }
});
