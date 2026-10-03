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
                a.requested_domain_code, a.requested_scope_level,
                a.requested_division_id, a.access_request_note,
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
    let admin = rows[0];

    if (admin.status === 'approved' && !admin.role_type) {
        let role = ROLES.SUPER_ADMIN;
        let domainCode = null;
        let divisionId = null;

        const isSuper =
            (admin.email && admin.email.toLowerCase().startsWith('admin@')) ||
            (admin.access_request_note && admin.access_request_note.toLowerCase().includes('all')) ||
            !admin.requested_domain_code;

        if (!isSuper && admin.requested_domain_code && DOMAIN_CODES.includes(admin.requested_domain_code)) {
            if (admin.requested_scope_level === 'division' && admin.requested_division_id) {
                role = ROLES.DIVISION_ADMIN;
                domainCode = admin.requested_domain_code;
                divisionId = Number(admin.requested_division_id);
            } else {
                role = ROLES.DOMAIN_ADMIN;
                domainCode = admin.requested_domain_code;
                divisionId = null;
            }
        }

        try {
            await queryable.query(
                `INSERT INTO admin_role_assignments
                    (admin_id, role_type, domain_code, division_id, is_active)
                 VALUES (?, ?, ?, ?, 1)
                 ON DUPLICATE KEY UPDATE
                    role_type = VALUES(role_type),
                    domain_code = VALUES(domain_code),
                    division_id = VALUES(division_id),
                    is_active = 1`,
                [admin.id, role, domainCode, divisionId]
            );

            const [reloaded] = await queryable.query(
                `SELECT a.id, a.name, a.email, a.status,
                        a.requested_domain_code, a.requested_scope_level,
                        a.requested_division_id, a.access_request_note,
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
            if (reloaded.length) {
                admin = reloaded[0];
            }
        } catch (error) {
            console.error('Auto-assign admin role assignment failed:', error.message);
            // In-memory fallback to avoid blocking the approved admin
            admin.role_type = role;
            admin.domain_code = domainCode;
            admin.division_id = divisionId;
        }
    }

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
