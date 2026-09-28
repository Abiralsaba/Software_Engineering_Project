#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.resolve(__dirname, '../..', '.env') });

const target = process.argv[2];
const allowedTargets = new Set(['central_govt_db', 'central_govt_db_test']);

async function main() {
    if (!allowedTargets.has(target)) {
        throw new Error('Target must be central_govt_db or central_govt_db_test.');
    }

    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: target,
        multipleStatements: true
    });

    try {
        const [[selected]] = await connection.query('SELECT DATABASE() AS database_name');
        if (selected.database_name !== target) throw new Error('Database target guard failed.');
        const [[requirements]] = await connection.query(
            `SELECT
                (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'admins') AS admins,
                (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'divisions') AS divisions`,
            [target, target]
        );
        if (Number(requirements.admins) !== 1 || Number(requirements.divisions) !== 1) {
            throw new Error('Base admins and divisions tables are required; no changes were made.');
        }

        const sql = fs.readFileSync(
            path.resolve(__dirname, '../../src/database/migrations/009_admin_role_scopes.sql'),
            'utf8'
        );
        const guardedSql = sql.replace(/^\s*--.*$/gm, '').replace(/ON DELETE (?:CASCADE|SET NULL|RESTRICT|NO ACTION)/gi, '');
        if (/\b(DROP|TRUNCATE|DELETE)\b/i.test(guardedSql)) {
            throw new Error('Migration safety guard rejected a destructive statement.');
        }
        await connection.query(sql);

        const [[result]] = await connection.query(
            `SELECT
                (SELECT COUNT(*) FROM admin_service_domains WHERE is_active = 1) AS domains,
                (SELECT COUNT(*) FROM admin_role_assignments WHERE role_type = 'SUPER_ADMIN' AND is_active = 1) AS super_admins`
        );
        if (Number(result.domains) < 10 || Number(result.super_admins) < 1) {
            throw new Error('Migration verification failed: domain catalogue or bootstrap super admin is missing.');
        }
        console.log(`Verified role-based admin access in ${target}: ${result.domains} domains, ${result.super_admins} super admin(s).`);
    } finally {
        await connection.end();
    }
}

main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
});
