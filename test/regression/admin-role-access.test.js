'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {
    DOMAIN_CODES, ROLES, divisionScope, hasDomainAccess, isSuperAdmin, normalizeAssignment, loadAdminAccess
} = require('../../src/admin/accessControl');

test('platform, central-domain and divisional roles have distinct authority', () => {
    const superAdmin = { assignment: { role: ROLES.SUPER_ADMIN } };
    const centralHealth = { assignment: { role: ROLES.DOMAIN_ADMIN, domainCode: 'health' } };
    const dhakaHealth = { assignment: { role: ROLES.DIVISION_ADMIN, domainCode: 'health', divisionId: 1 } };

    assert.equal(isSuperAdmin(superAdmin), true);
    assert.equal(hasDomainAccess(superAdmin, 'tax'), true);
    assert.equal(hasDomainAccess(centralHealth, 'health'), true);
    assert.equal(hasDomainAccess(centralHealth, 'water'), false);
    assert.equal(hasDomainAccess(dhakaHealth, 'health'), true);
    assert.equal(hasDomainAccess(dhakaHealth, 'health', { allowDivision: false }), false);
    assert.equal(divisionScope(dhakaHealth), 1);
    assert.equal(divisionScope(centralHealth), null);
});

test('database assignment rows are exposed without leaking unrelated account data', () => {
    assert.deepEqual(normalizeAssignment({
        role_type: 'DIVISION_ADMIN', domain_code: 'agriculture', domain_name: 'Agriculture Services',
        domain_name_bn: 'কৃষি সেবা', parent_authority: 'Ministry of Agriculture',
        division_id: 3, division_name: 'Dhaka', division_name_bn: 'ঢাকা'
    }), {
        role: 'DIVISION_ADMIN', domainCode: 'agriculture', domainName: 'Agriculture Services',
        domainNameBn: 'কৃষি সেবা', parentAuthority: 'Ministry of Agriculture',
        divisionId: 3, divisionName: 'Dhaka', divisionNameBn: 'ঢাকা'
    });
    assert.equal(DOMAIN_CODES.length, 10);
});

test('admin migration contains scope constraints, audit storage and a safe super-admin bootstrap', () => {
    const sql = fs.readFileSync(path.resolve(__dirname, '../../src/database/migrations/009_admin_role_scopes.sql'), 'utf8');
    assert.match(sql, /CREATE TABLE IF NOT EXISTS admin_role_assignments/);
    assert.match(sql, /role_type ENUM\('SUPER_ADMIN','DOMAIN_ADMIN','DIVISION_ADMIN'\)/);
    assert.match(sql, /CREATE TABLE IF NOT EXISTS admin_access_audit_log/);
    assert.match(sql, /NOT EXISTS \(SELECT 1 FROM admin_role_assignments\)/);
    const guardedSql = sql.replace(/^\s*--.*$/gm, '').replace(/ON DELETE (?:CASCADE|SET NULL|RESTRICT|NO ACTION)/gi, '');
    assert.doesNotMatch(guardedSql, /\b(?:DROP|TRUNCATE|DELETE)\b/i);
});

test('loadAdminAccess auto-provisions assignment for approved admin missing role assignment', async () => {
    let inserted = null;
    const mockQueryable = {
        async query(sql, params) {
            if (sql.includes('INSERT INTO admin_role_assignments')) {
                inserted = params;
                return [{ affectedRows: 1 }];
            }
            if (sql.includes('SELECT a.id, a.name, a.email, a.status')) {
                if (inserted) {
                    return [[{
                        id: 42, name: 'Admin', email: 'admin@gmail.com', status: 'approved',
                        requested_domain_code: 'nid', requested_scope_level: 'central',
                        requested_division_id: null, access_request_note: 'all',
                        role_type: inserted[1], domain_code: inserted[2], division_id: inserted[3]
                    }]];
                }
                return [[{
                    id: 42, name: 'Admin', email: 'admin@gmail.com', status: 'approved',
                    requested_domain_code: 'nid', requested_scope_level: 'central',
                    requested_division_id: null, access_request_note: 'all',
                    role_type: null, domain_code: null, division_id: null
                }]];
            }
            return [[]];
        }
    };

    const access = await loadAdminAccess(42, mockQueryable);
    assert.ok(access);
    assert.equal(access.status, 'approved');
    assert.equal(access.assignment.role, ROLES.SUPER_ADMIN);
    assert.deepEqual(inserted, [42, 'SUPER_ADMIN', null, null]);
});

test('loadAdminAccess auto-provisions divisional role for approved divisional admin missing role assignment', async () => {
    let inserted = null;
    const mockQueryable = {
        async query(sql, params) {
            if (sql.includes('INSERT INTO admin_role_assignments')) {
                inserted = params;
                return [{ affectedRows: 1 }];
            }
            if (sql.includes('SELECT a.id, a.name, a.email, a.status')) {
                if (inserted) {
                    return [[{
                        id: 43, name: 'Div Officer', email: 'officer@example.com', status: 'approved',
                        requested_domain_code: 'health', requested_scope_level: 'division',
                        requested_division_id: 3, access_request_note: '',
                        role_type: inserted[1], domain_code: inserted[2], division_id: inserted[3]
                    }]];
                }
                return [[{
                    id: 43, name: 'Div Officer', email: 'officer@example.com', status: 'approved',
                    requested_domain_code: 'health', requested_scope_level: 'division',
                    requested_division_id: 3, access_request_note: '',
                    role_type: null, domain_code: null, division_id: null
                }]];
            }
            return [[]];
        }
    };

    const access = await loadAdminAccess(43, mockQueryable);
    assert.ok(access);
    assert.equal(access.status, 'approved');
    assert.equal(access.assignment.role, ROLES.DIVISION_ADMIN);
    assert.equal(access.assignment.domainCode, 'health');
    assert.equal(access.assignment.divisionId, 3);
    assert.deepEqual(inserted, [43, 'DIVISION_ADMIN', 'health', 3]);
});
