const express = require('express');
const router = express.Router();
const SSLCommerz = require('sslcommerz-lts');
const db = require('../config/db');
const verifyToken = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// =============================================
// Passport Document Upload Configuration
// =============================================
const passportUploadDir = path.join(__dirname, '../../public/uploads/passport');
if (!fs.existsSync(passportUploadDir)) {
    fs.mkdirSync(passportUploadDir, { recursive: true });
}

const passportStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, passportUploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'passport-' + (req.user ? req.user.id : 'anon') + '-' + file.fieldname + '-' + uniqueSuffix + ext);
    }
});

const passportFileFilter = (req, file, cb) => {
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp|pdf)$/i)) {
        return cb(new Error('Only images and PDF files are allowed!'), false);
    }
    cb(null, true);
};

const passportUpload = multer({
    storage: passportStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: passportFileFilter
});

// =============================================
// HELPER: Generate Application Number
// =============================================
async function generateApplicationNumber() {
    const today = new Date();
    const dateStr = today.getFullYear().toString() +
        String(today.getMonth() + 1).padStart(2, '0') +
        String(today.getDate()).padStart(2, '0');

    // Generate random 5-digit number
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    return `EP${dateStr}${randomNum}`;
}

// =============================================
// PUBLIC ROUTES (No auth needed)
// =============================================

// Get active passport offices
router.get('/offices', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM passport_offices WHERE is_active = TRUE ORDER BY division, office_name'
        );
        res.json(rows);
    } catch (error) {
        console.error('Error fetching offices:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get fee schedule
router.get('/fees', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM passport_fee_schedule WHERE is_active = TRUE ORDER BY passport_type, page_count, validity_years, delivery_type'
        );
        res.json(rows);
    } catch (error) {
        console.error('Error fetching fees:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Calculate fee
router.get('/fee/calculate', async (req, res) => {
    try {
        const { passport_type, page_count, validity_years, delivery_type, service_type } = req.query;

        if (!passport_type || !page_count || !validity_years || !delivery_type) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        const [[feeRow]] = await db.query(
            `SELECT fee_bdt FROM passport_fee_schedule 
             WHERE passport_type = ? AND page_count = ? AND validity_years = ? AND delivery_type = ? AND is_active = TRUE
             LIMIT 1`,
            [passport_type, page_count, validity_years, delivery_type]
        );

        const baseFee = feeRow ? parseFloat(feeRow.fee_bdt) : 0;
        let penalty = 0;

        if (service_type === 'Lost Replacement' || service_type === 'Damaged Replacement') {
            penalty = 5000.00;
        }

        const response = {
            base_fee: baseFee,
            penalty: penalty,
            total_fee: baseFee + penalty,
            currency: 'BDT'
        };

        res.json(response);
    } catch (error) {
        console.error('Error calculating fee:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// =============================================
// SSLCOMMERZ CALLBACKS (Public)
// =============================================

// SUCCESS Handler (POST from SSLCommerz)
router.post('/payment/success/:tran_id', async (req, res) => {
    const tran_id = req.params.tran_id;
    try {
        await db.query(
            "UPDATE passport_applications SET payment_status = 'Paid', status = 'Payment Verified', payment_method = 'SSLCommerz', payment_date = NOW() WHERE transaction_id = ?",
            [tran_id]
        );
        res.redirect('/passport.html?status=success&tid=' + tran_id);
    } catch (error) {
        console.error(error);
        res.redirect('/passport.html?status=error');
    }
});

// FAIL Handler
router.post('/payment/fail/:tran_id', async (req, res) => {
    const tran_id = req.params.tran_id;
    try {
        await db.query(
            "UPDATE passport_applications SET payment_status = 'Failed' WHERE transaction_id = ?",
            [tran_id]
        );
        res.redirect('/passport.html?status=fail&tid=' + tran_id);
    } catch (error) {
        console.error(error);
        res.redirect('/passport.html?status=error');
    }
});

// CANCEL Handler
router.post('/payment/cancel/:tran_id', async (req, res) => {
    const tran_id = req.params.tran_id;
    try {
        await db.query(
            "UPDATE passport_applications SET payment_status = 'Cancelled' WHERE transaction_id = ?",
            [tran_id]
        );
        res.redirect('/passport.html?status=cancel&tid=' + tran_id);
    } catch (error) {
        console.error(error);
        res.redirect('/passport.html?status=error');
    }
});

// =============================================
// PROTECTED ROUTES (Auth needed)
// =============================================
router.use(verifyToken);

// ---------- LOCATIONS (reuse existing tables) ----------
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

// =============================================
// APPLY FOR PASSPORT
// =============================================
router.post('/apply', async (req, res) => {
    try {
        const {
            // Service Selection
            service_type, passport_type, page_count, validity_years, delivery_type,
            // Personal Info
            full_name_bn, full_name_en, father_name_bn, father_name_en,
            mother_name_bn, mother_name_en, spouse_name_bn, spouse_name_en,
            date_of_birth, gender, religion, marital_status, nationality,
            nid_number, birth_certificate_no, tin_number, blood_group,
            profession, education, height_ft, height_in, distinguishing_mark,
            // Present Address
            present_care_of, present_village_road, present_post_office,
            present_postal_code, present_upazila, present_district, present_division,
            // Permanent Address
            same_as_present, permanent_care_of, permanent_village_road, permanent_post_office,
            permanent_postal_code, permanent_upazila, permanent_district, permanent_division,
            // Contact
            mobile_number, email, emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
            // Previous Passport
            old_passport_number, old_passport_issue_date, old_passport_expiry_date,
            old_passport_issue_place, reason_for_reissue,
            // Office
            preferred_office
        } = req.body;

        // Validate required fields
        if (!full_name_en || !father_name_en || !mother_name_en || !date_of_birth || !gender || !marital_status) {
            return res.status(400).json({ error: 'Required personal information missing.' });
        }
        if (!present_division || !present_district) {
            return res.status(400).json({ error: 'Present address is required.' });
        }
        if (!mobile_number) {
            return res.status(400).json({ error: 'Mobile number is required.' });
        }

        if (nid_number) {
            const [identityRows] = await db.query(
                'SELECT id FROM reg_info WHERE id = ? AND nid = ? LIMIT 1',
                [req.user.id, nid_number]
            );
            if (identityRows.length === 0) {
                return res.status(403).json({ error: 'Passport NID must belong to the authenticated citizen.' });
            }
        }

        // check for duplicate active application
        const [existing] = await db.query(
            `SELECT id FROM passport_applications 
             WHERE user_id = ? AND status NOT IN ('Delivered','Rejected','Cancelled')`,
            [req.user.id]
        );
        if (existing.length > 0) {
            return res.status(400).json({ error: 'You already have an active passport application. Please wait for it to be processed or cancel it first.' });
        }

        // Generate application number
        const application_number = await generateApplicationNumber();

        // Calculate fee
        const [[feeRow]] = await db.query(
            `SELECT fee_bdt FROM passport_fee_schedule 
             WHERE passport_type = ? AND page_count = ? AND validity_years = ? AND delivery_type = ? AND is_active = TRUE
             LIMIT 1`,
            [passport_type || 'Ordinary', page_count || '48', validity_years || '5', delivery_type || 'Regular']
        );

        const baseFee = feeRow ? parseFloat(feeRow.fee_bdt) : 3450.00;
        let penalty = 0;
        if (service_type === 'Lost Replacement' || service_type === 'Damaged Replacement') {
            penalty = 5000.00;
        }
        const totalFee = baseFee + penalty;

        // Handle permanent address
        const permVillage = same_as_present ? present_village_road : permanent_village_road;
        const permPO = same_as_present ? present_post_office : permanent_post_office;
        const permPostal = same_as_present ? present_postal_code : permanent_postal_code;
        const permUpazila = same_as_present ? present_upazila : permanent_upazila;
        const permDistrict = same_as_present ? present_district : permanent_district;
        const permDivision = same_as_present ? present_division : permanent_division;
        const permCareOf = same_as_present ? present_care_of : permanent_care_of;

        await db.query(`
            INSERT INTO passport_applications (
                user_id, application_number,
                service_type, passport_type, page_count, validity_years, delivery_type,
                full_name_bn, full_name_en, father_name_bn, father_name_en,
                mother_name_bn, mother_name_en, spouse_name_bn, spouse_name_en,
                date_of_birth, gender, religion, marital_status, nationality,
                nid_number, birth_certificate_no, tin_number, blood_group,
                profession, education, height_ft, height_in, distinguishing_mark,
                present_care_of, present_village_road, present_post_office,
                present_postal_code, present_upazila, present_district, present_division,
                same_as_present, permanent_care_of, permanent_village_road, permanent_post_office,
                permanent_postal_code, permanent_upazila, permanent_district, permanent_division,
                mobile_number, email, emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
                old_passport_number, old_passport_issue_date, old_passport_expiry_date,
                old_passport_issue_place, reason_for_reissue,
                preferred_office,
                fee_amount, penalty_amount, total_fee
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            req.user.id, application_number,
            service_type || 'New', passport_type || 'Ordinary', String(page_count || '48'), String(validity_years || '5'), delivery_type || 'Regular',
            full_name_bn || null, full_name_en, father_name_bn || null, father_name_en,
            mother_name_bn || null, mother_name_en, spouse_name_bn || null, spouse_name_en || null,
            date_of_birth, gender, religion || 'Islam', marital_status, nationality || 'Bangladeshi',
            nid_number || null, birth_certificate_no || null, tin_number || null, blood_group || null,
            profession || null, education || null, height_ft || null, height_in || null, distinguishing_mark || null,
            present_care_of || null, present_village_road || null, present_post_office || null,
            present_postal_code || null, present_upazila || null, present_district || null, present_division || null,
            same_as_present ? 1 : 0, permCareOf || null, permVillage || null, permPO || null,
            permPostal || null, permUpazila || null, permDistrict || null, permDivision || null,
            mobile_number, email || null, emergency_contact_name || null, emergency_contact_phone || null, emergency_contact_relation || null,
            old_passport_number || null, old_passport_issue_date || null, old_passport_expiry_date || null,
            old_passport_issue_place || null, reason_for_reissue || null,
            preferred_office || 'RPO-DHK',
            baseFee, penalty, totalFee
        ]);

        res.json({
            success: true,
            message: 'Passport application submitted successfully!',
            applicationNumber: application_number,
            total_fee: totalFee
        });
    } catch (error) {
        console.error('Error submitting passport application:', error);
        res.status(500).json({ error: 'Failed to submit application. Please try again.' });
    }
});

// =============================================
// UPLOAD DOCUMENTS
// =============================================
router.post('/upload-documents/:appId', passportUpload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'nid_scan', maxCount: 1 },
    { name: 'birth_cert', maxCount: 1 },
    { name: 'old_passport_scan', maxCount: 1 },
    { name: 'noc', maxCount: 1 },
    { name: 'affidavit', maxCount: 1 },
    { name: 'additional_doc', maxCount: 1 }
]), async (req, res) => {
    try {
        // Verify ownership
        const [app] = await db.query(
            'SELECT id FROM passport_applications WHERE id = ? AND user_id = ?',
            [req.params.appId, req.user.id]
        );
        if (app.length === 0) {
            return res.status(404).json({ error: 'Application not found.' });
        }

        const updates = {};
        const files = req.files;

        if (files.photo) updates.photo_path = '/uploads/passport/' + files.photo[0].filename;
        if (files.nid_scan) updates.nid_scan_path = '/uploads/passport/' + files.nid_scan[0].filename;
        if (files.birth_cert) updates.birth_cert_path = '/uploads/passport/' + files.birth_cert[0].filename;
        if (files.old_passport_scan) updates.old_passport_scan_path = '/uploads/passport/' + files.old_passport_scan[0].filename;
        if (files.noc) updates.noc_path = '/uploads/passport/' + files.noc[0].filename;
        if (files.affidavit) updates.affidavit_path = '/uploads/passport/' + files.affidavit[0].filename;
        if (files.additional_doc) updates.additional_doc_path = '/uploads/passport/' + files.additional_doc[0].filename;

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No files uploaded.' });
        }

        const setClauses = Object.keys(updates).map(key => `${key} = ?`).join(', ');
        const values = [...Object.values(updates), req.params.appId];

        await db.query(`UPDATE passport_applications SET ${setClauses} WHERE id = ?`, values);

        res.json({ success: true, message: 'Documents uploaded successfully.', uploaded: Object.keys(updates) });
    } catch (error) {
        console.error('Error uploading documents:', error);
        res.status(500).json({ error: 'Failed to upload documents.' });
    }
});

// =============================================
// MY APPLICATIONS
// =============================================
router.get('/my-applications', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                pa.id, pa.application_number, pa.service_type, pa.passport_type,
                pa.page_count, pa.validity_years, pa.delivery_type,
                pa.full_name_en, pa.status, pa.total_fee, pa.payment_status,
                pa.submitted_at, pa.updated_at, pa.biometric_date, pa.delivered_at,
                po.office_name,
                pb.passport_number, pb.issue_date, pb.expiry_date
            FROM passport_applications pa
            LEFT JOIN passport_offices po ON pa.preferred_office = po.office_code
            LEFT JOIN passport_books pb ON pa.id = pb.application_id
            WHERE pa.user_id = ?
            ORDER BY pa.submitted_at DESC
        `, [req.user.id]);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching applications:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// =============================================
// VIEW SINGLE APPLICATION
// =============================================
router.get('/application/:id', async (req, res) => {
    try {
        const [[app]] = await db.query(`
            SELECT pa.*, po.office_name, po.office_name_bn, po.address as office_address,
                   pb.passport_number, pb.issue_date as passport_issue_date, pb.expiry_date as passport_expiry_date
            FROM passport_applications pa
            LEFT JOIN passport_offices po ON pa.preferred_office = po.office_code
            LEFT JOIN passport_books pb ON pa.id = pb.application_id
            WHERE pa.id = ? AND pa.user_id = ?
        `, [req.params.id, req.user.id]);

        if (!app) {
            return res.status(404).json({ error: 'Application not found.' });
        }

        // Get status history
        const [history] = await db.query(
            'SELECT * FROM passport_status_history WHERE application_id = ? ORDER BY created_at ASC',
            [req.params.id]
        );

        res.json({ application: app, status_history: history });
    } catch (error) {
        console.error('Error fetching application:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// =============================================
// TRACK APPLICATION BY NUMBER
// =============================================
router.get('/track/:appNumber', async (req, res) => {
    try {
        const [[app]] = await db.query(`
            SELECT 
                pa.application_number, pa.service_type, pa.passport_type,
                pa.full_name_en, pa.status, pa.total_fee, pa.payment_status,
                pa.submitted_at, pa.biometric_date, pa.police_verification_date,
                pa.approved_at, pa.printed_at, pa.dispatched_at, pa.delivered_at,
                po.office_name, pa.delivery_type
            FROM passport_applications pa
            LEFT JOIN passport_offices po ON pa.preferred_office = po.office_code
            WHERE pa.application_number = ? AND pa.user_id = ?
        `, [req.params.appNumber, req.user.id]);

        if (!app) {
            return res.status(404).json({ error: 'Application not found. Please check the application number.' });
        }

        // Get status history
        const [history] = await db.query(
            `SELECT new_status, remarks, created_at 
             FROM passport_status_history 
             WHERE application_id = (SELECT id FROM passport_applications WHERE application_number = ?)
             ORDER BY created_at ASC`,
            [req.params.appNumber]
        );

        res.json({ application: app, status_history: history });
    } catch (error) {
        console.error('Error tracking application:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// =============================================
// CANCEL APPLICATION
// =============================================
router.put('/application/:id/cancel', async (req, res) => {
    try {
        const [[app]] = await db.query(
            'SELECT id, status FROM passport_applications WHERE id = ? AND user_id = ?',
            [req.params.id, req.user.id]
        );

        if (!app) {
            return res.status(404).json({ error: 'Application not found.' });
        }
        if (!['Submitted', 'Payment Verified'].includes(app.status)) {
            return res.status(400).json({ error: 'Application can only be cancelled before processing begins.' });
        }

        await db.query(
            "UPDATE passport_applications SET status = 'Cancelled' WHERE id = ?",
            [req.params.id]
        );

        res.json({ success: true, message: 'Application cancelled successfully.' });
    } catch (error) {
        console.error('Error cancelling application:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// =============================================
// SSLCOMMERZ PAYMENT CALLBACKS (UNPROTECTED)
// =============================================

// SUCCESS Handler (POST from SSLCommerz)
router.post('/payment/success/:tran_id', async (req, res) => {
    const tran_id = req.params.tran_id;
    try {
        await db.query(
            "UPDATE passport_applications SET payment_status = 'Paid', status = 'Payment Verified', payment_method = 'SSLCommerz', payment_date = NOW() WHERE transaction_id = ?",
            [tran_id]
        );
        res.redirect('/passport.html?status=success&tid=' + tran_id);
    } catch (error) {
        console.error(error);
        res.redirect('/passport.html?status=error');
    }
});

// FAIL Handler
router.post('/payment/fail/:tran_id', async (req, res) => {
    const tran_id = req.params.tran_id;
    try {
        await db.query(
            "UPDATE passport_applications SET payment_status = 'Failed' WHERE transaction_id = ?",
            [tran_id]
        );
        res.redirect('/passport.html?status=fail&tid=' + tran_id);
    } catch (error) {
        console.error(error);
        res.redirect('/passport.html?status=error');
    }
});

// CANCEL Handler
router.post('/payment/cancel/:tran_id', async (req, res) => {
    const tran_id = req.params.tran_id;
    try {
        await db.query(
            "UPDATE passport_applications SET payment_status = 'Cancelled' WHERE transaction_id = ?",
            [tran_id]
        );
        res.redirect('/passport.html?status=cancel&tid=' + tran_id);
    } catch (error) {
        console.error(error);
        res.redirect('/passport.html?status=error');
    }
});

// =============================================
// SSLCOMMERZ PAYMENT (Protected Init)
// =============================================
const store_id = process.env.STORE_ID || 'testbox';
const store_passwd = process.env.STORE_PASS || 'qwerty';
const is_live = false;

// INIT Payment
router.post('/payment/init', async (req, res) => {
    const { applicationId } = req.body;

    try {
        const [[app]] = await db.query(
            'SELECT * FROM passport_applications WHERE id = ? AND user_id = ?',
            [applicationId, req.user.id]
        );

        if (!app) {
            return res.status(404).json({ error: 'Application not found.' });
        }
        if (app.payment_status === 'Paid') {
            return res.status(400).json({ error: 'Application is already paid.' });
        }

        const tran_id = 'PASS_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

        // update DB with transaction ID
        await db.query(
            'UPDATE passport_applications SET transaction_id = ? WHERE id = ?',
            [tran_id, applicationId]
        );

        const data = {
            total_amount: app.total_fee,
            currency: 'BDT',
            tran_id: tran_id,
            success_url: `http://localhost:3000/api/passport/payment/success/${tran_id}`,
            fail_url: `http://localhost:3000/api/passport/payment/fail/${tran_id}`,
            cancel_url: `http://localhost:3000/api/passport/payment/cancel/${tran_id}`,
            ipn_url: `http://localhost:3000/api/passport/payment/ipn`,
            shipping_method: 'Courier',
            product_name: `Passport Application ${app.application_number}`,
            product_category: 'Government Service',
            product_profile: 'general',
            cus_name: app.full_name_en,
            cus_email: app.email || 'customer@example.com',
            cus_add1: app.present_district || 'Dhaka',
            cus_add2: app.present_district || 'Dhaka',
            cus_city: app.present_district || 'Dhaka',
            cus_state: app.present_division || 'Dhaka',
            cus_postcode: app.present_postal_code || '1000',
            cus_country: 'Bangladesh',
            cus_phone: app.mobile_number,
            cus_fax: app.mobile_number,
            ship_name: app.full_name_en,
            ship_add1: 'Dhaka',
            ship_add2: 'Dhaka',
            ship_city: 'Dhaka',
            ship_state: 'Dhaka',
            ship_postcode: '1000',
            ship_country: 'Bangladesh',
        };

        const sslcz = new SSLCommerz(store_id, store_passwd, is_live);
        sslcz.init(data).then(apiResponse => {
            let GatewayPageURL = apiResponse.GatewayPageURL;
            if (GatewayPageURL) {
                res.json({ url: GatewayPageURL });
            } else {
                res.status(400).json({ error: 'Session was not successful' });
            }
        });

    } catch (error) {
        console.error('SSLCommerz Init Error:', error);
        res.status(500).json({ error: 'Payment initialization failed.' });
    }
});

// =============================================
// RECORD PAYMENT
// =============================================
router.post('/application/:id/payment', async (req, res) => {
    try {
        const { payment_method, transaction_id } = req.body;

        if (!payment_method || !transaction_id) {
            return res.status(400).json({ error: 'Payment method and transaction ID required.' });
        }

        const [[app]] = await db.query(
            'SELECT id, status, payment_status FROM passport_applications WHERE id = ? AND user_id = ?',
            [req.params.id, req.user.id]
        );

        if (!app) {
            return res.status(404).json({ error: 'Application not found.' });
        }
        if (app.payment_status === 'Paid') {
            return res.status(400).json({ error: 'Payment already recorded for this application.' });
        }

        await db.query(
            `UPDATE passport_applications 
             SET payment_status = 'Paid', payment_method = ?, payment_transaction_id = ?, 
                 payment_date = NOW(), status = 'Payment Verified'
             WHERE id = ?`,
            [payment_method, transaction_id, req.params.id]
        );

        res.json({ success: true, message: 'Payment recorded successfully.' });
    } catch (error) {
        console.error('Error recording payment:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// =============================================
// USER STATISTICS
// =============================================
router.get('/stats', async (req, res) => {
    try {
        const [[total]] = await db.query(
            'SELECT COUNT(*) as cnt FROM passport_applications WHERE user_id = ?', [req.user.id]
        );
        const [[active]] = await db.query(
            `SELECT COUNT(*) as cnt FROM passport_applications 
             WHERE user_id = ? AND status NOT IN ('Delivered','Rejected','Cancelled')`, [req.user.id]
        );
        const [[delivered]] = await db.query(
            `SELECT COUNT(*) as cnt FROM passport_applications 
             WHERE user_id = ? AND status = 'Delivered'`, [req.user.id]
        );
        const [[pending]] = await db.query(
            `SELECT COUNT(*) as cnt FROM passport_applications 
             WHERE user_id = ? AND status IN ('Submitted','Payment Verified','Under Review')`, [req.user.id]
        );
        const [[totalFees]] = await db.query(
            `SELECT COALESCE(SUM(total_fee), 0) as total FROM passport_applications 
             WHERE user_id = ? AND payment_status = 'Paid'`, [req.user.id]
        );

        res.json({
            total: total.cnt,
            active: active.cnt,
            delivered: delivered.cnt,
            pending: pending.cnt,
            total_fees_paid: totalFees.total
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// =============================================
// RECENT ACTIVITY
// =============================================
router.get('/recent-activity', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                pa.id, pa.application_number, pa.service_type, pa.status,
                pa.submitted_at, pa.updated_at, pa.total_fee, pa.payment_status
            FROM passport_applications pa
            WHERE pa.user_id = ?
            ORDER BY pa.updated_at DESC
            LIMIT 5
        `, [req.user.id]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// =============================================
// ADMIN ROUTES (Protected by Admin Middleware)
// =============================================
router.use('/admin', adminMiddleware);

// Admin: Get all applications with filters
router.get('/admin/applications', async (req, res) => {
    try {
        const { status, office, date_from, date_to, search } = req.query;
        let query = `
            SELECT pa.id, pa.application_number, pa.service_type, pa.passport_type,
                   pa.full_name_en, pa.nid_number, pa.mobile_number,
                   pa.status, pa.total_fee, pa.payment_status,
                   pa.submitted_at, pa.updated_at,
                   po.office_name,
                   ri.name as user_name, ri.email as user_email
            FROM passport_applications pa
            LEFT JOIN passport_offices po ON pa.preferred_office = po.office_code
            LEFT JOIN reg_info ri ON pa.user_id = ri.id
            WHERE 1=1
        `;
        const params = [];

        if (status) { query += ' AND pa.status = ?'; params.push(status); }
        if (office) { query += ' AND pa.preferred_office = ?'; params.push(office); }
        if (date_from) { query += ' AND DATE(pa.submitted_at) >= ?'; params.push(date_from); }
        if (date_to) { query += ' AND DATE(pa.submitted_at) <= ?'; params.push(date_to); }
        if (search) {
            query += ' AND (pa.application_number LIKE ? OR pa.full_name_en LIKE ? OR pa.nid_number LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        query += ` ORDER BY FIELD(pa.status, 
            'Submitted','Payment Verified','Under Review','Biometric Scheduled',
            'Biometric Enrolled','Police Verification','Police Verification Completed',
            'Approved','Printing','Dispatched','Ready for Delivery',
            'On Hold','Rejected','Cancelled','Delivered'), pa.submitted_at DESC`;

        const [rows] = await db.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Admin fetch error:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Admin: View full application details
router.get('/admin/application/:id', async (req, res) => {
    try {
        const [[app]] = await db.query(`
            SELECT pa.*, po.office_name, po.office_name_bn, po.address as office_address,
                   ri.name as user_name, ri.email as user_email,
                   pb.passport_number, pb.issue_date as passport_issue_date, pb.expiry_date as passport_expiry_date
            FROM passport_applications pa
            LEFT JOIN passport_offices po ON pa.preferred_office = po.office_code
            LEFT JOIN reg_info ri ON pa.user_id = ri.id
            LEFT JOIN passport_books pb ON pa.id = pb.application_id
            WHERE pa.id = ?
        `, [req.params.id]);

        if (!app) {
            return res.status(404).json({ error: 'Application not found.' });
        }

        const [history] = await db.query(
            'SELECT * FROM passport_status_history WHERE application_id = ? ORDER BY created_at ASC',
            [req.params.id]
        );

        res.json({ application: app, status_history: history });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Admin: Update application status
router.put('/admin/application/:id/status', async (req, res) => {
    try {
        const { status, remarks, rejection_reason } = req.body;

        if (!status) {
            return res.status(400).json({ error: 'Status is required.' });
        }

        const [[app]] = await db.query('SELECT id, status as old_status FROM passport_applications WHERE id = ?', [req.params.id]);
        if (!app) {
            return res.status(404).json({ error: 'Application not found.' });
        }

        // Accept optional custom dates from admin
        const { biometric_date, police_verification_date, approved_at, printed_at, dispatched_at, delivered_at } = req.body;

        // Build update query
        let updateQuery = 'UPDATE passport_applications SET status = ?';
        const updateParams = [status];

        if (rejection_reason) {
            updateQuery += ', rejection_reason = ?';
            updateParams.push(rejection_reason);
        }
        if (remarks) {
            updateQuery += ', admin_remarks = ?';
            updateParams.push(remarks);
        }

        // Set timestamps based on status (use custom date if provided, otherwise NOW())
        switch (status) {
            case 'Biometric Scheduled':
            case 'Biometric Enrolled':
                if (biometric_date) {
                    updateQuery += ', biometric_date = ?';
                    updateParams.push(biometric_date);
                } else {
                    updateQuery += ', biometric_date = NOW()';
                }
                break;
            case 'Police Verification':
            case 'Police Verification Completed':
                if (police_verification_date) {
                    updateQuery += ', police_verification_date = ?';
                    updateParams.push(police_verification_date);
                } else {
                    updateQuery += ', police_verification_date = NOW()';
                }
                break;
            case 'Approved':
                if (approved_at) {
                    updateQuery += ', approved_at = ?';
                    updateParams.push(approved_at);
                } else {
                    updateQuery += ', approved_at = NOW()';
                }
                break;
            case 'Printing':
                if (printed_at) {
                    updateQuery += ', printed_at = ?';
                    updateParams.push(printed_at);
                } else {
                    updateQuery += ', printed_at = NOW()';
                }
                break;
            case 'Dispatched':
                if (dispatched_at) {
                    updateQuery += ', dispatched_at = ?';
                    updateParams.push(dispatched_at);
                } else {
                    updateQuery += ', dispatched_at = NOW()';
                }
                break;
            case 'Delivered':
                if (delivered_at) {
                    updateQuery += ', delivered_at = ?';
                    updateParams.push(delivered_at);
                } else {
                    updateQuery += ', delivered_at = NOW()';
                }
                break;
        }

        updateQuery += ' WHERE id = ?';
        updateParams.push(req.params.id);

        await db.query(updateQuery, updateParams);

        res.json({ success: true, message: `Status updated to "${status}".` });
    } catch (error) {
        console.error('Admin status update error:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Admin: Dashboard Stats
router.get('/admin/stats', async (req, res) => {
    try {
        const [[total]] = await db.query('SELECT COUNT(*) as cnt FROM passport_applications');
        const [[pending]] = await db.query("SELECT COUNT(*) as cnt FROM passport_applications WHERE status IN ('Submitted','Payment Verified','Under Review')");
        const [[processing]] = await db.query("SELECT COUNT(*) as cnt FROM passport_applications WHERE status IN ('Biometric Scheduled','Biometric Enrolled','Police Verification','Police Verification Completed','Approved','Printing')");
        const [[delivered]] = await db.query("SELECT COUNT(*) as cnt FROM passport_applications WHERE status = 'Delivered'");
        const [[rejected]] = await db.query("SELECT COUNT(*) as cnt FROM passport_applications WHERE status = 'Rejected'");
        const [[revenue]] = await db.query("SELECT COALESCE(SUM(total_fee), 0) as total FROM passport_applications WHERE payment_status = 'Paid'");
        const [[todayCount]] = await db.query("SELECT COUNT(*) as cnt FROM passport_applications WHERE DATE(submitted_at) = CURDATE()");

        // Monthly trend (last 6 months)
        const [monthly] = await db.query(`
            SELECT DATE_FORMAT(submitted_at, '%Y-%m') as month, COUNT(*) as count
            FROM passport_applications
            WHERE submitted_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
            GROUP BY DATE_FORMAT(submitted_at, '%Y-%m')
            ORDER BY month ASC
        `);

        res.json({
            total: total.cnt,
            pending: pending.cnt,
            processing: processing.cnt,
            delivered: delivered.cnt,
            rejected: rejected.cnt,
            revenue: revenue.total,
            today: todayCount.cnt,
            monthly_trend: monthly
        });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
