const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verifyToken = require('../middleware/authMiddleware');

router.use(verifyToken);


router.get('/', async (req, res) => {
    try {
        const [stipends] = await db.query('SELECT * FROM stipends WHERE is_active = TRUE ORDER BY deadline ASC');
        res.json(stipends);
    } catch (error) {
        console.error('Error fetching stipends:', error);
        res.status(500).json({ error: 'Failed to fetch stipends' });
    }
});


router.get('/my-applications', async (req, res) => {
    try {
        const [applications] = await db.query(`
            SELECT 
                sa.*,
                s.title AS stipend_title,
                s.amount AS stipend_amount
            FROM stipend_applications sa
            JOIN stipends s ON sa.stipend_id = s.id
            WHERE sa.user_id = ?
            ORDER BY sa.submitted_at DESC
        `, [req.user.id]);

        res.json(applications);
    } catch (error) {
        console.error('Error fetching applications:', error);
        res.status(500).json({ error: 'Failed to fetch applications' });
    }
});


router.post('/apply', async (req, res) => {
    try {
        const { stipendId, studentDetails, financialInfo, guardianInfo, bankDetails } = req.body;
        const userId = req.user.id;

        // 1. Check if stipend exists and is active
        const [stipend] = await db.query('SELECT * FROM stipends WHERE id = ? AND is_active = TRUE', [stipendId]);
        if (stipend.length === 0) {
            return res.status(404).json({ error: 'Stipend program not found or inactive' });
        }
        const grant = stipend[0];

        // 2. Check duplicate application
        const [existing] = await db.query(
            'SELECT id FROM stipend_applications WHERE user_id = ? AND stipend_id = ?',
            [userId, stipendId]
        );
        if (existing.length > 0) {
            return res.status(400).json({ error: 'You have already applied for this stipend' });
        }

        // 3. Eligibility Check (Basic)
        // Check GPA
        if (grant.min_gpa && parseFloat(studentDetails.gpa) < grant.min_gpa) {
            return res.status(400).json({ error: `Minimum GPA requirement not met. Required: ${grant.min_gpa}` });
        }
        // Check Income
        if (grant.max_income && parseFloat(financialInfo.monthlyIncome) > grant.max_income) {
            return res.status(400).json({ error: `Income exceeds eligibility limit.` });
        }

        // 4. Generate Application No
        const appNo = `STP-${Date.now().toString(36).toUpperCase()}-${userId}`;

        // 5. Insert Application
        await db.query(`
            INSERT INTO stipend_applications
            (user_id, stipend_id, application_no, student_details, financial_info, guardian_info, bank_details, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'Submitted')
        `, [
            userId,
            stipendId,
            appNo,
            JSON.stringify(studentDetails),
            JSON.stringify(financialInfo),
            JSON.stringify(guardianInfo),
            JSON.stringify(bankDetails)
        ]);

        res.json({ success: true, message: 'Application submitted successfully', applicationNo: appNo });

    } catch (error) {
        console.error('Error submitting application:', error);
        res.status(500).json({ error: 'Failed to submit application: ' + error.message });
    }
});

module.exports = router;
