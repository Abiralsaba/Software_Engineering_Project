
const express = require('express');
const router = express.Router();
const db = require('../config/db');

// ==========================================
// PUBLIC ENDPOINTS - No Auth Required
// ==========================================


router.get('/admissions', async (req, res) => {
    try {
        const { university, type, status } = req.query;

        let query = `
            SELECT 
                ap.*,
                u.name AS university_name,
                u.name_bn AS university_name_bn,
                u.code AS university_code,
                u.type AS university_type,
                u.location AS university_location,
                u.logo_url,
                DATEDIFF(ap.end_date, CURDATE()) AS days_remaining
            FROM admission_posts ap
            JOIN universities u ON ap.university_id = u.id
            WHERE u.is_active = TRUE
        `;

        const params = [];

        if (status) {
            query += ' AND ap.status = ?';
            params.push(status);
        } else {
            query += ' AND ap.status IN ("Active", "Upcoming")';
        }

        if (university) {
            query += ' AND u.id = ?';
            params.push(university);
        }

        if (type) {
            query += ' AND u.type = ?';
            params.push(type);
        }

        query += ' ORDER BY ap.status = "Active" DESC, ap.end_date ASC';

        const [admissions] = await db.query(query, params);
        res.json(admissions);
    } catch (error) {
        console.error('Error fetching admissions:', error);
        res.status(500).json({ error: 'Failed to fetch admissions' });
    }
});


router.get('/admissions/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const [admissions] = await db.query(`
            SELECT 
                ap.*,
                u.name AS university_name,
                u.name_bn AS university_name_bn,
                u.code AS university_code,
                u.type AS university_type,
                u.location AS university_location,
                u.website AS university_website,
                u.logo_url,
                DATEDIFF(ap.end_date, CURDATE()) AS days_remaining,
                (SELECT COUNT(*) FROM university_applications WHERE admission_post_id = ap.id AND payment_status = 'Paid') AS total_applications
            FROM admission_posts ap
            JOIN universities u ON ap.university_id = u.id
            WHERE ap.id = ?
        `, [id]);

        if (admissions.length === 0) {
            return res.status(404).json({ error: 'Admission post not found' });
        }

        res.json(admissions[0]);
    } catch (error) {
        console.error('Error fetching admission details:', error);
        res.status(500).json({ error: 'Failed to fetch admission details' });
    }
});


router.get('/universities', async (req, res) => {
    try {
        const [universities] = await db.query(`
            SELECT * FROM universities WHERE is_active = TRUE ORDER BY name
        `);
        res.json(universities);
    } catch (error) {
        console.error('Error fetching universities:', error);
        res.status(500).json({ error: 'Failed to fetch universities' });
    }
});


router.get('/verify-hsc/:roll/:year', async (req, res) => {
    try {
        const { roll, year } = req.params;
        const { admissionId } = req.query;

        // Fetch HSC result
        const [results] = await db.query(`
            SELECT 
                h.*,
                b.name AS board_name,
                b.code AS board_code
            FROM hsc_results h
            LEFT JOIN education_boards b ON h.board_id = b.id
            WHERE h.roll_number = ? AND h.exam_year = ?
        `, [roll, year]);

        if (results.length === 0) {
            return res.status(404).json({
                error: 'HSC result not found',
                message: `No HSC result found for Roll: ${roll}, Year: ${year}`
            });
        }

        const hscResult = results[0];

        // Check if passed
        if (hscResult.result_status !== 'Passed') {
            return res.json({
                found: true,
                eligible: false,
                reason: 'HSC result status is not Passed',
                hscData: hscResult
            });
        }

        let eligibility = {
            eligible: true,
            reason: null
        };

        // If admission ID provided, check specific eligibility
        if (admissionId) {
            const [admissions] = await db.query(`
                SELECT * FROM admission_posts WHERE id = ?
            `, [admissionId]);

            if (admissions.length > 0) {
                const admission = admissions[0];

                // Check GPA requirement
                if (hscResult.gpa < admission.min_gpa) {
                    eligibility.eligible = false;
                    eligibility.reason = `Minimum GPA required: ${admission.min_gpa}. Your GPA: ${hscResult.gpa}`;
                }

                // Check group requirement
                if (admission.required_group !== 'Any' && hscResult.exam_group !== admission.required_group) {
                    eligibility.eligible = false;
                    eligibility.reason = `Required group: ${admission.required_group}. Your group: ${hscResult.exam_group}`;
                }

                // Check if already applied
                const [existing] = await db.query(`
                    SELECT * FROM university_applications 
                    WHERE admission_post_id = ? AND hsc_roll = ? AND hsc_year = ?
                `, [admissionId, roll, year]);

                if (existing.length > 0) {
                    eligibility.alreadyApplied = true;
                    eligibility.applicationId = existing[0].application_id;
                    eligibility.applicationStatus = existing[0].application_status;
                    eligibility.paymentStatus = existing[0].payment_status;
                }
            }
        }

        res.json({
            found: true,
            ...eligibility,
            hscData: {
                roll_number: hscResult.roll_number,
                registration_number: hscResult.registration_number,
                exam_year: hscResult.exam_year,
                student_name: hscResult.student_name,
                father_name: hscResult.father_name,
                mother_name: hscResult.mother_name,
                date_of_birth: hscResult.date_of_birth,
                institution_name: hscResult.institution_name,
                board_name: hscResult.board_name,
                exam_group: hscResult.exam_group,
                gpa: hscResult.gpa,
                result_status: hscResult.result_status
            }
        });
    } catch (error) {
        console.error('Error verifying HSC:', error);
        res.status(500).json({ error: 'Failed to verify HSC result' });
    }
});


router.post('/apply', async (req, res) => {
    try {
        const {
            admissionPostId,
            hscRoll,
            hscYear,
            mobile,
            email,
            presentAddress
        } = req.body;

        // Validate required fields
        if (!admissionPostId || !hscRoll || !hscYear || !mobile) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // verify HSC result exists and get data
        const [hscResults] = await db.query(`
            SELECT h.*, b.name AS board_name
            FROM hsc_results h
            LEFT JOIN education_boards b ON h.board_id = b.id
            WHERE h.roll_number = ? AND h.exam_year = ?
        `, [hscRoll, hscYear]);

        if (hscResults.length === 0) {
            return res.status(404).json({ error: 'HSC result not found in database' });
        }

        const hsc = hscResults[0];

        // Get admission post details
        const [admissions] = await db.query(`
            SELECT ap.*, u.code AS university_code
            FROM admission_posts ap
            JOIN universities u ON ap.university_id = u.id
            WHERE ap.id = ?
        `, [admissionPostId]);

        if (admissions.length === 0) {
            return res.status(404).json({ error: 'Admission post not found' });
        }

        const admission = admissions[0];

        // check if admission is active
        if (admission.status !== 'Active') {
            return res.status(400).json({ error: 'This admission is not currently accepting applications' });
        }

        // Check deadline
        const today = new Date();
        const endDate = new Date(admission.end_date);
        if (today > endDate) {
            return res.status(400).json({ error: 'Application deadline has passed' });
        }

        // Check eligibility
        if (hsc.gpa < admission.min_gpa) {
            return res.status(400).json({
                error: `You do not meet the minimum GPA requirement. Required: ${admission.min_gpa}, Your GPA: ${hsc.gpa}`
            });
        }

        if (admission.required_group !== 'Any' && hsc.exam_group !== admission.required_group) {
            return res.status(400).json({
                error: `This admission is only for ${admission.required_group} group students`
            });
        }

        // Check if already applied
        const [existing] = await db.query(`
            SELECT * FROM university_applications 
            WHERE admission_post_id = ? AND hsc_roll = ? AND hsc_year = ?
        `, [admissionPostId, hscRoll, hscYear]);

        if (existing.length > 0) {
            return res.status(400).json({
                error: 'You have already applied for this admission',
                applicationId: existing[0].application_id,
                paymentStatus: existing[0].payment_status
            });
        }

        // Generate application ID: UNIVERSITY-UNIT-YEAR-SERIAL
        const [countResult] = await db.query(`
            SELECT COUNT(*) AS count FROM university_applications WHERE admission_post_id = ?
        `, [admissionPostId]);

        const serial = String(countResult[0].count + 1).padStart(5, '0');
        const applicationId = `${admission.university_code}-${admission.unit_code}-${hscYear}-${serial}`;

        // Insert application
        const [result] = await db.query(`
            INSERT INTO university_applications (
                application_id, admission_post_id, hsc_roll, hsc_reg, hsc_year,
                student_name, father_name, mother_name, date_of_birth,
                hsc_gpa, hsc_group, hsc_board, hsc_institution,
                mobile, email, present_address, payment_amount, application_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft')
        `, [
            applicationId, admissionPostId, hscRoll, hsc.registration_number, hscYear,
            hsc.student_name, hsc.father_name, hsc.mother_name, hsc.date_of_birth,
            hsc.gpa, hsc.exam_group, hsc.board_name, hsc.institution_name,
            mobile, email, presentAddress, admission.application_fee
        ]);

        res.json({
            success: true,
            applicationId: applicationId,
            message: 'Application created. Please complete payment to submit.',
            paymentAmount: admission.application_fee
        });
    } catch (error) {
        console.error('Error submitting application:', error);
        res.status(500).json({ error: 'Failed to submit application' });
    }
});

/**
 * POST /api/university/payment/init - Initialize SSLCommerz payment
 */
router.post('/payment/init', async (req, res) => {
    try {
        const { applicationId } = req.body;

        // Get application details
        const [applications] = await db.query(`
            SELECT ua.*, ap.application_fee, u.name AS university_name, ap.unit_name
            FROM university_applications ua
            JOIN admission_posts ap ON ua.admission_post_id = ap.id
            JOIN universities u ON ap.university_id = u.id
            WHERE ua.application_id = ?
        `, [applicationId]);

        if (applications.length === 0) {
            return res.status(404).json({ error: 'Application not found' });
        }

        const app = applications[0];

        if (app.payment_status === 'Paid') {
            return res.status(400).json({ error: 'Payment already completed' });
        }

        // SSLCommerz configuration
        const SSLCommerzPayment = require('sslcommerz-lts');
        const store_id = process.env.STORE_ID || 'testbox';
        const store_passwd = process.env.STORE_PASS || 'qwerty';
        const is_live = false; // Set to true for production

        const data = {
            total_amount: app.application_fee,
            currency: 'BDT',
            tran_id: 'PAY' + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1000),
            success_url: `${process.env.BASE_URL || 'http://localhost:3000'}/api/university/payment/success`,
            fail_url: `${process.env.BASE_URL || 'http://localhost:3000'}/api/university/payment/fail`,
            cancel_url: `${process.env.BASE_URL || 'http://localhost:3000'}/api/university/payment/cancel`,
            ipn_url: `${process.env.BASE_URL || 'http://localhost:3000'}/api/university/payment/ipn`,
            shipping_method: 'NO',
            product_name: `${app.university_name} - ${app.unit_name} Admission`,
            product_category: 'University Admission',
            product_profile: 'non-physical-goods',
            cus_name: app.student_name,
            cus_email: app.email || 'student@example.com',
            cus_add1: app.present_address || 'Bangladesh',
            cus_city: 'Dhaka',
            cus_country: 'Bangladesh',
            cus_phone: app.mobile,
            value_a: applicationId // Store application ID for callback
        };

        const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);

        sslcz.init(data).then(apiResponse => {
            let GatewayPageURL = apiResponse.GatewayPageURL;
            if (GatewayPageURL) {
                res.json({ success: true, url: GatewayPageURL });
            } else {
                res.status(500).json({ error: 'Failed to initialize payment', details: apiResponse });
            }
        }).catch(err => {
            console.error('SSLCommerz error:', err);
            res.status(500).json({ error: 'Payment gateway error' });
        });
    } catch (error) {
        console.error('Error initializing payment:', error);
        res.status(500).json({ error: 'Failed to initialize payment' });
    }
});


router.post('/payment/success', async (req, res) => {
    try {
        const { value_a, tran_id, val_id, card_type } = req.body;
        const applicationId = value_a;

        // Update application payment status
        await db.query(`
            UPDATE university_applications 
            SET payment_status = 'Paid',
                payment_id = ?,
                payment_date = NOW(),
                payment_method = ?,
                application_status = 'Submitted'
            WHERE application_id = ?
        `, [tran_id, card_type || 'SSLCommerz', applicationId]);

        // Redirect to success page
        res.redirect(`/apply.html?success=true&applicationId=${applicationId}`);
    } catch (error) {
        console.error('Payment success error:', error);
        res.redirect('/apply.html?error=payment_update_failed');
    }
});

/**
 * POST /api/university/payment/fail - Payment failure callback
 */
router.post('/payment/fail', async (req, res) => {
    try {
        const { value_a } = req.body;
        const applicationId = value_a;

        await db.query(`
            UPDATE university_applications 
            SET payment_status = 'Failed'
            WHERE application_id = ?
        `, [applicationId]);

        res.redirect(`/apply.html?error=payment_failed&applicationId=${applicationId}`);
    } catch (error) {
        console.error('Payment fail error:', error);
        res.redirect('/apply.html?error=payment_failed');
    }
});

// POST /api/university/payment/cancel - Payment cancelled
 
router.post('/payment/cancel', (req, res) => {
    const { value_a } = req.body;
    res.redirect(`/apply.html?cancelled=true&applicationId=${value_a}`);
});

/**
 * GET /api/university/application/:id - Get application status
 */
router.get('/application/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const [applications] = await db.query(`
            SELECT 
                ua.*,
                ap.unit_name,
                ap.unit_code,
                ap.exam_date,
                u.name AS university_name,
                u.code AS university_code
            FROM university_applications ua
            JOIN admission_posts ap ON ua.admission_post_id = ap.id
            JOIN universities u ON ap.university_id = u.id
            WHERE ua.application_id = ?
        `, [id]);

        if (applications.length === 0) {
            return res.status(404).json({ error: 'Application not found' });
        }

        res.json(applications[0]);
    } catch (error) {
        console.error('Error fetching application:', error);
        res.status(500).json({ error: 'Failed to fetch application' });
    }
});


router.get('/my-applications/:roll/:year', async (req, res) => {
    try {
        const { roll, year } = req.params;

        const [applications] = await db.query(`
            SELECT 
                ua.*,
                ap.unit_name,
                ap.unit_code,
                ap.exam_date,
                u.name AS university_name,
                u.code AS university_code,
                u.logo_url
            FROM university_applications ua
            JOIN admission_posts ap ON ua.admission_post_id = ap.id
            JOIN universities u ON ap.university_id = u.id
            WHERE ua.hsc_roll = ? AND ua.hsc_year = ?
            ORDER BY ua.created_at DESC
        `, [roll, year]);

        res.json(applications);
    } catch (error) {
        console.error('Error fetching applications:', error);
        res.status(500).json({ error: 'Failed to fetch applications' });
    }
});

module.exports = router;
