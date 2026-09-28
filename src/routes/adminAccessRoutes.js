'use strict';

const express = require('express');
const db = require('../config/db');
const adminMiddleware = require('../middleware/adminMiddleware');
const { DOMAIN_CODES, ROLES, requireSuperAdmin } = require('../admin/accessControl');

const router = express.Router();
const VALID_ROLES = new Set(Object.values(ROLES));

async function getOptions(req, res) {
    try {
        const [[domains], [divisions]] = await Promise.all([
            db.query(
                `SELECT code, name, name_bn, parent_authority, icon, supports_division_scope
                 FROM admin_service_domains WHERE is_active = 1 ORDER BY sort_order, name`
            ),
            db.query(
                `SELECT id, name, name_bn FROM divisions
                 WHERE name NOT LIKE 'DEMO DATA — %' ORDER BY id`
            )
        ]);
        res.json({ domains, divisions });
    } catch (error) {
        console.error('Admin access options error:', error);
        res.status(503).json({
            error: 'Administrative access options are temporarily unavailable.',
            code: 'ADMIN_OPTIONS_UNAVAILABLE'
        });
    }
}

router.get('/options', getOptions);
router.use(adminMiddleware, requireSuperAdmin);

router.get('/admins', async (req, res) => {
    try {
        const [admins] = await db.query(
            `SELECT a.id, a.name, a.email, a.mobile, a.nid, a.status,
                    a.requested_domain_code, a.requested_scope_level,
                    a.requested_division_id, a.access_request_note, a.created_at,
                    r.role_type, r.domain_code, r.division_id,
                    d.name AS domain_name, d.name_bn AS domain_name_bn,
                    v.name AS division_name, v.name_bn AS division_name_bn
             FROM admins a
             LEFT JOIN admin_role_assignments r
               ON r.admin_id = a.id AND r.is_active = 1
             LEFT JOIN admin_service_domains d ON d.code = r.domain_code
             LEFT JOIN divisions v ON v.id = r.division_id
             ORDER BY FIELD(a.status, 'pending', 'approved', 'rejected'), a.created_at DESC`
        );
        res.json(admins);
    } catch (error) {
        console.error('Admin access list error:', error);
        res.status(500).json({ error: 'Could not load administrator access records.' });
    }
});

router.get('/audit', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT l.id, l.action_type, l.previous_access, l.new_access, l.note, l.created_at,
                    actor.name AS actor_name, target.name AS target_name
             FROM admin_access_audit_log l
             JOIN admins actor ON actor.id = l.actor_admin_id
             JOIN admins target ON target.id = l.target_admin_id
             ORDER BY l.created_at DESC LIMIT 100`
        );
        res.json(rows);
    } catch (error) {
        console.error('Admin access audit error:', error);
        res.status(500).json({ error: 'Could not load the access audit trail.' });
    }
});

async function validateAssignment(body, queryable = db) {
    const role = String(body.role || '').toUpperCase();
    const domainCode = body.domainCode || null;
    const divisionId = body.divisionId == null || body.divisionId === '' ? null : Number(body.divisionId);

    if (!VALID_ROLES.has(role)) return { error: 'Select a valid administrator role.' };
    if (role === ROLES.SUPER_ADMIN) return { role, domainCode: null, divisionId: null };
    if (!DOMAIN_CODES.includes(domainCode)) return { error: 'Select a valid service responsibility.' };
    if (role === ROLES.DIVISION_ADMIN && (!Number.isInteger(divisionId) || divisionId < 1)) {
        return { error: 'Select the division this administrator will manage.' };
    }
    if (role === ROLES.DIVISION_ADMIN) {
        const [domains] = await queryable.query(
            'SELECT supports_division_scope FROM admin_service_domains WHERE code = ? AND is_active = 1',
            [domainCode]
        );
        if (!domains.length || !domains[0].supports_division_scope) {
            return { error: 'This service is administered centrally and does not support a divisional role.' };
        }
    }
    return { role, domainCode, divisionId: role === ROLES.DIVISION_ADMIN ? divisionId : null };
}

router.put('/admins/:id/access', async (req, res) => {
    const targetId = Number(req.params.id);
    const nextStatus = String(req.body.status || 'approved').toLowerCase();
    const note = String(req.body.note || '').trim().slice(0, 500) || null;
    if (!Number.isInteger(targetId) || targetId < 1) {
        return res.status(400).json({ error: 'Invalid administrator account.' });
    }
    if (!['approved', 'rejected'].includes(nextStatus)) {
        return res.status(400).json({ error: 'Status must be approved or rejected.' });
    }
    if (targetId === Number(req.admin.id)) {
        return res.status(409).json({ error: 'You cannot change your own administrative access.' });
    }

    const assignment = nextStatus === 'approved' ? await validateAssignment(req.body) : null;
    if (assignment?.error) return res.status(400).json({ error: assignment.error });

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [targets] = await connection.query(
            `SELECT a.id, a.status, r.role_type, r.domain_code, r.division_id
             FROM admins a LEFT JOIN admin_role_assignments r ON r.admin_id = a.id
             WHERE a.id = ? FOR UPDATE`,
            [targetId]
        );
        if (!targets.length) {
            await connection.rollback();
            return res.status(404).json({ error: 'Administrator account not found.' });
        }

        const previous = targets[0];
        const removesSuperAccess = previous.role_type === ROLES.SUPER_ADMIN
            && (nextStatus !== 'approved' || assignment.role !== ROLES.SUPER_ADMIN);
        if (removesSuperAccess) {
            const [[count]] = await connection.query(
                `SELECT COUNT(*) AS total FROM admin_role_assignments r
                 JOIN admins a ON a.id = r.admin_id
                 WHERE r.role_type = 'SUPER_ADMIN' AND r.is_active = 1 AND a.status = 'approved'`
            );
            if (Number(count.total) <= 1) {
                await connection.rollback();
                return res.status(409).json({ error: 'At least one active platform super administrator is required.' });
            }
        }

        await connection.query(
            `UPDATE admins SET status = ?, approved_by = ?,
                    approved_at = CASE WHEN ? = 'approved' THEN NOW() ELSE NULL END
             WHERE id = ?`,
            [nextStatus, req.admin.id, nextStatus, targetId]
        );

        if (nextStatus === 'approved') {
            if (assignment.divisionId) {
                const [divisions] = await connection.query('SELECT id FROM divisions WHERE id = ?', [assignment.divisionId]);
                if (!divisions.length) {
                    await connection.rollback();
                    return res.status(400).json({ error: 'The selected division does not exist.' });
                }
            }
            await connection.query(
                `INSERT INTO admin_role_assignments
                    (admin_id, role_type, domain_code, division_id, is_active, assigned_by)
                 VALUES (?, ?, ?, ?, 1, ?)
                 ON DUPLICATE KEY UPDATE role_type = VALUES(role_type),
                    domain_code = VALUES(domain_code), division_id = VALUES(division_id),
                    is_active = 1, assigned_by = VALUES(assigned_by), assigned_at = CURRENT_TIMESTAMP`,
                [targetId, assignment.role, assignment.domainCode, assignment.divisionId, req.admin.id]
            );
        } else {
            await connection.query('UPDATE admin_role_assignments SET is_active = 0 WHERE admin_id = ?', [targetId]);
        }

        const auditAction = nextStatus === 'rejected'
            ? (previous.status === 'approved' ? 'SUSPEND' : 'REJECT')
            : (previous.status === 'approved' ? 'CHANGE_SCOPE' : 'APPROVE');
        await connection.query(
            `INSERT INTO admin_access_audit_log
                (actor_admin_id, target_admin_id, action_type, previous_access, new_access, note)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [req.admin.id, targetId, auditAction, JSON.stringify(previous),
                JSON.stringify(nextStatus === 'approved' ? { status: nextStatus, ...assignment } : { status: nextStatus }), note]
        );
        await connection.commit();
        res.json({ success: true, message: nextStatus === 'approved' ? 'Administrator access updated.' : 'Administrator access revoked.' });
    } catch (error) {
        await connection.rollback();
        console.error('Admin access update error:', error);
        res.status(500).json({ error: 'Could not update administrator access.' });
    } finally {
        connection.release();
    }
});

module.exports = router;
