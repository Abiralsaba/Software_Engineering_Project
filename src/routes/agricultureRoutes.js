const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verifyToken = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// ==============================
// PUBLIC ROUTES (No auth needed)
// ==============================

// get active market listings (public browsing)
router.get('/market/browse', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT m.*, d.name as division_name, di.name as district_name, u.name as upazila_name
            FROM agri_farmer_market m
            LEFT JOIN divisions d ON m.division_id = d.id
            LEFT JOIN districts di ON m.district_id = di.id
            LEFT JOIN upazilas u ON m.upazila_id = u.id
            WHERE m.status IN ('Approved', 'Pending')
            ORDER BY m.status ASC, m.created_at DESC
        `);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error' });
    }
});

// get upcoming training programs (public)
router.get('/training/programs', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT t.*, d.name as division_name, di.name as district_name
            FROM agri_training_programs t
            LEFT JOIN divisions d ON t.division_id = d.id
            LEFT JOIN districts di ON t.district_id = di.id
            WHERE t.status IN ('Upcoming', 'Ongoing')
            ORDER BY t.start_date ASC
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// ==============================
// PROTECTED ROUTES (Auth needed)
// ==============================
router.use(verifyToken);

// ---------- LOCATIONS (reuse existing) ----------
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

// ===========================
// SUBSIDIES
// ===========================

// Apply for Subsidy
router.post('/subsidy/apply', async (req, res) => {
    const {
        farmer_name, phone, subsidy_type, amount_requested, land_size_acres,
        crop_type, land_ownership, division_id, district_id, upazila_id,
        village, bank_name, bank_branch, bank_account, nid_number
    } = req.body;

    try {
        await db.query(`
            INSERT INTO agri_subsidies 
            (user_id, farmer_name, phone, subsidy_type, amount_requested, land_size_acres,
             crop_type, land_ownership, division_id, district_id, upazila_id,
             village, bank_name, bank_branch, bank_account, nid_number)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [req.user.id, farmer_name, phone, subsidy_type, amount_requested, land_size_acres,
            crop_type, land_ownership, division_id, district_id, upazila_id,
            village, bank_name, bank_branch, bank_account, nid_number]);

        res.json({ success: true, message: 'Subsidy application submitted successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error' });
    }
});

// My Subsidy History
router.get('/subsidy/my-history', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT s.*, d.name as division_name, di.name as district_name, u.name as upazila_name
            FROM agri_subsidies s
            LEFT JOIN divisions d ON s.division_id = d.id
            LEFT JOIN districts di ON s.district_id = di.id
            LEFT JOIN upazilas u ON s.upazila_id = u.id
            WHERE s.user_id = ?
            ORDER BY s.created_at DESC
        `, [req.user.id]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// ===========================
// CROP REPORTS
// ===========================

// Submit Crop Report
router.post('/crop-report/submit', async (req, res) => {
    const {
        farmer_name, crop_name, crop_variety, season, yield_metric_ton,
        land_area_acres, fertilizer_used, irrigation_method, harvest_date,
        market_price_per_ton, division_id, district_id, upazila_id, remarks
    } = req.body;

    try {
        await db.query(`
            INSERT INTO agri_crop_reports 
            (user_id, farmer_name, crop_name, crop_variety, season, yield_metric_ton,
             land_area_acres, fertilizer_used, irrigation_method, harvest_date,
             market_price_per_ton, division_id, district_id, upazila_id, remarks)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [req.user.id, farmer_name, crop_name, crop_variety, season, yield_metric_ton,
            land_area_acres, fertilizer_used, irrigation_method, harvest_date,
            market_price_per_ton, division_id, district_id, upazila_id, remarks]);

        res.json({ success: true, message: 'Crop report submitted successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error' });
    }
});

// My Crop Reports
router.get('/crop-report/my-reports', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT r.*, d.name as division_name, di.name as district_name, u.name as upazila_name
            FROM agri_crop_reports r
            LEFT JOIN divisions d ON r.division_id = d.id
            LEFT JOIN districts di ON r.district_id = di.id
            LEFT JOIN upazilas u ON r.upazila_id = u.id
            WHERE r.user_id = ?
            ORDER BY r.created_at DESC
        `, [req.user.id]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// View All Crop Reports (Aggregated by district - for View Reports section)
router.get('/crop-report/view-all', async (req, res) => {
    try {
        const { division_id, district_id, season, crop_name } = req.query;
        let query = `
            SELECT 
                d.name as division_name,
                di.name as district_name,
                r.crop_name,
                r.season,
                COUNT(*) as total_reports,
                SUM(r.yield_metric_ton) as total_yield,
                AVG(r.yield_metric_ton) as avg_yield,
                SUM(r.land_area_acres) as total_land_area,
                AVG(r.market_price_per_ton) as avg_price
            FROM agri_crop_reports r
            LEFT JOIN divisions d ON r.division_id = d.id
            LEFT JOIN districts di ON r.district_id = di.id
            WHERE 1=1
        `;
        const params = [];

        if (division_id) { query += ' AND r.division_id = ?'; params.push(division_id); }
        if (district_id) { query += ' AND r.district_id = ?'; params.push(district_id); }
        if (season) { query += ' AND r.season = ?'; params.push(season); }
        if (crop_name) { query += ' AND r.crop_name LIKE ?'; params.push(`%${crop_name}%`); }

        query += ' GROUP BY d.name, di.name, r.crop_name, r.season ORDER BY total_yield DESC';

        const [rows] = await db.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error' });
    }
});

// ===========================
// EXPERT Q&A
// ===========================

// Ask Expert
router.post('/expert/ask', async (req, res) => {
    const { question, category, crop_name } = req.body;
    try {
        await db.query(
            'INSERT INTO agri_expert_queries (user_id, question, category, crop_name) VALUES (?, ?, ?, ?)',
            [req.user.id, question, category || 'Other', crop_name || null]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// My Expert Queries
router.get('/expert/my-queries', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM agri_expert_queries WHERE user_id = ? ORDER BY created_at DESC',
            [req.user.id]
        );
        res.json(rows);
    } catch (error) {
        console.error('Error fetching expert queries:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// ===========================
// FARMER MARKET
// ===========================

// Post a Listing
router.post('/market/listing', async (req, res) => {
    const {
        farmer_name, product_name, product_category, quantity, unit,
        price_per_unit, phone, email, division_id, district_id, upazila_id,
        description, available_from, available_until
    } = req.body;

    try {
        await db.query(`
            INSERT INTO agri_farmer_market 
            (user_id, farmer_name, product_name, product_category, quantity, unit,
             price_per_unit, phone, email, division_id, district_id, upazila_id,
             description, available_from, available_until)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [req.user.id, farmer_name, product_name, product_category, quantity, unit,
            price_per_unit, phone, email, division_id, district_id, upazila_id,
            description, available_from || null, available_until || null]);

        res.json({ success: true, message: 'Listing posted! Awaiting admin approval.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error' });
    }
});

// My Listings
router.get('/market/my-listings', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT m.*, d.name as division_name, di.name as district_name
            FROM agri_farmer_market m
            LEFT JOIN divisions d ON m.division_id = d.id
            LEFT JOIN districts di ON m.district_id = di.id
            WHERE m.user_id = ?
            ORDER BY m.created_at DESC
        `, [req.user.id]);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching market listings:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// ===========================
// TRAINING
// ===========================

// Register for program
router.post('/training/register/:programId', async (req, res) => {
    const { farmer_name, phone } = req.body;
    try {
        // Check if already registered
        const [existing] = await db.query(
            'SELECT id FROM agri_training_registrations WHERE user_id = ? AND program_id = ?',
            [req.user.id, req.params.programId]
        );
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Already registered for this program.' });
        }

        // Check capacity
        const [program] = await db.query('SELECT capacity FROM agri_training_programs WHERE id = ?', [req.params.programId]);
        const [regCount] = await db.query('SELECT COUNT(*) as cnt FROM agri_training_registrations WHERE program_id = ?', [req.params.programId]);

        if (program.length > 0 && regCount[0].cnt >= program[0].capacity) {
            return res.status(400).json({ error: 'This program is full.' });
        }

        await db.query(
            'INSERT INTO agri_training_registrations (user_id, program_id, farmer_name, phone) VALUES (?, ?, ?, ?)',
            [req.user.id, req.params.programId, farmer_name, phone]
        );
        res.json({ success: true, message: 'Successfully registered!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error' });
    }
});

// My Registrations
router.get('/training/my-registrations', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT r.*, t.title, t.start_date, t.end_date, t.location, t.trainer_name
            FROM agri_training_registrations r
            JOIN agri_training_programs t ON r.program_id = t.id
            WHERE r.user_id = ?
            ORDER BY t.start_date DESC
        `, [req.user.id]);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching training registrations:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// ===========================
// OVERVIEW STATS
// ===========================
router.get('/stats', async (req, res) => {
    try {
        const [[subsidies]] = await db.query('SELECT COUNT(*) as cnt FROM agri_subsidies WHERE user_id = ?', [req.user.id]);
        const [[reports]] = await db.query('SELECT COUNT(*) as cnt FROM agri_crop_reports WHERE user_id = ?', [req.user.id]);
        const [[queries]] = await db.query('SELECT COUNT(*) as cnt FROM agri_expert_queries WHERE user_id = ?', [req.user.id]);
        const [[listings]] = await db.query('SELECT COUNT(*) as cnt FROM agri_farmer_market WHERE user_id = ?', [req.user.id]);
        const [[trainings]] = await db.query('SELECT COUNT(*) as cnt FROM agri_training_registrations WHERE user_id = ?', [req.user.id]);

        res.json({
            subsidies: subsidies.cnt,
            reports: reports.cnt,
            queries: queries.cnt,
            listings: listings.cnt,
            trainings: trainings.cnt
        });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Recent activity (combined)
router.get('/recent-activity', async (req, res) => {
    try {
        const [subsidies] = await db.query(
            "SELECT id, subsidy_type as title, status, created_at, 'Subsidy' as type FROM agri_subsidies WHERE user_id = ? ORDER BY created_at DESC LIMIT 3",
            [req.user.id]
        );
        const [reports] = await db.query(
            "SELECT id, crop_name as title, 'Submitted' as status, created_at, 'Crop Report' as type FROM agri_crop_reports WHERE user_id = ? ORDER BY created_at DESC LIMIT 3",
            [req.user.id]
        );
        const [queries] = await db.query(
            "SELECT id, SUBSTRING(question, 1, 50) as title, status, created_at, 'Expert Q&A' as type FROM agri_expert_queries WHERE user_id = ? ORDER BY created_at DESC LIMIT 3",
            [req.user.id]
        );

        const combined = [...subsidies, ...reports, ...queries]
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 8);

        res.json(combined);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// ===========================
// ADMIN ROUTES
// ===========================

router.use('/admin', adminMiddleware);

// Admin: Get all expert queries (pending first)
router.get('/admin/queries', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT q.*, r.name as user_name 
            FROM agri_expert_queries q
            LEFT JOIN reg_info r ON q.user_id = r.id
            ORDER BY FIELD(q.status, 'Pending', 'Replied'), q.created_at DESC
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Admin: Answer a query
router.put('/admin/answer/:id', async (req, res) => {
    const { answer, answered_by } = req.body;
    try {
        await db.query(
            "UPDATE agri_expert_queries SET answer = ?, answered_by = ?, answered_at = NOW(), status = 'Replied' WHERE id = ?",
            [answer, answered_by || 'Agriculture Officer', req.params.id]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Admin: Get all subsidies
router.get('/admin/subsidies', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT s.*, d.name as division_name, di.name as district_name, u.name as upazila_name,
                   r.name as user_name
            FROM agri_subsidies s
            LEFT JOIN divisions d ON s.division_id = d.id
            LEFT JOIN districts di ON s.district_id = di.id
            LEFT JOIN upazilas u ON s.upazila_id = u.id
            LEFT JOIN reg_info r ON s.user_id = r.id
            ORDER BY FIELD(s.status, 'Pending', 'Under Review', 'Approved', 'Rejected'), s.created_at DESC
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Admin: Update subsidy status
router.put('/admin/subsidy/:id', async (req, res) => {
    const { status, admin_remarks } = req.body;
    try {
        await db.query(
            'UPDATE agri_subsidies SET status = ?, admin_remarks = ?, reviewed_at = NOW() WHERE id = ?',
            [status, admin_remarks || null, req.params.id]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Admin: Crop summary (aggregated by division/district)
router.get('/admin/crop-summary', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                d.name as division_name,
                di.name as district_name,
                r.crop_name,
                r.season,
                COUNT(*) as total_reports,
                SUM(r.yield_metric_ton) as total_yield_mt,
                SUM(r.land_area_acres) as total_land_acres,
                AVG(r.market_price_per_ton) as avg_market_price
            FROM agri_crop_reports r
            LEFT JOIN divisions d ON r.division_id = d.id
            LEFT JOIN districts di ON r.district_id = di.id
            GROUP BY d.name, di.name, r.crop_name, r.season
            ORDER BY d.name, di.name, total_yield_mt DESC
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Admin: Get all market listings
router.get('/admin/market-listings', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT m.*, d.name as division_name, di.name as district_name, u.name as upazila_name, 
                   r.name as user_name
            FROM agri_farmer_market m
            LEFT JOIN divisions d ON m.division_id = d.id
            LEFT JOIN districts di ON m.district_id = di.id
            LEFT JOIN upazilas u ON m.upazila_id = u.id
            LEFT JOIN reg_info r ON m.user_id = r.id
            ORDER BY FIELD(m.status, 'Pending', 'Approved', 'Sold', 'Expired', 'Rejected'), m.created_at DESC
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Admin: Approve/reject market listing
router.put('/admin/market/:id', async (req, res) => {
    const { status, admin_remarks } = req.body;
    try {
        await db.query(
            'UPDATE agri_farmer_market SET status = ?, admin_remarks = ? WHERE id = ?',
            [status, admin_remarks || null, req.params.id]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Admin: Create training program
router.post('/admin/training', async (req, res) => {
    const {
        title, description, category, location, division_id, district_id,
        start_date, end_date, capacity, trainer_name, trainer_designation
    } = req.body;

    try {
        await db.query(`
            INSERT INTO agri_training_programs 
            (title, description, category, location, division_id, district_id,
             start_date, end_date, capacity, trainer_name, trainer_designation)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [title, description, category, location, division_id || null, district_id || null,
            start_date, end_date, capacity || 50, trainer_name, trainer_designation]);

        res.json({ success: true, message: 'Training program created.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Admin: Get all training with registration count
router.get('/admin/training', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT t.*, d.name as division_name, di.name as district_name,
                   (SELECT COUNT(*) FROM agri_training_registrations WHERE program_id = t.id) as registered_count
            FROM agri_training_programs t
            LEFT JOIN divisions d ON t.division_id = d.id
            LEFT JOIN districts di ON t.district_id = di.id
            ORDER BY t.start_date DESC
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Admin: Agriculture dashboard stats
router.get('/admin/stats', async (req, res) => {
    try {
        const [[subsidies]] = await db.query('SELECT COUNT(*) as total, SUM(CASE WHEN status = "Pending" THEN 1 ELSE 0 END) as pending FROM agri_subsidies');
        const [[reports]] = await db.query('SELECT COUNT(*) as total, SUM(yield_metric_ton) as total_yield FROM agri_crop_reports');
        const [[queries]] = await db.query('SELECT COUNT(*) as total, SUM(CASE WHEN status = "Pending" THEN 1 ELSE 0 END) as pending FROM agri_expert_queries');
        const [[market]] = await db.query('SELECT COUNT(*) as total, SUM(CASE WHEN status = "Pending" THEN 1 ELSE 0 END) as pending FROM agri_farmer_market');
        const [[training]] = await db.query('SELECT COUNT(*) as total FROM agri_training_programs');

        res.json({
            subsidies: { total: subsidies.total, pending: subsidies.pending },
            reports: { total: reports.total, total_yield: reports.total_yield || 0 },
            queries: { total: queries.total, pending: queries.pending },
            market: { total: market.total, pending: market.pending },
            training: { total: training.total }
        });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// ===========================
// DATABASE VIEWS (Admin)
// ===========================

// District Agriculture Summary View
router.get('/admin/views/district-summary', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM v_agri_district_summary');
        res.json(rows);
    } catch (error) {
        console.error('View query error:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Training Summary View
router.get('/admin/views/training-summary', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM v_agri_training_summary');
        res.json(rows);
    } catch (error) {
        console.error('View query error:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
