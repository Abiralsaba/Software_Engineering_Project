// ============================================== - স্বাস্থ্য ও পরি...

const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verifyToken = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// ==============================
// PUBLIC ROUTES (No auth needed)
// ==============================

// Browse hospitals (public)
router.get('/hospitals/browse', async (req, res) => {
    try {
        const { division, district, type } = req.query;
        let sql = `SELECT * FROM health_hospitals WHERE is_active = 1`;
        const params = [];

        if (division) { sql += ` AND division = ?`; params.push(division); }
        if (district) { sql += ` AND district = ?`; params.push(district); }
        if (type) { sql += ` AND hospital_type = ?`; params.push(type); }

        sql += ` ORDER BY name ASC`;
        const [rows] = await db.query(sql, params);
        res.json(rows);
    } catch (error) {
        console.error('Hospital browse error:', error);
        res.status(500).json({ error: 'Database error' });
    }
});


// ==============================
// PROTECTED ROUTES (Auth needed)
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

// ===========================
// OVERVIEW / STATS
// ===========================
router.get('/my-stats', async (req, res) => {
    try {
        const userId = req.user.id;
        const [[cards]] = await db.query('SELECT COUNT(*) as count FROM health_cards WHERE user_id = ?', [userId]);
        const [[vaccines]] = await db.query('SELECT COUNT(*) as count FROM health_vaccinations WHERE user_id = ?', [userId]);
        const [[appointments]] = await db.query('SELECT COUNT(*) as count FROM health_appointments WHERE user_id = ?', [userId]);
        const [[ambulance]] = await db.query('SELECT COUNT(*) as count FROM health_ambulance_requests WHERE user_id = ?', [userId]);
        const [[complaints]] = await db.query('SELECT COUNT(*) as count FROM health_complaints WHERE user_id = ?', [userId]);

        res.json({
            health_cards: cards.count,
            vaccinations: vaccines.count,
            appointments: appointments.count,
            ambulance_requests: ambulance.count,
            complaints: complaints.count
        });
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Recent activity
router.get('/my-activity', async (req, res) => {
    try {
        const userId = req.user.id;
        const activities = [];

        const [cards] = await db.query(
            `SELECT 'Health Card' as type, status, created_at FROM health_cards WHERE user_id = ? ORDER BY created_at DESC LIMIT 3`, [userId]);
        const [vaccines] = await db.query(
            `SELECT CONCAT('Vaccination - ', vaccine_name) as type, status, created_at FROM health_vaccinations WHERE user_id = ? ORDER BY created_at DESC LIMIT 3`, [userId]);
        const [appts] = await db.query(
            `SELECT CONCAT('Appointment - ', department) as type, status, created_at FROM health_appointments WHERE user_id = ? ORDER BY created_at DESC LIMIT 3`, [userId]);
        const [ambulances] = await db.query(
            `SELECT CONCAT('Ambulance - ', emergency_type) as type, status, created_at FROM health_ambulance_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 3`, [userId]);
        const [comps] = await db.query(
            `SELECT CONCAT('Complaint - ', complaint_type) as type, status, created_at FROM health_complaints WHERE user_id = ? ORDER BY created_at DESC LIMIT 3`, [userId]);

        activities.push(...cards, ...vaccines, ...appts, ...ambulances, ...comps);
        activities.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        res.json(activities.slice(0, 10));
    } catch (error) {
        console.error('Activity error:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// ===========================
// HEALTH CARD
// ===========================

// Apply for health card
router.post('/health-card/apply', async (req, res) => {
    const {
        full_name, father_name, mother_name, nid_number, date_of_birth, gender,
        blood_group, phone, emergency_contact, division, district, upazila,
        address, allergies, chronic_diseases, disability
    } = req.body;

    try {
        // check if user already has a card
        const [existing] = await db.query('SELECT id FROM health_cards WHERE user_id = ? AND status != "Rejected"', [req.user.id]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'You already have a health card application.' });
        }

        // Generate card number
        const cardNumber = 'HC-' + Date.now().toString().slice(-8) + Math.floor(Math.random() * 1000);

        await db.query(`
            INSERT INTO health_cards 
            (user_id, card_number, full_name, father_name, mother_name, nid_number, date_of_birth, gender,
             blood_group, phone, emergency_contact, division, district, upazila,
             address, allergies, chronic_diseases, disability)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [req.user.id, cardNumber, full_name, father_name, mother_name, nid_number, date_of_birth, gender,
            blood_group, phone, emergency_contact, division, district, upazila,
            address, allergies, chronic_diseases, disability || 'None']);

        res.json({ success: true, message: 'Health card application submitted successfully.', card_number: cardNumber });
    } catch (error) {
        console.error('Health card apply error:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get my health card
router.get('/health-card/my', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM health_cards WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// ===========================
// VACCINATION
// ===========================

// Register for vaccination
router.post('/vaccination/register', async (req, res) => {
    const {
        vaccine_name, vaccine_type, dose_number, vaccination_date,
        vaccination_center, health_card_id
    } = req.body;

    try {
        if (health_card_id) {
            const [ownedCards] = await db.query(
                'SELECT id FROM health_cards WHERE id = ? AND user_id = ? LIMIT 1',
                [health_card_id, req.user.id]
            );
            if (ownedCards.length === 0) {
                return res.status(403).json({ error: 'The selected health card does not belong to the authenticated citizen.' });
            }
        }
        await db.query(`
            INSERT INTO health_vaccinations 
            (user_id, health_card_id, vaccine_name, vaccine_type, dose_number, vaccination_date, vaccination_center)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [req.user.id, health_card_id || null, vaccine_name, vaccine_type, dose_number || 1,
        vaccination_date || null, vaccination_center || null]);

        res.json({ success: true, message: 'Vaccination registration successful.' });
    } catch (error) {
        console.error('Vaccine register error:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get my vaccination records
router.get('/vaccination/my', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT v.*, h.card_number 
            FROM health_vaccinations v
            LEFT JOIN health_cards h ON v.health_card_id = h.id
            WHERE v.user_id = ? 
            ORDER BY v.created_at DESC
        `, [req.user.id]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// ===========================
// HOSPITALS
// ===========================

// Get all hospitals (authenticated)
router.get('/hospitals', async (req, res) => {
    try {
        const { division, district, type, search } = req.query;
        let sql = `SELECT * FROM health_hospitals WHERE is_active = 1`;
        const params = [];

        if (division) { sql += ` AND division = ?`; params.push(division); }
        if (district) { sql += ` AND district = ?`; params.push(district); }
        if (type) { sql += ` AND hospital_type = ?`; params.push(type); }
        if (search) { sql += ` AND (name LIKE ? OR name_bn LIKE ?)`; params.push(`%${search}%`, `%${search}%`); }

        sql += ` ORDER BY hospital_type, name ASC`;
        const [rows] = await db.query(sql, params);
        res.json(rows);
    } catch (error) {
        console.error('Hospital list error:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get single hospital
router.get('/hospitals/:id', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM health_hospitals WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Hospital not found' });
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// ===========================
// APPOINTMENTS
// ===========================

// Book appointment
router.post('/appointment/book', async (req, res) => {
    const {
        hospital_id, patient_name, patient_age, patient_gender,
        phone, department, doctor_name, appointment_date, appointment_time,
        symptoms, urgency
    } = req.body;

    try {
        await db.query(`
            INSERT INTO health_appointments 
            (user_id, hospital_id, patient_name, patient_age, patient_gender,
             phone, department, doctor_name, appointment_date, appointment_time,
             symptoms, urgency)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [req.user.id, hospital_id || null, patient_name, patient_age, patient_gender,
            phone, department, doctor_name || null, appointment_date, appointment_time || null,
        symptoms || null, urgency || 'Normal']);

        res.json({ success: true, message: 'Appointment booked successfully.' });
    } catch (error) {
        console.error('Appointment book error:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get my appointments
router.get('/appointment/my', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT a.*, h.name as hospital_name 
            FROM health_appointments a
            LEFT JOIN health_hospitals h ON a.hospital_id = h.id
            WHERE a.user_id = ? 
            ORDER BY a.appointment_date DESC
        `, [req.user.id]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Cancel appointment
router.put('/appointment/cancel/:id', async (req, res) => {
    try {
        const [result] = await db.query(
            'UPDATE health_appointments SET status = "Cancelled" WHERE id = ? AND user_id = ? AND status = "Pending"',
            [req.params.id, req.user.id]
        );
        if (result.affectedRows === 0) return res.status(400).json({ error: 'Cannot cancel this appointment.' });
        res.json({ success: true, message: 'Appointment cancelled.' });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// ===========================
// AMBULANCE
// ===========================

// Request ambulance
router.post('/ambulance/request', async (req, res) => {
    const {
        patient_name, phone, emergency_type, pickup_address,
        destination_hospital, division, district, urgency, ambulance_type
    } = req.body;

    try {
        await db.query(`
            INSERT INTO health_ambulance_requests 
            (user_id, patient_name, phone, emergency_type, pickup_address,
             destination_hospital, division, district, urgency, ambulance_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [req.user.id, patient_name, phone, emergency_type, pickup_address,
        destination_hospital || null, division, district, urgency || 'Urgent', ambulance_type || 'Basic']);

        res.json({ success: true, message: 'Ambulance request submitted. Emergency services will contact you shortly.' });
    } catch (error) {
        console.error('Ambulance request error:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get my ambulance requests
router.get('/ambulance/my', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM health_ambulance_requests WHERE user_id = ? ORDER BY created_at DESC',
            [req.user.id]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// ===========================
// COMPLAINTS
// ===========================

// Submit complaint
router.post('/complaint/submit', async (req, res) => {
    const {
        complaint_type, hospital_name, description, division, district
    } = req.body;

    try {
        await db.query(`
            INSERT INTO health_complaints 
            (user_id, complaint_type, hospital_name, description, division, district)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [req.user.id, complaint_type, hospital_name || null, description, division || null, district || null]);

        res.json({ success: true, message: 'Complaint submitted successfully.' });
    } catch (error) {
        console.error('Complaint submit error:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get my complaints
router.get('/complaint/my', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM health_complaints WHERE user_id = ? ORDER BY created_at DESC',
            [req.user.id]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});


// ==============================================
// ADMIN ROUTES
// ==============================================
router.use('/admin', adminMiddleware);

// ---------- ADMIN STATS ----------
router.get('/admin/stats', async (req, res) => {
    try {
        const [[totalCards]] = await db.query('SELECT COUNT(*) as c FROM health_cards');
        const [[pendingCards]] = await db.query('SELECT COUNT(*) as c FROM health_cards WHERE status = "Pending"');
        const [[approvedCards]] = await db.query('SELECT COUNT(*) as c FROM health_cards WHERE status = "Approved"');
        const [[totalVaccines]] = await db.query('SELECT COUNT(*) as c FROM health_vaccinations');
        const [[completedVaccines]] = await db.query('SELECT COUNT(*) as c FROM health_vaccinations WHERE status = "Completed"');
        const [[totalAppointments]] = await db.query('SELECT COUNT(*) as c FROM health_appointments');
        const [[pendingAppointments]] = await db.query('SELECT COUNT(*) as c FROM health_appointments WHERE status = "Pending"');
        const [[totalAmbulance]] = await db.query('SELECT COUNT(*) as c FROM health_ambulance_requests');
        const [[activeAmbulance]] = await db.query('SELECT COUNT(*) as c FROM health_ambulance_requests WHERE status IN ("Requested","Dispatched","En Route")');
        const [[totalComplaints]] = await db.query('SELECT COUNT(*) as c FROM health_complaints');
        const [[pendingComplaints]] = await db.query('SELECT COUNT(*) as c FROM health_complaints WHERE status = "Submitted"');
        const [[totalHospitals]] = await db.query('SELECT COUNT(*) as c FROM health_hospitals WHERE is_active = 1');
        const [[todayAppts]] = await db.query('SELECT COUNT(*) as c FROM health_appointments WHERE DATE(appointment_date) = CURDATE()');

        res.json({
            stats: {
                total_cards: totalCards.c,
                pending_cards: pendingCards.c,
                approved_cards: approvedCards.c,
                total_vaccinations: totalVaccines.c,
                completed_vaccines: completedVaccines.c,
                total_appointments: totalAppointments.c,
                pending_appointments: pendingAppointments.c,
                total_ambulance: totalAmbulance.c,
                active_ambulance: activeAmbulance.c,
                total_complaints: totalComplaints.c,
                pending_complaints: pendingComplaints.c,
                total_hospitals: totalHospitals.c,
                today_appointments: todayAppts.c
            }
        });
    } catch (error) {
        console.error('Admin stats error:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// ---------- ADMIN HEALTH CARDS ----------
router.get('/admin/health-cards', async (req, res) => {
    try {
        const { status, search } = req.query;
        let sql = `SELECT hc.*, u.name as user_name, u.email as user_email 
                    FROM health_cards hc 
                    LEFT JOIN reg_info u ON hc.user_id = u.id WHERE 1=1`;
        const params = [];

        if (status) { sql += ` AND hc.status = ?`; params.push(status); }
        if (search) {
            sql += ` AND (hc.full_name LIKE ? OR hc.nid_number LIKE ? OR hc.card_number LIKE ? OR hc.phone LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }

        sql += ` ORDER BY hc.created_at DESC`;
        const [rows] = await db.query(sql, params);
        res.json({ cards: rows });
    } catch (error) {
        console.error('Admin health cards error:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

router.get('/admin/health-cards/:id', async (req, res) => {
    try {
        const [rows] = await db.query(`SELECT hc.*, u.name as user_name, u.email as user_email 
            FROM health_cards hc LEFT JOIN reg_info u ON hc.user_id = u.id WHERE hc.id = ?`, [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: 'Not found' });
        res.json({ card: rows[0] });
    } catch (error) { res.status(500).json({ error: 'Database error' }); }
});

router.put('/admin/health-cards/:id', async (req, res) => {
    const { status, admin_note } = req.body;
    try {
        await db.query('UPDATE health_cards SET status = ?, admin_remarks = ? WHERE id = ?',
            [status, admin_note || null, req.params.id]);
        res.json({ success: true, message: 'Health card updated.' });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// ---------- ADMIN VACCINATIONS ----------
router.get('/admin/vaccinations', async (req, res) => {
    try {
        const { status, search } = req.query;
        let sql = `SELECT v.*, u.name as user_name, u.email as user_email, hc.card_number
                    FROM health_vaccinations v
                    LEFT JOIN reg_info u ON v.user_id = u.id
                    LEFT JOIN health_cards hc ON v.health_card_id = hc.id
                    WHERE 1=1`;
        const params = [];

        if (status) { sql += ` AND v.status = ?`; params.push(status); }
        if (search) {
            sql += ` AND (v.vaccine_name LIKE ? OR u.name LIKE ? OR hc.card_number LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        sql += ` ORDER BY v.created_at DESC`;
        const [rows] = await db.query(sql, params);
        res.json({ vaccinations: rows });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

router.get('/admin/vaccinations/:id', async (req, res) => {
    try {
        const [rows] = await db.query(`SELECT v.*, u.name as user_name, u.email as user_email, hc.card_number, hc.full_name, hc.nid_number
            FROM health_vaccinations v
            LEFT JOIN reg_info u ON v.user_id = u.id
            LEFT JOIN health_cards hc ON v.health_card_id = hc.id
            WHERE v.id = ?`, [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: 'Not found' });
        res.json({ vaccination: rows[0] });
    } catch (error) { res.status(500).json({ error: 'Database error' }); }
});

router.put('/admin/vaccinations/:id', async (req, res) => {
    const { status, vaccination_date, vaccination_center, batch_number, administered_by,
        next_dose_date, certificate_number, admin_remarks } = req.body;
    try {
        await db.query(`UPDATE health_vaccinations SET 
            status = ?, vaccination_date = ?, vaccination_center = ?, batch_number = ?,
            administered_by = ?, next_dose_date = ?, certificate_number = ?, admin_remarks = ?
            WHERE id = ?`,
            [status, vaccination_date || null, vaccination_center || null, batch_number || null,
                administered_by || null, next_dose_date || null, certificate_number || null,
                admin_remarks || null, req.params.id]);
        res.json({ success: true, message: 'Vaccination record updated.' });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// ---------- ADMIN APPOINTMENTS ----------
router.get('/admin/appointments', async (req, res) => {
    try {
        const { status, search, date } = req.query;
        let sql = `SELECT a.*, u.name as user_name, u.email as user_email, h.name as hospital_name
                    FROM health_appointments a
                    LEFT JOIN reg_info u ON a.user_id = u.id
                    LEFT JOIN health_hospitals h ON a.hospital_id = h.id
                    WHERE 1=1`;
        const params = [];

        if (status) { sql += ` AND a.status = ?`; params.push(status); }
        if (date) { sql += ` AND DATE(a.appointment_date) = ?`; params.push(date); }
        if (search) {
            sql += ` AND (a.patient_name LIKE ? OR u.name LIKE ? OR a.phone LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        sql += ` ORDER BY a.appointment_date DESC`;
        const [rows] = await db.query(sql, params);
        res.json({ appointments: rows });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

router.get('/admin/appointments/:id', async (req, res) => {
    try {
        const [rows] = await db.query(`SELECT a.*, u.name as username, h.name as hospital_name
            FROM health_appointments a
            LEFT JOIN reg_info u ON a.user_id = u.id
            LEFT JOIN health_hospitals h ON a.hospital_id = h.id
            WHERE a.id = ?`, [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: 'Not found' });
        res.json({ appointment: rows[0] });
    } catch (error) { res.status(500).json({ error: 'Database error' }); }
});

router.put('/admin/appointments/:id', async (req, res) => {
    const { status, doctor_name, appointment_time, prescription, admin_remarks } = req.body;
    try {
        await db.query(`UPDATE health_appointments SET 
            status = ?, doctor_name = ?, appointment_time = ?, prescription = ?, admin_remarks = ?
            WHERE id = ?`,
            [status, doctor_name || null, appointment_time || null, prescription || null,
                admin_remarks || null, req.params.id]);
        res.json({ success: true, message: 'Appointment updated.' });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// ---------- ADMIN AMBULANCE ----------
router.get('/admin/ambulance', async (req, res) => {
    try {
        const { status, search } = req.query;
        let sql = `SELECT a.*, u.name as user_name, u.email as user_email
                    FROM health_ambulance_requests a
                    LEFT JOIN reg_info u ON a.user_id = u.id
                    WHERE 1=1`;
        const params = [];

        if (status) { sql += ` AND a.status = ?`; params.push(status); }
        if (search) {
            sql += ` AND (a.patient_name LIKE ? OR a.phone LIKE ? OR u.name LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        sql += ` ORDER BY a.created_at DESC`;
        const [rows] = await db.query(sql, params);
        res.json({ requests: rows });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

router.get('/admin/ambulance/:id', async (req, res) => {
    try {
        const [rows] = await db.query(`SELECT a.*, u.name as username
            FROM health_ambulance_requests a
            LEFT JOIN reg_info u ON a.user_id = u.id
            WHERE a.id = ?`, [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: 'Not found' });
        res.json({ request: rows[0] });
    } catch (error) { res.status(500).json({ error: 'Database error' }); }
});

router.put('/admin/ambulance/:id', async (req, res) => {
    const { status, driver_name, driver_phone, vehicle_number, estimated_arrival, admin_remarks } = req.body;
    try {
        await db.query(`UPDATE health_ambulance_requests SET 
            status = ?, driver_name = ?, driver_phone = ?, vehicle_number = ?, 
            estimated_arrival = ?, admin_remarks = ?
            WHERE id = ?`,
            [status, driver_name || null, driver_phone || null, vehicle_number || null,
                estimated_arrival || null, admin_remarks || null, req.params.id]);
        res.json({ success: true, message: 'Ambulance request updated.' });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// ---------- ADMIN COMPLAINTS ----------
router.get('/admin/complaints', async (req, res) => {
    try {
        const { status, search } = req.query;
        let sql = `SELECT c.*, u.name as user_name, u.email as user_email
                    FROM health_complaints c
                    LEFT JOIN reg_info u ON c.user_id = u.id
                    WHERE 1=1`;
        const params = [];

        if (status) { sql += ` AND c.status = ?`; params.push(status); }
        if (search) {
            sql += ` AND (c.hospital_name LIKE ? OR c.description LIKE ? OR u.name LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        sql += ` ORDER BY c.created_at DESC`;
        const [rows] = await db.query(sql, params);
        res.json({ complaints: rows });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

router.get('/admin/complaints/:id', async (req, res) => {
    try {
        const [rows] = await db.query(`SELECT c.*, u.name as username
            FROM health_complaints c
            LEFT JOIN reg_info u ON c.user_id = u.id
            WHERE c.id = ?`, [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: 'Not found' });
        res.json({ complaint: rows[0] });
    } catch (error) { res.status(500).json({ error: 'Database error' }); }
});

router.put('/admin/complaints/:id', async (req, res) => {
    const { status, admin_response } = req.body;
    try {
        await db.query('UPDATE health_complaints SET status = ?, resolution = ? WHERE id = ?',
            [status, admin_response || null, req.params.id]);
        res.json({ success: true, message: 'Complaint updated.' });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// ---------- ADMIN HOSPITALS CRUD ----------
router.get('/admin/hospitals', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM health_hospitals ORDER BY name ASC');
        res.json({ hospitals: rows });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

router.post('/admin/hospitals', async (req, res) => {
    const {
        name, name_bn, hospital_type, division, district, upazila, address,
        phone, emergency_phone, email, total_beds, icu_beds, available_beds,
        available_icu_beds, departments, facilities, ambulance_available, blood_bank
    } = req.body;

    try {
        await db.query(`
            INSERT INTO health_hospitals 
            (name, name_bn, hospital_type, division, district, upazila, address,
             phone, emergency_phone, email, total_beds, icu_beds, available_beds,
             available_icu_beds, departments, facilities, ambulance_available, blood_bank)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [name, name_bn, hospital_type, division, district, upazila, address,
            phone, emergency_phone, email, total_beds || 0, icu_beds || 0, available_beds || 0,
            available_icu_beds || 0, departments, facilities, ambulance_available ? 1 : 0, blood_bank ? 1 : 0]);

        res.json({ success: true, message: 'Hospital added.' });
    } catch (error) {
        console.error('Admin add hospital error:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

router.put('/admin/hospitals/:id', async (req, res) => {
    const {
        name, name_bn, hospital_type, division, district, upazila, address,
        phone, emergency_phone, email, total_beds, icu_beds, available_beds,
        available_icu_beds, departments, facilities, ambulance_available, blood_bank, is_active
    } = req.body;

    try {
        await db.query(`
            UPDATE health_hospitals SET 
            name=?, name_bn=?, hospital_type=?, division=?, district=?, upazila=?, address=?,
            phone=?, emergency_phone=?, email=?, total_beds=?, icu_beds=?, available_beds=?,
            available_icu_beds=?, departments=?, facilities=?, ambulance_available=?, blood_bank=?, is_active=?
            WHERE id = ?
        `, [name, name_bn, hospital_type, division, district, upazila, address,
            phone, emergency_phone, email, total_beds, icu_beds, available_beds,
            available_icu_beds, departments, facilities, ambulance_available ? 1 : 0,
            blood_bank ? 1 : 0, is_active !== undefined ? is_active : 1, req.params.id]);

        res.json({ success: true, message: 'Hospital updated.' });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

router.get('/admin/hospitals/:id', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM health_hospitals WHERE id = ?', [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: 'Not found' });
        res.json({ hospital: rows[0] });
    } catch (error) { res.status(500).json({ error: 'Database error' }); }
});

router.delete('/admin/hospitals/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM health_hospitals WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'Hospital deleted.' });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
