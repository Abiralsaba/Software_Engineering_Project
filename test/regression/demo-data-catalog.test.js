'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DB_NAME = 'central_govt_db_test';
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

if (process.env.DB_NAME !== 'central_govt_db_test') {
    throw new Error('Demo-data tests refuse to run outside central_govt_db_test');
}

const db = require('../../src/config/db');
const projectRoot = path.resolve(__dirname, '../..');

test('professional Bangladesh demo catalogue is complete, bilingual and synthetic', async () => {
    try {
        const [[locations]] = await db.query(`
            SELECT
                (SELECT COUNT(*) FROM divisions WHERE geo_code IS NOT NULL AND name_bn <> '') AS divisions,
                (SELECT COUNT(*) FROM districts WHERE geo_code IS NOT NULL AND name_bn <> '') AS districts,
                (SELECT COUNT(*) FROM upazilas WHERE geo_code IS NOT NULL AND name_bn <> '') AS upazilas
        `);
        assert.deepEqual(locations, { divisions: 8, districts: 64, upazilas: 495 });

        for (const table of ['jsc_results', 'ssc_results', 'hsc_results']) {
            const [students] = await db.query(
                `SELECT roll_number, registration_number, student_name, father_name, mother_name, institution_name
                 FROM ${table} WHERE registration_number LIKE 'DEMO-%'`
            );
            assert.equal(students.length, 22, `${table} should cover all 11 boards with two students`);
            for (const row of students) {
                assert.match(row.roll_number, /^[0-9]+$/);
                assert.match(row.registration_number, /^DEMO-/);
                for (const key of ['student_name', 'father_name', 'mother_name', 'institution_name']) {
                    assert.match(row[key], /[\u0980-\u09ff]/, `${table}.${key} must contain Bengali text`);
                }
            }
        }

        const [products] = await db.query(
            "SELECT name,image_url FROM shop_items WHERE image_url LIKE '/images/demo/shop/%'"
        );
        assert.ok(products.length >= 8);
        for (const product of products) {
            const asset = path.join(projectRoot, 'public', product.image_url.replace(/^\//, ''));
            assert.equal(fs.existsSync(asset), true, `${product.name} image should exist`);
        }

        const [groups] = await db.query(
            "SELECT id,name,cover_image FROM community_groups WHERE cover_image LIKE '/images/demo/community/%' AND status='approved'"
        );
        assert.equal(groups.length, 4);
        for (const group of groups) {
            assert.match(group.name, /[\u0980-\u09ff]/);
            const [[posts]] = await db.query('SELECT COUNT(*) AS count FROM community_posts WHERE group_id=? AND status=\'approved\'', [group.id]);
            assert.equal(posts.count, 2);
            assert.equal(fs.existsSync(path.join(projectRoot, 'public', group.cover_image.replace(/^\//, ''))), true);
        }

        const [[services]] = await db.query(`
            SELECT
                (SELECT COUNT(*) FROM nid_correction_requests WHERE request_no LIKE 'NID-DEMO-%') AS nid,
                (SELECT COUNT(*) FROM passport_applications WHERE application_number LIKE 'DEMO-PAS-%') AS passport,
                (SELECT COUNT(*) FROM health_cards WHERE card_number LIKE 'DEMO-HC-%') AS health,
                (SELECT COUNT(*) FROM water_connections WHERE connection_number LIKE 'DEMO-WASA-%') AS water,
                (SELECT COUNT(*) FROM agri_training_programs WHERE title='নিরাপদ সবজি উৎপাদন ও বাজারজাতকরণ') AS agriculture,
                (SELECT COUNT(*) FROM nbr_tax_returns WHERE submission_ref LIKE 'DEMO-RETURN-%') AS tax,
                (SELECT COUNT(*) FROM land_mutations_v2 WHERE tracking_number LIKE 'DEMO-LAND-%') AS land
        `);
        assert.deepEqual(services, { nid: 1, passport: 1, health: 1, water: 1, agriculture: 1, tax: 1, land: 1 });
    } finally {
        await db.end();
    }
});
