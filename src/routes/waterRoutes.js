

const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verifyToken = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// ==============================
// PUBLIC ROUTES
// ==============================

// Browse active projects (public)
router.get('/projects/browse', async (req, res) => {
    try {
        const { division, type, status } = req.query;
        let sql = `SELECT * FROM water_projects WHERE is_active = 1`;
        const params = [];
        if (division) { sql += ` AND division = ?`; params.push(division); }
        if (type) { sql += ` AND project_type = ?`; params.push(type); }
        if (status) { sql += ` AND status = ?`; params.push(status); }
        sql += ` ORDER BY created_at DESC`;
        const [rows] = await db.query(sql, params);
        res.json(rows);
    } catch (error) {
        console.error('Projects browse error:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// ==============================
// PROTECTED ROUTES
// ==============================
router.use(verifyToken);

// ---------- LOCATIONS ----------
router.get('/locations/divisions', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM divisions ORDER BY name');
        res.json(rows);
    } catch (e) { res.status(500).json({ error: 'DB error' }); }
});

router.get('/locations/districts/:divId', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM districts WHERE division_id = ? ORDER BY name', [req.params.divId]);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: 'DB error' }); }
});

router.get('/locations/upazilas/:distId', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM upazilas WHERE district_id = ? ORDER BY name', [req.params.distId]);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: 'DB error' }); }
});

// ---------- USER STATS ----------
router.get('/my-stats', async (req, res) => {
    try {
        const uid = req.user.id;
        const [[conn]] = await db.query('SELECT COUNT(*) as c FROM water_connections WHERE user_id = ?', [uid]);
        const [[activeConn]] = await db.query('SELECT COUNT(*) as c FROM water_connections WHERE user_id = ? AND status = "Active"', [uid]);
        const [[bills]] = await db.query('SELECT COUNT(*) as c FROM water_bill_payments WHERE user_id = ?', [uid]);
        const [[pendingBills]] = await db.query('SELECT COUNT(*) as c FROM water_bill_payments WHERE user_id = ? AND status = "Pending"', [uid]);
        const [[complaints]] = await db.query('SELECT COUNT(*) as c FROM water_complaints WHERE user_id = ?', [uid]);
        const [[quality]] = await db.query('SELECT COUNT(*) as c FROM water_quality_reports WHERE user_id = ?', [uid]);
        res.json({
            total_connections: conn.c,
            active_connections: activeConn.c,
            total_bills: bills.c,
            pending_bills: pendingBills.c,
            total_complaints: complaints.c,
            total_quality_reports: quality.c
        });
    } catch (e) {
        console.error('Stats error:', e);
        res.status(500).json({ error: 'DB error' });
    }
});

router.get('/my-activity', async (req, res) => {
    try {
        const uid = req.user.id;
        const [rows] = await db.query(`
            (SELECT 'Connection' as type, holder_name as title, status, created_at FROM water_connections WHERE user_id = ?)
            UNION ALL
            (SELECT 'Bill Payment' as type, CONCAT('Bill - ', billing_month) as title, status, created_at FROM water_bill_payments WHERE user_id = ?)
            UNION ALL
            (SELECT 'Complaint' as type, complaint_type as title, status, created_at FROM water_complaints WHERE user_id = ?)
            UNION ALL
            (SELECT 'Quality Report' as type, issue_type as title, status, created_at FROM water_quality_reports WHERE user_id = ?)
            ORDER BY created_at DESC LIMIT 15
        `, [uid, uid, uid, uid]);
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: 'DB error' });
    }
});

// ========== WATER CONNECTIONS ==========

// Apply for new connection
router.post('/connection/apply', async (req, res) => {
    const { holder_name, nid_number, phone, connection_type, pipe_size,
        division, district, upazila, address, ward_no, zone, wasa_region } = req.body;
    try {
        const connNum = 'WC' + Date.now().toString().slice(-8) + Math.floor(Math.random() * 100);
        await db.query(`
            INSERT INTO water_connections 
            (user_id, connection_number, holder_name, nid_number, phone, connection_type, pipe_size,
             division, district, upazila, address, ward_no, zone, wasa_region)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [req.user.id, connNum, holder_name, nid_number, phone, connection_type, pipe_size || '0.5 inch',
            division, district, upazila, address, ward_no || null, zone || null, wasa_region || 'DPHE Regional']);
        res.json({ success: true, message: 'Connection application submitted.', connection_number: connNum });
    } catch (error) {
        console.error('Connection apply error:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// My connections
router.get('/connection/my-connections', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM water_connections WHERE user_id = ? ORDER BY created_at DESC',
            [req.user.id]
        );
        res.json(rows);
    } catch (e) { res.status(500).json({ error: 'DB error' }); }
});

// ========== BILL PAYMENTS ==========

// Pay bill
router.post('/bill/pay', async (req, res) => {
    const { connection_number, billing_month, meter_reading_prev, meter_reading_current,
        amount, surcharge, total_amount, payment_method, transaction_id } = req.body;
    try {
        // Find connection
        let connId = null;
        if (connection_number) {
            const [conn] = await db.query(
                'SELECT id, user_id FROM water_connections WHERE connection_number = ? LIMIT 1',
                [connection_number]
            );
            if (conn.length === 0) return res.status(404).json({ error: 'Water connection not found.' });
            if (conn[0].user_id !== req.user.id) {
                return res.status(403).json({ error: 'The selected water connection does not belong to the authenticated citizen.' });
            }
            connId = conn[0].id;
        }
        const units = (meter_reading_current || 0) - (meter_reading_prev || 0);
        await db.query(`
            INSERT INTO water_bill_payments 
            (user_id, connection_id, connection_number, billing_month, meter_reading_prev, meter_reading_current,
             units_consumed, amount, surcharge, total_amount, payment_method, transaction_id, status, paid_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Paid', NOW())
        `, [req.user.id, connId, connection_number, billing_month, meter_reading_prev || 0,
            meter_reading_current || 0, units, amount, surcharge || 0, total_amount, payment_method, transaction_id || null]);
        res.json({ success: true, message: 'Bill payment recorded.' });
    } catch (error) {
        console.error('Bill payment error:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// My bills
router.get('/bill/my-bills', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM water_bill_payments WHERE user_id = ? ORDER BY created_at DESC',
            [req.user.id]
        );
        res.json(rows);
    } catch (e) { res.status(500).json({ error: 'DB error' }); }
});

// ========== WATER QUALITY REPORTS ==========

// Submit quality report
router.post('/quality/report', async (req, res) => {
    const { source_type, division, district, upazila, location_details,
        issue_type, severity, description, affected_people } = req.body;
    try {
        await db.query(`
            INSERT INTO water_quality_reports 
            (user_id, source_type, division, district, upazila, location_details,
             issue_type, severity, description, affected_people)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [req.user.id, source_type, division, district, upazila || null, location_details || null,
            issue_type, severity || 'Medium', description, affected_people || 0]);
        res.json({ success: true, message: 'Water quality report submitted.' });
    } catch (error) {
        console.error('Quality report error:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// My quality reports
router.get('/quality/my-reports', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM water_quality_reports WHERE user_id = ? ORDER BY created_at DESC',
            [req.user.id]
        );
        res.json(rows);
    } catch (e) { res.status(500).json({ error: 'DB error' }); }
});

// ========== COMPLAINTS ==========

// File complaint
router.post('/complaint/submit', async (req, res) => {
    const { complaint_type, priority, division, district, upazila,
        address, description, contact_phone } = req.body;
    try {
        await db.query(`
            INSERT INTO water_complaints 
            (user_id, complaint_type, priority, division, district, upazila,
             address, description, contact_phone)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [req.user.id, complaint_type, priority || 'Normal', division, district,
            upazila || null, address, description, contact_phone || null]);
        res.json({ success: true, message: 'Complaint filed successfully.' });
    } catch (error) {
        console.error('Complaint error:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// My complaints
router.get('/complaint/my-complaints', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM water_complaints WHERE user_id = ? ORDER BY created_at DESC',
            [req.user.id]
        );
        res.json(rows);
    } catch (e) { res.status(500).json({ error: 'DB error' }); }
});

// ========== PROJECTS (user view) ==========
router.get('/projects/list', async (req, res) => {
    try {
        const { division, type } = req.query;
        let sql = `SELECT * FROM water_projects WHERE is_active = 1`;
        const params = [];
        if (division) { sql += ` AND division = ?`; params.push(division); }
        if (type) { sql += ` AND project_type = ?`; params.push(type); }
        sql += ` ORDER BY created_at DESC`;
        const [rows] = await db.query(sql, params);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: 'DB error' }); }
});


// ==============================================
// ADMIN ROUTES
// ==============================================
router.use('/admin', adminMiddleware);

// ---------- ADMIN STATS ----------
router.get('/admin/stats', async (req, res) => {
    try {
        const [[totalConn]] = await db.query('SELECT COUNT(*) as c FROM water_connections');
        const [[pendingConn]] = await db.query('SELECT COUNT(*) as c FROM water_connections WHERE status = "Pending"');
        const [[activeConn]] = await db.query('SELECT COUNT(*) as c FROM water_connections WHERE status = "Active"');
        const [[totalBills]] = await db.query('SELECT COUNT(*) as c FROM water_bill_payments');
        const [[paidBills]] = await db.query('SELECT COUNT(*) as c FROM water_bill_payments WHERE status = "Paid"');
        const [[pendingBills]] = await db.query('SELECT COUNT(*) as c FROM water_bill_payments WHERE status = "Pending"');
        const [[totalRevenue]] = await db.query('SELECT COALESCE(SUM(total_amount),0) as c FROM water_bill_payments WHERE status = "Paid"');
        const [[totalComplaints]] = await db.query('SELECT COUNT(*) as c FROM water_complaints');
        const [[openComplaints]] = await db.query('SELECT COUNT(*) as c FROM water_complaints WHERE status IN ("Submitted","Assigned","In Progress")');
        const [[totalQuality]] = await db.query('SELECT COUNT(*) as c FROM water_quality_reports');
        const [[criticalQuality]] = await db.query('SELECT COUNT(*) as c FROM water_quality_reports WHERE severity = "Critical" AND status NOT IN ("Resolved","Closed")');
        const [[totalProjects]] = await db.query('SELECT COUNT(*) as c FROM water_projects WHERE is_active = 1');
        const [[ongoingProjects]] = await db.query('SELECT COUNT(*) as c FROM water_projects WHERE status = "Ongoing" AND is_active = 1');

        res.json({ stats: {
            total_connections: totalConn.c,
            pending_connections: pendingConn.c,
            active_connections: activeConn.c,
            total_bills: totalBills.c,
            paid_bills: paidBills.c,
            pending_bills: pendingBills.c,
            total_revenue: totalRevenue.c,
            total_complaints: totalComplaints.c,
            open_complaints: openComplaints.c,
            total_quality: totalQuality.c,
            critical_quality: criticalQuality.c,
            total_projects: totalProjects.c,
            ongoing_projects: ongoingProjects.c
        }});
    } catch (error) {
        console.error('Admin water stats error:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// ---------- ADMIN CONNECTIONS ----------
router.get('/admin/connections', async (req, res) => {
    try {
        const { status, search } = req.query;
        let sql = `SELECT wc.*, u.name as user_name, u.email as user_email 
                    FROM water_connections wc 
                    LEFT JOIN reg_info u ON wc.user_id = u.id WHERE 1=1`;
        const params = [];
        if (status) { sql += ` AND wc.status = ?`; params.push(status); }
        if (search) {
            sql += ` AND (wc.holder_name LIKE ? OR wc.connection_number LIKE ? OR wc.nid_number LIKE ? OR wc.phone LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }
        sql += ` ORDER BY wc.created_at DESC`;
        const [rows] = await db.query(sql, params);
        res.json({ connections: rows });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

router.get('/admin/connections/:id', async (req, res) => {
    try {
        const [rows] = await db.query(`SELECT wc.*, u.name as user_name, u.email as user_email 
            FROM water_connections wc LEFT JOIN reg_info u ON wc.user_id = u.id WHERE wc.id = ?`, [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: 'Not found' });
        res.json({ connection: rows[0] });
    } catch (error) { res.status(500).json({ error: 'Database error' }); }
});

router.put('/admin/connections/:id', async (req, res) => {
    const { status, monthly_rate, admin_remarks } = req.body;
    try {
        let approvedDate = null;
        if (status === 'Approved' || status === 'Active') approvedDate = new Date().toISOString().split('T')[0];
        const [result] = await db.query('UPDATE water_connections SET status = ?, monthly_rate = ?, admin_remarks = ?, approved_date = COALESCE(?, approved_date) WHERE id = ?',
            [status, monthly_rate || 0, admin_remarks || null, approvedDate, req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Connection not found' });
        res.json({ success: true, message: 'Connection updated.' });
    } catch (error) { res.status(500).json({ error: 'Database error' }); }
});

// ---------- ADMIN BILLS ----------
router.get('/admin/bills', async (req, res) => {
    try {
        const { status, search } = req.query;
        let sql = `SELECT b.*, u.name as user_name 
                    FROM water_bill_payments b 
                    LEFT JOIN reg_info u ON b.user_id = u.id WHERE 1=1`;
        const params = [];
        if (status) { sql += ` AND b.status = ?`; params.push(status); }
        if (search) {
            sql += ` AND (b.connection_number LIKE ? OR u.name LIKE ? OR b.transaction_id LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        sql += ` ORDER BY b.created_at DESC`;
        const [rows] = await db.query(sql, params);
        res.json({ bills: rows });
    } catch (error) { res.status(500).json({ error: 'Database error' }); }
});

router.get('/admin/bills/:id', async (req, res) => {
    try {
        const [rows] = await db.query(`SELECT b.*, u.name as user_name 
            FROM water_bill_payments b LEFT JOIN reg_info u ON b.user_id = u.id WHERE b.id = ?`, [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: 'Not found' });
        res.json({ bill: rows[0] });
    } catch (error) { res.status(500).json({ error: 'Database error' }); }
});

router.put('/admin/bills/:id', async (req, res) => {
    const { status, admin_remarks } = req.body;
    try {
        let paidDate = null;
        if (status === 'Paid') paidDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const [result] = await db.query('UPDATE water_bill_payments SET status = ?, admin_remarks = ?, paid_date = COALESCE(?, paid_date) WHERE id = ?',
            [status, admin_remarks || null, paidDate, req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Bill not found' });
        res.json({ success: true, message: 'Bill updated.' });
    } catch (error) { res.status(500).json({ error: 'Database error' }); }
});

// ---------- ADMIN QUALITY REPORTS ----------
router.get('/admin/quality', async (req, res) => {
    try {
        const { status, severity, search } = req.query;
        let sql = `SELECT q.*, u.name as user_name 
                    FROM water_quality_reports q 
                    LEFT JOIN reg_info u ON q.user_id = u.id WHERE 1=1`;
        const params = [];
        if (status) { sql += ` AND q.status = ?`; params.push(status); }
        if (severity) { sql += ` AND q.severity = ?`; params.push(severity); }
        if (search) {
            sql += ` AND (q.issue_type LIKE ? OR q.district LIKE ? OR u.name LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        sql += ` ORDER BY q.created_at DESC`;
        const [rows] = await db.query(sql, params);
        res.json({ reports: rows });
    } catch (error) { res.status(500).json({ error: 'Database error' }); }
});

router.get('/admin/quality/:id', async (req, res) => {
    try {
        const [rows] = await db.query(`SELECT q.*, u.name as user_name 
            FROM water_quality_reports q LEFT JOIN reg_info u ON q.user_id = u.id WHERE q.id = ?`, [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: 'Not found' });
        res.json({ report: rows[0] });
    } catch (error) { res.status(500).json({ error: 'Database error' }); }
});

router.put('/admin/quality/:id', async (req, res) => {
    const { status, test_result, admin_remarks } = req.body;
    try {
        const [result] = await db.query('UPDATE water_quality_reports SET status = ?, test_result = ?, admin_remarks = ? WHERE id = ?',
            [status, test_result || null, admin_remarks || null, req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Quality report not found' });
        res.json({ success: true, message: 'Quality report updated.' });
    } catch (error) { res.status(500).json({ error: 'Database error' }); }
});

// ---------- ADMIN COMPLAINTS ----------
router.get('/admin/complaints', async (req, res) => {
    try {
        const { status, priority, search } = req.query;
        let sql = `SELECT c.*, u.name as user_name 
                    FROM water_complaints c 
                    LEFT JOIN reg_info u ON c.user_id = u.id WHERE 1=1`;
        const params = [];
        if (status) { sql += ` AND c.status = ?`; params.push(status); }
        if (priority) { sql += ` AND c.priority = ?`; params.push(priority); }
        if (search) {
            sql += ` AND (c.complaint_type LIKE ? OR c.district LIKE ? OR u.name LIKE ? OR c.address LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }
        sql += ` ORDER BY c.created_at DESC`;
        const [rows] = await db.query(sql, params);
        res.json({ complaints: rows });
    } catch (error) { res.status(500).json({ error: 'Database error' }); }
});

router.get('/admin/complaints/:id', async (req, res) => {
    try {
        const [rows] = await db.query(`SELECT c.*, u.name as user_name 
            FROM water_complaints c LEFT JOIN reg_info u ON c.user_id = u.id WHERE c.id = ?`, [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: 'Not found' });
        res.json({ complaint: rows[0] });
    } catch (error) { res.status(500).json({ error: 'Database error' }); }
});

router.put('/admin/complaints/:id', async (req, res) => {
    const { status, assigned_to, resolution, admin_remarks } = req.body;
    try {
        let resolvedDate = null;
        if (status === 'Resolved' || status === 'Closed') resolvedDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const [result] = await db.query(`UPDATE water_complaints SET status = ?, assigned_to = ?, resolution = ?,
            admin_remarks = ?, resolved_date = COALESCE(?, resolved_date) WHERE id = ?`,
            [status, assigned_to || null, resolution || null, admin_remarks || null, resolvedDate, req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Complaint not found' });
        res.json({ success: true, message: 'Complaint updated.' });
    } catch (error) { res.status(500).json({ error: 'Database error' }); }
});

// ---------- ADMIN PROJECTS CRUD ----------
router.get('/admin/projects', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM water_projects ORDER BY created_at DESC');
        res.json({ projects: rows });
    } catch (error) { res.status(500).json({ error: 'Database error' }); }
});

router.get('/admin/projects/:id', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM water_projects WHERE id = ?', [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: 'Not found' });
        res.json({ project: rows[0] });
    } catch (error) { res.status(500).json({ error: 'Database error' }); }
});

router.post('/admin/projects', async (req, res) => {
    const { project_name, project_name_bn, project_type, implementing_agency,
        division, district, budget_crore, start_date, expected_completion,
        progress_percent, beneficiaries, description, status } = req.body;
    try {
        await db.query(`INSERT INTO water_projects 
            (project_name, project_name_bn, project_type, implementing_agency,
             division, district, budget_crore, start_date, expected_completion,
             progress_percent, beneficiaries, description, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [project_name, project_name_bn || null, project_type, implementing_agency || null,
                division, district || null, budget_crore || 0, start_date || null, expected_completion || null,
                progress_percent || 0, beneficiaries || 0, description || null, status || 'Planned']);
        res.json({ success: true, message: 'Project created.' });
    } catch (error) {
        console.error('Admin add project error:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

router.put('/admin/projects/:id', async (req, res) => {
    const { project_name, project_name_bn, project_type, implementing_agency,
        division, district, budget_crore, start_date, expected_completion,
        progress_percent, beneficiaries, description, status, is_active } = req.body;
    try {
        const [result] = await db.query(`UPDATE water_projects SET
            project_name=?, project_name_bn=?, project_type=?, implementing_agency=?,
            division=?, district=?, budget_crore=?, start_date=?, expected_completion=?,
            progress_percent=?, beneficiaries=?, description=?, status=?, is_active=?
            WHERE id = ?`,
            [project_name, project_name_bn, project_type, implementing_agency,
                division, district, budget_crore, start_date, expected_completion,
                progress_percent, beneficiaries, description, status,
                is_active !== undefined ? is_active : 1, req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Project not found' });
        res.json({ success: true, message: 'Project updated.' });
    } catch (error) { res.status(500).json({ error: 'Database error' }); }
});

router.delete('/admin/projects/:id', async (req, res) => {
    try {
        const [result] = await db.query('DELETE FROM water_projects WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Project not found' });
        res.json({ success: true, message: 'Project deleted.' });
    } catch (error) { res.status(500).json({ error: 'Database error' }); }
});

module.exports = router;
