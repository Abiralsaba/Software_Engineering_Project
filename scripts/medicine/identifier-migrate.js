#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.resolve(__dirname, '../..', '.env') });

const args = process.argv.slice(2);
const target = args[args.indexOf('--target') + 1];
const allowDevelopment = args.includes('--allow-development');
const allowed = new Set(['central_govt_db_test', 'central_govt_db']);

if (!allowed.has(target)) throw new Error('--target must be central_govt_db_test or central_govt_db');
if (target === 'central_govt_db' && !allowDevelopment) throw new Error('Development migration requires --allow-development');

const schemaPath = path.resolve(__dirname, '../../src/database/migrations/007_medicine_identifier.sql');

async function main() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '',
        database: target, multipleStatements: true
    });
    try {
        const [[database]] = await connection.query('SELECT DATABASE() AS database_name');
        if (database.database_name !== target) throw new Error(`Database guard failed: expected ${target}`);
        const [[catalogue]] = await connection.query("SELECT COUNT(*) AS count FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME='medicines'", [target]);
        if (Number(catalogue.count) !== 1) throw new Error('Verified medicine catalogue is missing; no changes were made');
        const sql = fs.readFileSync(schemaPath, 'utf8');
        const executableSql = sql.replace(/^\s*--.*$/gm, '');
        if (/(?:^|;)\s*(DROP|TRUNCATE|DELETE|ALTER)\b/i.test(executableSql)) throw new Error('Migration contains a prohibited destructive statement');
        await connection.query(sql);
        const [tables] = await connection.query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME IN ('medicine_scan_sessions','medicine_scan_items','medicine_scan_candidates','medicine_scan_confirmations','medicine_savings_estimates') ORDER BY TABLE_NAME", [target]);
        if (tables.length !== 5) throw new Error('Medicine Identifier migration verification failed');
        console.log(JSON.stringify({ database: database.database_name, tables: tables.map(row => row.TABLE_NAME), status: 'VERIFIED' }));
    } finally {
        await connection.end();
    }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
