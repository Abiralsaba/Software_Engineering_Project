const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verifyToken = require('../middleware/authMiddleware');

router.use(verifyToken);

// =============================================
// DASHBOARD STATS
// =============================================
router.get('/dashboard', async (req, res) => {
    try {
        const userId = req.user.id;

        // TIN status
        const [tin] = await db.query(
            'SELECT id, tin_number, status FROM nbr_tin_registrations WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
            [userId]
        );

        // Returns summary
        const [returnStats] = await db.query(
            `SELECT 
                COUNT(*) as total_returns,
                SUM(CASE WHEN status = 'Accepted' THEN 1 ELSE 0 END) as accepted_returns,
                SUM(CASE WHEN status = 'Submitted' OR status = 'Under Review' THEN 1 ELSE 0 END) as pending_returns,
                COALESCE(SUM(total_income), 0) as total_income_declared,
                COALESCE(SUM(net_tax_liability), 0) as total_tax_liability
             FROM nbr_tax_returns WHERE user_id = ?`,
            [userId]
        );

        // Payments summary
        const [paymentStats] = await db.query(
            `SELECT 
                COUNT(*) as total_payments,
                COALESCE(SUM(CASE WHEN status = 'Verified' THEN amount ELSE 0 END), 0) as total_paid,
                COALESCE(SUM(CASE WHEN status = 'Pending' THEN amount ELSE 0 END), 0) as pending_amount
             FROM nbr_tax_payments WHERE user_id = ?`,
            [userId]
        );

        // Unread notices
        const [noticeCount] = await db.query(
            "SELECT COUNT(*) as unread FROM nbr_tax_notices WHERE user_id = ? AND status = 'Issued'",
            [userId]
        );

        // VAT status
        const [vat] = await db.query(
            'SELECT id, bin_number, status FROM nbr_vat_registrations WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
            [userId]
        );

        res.json({
            tin: tin[0] || null,
            vat: vat[0] || null,
            returns: returnStats[0],
            payments: paymentStats[0],
            unreadNotices: noticeCount[0].unread
        });
    } catch (error) {
        console.error('Tax dashboard error:', error);
        res.status(500).json({ error: 'Failed to load dashboard' });
    }
});

// =============================================
// TIN REGISTRATION
// =============================================
router.post('/tin/apply', async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            taxpayer_name, father_name, mother_name, date_of_birth,
            nid_number, passport_number, mobile, email,
            present_address, permanent_address, taxpayer_type,
            source_of_income, zone_id
        } = req.body;

        // Check existing application
        const [existing] = await db.query(
            "SELECT id, status FROM nbr_tin_registrations WHERE user_id = ? AND status IN ('Pending','Approved')",
            [userId]
        );
        if (existing.length > 0) {
            return res.status(400).json({
                error: existing[0].status === 'Approved'
                    ? 'You already have an approved TIN.'
                    : 'You already have a pending TIN application.'
            });
        }

        await db.query(
            `INSERT INTO nbr_tin_registrations 
             (user_id, taxpayer_name, father_name, mother_name, date_of_birth,
              nid_number, passport_number, mobile, email,
              present_address, permanent_address, taxpayer_type,
              source_of_income, zone_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, taxpayer_name, father_name, mother_name, date_of_birth,
                nid_number, passport_number, mobile, email,
                present_address, permanent_address, taxpayer_type || 'Individual',
                source_of_income, zone_id || null]
        );

        res.json({ success: true, message: 'TIN application submitted successfully.' });
    } catch (error) {
        console.error('TIN apply error:', error);
        res.status(500).json({ error: 'Failed to submit TIN application.' });
    }
});

router.get('/tin/status', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT t.*, z.zone_name, z.zone_code 
             FROM nbr_tin_registrations t
             LEFT JOIN nbr_tax_zones z ON t.zone_id = z.id
             WHERE t.user_id = ? ORDER BY t.created_at DESC LIMIT 1`,
            [req.user.id]
        );
        res.json(rows[0] || null);
    } catch (error) {
        console.error('TIN status error:', error);
        res.status(500).json({ error: 'Failed to check TIN status.' });
    }
});

// =============================================
// E-RETURN FILING
// =============================================
router.post('/returns/file', async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            assessment_year, income_year, return_type,
            salary_income, house_property_income, agriculture_income,
            business_income, capital_gains, other_income,
            tax_exempted_income, tax_rebate,
            tax_paid_advance, tax_deducted_source,
            total_assets, total_liabilities, total_expenditure
        } = req.body;

        // Get TIN
        const [tin] = await db.query(
            "SELECT id FROM nbr_tin_registrations WHERE user_id = ? AND status = 'Approved' LIMIT 1",
            [userId]
        );

        // Calculate totals
        const totalIncome = parseFloat(salary_income || 0) +
            parseFloat(house_property_income || 0) +
            parseFloat(agriculture_income || 0) +
            parseFloat(business_income || 0) +
            parseFloat(capital_gains || 0) +
            parseFloat(other_income || 0);

        const taxableIncome = totalIncome - parseFloat(tax_exempted_income || 0);

        // BD Tax Slabs 2025-26 for Individual
        let taxOnIncome = 0;
        let remaining = taxableIncome;

        const slabs = [
            { limit: 350000, rate: 0 },
            { limit: 100000, rate: 0.05 },
            { limit: 400000, rate: 0.10 },
            { limit: 500000, rate: 0.15 },
            { limit: 500000, rate: 0.20 },
            { limit: Infinity, rate: 0.25 }
        ];

        for (const slab of slabs) {
            if (remaining <= 0) break;
            const applicable = Math.min(remaining, slab.limit);
            taxOnIncome += applicable * slab.rate;
            remaining -= applicable;
        }

        const netTax = Math.max(0, taxOnIncome - parseFloat(tax_rebate || 0));
        const taxDue = Math.max(0, netTax - parseFloat(tax_paid_advance || 0) - parseFloat(tax_deducted_source || 0));
        const netWealth = parseFloat(total_assets || 0) - parseFloat(total_liabilities || 0);

        // Generate submission ref
        const submissionRef = `ER-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

        await db.query(
            `INSERT INTO nbr_tax_returns 
             (user_id, tin_id, assessment_year, income_year, return_type,
              salary_income, house_property_income, agriculture_income,
              business_income, capital_gains, other_income, total_income,
              tax_exempted_income, taxable_income, tax_on_income,
              tax_rebate, net_tax_liability, tax_paid_advance,
              tax_deducted_source, tax_due,
              total_assets, total_liabilities, net_wealth,
              total_expenditure, submission_ref, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Submitted')`,
            [userId, tin.length > 0 ? tin[0].id : null,
                assessment_year, income_year, return_type || 'Normal',
                salary_income || 0, house_property_income || 0, agriculture_income || 0,
                business_income || 0, capital_gains || 0, other_income || 0, totalIncome,
                tax_exempted_income || 0, taxableIncome, taxOnIncome,
                tax_rebate || 0, netTax, tax_paid_advance || 0,
                tax_deducted_source || 0, taxDue,
                total_assets || 0, total_liabilities || 0, netWealth,
                total_expenditure || 0, submissionRef]
        );

        res.json({
            success: true,
            submission_ref: submissionRef,
            tax_computed: {
                total_income: totalIncome,
                taxable_income: taxableIncome,
                tax_on_income: taxOnIncome,
                net_tax: netTax,
                tax_due: taxDue
            }
        });
    } catch (error) {
        console.error('Return file error:', error);
        res.status(500).json({ error: 'Failed to file return.' });
    }
});

router.get('/returns', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT r.*, t.tin_number 
             FROM nbr_tax_returns r
             LEFT JOIN nbr_tin_registrations t ON r.tin_id = t.id
             WHERE r.user_id = ? ORDER BY r.created_at DESC`,
            [req.user.id]
        );
        res.json(rows);
    } catch (error) {
        console.error('Returns error:', error);
        res.status(500).json({ error: 'Failed to load returns.' });
    }
});

// =============================================
// PAYMENTS
// =============================================
router.post('/payments/pay', async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            return_id, payment_type, amount, payment_method,
            bank_name, branch_name, transaction_id, fiscal_year
        } = req.body;

        if (return_id) {
            const [ownedReturns] = await db.query(
                'SELECT id FROM nbr_tax_returns WHERE id = ? AND user_id = ? LIMIT 1',
                [return_id, userId]
            );
            if (ownedReturns.length === 0) {
                return res.status(403).json({ error: 'The selected tax return does not belong to the authenticated citizen.' });
            }
        }

        // Get TIN
        const [tin] = await db.query(
            "SELECT id FROM nbr_tin_registrations WHERE user_id = ? AND status = 'Approved' LIMIT 1",
            [userId]
        );

        const receiptNo = `RCP-${Date.now().toString(36).toUpperCase()}`;

        await db.query(
            `INSERT INTO nbr_tax_payments
             (user_id, return_id, tin_id, payment_type, amount, payment_method,
              bank_name, branch_name, transaction_id, payment_date, fiscal_year,
              status, receipt_no)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), ?, 'Pending', ?)`,
            [userId, return_id || null, tin.length > 0 ? tin[0].id : null,
                payment_type || 'Income Tax', amount, payment_method || 'Online',
                bank_name, branch_name, transaction_id,
                fiscal_year, receiptNo]
        );

        res.json({ success: true, receipt_no: receiptNo });
    } catch (error) {
        console.error('Payment error:', error);
        res.status(500).json({ error: 'Failed to process payment.' });
    }
});

router.get('/payments', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT p.*, t.tin_number
             FROM nbr_tax_payments p
             LEFT JOIN nbr_tin_registrations t ON p.tin_id = t.id
             WHERE p.user_id = ? ORDER BY p.created_at DESC`,
            [req.user.id]
        );
        res.json(rows);
    } catch (error) {
        console.error('Payments error:', error);
        res.status(500).json({ error: 'Failed to load payments.' });
    }
});

// =============================================
// VAT REGISTRATION
// =============================================
router.post('/vat/register', async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            business_name, business_name_bn, business_type,
            trade_license_no, business_address, annual_turnover,
            contact_person, contact_phone, contact_email
        } = req.body;

        // Check existing
        const [existing] = await db.query(
            "SELECT id, status FROM nbr_vat_registrations WHERE user_id = ? AND status IN ('Pending','Active')",
            [userId]
        );
        if (existing.length > 0) {
            return res.status(400).json({
                error: existing[0].status === 'Active'
                    ? 'You already have an active VAT registration.'
                    : 'You have a pending VAT application.'
            });
        }

        await db.query(
            `INSERT INTO nbr_vat_registrations
             (user_id, business_name, business_name_bn, business_type,
              trade_license_no, business_address, annual_turnover,
              contact_person, contact_phone, contact_email)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, business_name, business_name_bn, business_type || 'Service Provider',
                trade_license_no, business_address, annual_turnover || 0,
                contact_person, contact_phone, contact_email]
        );

        res.json({ success: true, message: 'VAT registration submitted.' });
    } catch (error) {
        console.error('VAT register error:', error);
        res.status(500).json({ error: 'Failed to submit VAT registration.' });
    }
});

router.get('/vat/status', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM nbr_vat_registrations WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
            [req.user.id]
        );
        res.json(rows[0] || null);
    } catch (error) {
        console.error('VAT status error:', error);
        res.status(500).json({ error: 'Failed to check VAT status.' });
    }
});

// =============================================
// TAX ZONES
// =============================================
router.get('/zones', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM nbr_tax_zones WHERE is_active = 1 ORDER BY zone_name'
        );
        res.json(rows);
    } catch (error) {
        console.error('Zones error:', error);
        res.status(500).json({ error: 'Failed to load zones.' });
    }
});

// =============================================
// TAX NOTICES
// =============================================
router.get('/notices', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM nbr_tax_notices WHERE user_id = ? ORDER BY created_at DESC',
            [req.user.id]
        );
        res.json(rows);
    } catch (error) {
        console.error('Notices error:', error);
        res.status(500).json({ error: 'Failed to load notices.' });
    }
});

// Mark notice as read
router.put('/notices/:id/read', async (req, res) => {
    try {
        await db.query(
            "UPDATE nbr_tax_notices SET status = 'Read' WHERE id = ? AND user_id = ? AND status = 'Issued'",
            [req.params.id, req.user.id]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update notice.' });
    }
});

// =============================================
// CHALLAN
// =============================================
router.post('/challan', async (req, res) => {
    try {
        const userId = req.user.id;
        const { tin_number, assessment_year, tax_zone, deposit_type, amount, bank_name, branch_name } = req.body;

        const challanNo = `CHN-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

        await db.query(
            `INSERT INTO nbr_tax_challan
             (user_id, challan_no, tin_number, assessment_year, tax_zone,
              deposit_type, amount, bank_name, branch_name, deposit_date, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), 'Generated')`,
            [userId, challanNo, tin_number, assessment_year, tax_zone,
                deposit_type || 'Income Tax', amount, bank_name, branch_name]
        );

        res.json({ success: true, challan_no: challanNo });
    } catch (error) {
        console.error('Challan error:', error);
        res.status(500).json({ error: 'Failed to generate challan.' });
    }
});

router.get('/challan', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM nbr_tax_challan WHERE user_id = ? ORDER BY created_at DESC',
            [req.user.id]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load challans.' });
    }
});

module.exports = router;
