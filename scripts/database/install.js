#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const bcryptjs = require('bcryptjs');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const DATABASE_ROOT = path.join(PROJECT_ROOT, 'src/database');
const ALLOWED_DATABASES = new Set(['central_govt_db', 'central_govt_db_test']);

const args = process.argv.slice(2);
const targetIndex = args.indexOf('--target');
const target = targetIndex >= 0 ? args[targetIndex + 1] : null;
const reset = args.includes('--reset');
let routineInstallationEnabled = true;

if (!ALLOWED_DATABASES.has(target)) {
    console.error('Refusing installation: --target must be central_govt_db or central_govt_db_test.');
    process.exit(1);
}

if (reset && target !== 'central_govt_db_test') {
    console.error('Refusing reset: automated resets are allowed only for central_govt_db_test.');
    process.exit(1);
}

const connectionOptions = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || ''
};

const mysqlBinaryCandidates = [
    process.env.MYSQL_BIN,
    '/Applications/XAMPP/xamppfiles/bin/mysql',
    'mysql'
].filter(Boolean);

function resolveMysqlBinary() {
    for (const candidate of mysqlBinaryCandidates) {
        if (candidate.includes(path.sep)) {
            if (fs.existsSync(candidate)) return candidate;
            continue;
        }

        const result = spawnSync('command', ['-v', candidate], {
            shell: true,
            encoding: 'utf8'
        });
        if (result.status === 0) return candidate;
    }
    throw new Error('MySQL client not found. Set MYSQL_BIN or install the mysql CLI.');
}

function lockSqlToTarget(rawSql, relativePath) {
    let sql = rawSql
        .replace(/^\s*USE\s+`?[^`;\s]+`?\s*;\s*$/gim, '-- database selection removed by allowlisted installer')
        .replace(/^\s*CREATE\s+DATABASE\b[^;]*;\s*$/gim, '-- database creation removed by allowlisted installer')
        .replace(/^\s*DROP\s+DATABASE\b[^;]*;\s*$/gim, '-- database removal removed by allowlisted installer');

    if (/^\s*(USE|CREATE\s+DATABASE|DROP\s+DATABASE)\b/im.test(sql)) {
        throw new Error(`Unsafe database-selection statement remains in ${relativePath}`);
    }

    return `USE \`${target}\`;\n${sql}`;
}

function applyReviewedSourceTransforms(rawSql, relativePath) {
    let sql = rawSql;

    if (relativePath === 'src/database/passport_schema.sql' && !routineInstallationEnabled) {
        const routineStart = sql.indexOf('-- 7. Stored Procedures');
        const triggerStart = sql.indexOf('-- 8. Triggers');
        if (routineStart < 0 || triggerStart < 0 || triggerStart <= routineStart) {
            throw new Error('Reviewed passport routine section no longer matches; refusing implicit rewrite');
        }
        sql = `${sql.slice(0, routineStart)}-- 7. Stored Procedures\n-- Deferred by migration 005: incompatible host mysql.proc system table.\n\n${sql.slice(triggerStart)}`;
    }

    if (relativePath !== 'src/database/schema_full.sql') return sql;

    const staleWaterDefinition = [
        "  created_at timestamp NOT NULL DEFAULT current_timestamp(),",
        "  KEY fk_water_user (user_id),",
        "  CONSTRAINT fk_water_user FOREIGN KEY (user_id) REFERENCES reg_info (id) ON DELETE CASCADE"
    ].join('\n');
    const installableWaterDefinition = [
        "  created_at timestamp NOT NULL DEFAULT current_timestamp(),",
        "  PRIMARY KEY (id),",
        "  KEY fk_water_user (user_id),",
        "  CONSTRAINT fk_water_user FOREIGN KEY (user_id) REFERENCES reg_info (id) ON DELETE CASCADE"
    ].join('\n');

    const occurrences = sql.split(staleWaterDefinition).length - 1;
    if (occurrences !== 1) {
        throw new Error('Reviewed schema_full.sql water placeholder no longer matches exactly; refusing implicit rewrite');
    }
    return sql.replace(staleWaterDefinition, installableWaterDefinition);
}

function runSql(mysqlBinary, relativePath, replacements = {}) {
    const absolutePath = path.join(PROJECT_ROOT, relativePath);
    let sql = applyReviewedSourceTransforms(
        fs.readFileSync(absolutePath, 'utf8'),
        relativePath
    );

    for (const [placeholder, value] of Object.entries(replacements)) {
        if (!sql.includes(placeholder)) {
            throw new Error(`Expected placeholder ${placeholder} is missing in ${relativePath}`);
        }
        sql = sql.split(placeholder).join(value.replaceAll("'", "''"));
    }

    sql = lockSqlToTarget(sql, relativePath);

    const result = spawnSync(mysqlBinary, [
        '--default-character-set=utf8mb4',
        '--host', connectionOptions.host,
        '--port', String(connectionOptions.port),
        '--user', connectionOptions.user,
        '--database', target,
        '--show-warnings'
    ], {
        cwd: PROJECT_ROOT,
        env: { ...process.env, MYSQL_PWD: connectionOptions.password },
        input: sql,
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024
    });

    if (result.status !== 0) {
        const details = (result.stderr || result.stdout || '').trim();
        throw new Error(`SQL failed in ${relativePath}${details ? `:\n${details}` : ''}`);
    }

    console.log(`applied ${relativePath}`);
}

async function prepareDatabase() {
    const connection = await mysql.createConnection(connectionOptions);
    try {
        const [rows] = await connection.query(
            'SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?',
            [target]
        );

        if (rows.length > 0) {
            if (!reset) {
                throw new Error(`${target} already exists; no changes were made. Use --reset only for central_govt_db_test.`);
            }
            await connection.query(`DROP DATABASE \`${target}\``);
            console.log(`reset ${target}`);
        }

        await connection.query(
            `CREATE DATABASE \`${target}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
        );
        console.log(`created ${target} with utf8mb4 / utf8mb4_unicode_ci`);
    } finally {
        await connection.end();
    }
}

async function detectRoutineInstallationSupport() {
    const connection = await mysql.createConnection(connectionOptions);
    try {
        const [[versionRow]] = await connection.query('SELECT VERSION() AS version');
        if (!String(versionRow.version).includes('MariaDB')) return true;

        const [[procRow]] = await connection.query(
            `SELECT COUNT(*) AS column_count
             FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = 'mysql' AND TABLE_NAME = 'proc'`
        );

        // MariaDB 10.4 expects 21 mysql.proc columns. The observed 20-column
        // layout is the known 10.1 -> 10.4 upgrade mismatch.
        return !String(versionRow.version).startsWith('10.4.') || procRow.column_count === 21;
    } finally {
        await connection.end();
    }
}

async function validateDatabase() {
    const connection = await mysql.createConnection({ ...connectionOptions, database: target });
    try {
        const [schemaRows] = await connection.query(
            `SELECT DEFAULT_CHARACTER_SET_NAME AS charset_name,
                    DEFAULT_COLLATION_NAME AS collation_name
             FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?`,
            [target]
        );
        const schema = schemaRows[0];
        if (!schema || schema.charset_name !== 'utf8mb4' || schema.collation_name !== 'utf8mb4_unicode_ci') {
            throw new Error('Database character set/collation validation failed');
        }

        const requiredTables = [
            'reg_info', 'user_info', 'admins', 'todos', 'land_mutations_v2',
            'my_land_record', 'landtax', 'service_requests', 'notifications',
            'nid_cards', 'shop_items', 'addto_cart', 'Ordered_item', 'stipends',
            'stipend_applications'
        ];
        const [tableRows] = await connection.query(
            `SELECT TABLE_NAME FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (?)`,
            [target, requiredTables]
        );
        const foundTables = new Set(tableRows.map(row => row.TABLE_NAME.toLowerCase()));
        const missingTables = requiredTables.filter(name => !foundTables.has(name.toLowerCase()));
        if (missingTables.length) {
            throw new Error(`Required tables missing: ${missingTables.join(', ')}`);
        }

        const [migrationRows] = await connection.query(
            'SELECT version FROM nationx_schema_migrations ORDER BY version'
        );
        const versions = migrationRows.map(row => row.version);
        const expectedVersions = routineInstallationEnabled
            ? '000,001,002,003,004'
            : '000,001,002,003,005';
        if (versions.join(',') !== expectedVersions) {
            throw new Error(`Unexpected migration set: ${versions.join(', ')}`);
        }

        const [constraintRows] = await connection.query(
            `SELECT CONSTRAINT_NAME, TABLE_NAME, REFERENCED_TABLE_NAME
             FROM information_schema.REFERENTIAL_CONSTRAINTS
             WHERE CONSTRAINT_SCHEMA = ?
               AND CONSTRAINT_NAME IN ('fk_land_mutation_buyer', 'fk_landtax_user', 'nid_cards_ibfk_1')`,
            [target]
        );
        const constraints = new Map(constraintRows.map(row => [row.CONSTRAINT_NAME, row]));
        if (!constraints.has('fk_land_mutation_buyer') || !constraints.has('fk_landtax_user')) {
            throw new Error('Approved land buyer or land-tax user foreign key is missing');
        }
        if (constraints.has('nid_cards_ibfk_1')) {
            throw new Error('Invalid nid_cards foreign key still exists');
        }

        const [syntheticRows] = await connection.query(
            `SELECT
                (SELECT COUNT(*) FROM reg_info WHERE email LIKE '%.demo@nationx.test') AS citizens,
                (SELECT COUNT(*) FROM admins WHERE email = 'admin.demo@nationx.test' AND status = 'approved') AS admins,
                (SELECT COUNT(*) FROM divisions WHERE name LIKE 'DEMO DATA — %') AS demo_divisions`
        );
        if (syntheticRows[0].citizens !== 2 || syntheticRows[0].admins !== 1 || syntheticRows[0].demo_divisions !== 1) {
            throw new Error('Synthetic baseline validation failed');
        }

        const [triggerRows] = await connection.query(
            `SELECT TRIGGER_NAME FROM information_schema.TRIGGERS
             WHERE TRIGGER_SCHEMA = ? AND TRIGGER_NAME IN (
                 'after_mutation_approval',
                 'tr_service_request_status_change',
                 'tr_land_mutation_audit_update'
             )`,
            [target]
        );
        if (triggerRows.length !== 3) {
            throw new Error('Corrected trigger set is incomplete');
        }

        console.log(`validated ${target}: schema, constraints, migrations, triggers, and synthetic identities`);
    } finally {
        await connection.end();
    }
}

async function main() {
    const mysqlBinary = resolveMysqlBinary();
    routineInstallationEnabled = await detectRoutineInstallationSupport();
    if (!routineInstallationEnabled) {
        console.log('deferred unused stored routines: host MariaDB mysql.proc requires an external system-table upgrade');
    }
    await prepareDatabase();

    const citizenHash = await bcrypt.hash('NationX-Demo-2026!', 10);
    const adminHash = await bcryptjs.hash('NationX-Admin-2026!', 10);

    const beforeDomains = [
        'src/database/schema_full.sql',
        'src/database/migrations/000_core_dump_installability.sql',
        'src/database/migrations/001_fresh_install_domain_precedence.sql',
        'src/database/migrations/002_backend_contract_compatibility.sql'
    ];
    for (const file of beforeDomains) runSql(mysqlBinary, file);

    runSql(mysqlBinary, 'src/database/seeds/001_synthetic_identities.sql', {
        '__SYNTHETIC_CITIZEN_PASSWORD_HASH__': citizenHash,
        '__SYNTHETIC_ADMIN_PASSWORD_HASH__': adminHash
    });

    const domainSchemas = [
        'src/database/nid_schema.sql',
        'src/database/passport_schema.sql',
        'src/database/health_schema.sql',
        'src/database/water_schema.sql',
        'src/database/nbr_schema.sql',
        'src/database/agriculture_schema.sql',
        'src/database/education_schema.sql',
        'src/database/education_institutions.sql',
        'src/database/university_admission_schema.sql',
        'src/database/market_schema.sql',
        'src/database/shop_schema.sql',
        'src/database/notices_schema.sql',
        'src/database/stipend_schema.sql',
        'src/database/admin_schema.sql',
        'src/database/contact_schema.sql',
        'src/database/land_mutation_schema.sql'
    ];
    for (const file of domainSchemas) runSql(mysqlBinary, file);

    const databaseFeatures = [
        'src/database/schema_normalized.sql',
        'src/database/views.sql',
        'src/database/triggers.sql',
        'src/database/land_mutation_trigger.sql',
        'src/database/migrations/003_trigger_authoritative_land.sql',
    ];
    if (routineInstallationEnabled) {
        databaseFeatures.push(
            'src/database/procedures.sql',
            'src/database/migrations/004_land_procedure_trigger_compatibility.sql'
        );
    } else {
        databaseFeatures.push('src/database/migrations/005_defer_routines_for_incompatible_server.sql');
    }
    databaseFeatures.push('src/database/seeds/002_synthetic_demo_data.sql');
    for (const file of databaseFeatures) runSql(mysqlBinary, file);

    await validateDatabase();
}

main().catch(error => {
    console.error(error.message);
    process.exit(1);
});
