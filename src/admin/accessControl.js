'use strict';

const db = require('../config/db');

const ROLES = Object.freeze({
    SUPER_ADMIN: 'SUPER_ADMIN',
    DOMAIN_ADMIN: 'DOMAIN_ADMIN',
    DIVISION_ADMIN: 'DIVISION_ADMIN'
});

const DOMAIN_CODES = Object.freeze([
    'nid', 'passport', 'health', 'water', 'land',
    'agriculture', 'tax', 'education', 'community', 'commerce'
]);

function normalizeAssignment(row) {
    if (!row || !row.role_type) return null;
    return {
        role: row.role_type,
        domainCode: row.domain_code || null,
        domainName: row.domain_name || null,
        domainNameBn: row.domain_name_bn || null,
        parentAuthority: row.parent_authority || null,
        divisionId: row.division_id == null ? null : Number(row.division_id),
        divisionName: row.division_name || null,
        divisionNameBn: row.division_name_bn || null
    };
}

async function loadAdminAccess(adminId, queryable = db) {
    const [rows] = await queryable.query(
        `SELECT a.id, a.name, a.email, a.status,
                r.role_type, r.domain_code, r.division_id,
                d.name AS domain_name, d.name_bn AS domain_name_bn,
                d.parent_authority,
                v.name AS division_name, v.name_bn AS division_name_bn
         FROM admins a
         LEFT JOIN admin_role_assignments r
           ON r.admin_id = a.id AND r.is_active = 1
         LEFT JOIN admin_service_domains d ON d.code = r.domain_code
         LEFT JOIN divisions v ON v.id = r.division_id
         WHERE a.id = ?
         LIMIT 1`,
        [adminId]
    );

    if (!rows.length) return null;
    const admin = rows[0];
    return {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        status: admin.status,
        assignment: normalizeAssignment(admin)
    };
}

function hasDomainAccess(admin, domainCode, { allowDivision = true } = {}) {
    const assignment = admin?.assignment;
    if (!assignment) return false;
    if (assignment.role === ROLES.SUPER_ADMIN) return true;
    if (assignment.domainCode !== domainCode) return false;
    if (assignment.role === ROLES.DOMAIN_ADMIN) return true;
    return allowDivision && assignment.role === ROLES.DIVISION_ADMIN;
}

function isSuperAdmin(admin) {
    return admin?.assignment?.role === ROLES.SUPER_ADMIN;
}

function requireSuperAdmin(req, res, next) {
    if (!isSuperAdmin(req.admin)) {
        return res.status(403).json({
            error: 'This action is reserved for the NationX platform administrator.',
            code: 'SUPER_ADMIN_REQUIRED'
        });
    }
    next();
}

function requireDomain(domainCode, options = {}) {
    if (!DOMAIN_CODES.includes(domainCode)) {
        throw new Error(`Unknown admin service domain: ${domainCode}`);
    }

    return (req, res, next) => {
        if (!hasDomainAccess(req.admin, domainCode, options)) {
            return res.status(403).json({
                error: options.allowDivision === false
                    ? 'Use the scoped work queue for divisional administration.'
                    : 'You do not have access to this service administration area.',
                code: 'ADMIN_SCOPE_DENIED'
            });
        }
        next();
    };
}

function divisionScope(admin) {
    return admin?.assignment?.role === ROLES.DIVISION_ADMIN
        ? admin.assignment.divisionId
        : null;
}

module.exports = {
    DOMAIN_CODES,
    ROLES,
    divisionScope,
    hasDomainAccess,
    isSuperAdmin,
    loadAdminAccess,
    normalizeAssignment,
    requireDomain,
    requireSuperAdmin
};
