// nID Wing Routes - Election Commission of Bangla... - জাতীয় পরিচ..

const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verifyToken = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// File Upload Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../../public/uploads/nid');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|pdf/;
        const ext = allowed.test(path.extname(file.originalname).toLowerCase());
        const mime = allowed.test(file.mimetype);
        if (ext && mime) cb(null, true);
        else cb(new Error('Only JPEG, PNG, PDF allowed'));
    }
});

// Generate unique application/request numbers
function generateRefNumber(prefix) {
    const year = new Date().getFullYear();
    const random = Math.floor(100000 + Math.random() * 900000);
    return `${prefix}-${year}-${random}`;
}

// ==============================
// PUBLIC ROUTES
// ==============================

// Get Collection Centers
router.get('/centers', async (req, res) => {
    try {
        const [centers] = await db.query(`
            SELECT id, center_name, center_name_bn, address, phone, email,
                   opening_time, closing_time, daily_capacity
            FROM nid_collection_centers
            WHERE is_active = 1
            ORDER BY center_name
        `);
        res.json(centers);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch centers' });
    }
});

// Get Fee Structure
router.get('/fees', async (req, res) => {
    try {
        const [fees] = await db.query('SELECT * FROM nid_fees WHERE is_active = 1');
        res.json(fees);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch fees' });
    }
});

// Public NID Verification (Basic)
router.post('/verify-public', async (req, res) => {
    const { nid_number, dob } = req.body;
    try {
        const [profile] = await db.query(`
            SELECT name_en, name_bn, date_of_birth, photo_url, profile_status
            FROM nid_profiles 
            WHERE nid_number = ? AND date_of_birth = ? AND profile_status = 'Active'
        `, [nid_number, dob]);

        if (profile.length === 0) {
            return res.json({ verified: false, message: 'NID not found or DOB mismatch' });
        }

        res.json({
            verified: true,
            data: {
                name_en: profile[0].name_en,
                name_bn: profile[0].name_bn,
                photo: profile[0].photo_url
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Verification failed' });
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

// ==============================
// DASHBOARD & STATS
// ==============================
router.get('/dashboard', async (req, res) => {
    try {
        // Get user's NID profile
        const [profile] = await db.query(
            'SELECT * FROM nid_profiles WHERE user_id = ?',
            [req.user.id]
        );

        // If no profile, check reg_info for basic NID data
        let nidData = null;
        if (profile.length === 0) {
            const [regInfo] = await db.query(
                'SELECT nid, name, mobile, email, dob as date_of_birth FROM reg_info WHERE id = ?',
                [req.user.id]
            );
            if (regInfo.length > 0) {
                nidData = {
                    nid_number: regInfo[0].nid,
                    name_en: regInfo[0].name,
                    mobile_primary: regInfo[0].mobile,
                    email: regInfo[0].email,
                    date_of_birth: regInfo[0].date_of_birth,
                    profile_status: 'Pending',
                    has_full_profile: false
                };
            }
        } else {
            nidData = { ...profile[0], has_full_profile: true };
        }

        // Count applications
        const [appCounts] = await db.query(`
            SELECT 
                (SELECT COUNT(*) FROM nid_applications WHERE user_id = ?) as new_applications,
                (SELECT COUNT(*) FROM nid_correction_requests WHERE user_id = ?) as corrections,
                (SELECT COUNT(*) FROM nid_reissue_requests WHERE user_id = ?) as reissues,
                (SELECT COUNT(*) FROM nid_smart_card_applications WHERE user_id = ?) as smart_cards,
                (SELECT COUNT(*) FROM nid_address_changes WHERE user_id = ?) as address_changes,
                (SELECT COUNT(*) FROM nid_verification_requests WHERE user_id = ?) as verifications
        `, [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id]);

        // Get recent applications
        const [recentApps] = await db.query(`
            SELECT 'Correction' as type, request_no as ref_no, status, created_at
            FROM nid_correction_requests WHERE user_id = ?
            UNION ALL
            SELECT 'Reissue', request_no, status, created_at
            FROM nid_reissue_requests WHERE user_id = ?
            UNION ALL
            SELECT 'Smart Card', application_no, status, created_at
            FROM nid_smart_card_applications WHERE user_id = ?
            UNION ALL
            SELECT 'Address Change', request_no, status, created_at
            FROM nid_address_changes WHERE user_id = ?
            ORDER BY created_at DESC LIMIT 5
        `, [req.user.id, req.user.id, req.user.id, req.user.id]);

        res.json({
            profile: nidData,
            stats: appCounts[0],
            recentApplications: recentApps
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to load dashboard' });
    }
});

// ==============================
// NID PROFILE
// ==============================

// Get/Create NID Profile
router.get('/profile', async (req, res) => {
    try {
        const [profile] = await db.query(
            'SELECT * FROM nid_profiles WHERE user_id = ?',
            [req.user.id]
        );

        if (profile.length === 0) {
            // Fetch from reg_info
            const [regInfo] = await db.query(
                'SELECT * FROM reg_info WHERE id = ?',
                [req.user.id]
            );

            if (regInfo.length > 0) {
                return res.json({
                    exists: false,
                    based_on_registration: {
                        nid_number: regInfo[0].nid,
                        name_en: regInfo[0].name,
                        mobile_primary: regInfo[0].mobile,
                        email: regInfo[0].email,
                        date_of_birth: regInfo[0].dob
                    }
                });
            }
            return res.json({ exists: false });
        }

        res.json({ exists: true, profile: profile[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// Create/Update NID Profile
router.post('/profile', upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'signature', maxCount: 1 }]), async (req, res) => {
    console.log("req.body:", req.body, "Content-Type:", req.headers['content-type']);

    // Sanitize empty strings and whitespace-only to null for database compatibility
    Object.keys(req.body).forEach(k => {
        if (req.body[k] === '' || (typeof req.body[k] === 'string' && req.body[k].trim() === '')) {
            req.body[k] = null;
        }
    });

    // Integer fields must be proper numbers or null
    const intFields = [
        'present_division_id', 'present_district_id', 'present_upazila_id',
        'permanent_division_id', 'permanent_district_id', 'permanent_upazila_id'
    ];
    intFields.forEach(f => {
        const v = req.body[f];
        if (v === null || v === undefined || v === '' || isNaN(parseInt(v))) {
            req.body[f] = null;
        } else {
            req.body[f] = parseInt(v);
        }
    });

    const {
        name_bn, name_en, father_name_bn, father_name_en,
        mother_name_bn, mother_name_en, spouse_name_bn, spouse_name_en,
        date_of_birth, birth_place_bn, birth_place_en, birth_certificate_no,
        gender, blood_group, mobile_primary, mobile_secondary, email,
        present_division_id, present_district_id, present_upazila_id,
        present_post_office, present_post_code, present_ward_no,
        present_village_bn, present_village_en, present_road_no, present_house_no,
        permanent_division_id, permanent_district_id, permanent_upazila_id,
        permanent_post_office, permanent_post_code, permanent_ward_no,
        permanent_village_bn, permanent_village_en, permanent_road_no, permanent_house_no,
        educational_qualification, occupation, occupation_bn, religion
    } = req.body;

    const photoUrl = req.files?.photo?.[0] ? `/uploads/nid/${req.files.photo[0].filename}` : null;
    const signatureUrl = req.files?.signature?.[0] ? `/uploads/nid/${req.files.signature[0].filename}` : null;

    try {
        // Check if profile exists
        const [existing] = await db.query(
            'SELECT id, nid_number FROM nid_profiles WHERE user_id = ?',
            [req.user.id]
        );

        // Get NID from reg_info
        const [regInfo] = await db.query('SELECT nid, gender, name, dob FROM reg_info WHERE id = ?', [req.user.id]);
        const nidNumber = regInfo[0]?.nid;

        // Ensure NOT NULL fields have fallbacks
        const finalGender = gender || (existing.length ? existing[0].gender : null) || regInfo[0]?.gender || 'Male';
        const finalNameBn = name_bn || (existing.length ? existing[0].name_bn : null) || '';
        const finalNameEn = name_en || (existing.length ? existing[0].name_en : null) || regInfo[0]?.name || 'Unknown';
        const finalDob = date_of_birth || (existing.length ? existing[0].date_of_birth : null) || regInfo[0]?.dob;

        if (existing.length > 0) {
            // Update existing profile
            await db.query(`
                UPDATE nid_profiles SET
                    name_bn = ?, name_en = ?, father_name_bn = ?, father_name_en = ?,
                    mother_name_bn = ?, mother_name_en = ?, spouse_name_bn = ?, spouse_name_en = ?,
                    date_of_birth = ?, birth_place_bn = ?, birth_place_en = ?, birth_certificate_no = ?,
                    gender = ?, blood_group = ?, mobile_primary = ?, mobile_secondary = ?, email = ?,
                    present_division_id = ?, present_district_id = ?, present_upazila_id = ?,
                    present_post_office = ?, present_post_code = ?, present_ward_no = ?,
                    present_village_bn = ?, present_village_en = ?, present_road_no = ?, present_house_no = ?,
                    permanent_division_id = ?, permanent_district_id = ?, permanent_upazila_id = ?,
                    permanent_post_office = ?, permanent_post_code = ?, permanent_ward_no = ?,
                    permanent_village_bn = ?, permanent_village_en = ?, permanent_road_no = ?, permanent_house_no = ?,
                    educational_qualification = ?, occupation = ?, occupation_bn = ?, religion = ?,
                    photo_url = COALESCE(?, photo_url), signature_url = COALESCE(?, signature_url),
                    profile_status = 'Pending', updated_at = NOW()
                WHERE user_id = ?
            `, [
                finalNameBn, finalNameEn, father_name_bn, father_name_en,
                mother_name_bn, mother_name_en, spouse_name_bn, spouse_name_en,
                finalDob, birth_place_bn, birth_place_en, birth_certificate_no,
                finalGender, blood_group, mobile_primary, mobile_secondary, email,
                present_division_id, present_district_id, present_upazila_id,
                present_post_office, present_post_code, present_ward_no,
                present_village_bn, present_village_en, present_road_no, present_house_no,
                permanent_division_id, permanent_district_id, permanent_upazila_id,
                permanent_post_office, permanent_post_code, permanent_ward_no,
                permanent_village_bn, permanent_village_en, permanent_road_no, permanent_house_no,
                educational_qualification, occupation, occupation_bn, religion,
                photoUrl, signatureUrl,
                req.user.id
            ]);
            // Removed early res.json
        } else {
            // Create new profile
            await db.query(`
                INSERT INTO nid_profiles (
                    user_id, nid_number, name_bn, name_en, father_name_bn, father_name_en,
                    mother_name_bn, mother_name_en, spouse_name_bn, spouse_name_en,
                    date_of_birth, birth_place_bn, birth_place_en, birth_certificate_no,
                    gender, blood_group, mobile_primary, mobile_secondary, email,
                    present_division_id, present_district_id, present_upazila_id,
                    present_post_office, present_post_code, present_ward_no,
                    present_village_bn, present_village_en, present_road_no, present_house_no,
                    permanent_division_id, permanent_district_id, permanent_upazila_id,
                    permanent_post_office, permanent_post_code, permanent_ward_no,
                    permanent_village_bn, permanent_village_en, permanent_road_no, permanent_house_no,
                    educational_qualification, occupation, occupation_bn, religion,
                    photo_url, signature_url, profile_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')
            `, [
                req.user.id, nidNumber, finalNameBn, finalNameEn, father_name_bn, father_name_en,
                mother_name_bn, mother_name_en, spouse_name_bn, spouse_name_en,
                finalDob, birth_place_bn, birth_place_en, birth_certificate_no,
                finalGender, blood_group, mobile_primary, mobile_secondary, email,
                present_division_id, present_district_id, present_upazila_id,
                present_post_office, present_post_code, present_ward_no,
                present_village_bn, present_village_en, present_road_no, present_house_no,
                permanent_division_id, permanent_district_id, permanent_upazila_id,
                permanent_post_office, permanent_post_code, permanent_ward_no,
                permanent_village_bn, permanent_village_en, permanent_road_no, permanent_house_no,
                educational_qualification, occupation, occupation_bn, religion,
                photoUrl, signatureUrl
            ]);
            // Removed early res.json
        }

        // Log activity
        await db.query(
            'INSERT INTO nid_activity_log (nid_number, user_id, activity_type, activity_details) VALUES (?, ?, ?, ?)',
            [nidNumber, req.user.id, 'Profile Update', 'NID profile created/updated']
        );
        console.log("Success fully saved profile");

        return res.json({
            success: true,
            message: existing.length > 0 ? 'Profile updated successfully' : 'Profile created successfully',
            uploaded: { photo: photoUrl, signature: signatureUrl }
        });
    } catch (error) {
        console.log("CATCH BLOCK HIT! Error is:");
        console.error(error);
        console.log("End of error.");
        res.status(500).json({ error: 'Failed to save profile', details: error.message });
    }
});

// ==============================
// CORRECTION REQUESTS
// ==============================

// Get Correction History
router.get('/corrections', async (req, res) => {
    try {
        const [corrections] = await db.query(`
            SELECT * FROM nid_correction_requests 
            WHERE user_id = ? 
            ORDER BY created_at DESC
        `, [req.user.id]);
        res.json(corrections);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch corrections' });
    }
});

// Submit Correction Request
router.post('/corrections', upload.array('documents', 3), async (req, res) => {
    const {
        nid_number, correction_category, correction_type, current_value, corrected_value,
        document_description
    } = req.body;

    const finalCategory = correction_category || correction_type;

    const requestNo = generateRefNumber('COR');

    // Handle uploaded files
    const docUrls = req.files ? req.files.map(f => `/uploads/nid/${f.filename}`) : [];

    try {
        await db.query(`
            INSERT INTO nid_correction_requests (
                user_id, request_no, nid_number, correction_category,
                current_value, corrected_value, document_description,
                supporting_doc_1, supporting_doc_2, supporting_doc_3,
                status, fee_amount
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Submitted', 
                (SELECT normal_fee FROM nid_fees WHERE service_code = 'NID_COR_1' LIMIT 1)
            )
        `, [
            req.user.id, requestNo, nid_number, finalCategory,
            current_value, corrected_value, document_description,
            docUrls[0] || null, docUrls[1] || null, docUrls[2] || null
        ]);

        // Log activity
        await db.query(
            'INSERT INTO nid_activity_log (nid_number, user_id, activity_type, activity_details) VALUES (?, ?, ?, ?)',
            [nid_number, req.user.id, 'Correction Request', `Correction for ${finalCategory}`]
        );

        res.json({
            success: true,
            request_no: requestNo,
            referenceNumber: requestNo,
            message: 'Correction request submitted successfully'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to submit correction request' });
    }
});

// Get Single Correction Status
router.get('/corrections/:requestNo', async (req, res) => {
    try {
        const [correction] = await db.query(`
            SELECT * FROM nid_correction_requests 
            WHERE request_no = ? AND user_id = ?
        `, [req.params.requestNo, req.user.id]);

        if (correction.length === 0) {
            return res.status(404).json({ error: 'Request not found' });
        }

        res.json(correction[0]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch correction' });
    }
});

// ==============================
// REISSUE REQUESTS
// ==============================

// Get Reissue History
router.get('/reissue', async (req, res) => {
    try {
        const [reissues] = await db.query(`
            SELECT r.*, c.center_name 
            FROM nid_reissue_requests r
            LEFT JOIN nid_collection_centers c ON r.collection_center_id = c.id
            WHERE r.user_id = ? 
            ORDER BY r.created_at DESC
        `, [req.user.id]);
        res.json(reissues);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch reissue requests' });
    }
});

// Submit Reissue Request
router.post('/reissue', upload.fields([
    { name: 'gd_document', maxCount: 1 },
    { name: 'damaged_card_photo', maxCount: 1 },
    { name: 'damaged_photo', maxCount: 1 }
]), async (req, res) => {
    const {
        nid_number, reason, reason_details, details,
        gd_number, gd_date, police_station,
        delivery_type, collection_center_id, delivery_address
    } = req.body;

    const finalDetails = reason_details || details || '';

    const requestNo = generateRefNumber('REI');

    // Get file URLs
    const gdDocUrl = req.files?.gd_document ? `/uploads/nid/${req.files.gd_document[0].filename}` : null;
    const damagedPhotoUrl = (req.files?.damaged_card_photo ? `/uploads/nid/${req.files.damaged_card_photo[0].filename}` : null)
        || (req.files?.damaged_photo ? `/uploads/nid/${req.files.damaged_photo[0].filename}` : null);

    // Determine fee based on reason
    let feeCode = reason === 'Lost' || reason === 'Stolen' ? 'NID_REI_L' : 'NID_REI_D';

    try {
        // Get fee
        const [feeRow] = await db.query('SELECT normal_fee FROM nid_fees WHERE service_code = ?', [feeCode]);
        const feeAmount = feeRow[0]?.normal_fee || 345;

        // Calculate expected delivery (21 days)
        const expectedDelivery = new Date();
        expectedDelivery.setDate(expectedDelivery.getDate() + 21);

        await db.query(`
            INSERT INTO nid_reissue_requests (
                user_id, request_no, nid_number, reason, reason_details,
                gd_number, gd_date, police_station, gd_document_url,
                damaged_card_photo_url, delivery_type, collection_center_id,
                delivery_address, fee_amount, expected_delivery, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Submitted')
        `, [
            req.user.id, requestNo, nid_number, reason, finalDetails,
            gd_number || null, gd_date || null, police_station || null, gdDocUrl,
            damagedPhotoUrl, delivery_type, collection_center_id || null,
            delivery_address || null, feeAmount, expectedDelivery.toISOString().split('T')[0]
        ]);

        // Log activity
        await db.query(
            'INSERT INTO nid_activity_log (nid_number, user_id, activity_type, activity_details) VALUES (?, ?, ?, ?)',
            [nid_number, req.user.id, 'Reissue Request', `Reissue due to: ${reason}`]
        );

        res.json({
            success: true,
            request_no: requestNo,
            referenceNumber: requestNo,
            fee_amount: feeAmount,
            expected_delivery: expectedDelivery.toISOString().split('T')[0],
            message: 'Reissue request submitted successfully'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to submit reissue request' });
    }
});

// ==============================
// SMART CARD APPLICATION
// ==============================

// Get Smart Card Applications
router.get('/smart-card', async (req, res) => {
    try {
        const [applications] = await db.query(`
            SELECT s.*, c.center_name
            FROM nid_smart_card_applications s
            LEFT JOIN nid_collection_centers c ON s.collection_center_id = c.id
            WHERE s.user_id = ?
            ORDER BY s.created_at DESC
        `, [req.user.id]);
        res.json(applications);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch smart card applications' });
    }
});

// Apply for Smart Card
router.post('/smart-card', async (req, res) => {
    const {
        nid_number, current_card_type,
        include_driving_license, include_passport_info, include_passport,
        include_health_id, include_bank_account,
        collection_center_id, biometric_appointment, biometric_date
    } = req.body;

    const finalPassport = include_passport_info || include_passport;
    const finalBioDate = biometric_appointment || biometric_date || null;

    const applicationNo = generateRefNumber('SMT');

    try {
        // Get fee
        const [feeRow] = await db.query('SELECT normal_fee FROM nid_fees WHERE service_code = ?', ['NID_SMART']);
        const feeAmount = feeRow[0]?.normal_fee || 575;

        // Expected delivery (30 days)
        const expectedDelivery = new Date();
        expectedDelivery.setDate(expectedDelivery.getDate() + 30);

        await db.query(`
            INSERT INTO nid_smart_card_applications (
                user_id, application_no, nid_number, current_card_type,
                include_driving_license, include_passport_info,
                include_health_id, include_bank_account,
                collection_center_id, biometric_appointment,
                fee_amount, expected_delivery, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Submitted')
        `, [
            req.user.id, applicationNo, nid_number, current_card_type || 'Standard',
            include_driving_license ? 1 : 0, finalPassport ? 1 : 0,
            include_health_id ? 1 : 0, include_bank_account ? 1 : 0,
            collection_center_id, finalBioDate,
            feeAmount, expectedDelivery.toISOString().split('T')[0]
        ]);

        // Log activity
        await db.query(
            'INSERT INTO nid_activity_log (nid_number, user_id, activity_type, activity_details) VALUES (?, ?, ?, ?)',
            [nid_number, req.user.id, 'Smart Card Request', 'Smart NID card application submitted']
        );

        res.json({
            success: true,
            application_no: applicationNo,
            referenceNumber: applicationNo,
            fee_amount: feeAmount,
            message: 'Smart card application submitted successfully'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to submit smart card application' });
    }
});

// ==============================
// ADDRESS CHANGE
// ==============================

// Get Address Change History
router.get('/address-change', async (req, res) => {
    try {
        const [changes] = await db.query(`
            SELECT ac.*, 
                od.name as old_division, odi.name as old_district, ou.name as old_upazila,
                nd.name as new_division, ndi.name as new_district, nu.name as new_upazila
            FROM nid_address_changes ac
            LEFT JOIN divisions od ON ac.old_division_id = od.id
            LEFT JOIN districts odi ON ac.old_district_id = odi.id
            LEFT JOIN upazilas ou ON ac.old_upazila_id = ou.id
            LEFT JOIN divisions nd ON ac.new_division_id = nd.id
            LEFT JOIN districts ndi ON ac.new_district_id = ndi.id
            LEFT JOIN upazilas nu ON ac.new_upazila_id = nu.id
            WHERE ac.user_id = ?
            ORDER BY ac.created_at DESC
        `, [req.user.id]);
        res.json(changes);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch address changes' });
    }
});

// Submit Address Change
router.post('/address-change', upload.single('proof_document'), async (req, res) => {
    const {
        nid_number, address_type,
        old_division_id, old_district_id, old_upazila_id, old_address,
        new_division_id, new_district_id, new_upazila_id,
        new_division, new_district, new_upazila,
        new_post_office, new_post_code, new_ward, new_ward_no,
        new_village, new_road, new_house, new_house_no,
        change_reason, reason, document_type
    } = req.body;

    // Support both text names and IDs from frontend
    const finalNewDivId = new_division_id || null;
    const finalNewDistId = new_district_id || null;
    const finalNewUpaId = new_upazila_id || null;
    const finalWard = new_ward || new_ward_no || null;
    const finalHouse = new_house || new_house_no || null;
    const finalReason = change_reason || reason || null;

    const requestNo = generateRefNumber('ADR');
    const docUrl = req.file ? `/uploads/nid/${req.file.filename}` : null;

    try {
        // Get fee
        const [feeRow] = await db.query('SELECT normal_fee FROM nid_fees WHERE service_code = ?', ['NID_ADDR']);
        const feeAmount = feeRow[0]?.normal_fee || 230;

        // Build full address
        const fullAddress = `${new_house || ''} ${new_road || ''}, ${new_village || ''}, ${new_post_office || ''} - ${new_post_code || ''}`.trim();

        await db.query(`
            INSERT INTO nid_address_changes (
                user_id, request_no, nid_number, address_type,
                old_division_id, old_district_id, old_upazila_id, old_address,
                new_division_id, new_district_id, new_upazila_id,
                new_post_office, new_post_code, new_ward,
                new_village, new_road, new_house, new_full_address,
                change_reason, proof_document_url, document_type,
                fee_amount, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Submitted')
        `, [
            req.user.id, requestNo, nid_number, address_type,
            old_division_id || null, old_district_id || null, old_upazila_id || null, old_address || null,
            finalNewDivId, finalNewDistId, finalNewUpaId,
            new_post_office, new_post_code, finalWard,
            new_village, new_road, finalHouse, fullAddress,
            finalReason, docUrl, document_type,
            feeAmount
        ]);

        // Log activity
        await db.query(
            'INSERT INTO nid_activity_log (nid_number, user_id, activity_type, activity_details) VALUES (?, ?, ?, ?)',
            [nid_number, req.user.id, 'Address Change', `Address change request for ${address_type || 'N/A'} address`]
        );

        res.json({
            success: true,
            request_no: requestNo,
            referenceNumber: requestNo,
            fee_amount: feeAmount,
            message: 'Address change request submitted successfully'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to submit address change' });
    }
});

// ==============================
// NID VERIFICATION
// ==============================

// Get Verification History
router.get('/verifications', async (req, res) => {
    try {
        const [verifications] = await db.query(`
            SELECT * FROM nid_verification_requests
            WHERE user_id = ?
            ORDER BY created_at DESC
        `, [req.user.id]);
        res.json(verifications);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch verifications' });
    }
});

// Submit Verification Request
router.post('/verify', async (req, res) => {
    const { verification_type, purpose, verify_nid_number, verified_nid, verify_name, verified_name, verify_dob, verified_dob } = req.body;
    const finalNid = verify_nid_number || verified_nid;
    const finalName = verify_name || verified_name;
    const finalDob = verify_dob || verified_dob;

    try {
        // Search for the NID in profiles
        const [profile] = await db.query(`
            SELECT nid_number, name_en, name_bn, date_of_birth, photo_url, profile_status,
                   father_name_en, mother_name_en, blood_group
            FROM nid_profiles 
            WHERE nid_number = ?
        `, [finalNid]);

        let verificationStatus = 'Not Found';
        let verifiedData = null;
        let mismatchFields = [];

        if (profile.length > 0) {
            const p = profile[0];

            // Check for mismatches
            if (finalName && p.name_en && !p.name_en.toLowerCase().includes(finalName.toLowerCase())) {
                mismatchFields.push('Name');
            }
            if (finalDob) {
                // Compare dates without timezone issues
                const dbDate = new Date(p.date_of_birth);
                const dbDateStr = `${dbDate.getFullYear()}-${String(dbDate.getMonth() + 1).padStart(2, '0')}-${String(dbDate.getDate()).padStart(2, '0')}`;
                if (dbDateStr !== finalDob) {
                    mismatchFields.push('Date of Birth');
                }
            }

            if (mismatchFields.length > 0) {
                verificationStatus = 'Mismatch';
            } else {
                verificationStatus = 'Verified';
                verifiedData = {
                    name_en: p.name_en,
                    name_bn: p.name_bn,
                    father_name: p.father_name_en,
                    mother_name: p.mother_name_en,
                    date_of_birth: p.date_of_birth,
                    blood_group: p.blood_group,
                    photo: p.photo_url,
                    nid_status: p.profile_status
                };
            }
        }

        // Log verification
        await db.query(`
            INSERT INTO nid_verification_requests (
                user_id, verification_type, purpose,
                verify_nid_number, verify_name, verify_dob,
                verification_status, verified_data, mismatch_fields,
                api_response_time
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `, [
            req.user.id, verification_type, purpose,
            finalNid, finalName, finalDob,
            verificationStatus, verifiedData ? JSON.stringify(verifiedData) : null,
            mismatchFields.length > 0 ? mismatchFields.join(', ') : null
        ]);

        // Activity log
        await db.query(
            'INSERT INTO nid_activity_log (nid_number, user_id, activity_type, activity_details) VALUES (?, ?, ?, ?)',
            [finalNid, req.user.id, 'Verification', `NID verification - Result: ${verificationStatus}`]
        );

        res.json({
            success: true,
            verification_status: verificationStatus,
            isValid: verificationStatus === 'Verified',
            verified_data: verifiedData,
            data: verifiedData,
            mismatches: mismatchFields,
            matchResult: {
                name: !mismatchFields.includes('Name'),
                dob: !mismatchFields.includes('Date of Birth')
            },
            message: verificationStatus === 'Verified' ? 'NID verified successfully' :
                verificationStatus === 'Mismatch' ? 'Data mismatch detected' : 'NID not found'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Verification failed' });
    }
});

// ==============================
// BIOMETRIC APPOINTMENTS
// ==============================

// Get Appointments
router.get('/appointments', async (req, res) => {
    try {
        const [appointments] = await db.query(`
            SELECT a.*, c.center_name, c.address as center_address
            FROM nid_biometric_appointments a
            LEFT JOIN nid_collection_centers c ON a.center_id = c.id
            WHERE a.user_id = ?
            ORDER BY a.appointment_date DESC
        `, [req.user.id]);
        res.json(appointments);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch appointments' });
    }
});

// Book Appointment
router.post('/appointments', async (req, res) => {
    const {
        application_type, appointment_type, related_application_id,
        center_id, collection_center_id, appointment_date, time_slot
    } = req.body;

    const finalAppType = application_type || appointment_type || 'General';
    const finalCenterId = center_id || collection_center_id;

    const appointmentRef = generateRefNumber('APT');

    try {
        // Check slot availability
        const [existing] = await db.query(`
            SELECT COUNT(*) as count FROM nid_biometric_appointments
            WHERE center_id = ? AND appointment_date = ? AND time_slot = ?
            AND status IN ('Scheduled', 'Confirmed')
        `, [finalCenterId, appointment_date, time_slot]);

        // Get center capacity
        const [center] = await db.query('SELECT daily_capacity FROM nid_collection_centers WHERE id = ?', [finalCenterId]);
        const hourlyCapacity = Math.floor((center[0]?.daily_capacity || 100) / 7);

        if (existing[0].count >= hourlyCapacity) {
            return res.status(400).json({ error: 'This time slot is fully booked. Please select another.' });
        }

        await db.query(`
            INSERT INTO nid_biometric_appointments (
                user_id, appointment_ref, application_type, related_application_id,
                center_id, appointment_date, time_slot, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Scheduled')
        `, [
            req.user.id, appointmentRef, finalAppType, related_application_id || null,
            finalCenterId, appointment_date, time_slot
        ]);

        res.json({
            success: true,
            appointment_ref: appointmentRef,
            tokenNumber: appointmentRef,
            message: 'Appointment booked successfully'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to book appointment' });
    }
});

// Get Available Time Slots
router.get('/appointments/slots/:centerId/:date', async (req, res) => {
    const { centerId, date } = req.params;

    const allSlots = ['09:00-10:00', '10:00-11:00', '11:00-12:00', '12:00-13:00', '14:00-15:00', '15:00-16:00', '16:00-17:00'];

    try {
        const [center] = await db.query('SELECT daily_capacity FROM nid_collection_centers WHERE id = ?', [centerId]);
        const hourlyCapacity = Math.floor((center[0]?.daily_capacity || 100) / 7);

        const [bookings] = await db.query(`
            SELECT time_slot, COUNT(*) as count
            FROM nid_biometric_appointments
            WHERE center_id = ? AND appointment_date = ? AND status IN ('Scheduled', 'Confirmed')
            GROUP BY time_slot
        `, [centerId, date]);

        const bookingMap = {};
        bookings.forEach(b => { bookingMap[b.time_slot] = b.count; });

        const availableSlots = allSlots.map(slot => ({
            slot,
            available: hourlyCapacity - (bookingMap[slot] || 0),
            full: (bookingMap[slot] || 0) >= hourlyCapacity
        }));

        res.json(availableSlots);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch slots' });
    }
});

// ==============================
// FAMILY MEMBERS
// ==============================

// Get Family Members
router.get('/family', async (req, res) => {
    try {
        const [members] = await db.query(`
            SELECT * FROM nid_family_members
            WHERE user_id = ?
            ORDER BY relation
        `, [req.user.id]);
        res.json(members);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch family members' });
    }
});

// Add Family Member
router.post('/family', async (req, res) => {
    const { relation, relationship, member_name, member_nid, member_dob, member_occupation, is_dependent } = req.body;
    const finalRelation = relation || relationship;

    try {
        // get user's NID profile ID
        const [profile] = await db.query('SELECT id FROM nid_profiles WHERE user_id = ?', [req.user.id]);

        if (profile.length === 0) {
            return res.status(400).json({ error: 'Please create your NID profile first' });
        }

        await db.query(`
            INSERT INTO nid_family_members (
                nid_profile_id, user_id, relation, member_name, member_nid,
                member_dob, member_occupation, is_dependent
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            profile[0].id, req.user.id, finalRelation, member_name, member_nid || null,
            member_dob || null, member_occupation || null, is_dependent ? 1 : 0
        ]);

        res.json({ success: true, message: 'Family member added successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to add family member' });
    }
});

// Delete Family Member
router.delete('/family/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM nid_family_members WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        res.json({ success: true, message: 'Family member removed' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to remove family member' });
    }
});

// ==============================
// ACTIVITY LOG
// ==============================
router.get('/activity-log', async (req, res) => {
    try {
        const [logs] = await db.query(`
            SELECT * FROM nid_activity_log
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 50
        `, [req.user.id]);
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch activity log' });
    }
});

// ==============================
// ALL APPLICATIONS (Combined)
// ==============================
router.get('/all-applications', async (req, res) => {
    try {
        const [apps] = await db.query(`
            SELECT 'New NID' as type, application_no as ref_no, status, created_at, 'nid_applications' as source_table
            FROM nid_applications WHERE user_id = ?
            UNION ALL
            SELECT 'Correction' as type, request_no as ref_no, status, created_at, 'nid_correction_requests'
            FROM nid_correction_requests WHERE user_id = ?
            UNION ALL
            SELECT 'Reissue' as type, request_no as ref_no, status, created_at, 'nid_reissue_requests'
            FROM nid_reissue_requests WHERE user_id = ?
            UNION ALL
            SELECT 'Smart Card' as type, application_no as ref_no, status, created_at, 'nid_smart_card_applications'
            FROM nid_smart_card_applications WHERE user_id = ?
            UNION ALL
            SELECT 'Address Change' as type, request_no as ref_no, status, created_at, 'nid_address_changes'
            FROM nid_address_changes WHERE user_id = ?
            ORDER BY created_at DESC
        `, [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id]);

        res.json(apps);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch applications' });
    }
});

// Application Status Tracking
router.get('/track/:refNo', async (req, res) => {
    const { refNo } = req.params;

    try {
        // Determine type from prefix
        let table, idField;
        if (refNo.startsWith('COR')) {
            table = 'nid_correction_requests';
            idField = 'request_no';
        } else if (refNo.startsWith('REI')) {
            table = 'nid_reissue_requests';
            idField = 'request_no';
        } else if (refNo.startsWith('SMT')) {
            table = 'nid_smart_card_applications';
            idField = 'application_no';
        } else if (refNo.startsWith('ADR')) {
            table = 'nid_address_changes';
            idField = 'request_no';
        } else if (refNo.startsWith('NID')) {
            table = 'nid_applications';
            idField = 'application_no';
        } else {
            return res.status(400).json({ error: 'Invalid reference number format' });
        }

        const [result] = await db.query(`SELECT * FROM ${table} WHERE ${idField} = ? AND user_id = ?`, [refNo, req.user.id]);

        if (result.length === 0) {
            return res.status(404).json({ error: 'Application not found' });
        }

        // Normalize the response
        const row = result[0];
        res.json({
            ...row,
            reference_number: row[idField],
            type: refNo.startsWith('COR') ? 'Correction' : refNo.startsWith('REI') ? 'Reissue' : refNo.startsWith('SMT') ? 'Smart Card' : refNo.startsWith('ADR') ? 'Address Change' : 'New NID'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to track application' });
    }
});


// ==============================
// ADMIN ROUTES
// ==============================

// Admin: Get Dashboard Stats
router.get('/admin/stats', adminMiddleware, async (req, res) => {
    try {
        const [[totalApps]] = await db.query('SELECT COUNT(*) as cnt FROM nid_applications');
        const [[corrections]] = await db.query('SELECT COUNT(*) as cnt FROM nid_correction_requests');
        const [[reissues]] = await db.query('SELECT COUNT(*) as cnt FROM nid_reissue_requests');
        const [[pending]] = await db.query("SELECT ((SELECT COUNT(*) FROM nid_applications WHERE status = 'Submitted') + (SELECT COUNT(*) FROM nid_correction_requests WHERE status = 'Submitted') + (SELECT COUNT(*) FROM nid_reissue_requests WHERE status = 'Submitted')) as cnt");
        const [[processing]] = await db.query("SELECT ((SELECT COUNT(*) FROM nid_applications WHERE status IN ('Under Review', 'Biometric Pending', 'Verified', 'Card Printing')) + (SELECT COUNT(*) FROM nid_correction_requests WHERE status IN ('Under Review', 'Document Verification')) + (SELECT COUNT(*) FROM nid_reissue_requests WHERE status IN ('Under Review', 'Verified', 'Card Printing'))) as cnt");
        const [[approved]] = await db.query("SELECT ((SELECT COUNT(*) FROM nid_applications WHERE status IN ('Approved', 'Ready for Collection', 'Delivered')) + (SELECT COUNT(*) FROM nid_correction_requests WHERE status IN ('Approved', 'Completed')) + (SELECT COUNT(*) FROM nid_reissue_requests WHERE status IN ('Ready for Collection', 'Delivered'))) as cnt");
        const [[rejected]] = await db.query("SELECT ((SELECT COUNT(*) FROM nid_applications WHERE status = 'Rejected') + (SELECT COUNT(*) FROM nid_correction_requests WHERE status = 'Rejected') + (SELECT COUNT(*) FROM nid_reissue_requests WHERE status = 'Rejected')) as cnt");

        res.json({
            total: (totalApps ? totalApps.cnt : 0) + (corrections ? corrections.cnt : 0) + (reissues ? reissues.cnt : 0),
            pending: pending ? pending.cnt : 0,
            processing: processing ? processing.cnt : 0,
            approved: approved ? approved.cnt : 0,
            rejected: rejected ? rejected.cnt : 0,
            corrections: corrections ? corrections.cnt : 0
        });
    } catch (error) {
        console.error('Stats Error:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// Admin: Get All Applications (Unified) — JOINs reg_info for names
router.get('/admin/applications', adminMiddleware, async (req, res) => {
    try {
        const [apps] = await db.query(`
            SELECT 'New NID' as type, a.application_no as ref_no, a.status, a.created_at, 
                   a.name_en, a.name_bn, r.name as user_name, 'nid_applications' as source_table
            FROM nid_applications a
            LEFT JOIN reg_info r ON a.user_id = r.id
            UNION ALL
            SELECT 'Correction' as type, c.request_no as ref_no, c.status, c.created_at, 
                   NULL as name_en, NULL as name_bn, r.name as user_name, 'nid_correction_requests' as source_table
            FROM nid_correction_requests c
            LEFT JOIN reg_info r ON c.user_id = r.id
            UNION ALL
            SELECT 'Reissue' as type, re.request_no as ref_no, re.status, re.created_at, 
                   NULL as name_en, NULL as name_bn, r.name as user_name, 'nid_reissue_requests' as source_table
            FROM nid_reissue_requests re
            LEFT JOIN reg_info r ON re.user_id = r.id
            ORDER BY created_at DESC
            LIMIT 200
        `);
        res.json(apps);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch applications' });
    }
});

// Admin: Get Single Application Details (with user info)
router.get('/admin/application/:refNo', adminMiddleware, async (req, res) => {
    const { refNo } = req.params;
    const { table } = req.query; 
    
    const allowedTables = ['nid_applications', 'nid_correction_requests', 'nid_reissue_requests', 'nid_address_changes', 'nid_smart_card_applications'];
    if (!table || !allowedTables.includes(table)) {
        return res.status(400).json({ error: 'Invalid source table' });
    }

    try {
        const idField = (table === 'nid_applications' || table === 'nid_smart_card_applications') ? 'application_no' : 'request_no';
        const [result] = await db.query(`
            SELECT t.*, r.name as user_name, r.email as user_email, r.mobile as user_mobile, r.nid as user_nid
            FROM ${table} t
            LEFT JOIN reg_info r ON t.user_id = r.id
            WHERE t.${idField} = ?
        `, [refNo]);

        if (result.length === 0) {
            return res.status(404).json({ error: 'Application not found' });
        }
        res.json(result[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch details' });
    }
});

// Admin: Update Status
router.post('/admin/update-status', adminMiddleware, async (req, res) => {
    const { refNo, sourceTable, status, remarks } = req.body;
    
    if (!status) return res.status(400).json({ error: 'Status is required' });
    
    const allowedTables = ['nid_applications', 'nid_correction_requests', 'nid_reissue_requests', 'nid_address_changes', 'nid_smart_card_applications'];
    if (!allowedTables.includes(sourceTable)) {
        return res.status(400).json({ error: 'Invalid table' });
    }

    try {
        const idField = (sourceTable === 'nid_applications' || sourceTable === 'nid_smart_card_applications') ? 'application_no' : 'request_no';

        // Build update — include rejection_reason if rejecting, admin_remarks if column exists
        let updateSQL = `UPDATE ${sourceTable} SET status = ?`;
        const params = [status];

        if (status === 'Rejected' && remarks) {
            updateSQL += `, rejection_reason = ?`;
            params.push(remarks);
        }
        if (status === 'Approved' && sourceTable === 'nid_applications') {
            updateSQL += `, approved_at = NOW()`;
        }

        updateSQL += ` WHERE ${idField} = ?`;
        params.push(refNo);

        await db.query(updateSQL, params);

        // Try to update admin_remarks column if it exists (correction_requests has it)
        if (remarks && sourceTable === 'nid_correction_requests') {
            try {
                await db.query(`UPDATE nid_correction_requests SET admin_remarks = ? WHERE request_no = ?`, [remarks, refNo]);
            } catch (e) { /* column may not exist, ignore */ }
        }

        // Log Activity
        const [app] = await db.query(`SELECT user_id FROM ${sourceTable} WHERE ${idField} = ?`, [refNo]);
        
        if (app.length > 0) {
            try {
                await db.query(`
                    INSERT INTO nid_activity_log (user_id, activity_type, activity_details)
                    VALUES (?, 'Profile Update', ?)
                `, [app[0].user_id, `Admin updated ${refNo} status to ${status}. Remarks: ${remarks || 'None'}`]);
            } catch (logErr) {
                console.error('Activity log insert failed (non-critical):', logErr.message);
            }
        }

        res.json({ success: true, message: `Status updated to "${status}"` });
    } catch (error) {
        console.error('Update Error:', error);
        res.status(500).json({ error: 'Database error: ' + error.message });
    }
});

module.exports = router;
