'use strict';

const express = require('express');
const db = require('../config/db');
const adminMiddleware = require('../middleware/adminMiddleware');
const { divisionScope, hasDomainAccess } = require('../admin/accessControl');

const router = express.Router();

const WORK_RESOURCES = Object.freeze({
    nid: {
        applications: {
            label: 'NID applications', table: 'nid_applications', alias: 'w', divisionId: 'w.present_division_id',
            select: 'w.id, w.application_no AS reference, w.name_en AS applicant, w.mobile, w.status, w.created_at',
            statuses: ['Submitted', 'Under Review', 'Biometric Pending', 'Verified', 'Approved', 'Rejected']
        }
    },
    passport: {
        applications: {
            label: 'Passport applications', table: 'passport_applications', alias: 'w', divisionText: 'w.present_division',
            select: 'w.id, w.application_number AS reference, w.full_name_en AS applicant, w.mobile_number AS mobile, w.status, w.submitted_at AS created_at',
            dateColumn: 'submitted_at',
            statuses: ['Submitted', 'Under Review', 'Biometric Scheduled', 'Police Verification', 'Approved', 'Rejected', 'Ready for Delivery']
        }
    },
    health: {
        cards: {
            label: 'Health cards', table: 'health_cards', alias: 'w', divisionText: 'w.division',
            select: 'w.id, w.card_number AS reference, w.full_name AS applicant, w.phone AS mobile, w.status, w.created_at',
            statuses: ['Pending', 'Approved', 'Rejected']
        },
        ambulance: {
            label: 'Ambulance requests', table: 'health_ambulance_requests', alias: 'w', divisionText: 'w.division',
            select: 'w.id, CONCAT(\'AMB-\', w.id) AS reference, w.patient_name AS applicant, w.phone AS mobile, w.status, w.created_at',
            statuses: ['Requested', 'Dispatched', 'En Route', 'Arrived', 'Completed', 'Cancelled']
        },
        complaints: {
            label: 'Health complaints', table: 'health_complaints', alias: 'w', divisionText: 'w.division',
            select: 'w.id, CONCAT(\'HC-\', w.id) AS reference, w.hospital_name AS applicant, w.complaint_type AS summary, w.status, w.created_at',
            statuses: ['Submitted', 'Under Review', 'Resolved', 'Rejected']
        },
        appointments: {
            label: 'Medical appointments', table: 'health_appointments', alias: 'w',
            joins: 'LEFT JOIN health_hospitals h ON h.id = w.hospital_id', divisionText: 'h.division',
            select: 'w.id, CONCAT(\'APT-\', w.id) AS reference, w.patient_name AS applicant, w.department AS summary, w.status, w.created_at',
            statuses: ['Pending', 'Confirmed', 'Completed', 'Cancelled', 'No Show']
        }
    },
    water: {
        connections: {
            label: 'Water connections', table: 'water_connections', alias: 'w', divisionText: 'w.division',
            select: 'w.id, w.connection_number AS reference, w.holder_name AS applicant, w.phone AS mobile, w.status, w.created_at',
            statuses: ['Pending', 'Under Review', 'Approved', 'Rejected', 'Active', 'Disconnected']
        },
        quality: {
            label: 'Water quality reports', table: 'water_quality_reports', alias: 'w', divisionText: 'w.division',
            select: 'w.id, CONCAT(\'WQ-\', w.id) AS reference, w.issue_type AS applicant, w.severity AS summary, w.status, w.created_at',
            statuses: ['Reported', 'Under Investigation', 'Testing', 'Action Taken', 'Resolved', 'Closed']
        },
        complaints: {
            label: 'Water complaints', table: 'water_complaints', alias: 'w', divisionText: 'w.division',
            select: 'w.id, CONCAT(\'WC-\', w.id) AS reference, w.complaint_type AS applicant, w.priority AS summary, w.status, w.created_at',
            statuses: ['Submitted', 'Assigned', 'In Progress', 'Resolved', 'Rejected', 'Closed']
        },
        bills: {
            label: 'Water bills', table: 'water_bill_payments', alias: 'w',
            joins: 'LEFT JOIN water_connections c ON c.id = w.connection_id', divisionText: 'c.division',
            select: 'w.id, COALESCE(w.connection_number, CONCAT(\'BILL-\', w.id)) AS reference, w.billing_month AS applicant, w.total_amount AS summary, w.status, w.created_at',
            statuses: ['Pending', 'Paid', 'Failed', 'Overdue']
        }
    },
    land: {
        mutations: {
            label: 'Land mutation requests', table: 'land_mutations_v2', alias: 'w', divisionId: 'w.division_id',
            select: 'w.id, w.tracking_number AS reference, w.applicant_name AS applicant, w.applicant_nid AS summary, w.status, w.created_at',
            statuses: ['Pending', 'Approved', 'Rejected']
        }
    },
    agriculture: {
        subsidies: {
            label: 'Agriculture subsidies', table: 'agri_subsidies', alias: 'w', divisionId: 'w.division_id',
            select: 'w.id, CONCAT(\'SUB-\', w.id) AS reference, w.farmer_name AS applicant, w.subsidy_type AS summary, w.status, w.created_at',
            statuses: ['Pending', 'Under Review', 'Approved', 'Rejected']
        },
        market: {
            label: 'Farmer market listings', table: 'agri_farmer_market', alias: 'w', divisionId: 'w.division_id',
            select: 'w.id, CONCAT(\'MKT-\', w.id) AS reference, w.farmer_name AS applicant, w.product_name AS summary, w.status, w.created_at',
            statuses: ['Pending', 'Approved', 'Sold', 'Expired', 'Rejected']
        }
    },
    tax: {
        tins: {
            label: 'TIN registrations', table: 'nbr_tin_registrations', alias: 'w',
            joins: 'LEFT JOIN nbr_tax_zones z ON z.id = w.zone_id', divisionText: 'z.division',
            select: 'w.id, COALESCE(w.tin_number, CONCAT(\'TIN-\', w.id)) AS reference, w.taxpayer_name AS applicant, w.mobile, w.status, w.created_at',
            statuses: ['Pending', 'Approved', 'Rejected', 'Suspended']
        },
        returns: {
            label: 'Tax returns', table: 'nbr_tax_returns', alias: 'w',
            joins: 'LEFT JOIN nbr_tin_registrations t ON t.id = w.tin_id LEFT JOIN nbr_tax_zones z ON z.id = t.zone_id', divisionText: 'z.division',
            select: 'w.id, w.submission_ref AS reference, w.assessment_year AS applicant, w.total_income AS summary, w.status, w.created_at',
            statuses: ['Submitted', 'Under Review', 'Assessed', 'Accepted', 'Rejected']
        }
    },
    education: {
        admissions: {
            label: 'University applications', table: 'university_applications', alias: 'w',
            joins: 'JOIN admission_posts p ON p.id = w.admission_post_id JOIN universities u ON u.id = p.university_id',
            divisionText: 'u.location', statusColumn: 'application_status',
            select: 'w.id, w.application_id AS reference, w.student_name AS applicant, u.name AS summary, w.application_status AS status, w.created_at',
            userId: null,
            statuses: ['Submitted', 'Verified', 'Rejected', 'Cancelled']
        }
    },
    community: {
        groups: {
            label: 'Community groups', table: 'community_groups', alias: 'w', userId: 'w.created_by',
            select: 'w.id, CONCAT(\'GROUP-\', w.id) AS reference, w.name AS applicant, w.description AS summary, w.status, w.created_at',
            statuses: ['pending', 'approved', 'rejected']
        },
        posts: {
            label: 'Community posts', table: 'community_posts', alias: 'w',
            select: 'w.id, CONCAT(\'POST-\', w.id) AS reference, CONCAT(\'Group #\', w.group_id) AS applicant, LEFT(w.content, 120) AS summary, w.status, w.created_at',
            statuses: ['pending', 'approved', 'rejected']
        }
    },
    commerce: {
        orders: {
            label: 'Marketplace orders', table: 'Ordered_item', alias: 'w', statusColumn: 'payment_status',
            select: 'w.id, CONCAT(\'ORDER-\', w.id) AS reference, w.contact_number AS applicant, w.total_amount AS summary, w.payment_status AS status, w.created_at',
            statuses: [], readOnly: true
        },
        complaints: {
            label: 'Marketplace complaints', table: 'price_complaints', alias: 'w',
            select: 'w.id, CONCAT(\'COMPLAINT-\', w.id) AS reference, w.shop_name AS applicant, w.item_name AS summary, w.status, w.created_at',
            statuses: ['pending', 'investigating', 'resolved', 'dismissed']
        }
    }
});

function divisionNames(admin) {
    const name = String(admin.assignment.divisionName || '').trim();
    const aliases = new Set([name]);
    if (/chattogram/i.test(name)) aliases.add('Chittagong');
    if (/chittagong/i.test(name)) aliases.add('Chattogram');
    if (/barishal/i.test(name)) aliases.add('Barisal');
    if (/barisal/i.test(name)) aliases.add('Barishal');
    return [...aliases].filter(Boolean);
}

function scopeClause(req, resource) {
    const scopedDivision = divisionScope(req.admin);
    if (!scopedDivision) return { sql: '1=1', params: [] };
    if (resource.divisionId) return { sql: `${resource.divisionId} = ?`, params: [scopedDivision] };
    if (resource.divisionText) {
        const names = divisionNames(req.admin);
        return {
            sql: `(${names.map(() => `LOWER(TRIM(${resource.divisionText})) = LOWER(?) OR LOWER(${resource.divisionText}) LIKE CONCAT('%', LOWER(?), '%')`).join(' OR ')})`,
            params: names.flatMap(name => [name, name])
        };
    }
    return { sql: '1=0', params: [] };
}

function requireWorkDomain(req, res, next) {
    const domain = req.params.domain;
    if (!WORK_RESOURCES[domain]) return res.status(404).json({ error: 'Administration area not found.' });
    if (!hasDomainAccess(req.admin, domain)) {
        return res.status(403).json({ error: 'You do not have access to this service administration area.', code: 'ADMIN_SCOPE_DENIED' });
    }
    next();
}

router.use(adminMiddleware);

router.get('/:domain', requireWorkDomain, async (req, res) => {
    const resources = WORK_RESOURCES[req.params.domain];
    const resourceKey = req.query.resource && resources[req.query.resource]
        ? req.query.resource
        : Object.keys(resources)[0];
    const resource = resources[resourceKey];
    const scope = scopeClause(req, resource);
    const requestedStatus = String(req.query.status || '').trim();
    const statusColumn = resource.statusColumn || 'status';
    const statusSql = requestedStatus && resource.statuses.includes(requestedStatus) ? ` AND w.${statusColumn} = ?` : '';
    const params = [...scope.params, ...(statusSql ? [requestedStatus] : [])];

    try {
        const [items] = await db.query(
            `SELECT ${resource.select}
             FROM ${resource.table} ${resource.alias}
             ${resource.joins || ''}
             WHERE ${scope.sql}${statusSql}
             ORDER BY w.${resource.dateColumn || 'created_at'} DESC LIMIT 250`,
            params
        );
        res.json({
            domain: req.params.domain,
            scope: req.admin.assignment,
            selectedResource: resourceKey,
            resources: Object.entries(resources).map(([key, value]) => ({ key, label: value.label, statuses: value.statuses, readOnly: Boolean(value.readOnly) })),
            items
        });
    } catch (error) {
        console.error('Scoped admin queue error:', error);
        res.status(500).json({ error: 'Could not load the scoped work queue.' });
    }
});

router.put('/:domain/:resource/:id/status', requireWorkDomain, async (req, res) => {
    const resource = WORK_RESOURCES[req.params.domain]?.[req.params.resource];
    const itemId = Number(req.params.id);
    const status = String(req.body.status || '');
    if (!resource || !Number.isInteger(itemId) || itemId < 1) return res.status(404).json({ error: 'Work item not found.' });
    if (!resource.statuses.includes(status)) return res.status(400).json({ error: 'Select a valid workflow status.' });

    const scope = scopeClause(req, resource);
    const statusColumn = resource.statusColumn || 'status';
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const userIdSelect = resource.userId === null ? '' : `, ${resource.userId || 'w.user_id'} AS scoped_user_id`;
        const [rows] = await connection.query(
            `SELECT w.id, w.${statusColumn} AS old_status${userIdSelect}
             FROM ${resource.table} w ${resource.joins || ''}
             WHERE w.id = ? AND ${scope.sql} FOR UPDATE`,
            [itemId, ...scope.params]
        );
        if (!rows.length) {
            await connection.rollback();
            return res.status(404).json({ error: 'Work item was not found within your assigned scope.' });
        }
        const updates = [`${statusColumn} = ?`];
        const updateParams = [status];
        if (req.params.domain === 'nid') {
            updates.push('reviewed_by = ?', 'reviewed_at = NOW()');
            updateParams.push(req.admin.id);
            if (status === 'Approved') {
                updates.push('approved_by = ?', 'approved_at = NOW()');
                updateParams.push(req.admin.id);
            }
        }
        if (req.params.domain === 'passport') {
            const timestampColumns = {
                'Biometric Scheduled': 'biometric_date', 'Police Verification': 'police_verification_date',
                Approved: 'approved_at', 'Ready for Delivery': 'dispatched_at'
            };
            if (timestampColumns[status]) updates.push(`${timestampColumns[status]} = NOW()`);
        }
        if (req.params.domain === 'agriculture' && req.params.resource === 'subsidies') updates.push('reviewed_at = NOW()');
        if (req.params.domain === 'tax' && (req.params.resource === 'returns' || status === 'Approved')) {
            updates.push(req.params.resource === 'returns' ? 'reviewed_by = ?' : 'approved_by = ?');
            updates.push(req.params.resource === 'returns' ? 'reviewed_at = NOW()' : 'approved_at = NOW()');
            updateParams.push(req.admin.id);
        }
        if (req.params.domain === 'education') {
            updates.push('verified_by = ?', 'verified_at = NOW()');
            updateParams.push(req.admin.id);
        }
        if (req.params.domain === 'water' && req.params.resource === 'connections' && ['Approved', 'Active'].includes(status)) {
            updates.push('approved_date = COALESCE(approved_date, CURRENT_DATE)');
        }

        await connection.query(
            `UPDATE ${resource.table} SET ${updates.join(', ')} WHERE id = ?`,
            [...updateParams, itemId]
        );
        if (req.params.domain === 'passport') {
            await connection.query(
                `INSERT INTO passport_status_history
                    (application_id, old_status, new_status, changed_by, remarks)
                 VALUES (?, ?, ?, ?, 'Updated through scoped NationX administration')`,
                [itemId, rows[0].old_status, status, req.admin.name]
            );
        }
        if (req.params.domain === 'nid' && rows[0].scoped_user_id) {
            await connection.query(
                `INSERT INTO nid_activity_log (user_id, activity_type, activity_details)
                 VALUES (?, 'Profile Update', ?)`,
                [rows[0].scoped_user_id, `Administrative workflow status changed to ${status}`]
            );
        }
        if (rows[0].scoped_user_id) {
            await connection.query(
                `INSERT INTO notifications (user_id, type, message, is_read)
                 VALUES (?, 'Service update', ?, 0)`,
                [rows[0].scoped_user_id, `Your ${resource.label.toLowerCase()} record is now ${status}.`]
            );
        }
        await connection.query(
            `INSERT INTO admin_actions_log
                (admin_id, action_type, target_table, target_id, old_status, new_status, notes)
             VALUES (?, 'STATUS_UPDATE', ?, ?, ?, ?, ?)`,
            [req.admin.id, resource.table, itemId, rows[0].old_status, status,
                `Scoped ${req.params.domain}/${req.params.resource} workflow`]
        );
        await connection.commit();
        res.json({ success: true, message: 'Workflow status updated.', status });
    } catch (error) {
        await connection.rollback();
        console.error('Scoped admin status error:', error);
        res.status(500).json({ error: 'Could not update this work item.' });
    } finally {
        connection.release();
    }
});

module.exports = router;
