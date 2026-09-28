// admin Authentication Controller - Handles admin registration and..

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const db = require('../config/db');
const { loadAdminAccess } = require('../admin/accessControl');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Register a new admin (status will be 'pending')
const register = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const {
        name, email, password, mobile, nid,
        requested_domain_code, requested_scope_level, requested_division_id,
        access_request_note
    } = req.body;

    try {
        // check if email already exists
        const [existing] = await db.query('SELECT id FROM admins WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        const [domains] = await db.query(
            'SELECT code, supports_division_scope FROM admin_service_domains WHERE code = ? AND is_active = 1',
            [requested_domain_code]
        );
        if (!domains.length) return res.status(400).json({ error: 'Select a valid service responsibility.' });

        const divisionId = requested_scope_level === 'division' ? Number(requested_division_id) : null;
        if (requested_scope_level === 'division') {
            if (!domains[0].supports_division_scope) {
                return res.status(400).json({ error: 'This service is administered centrally and does not support a divisional role.' });
            }
            const [divisions] = await db.query('SELECT id FROM divisions WHERE id = ?', [divisionId]);
            if (!divisions.length) return res.status(400).json({ error: 'Select a valid division.' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert admin with pending status
        const [result] = await db.query(
            `INSERT INTO admins
                (name, email, password, mobile, nid, status, requested_domain_code,
                 requested_scope_level, requested_division_id, access_request_note)
             VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
            [name, email, hashedPassword, mobile, nid, requested_domain_code,
                requested_scope_level, divisionId, String(access_request_note || '').slice(0, 500) || null]
        );

        res.status(201).json({
            success: true,
            message: 'Registration successful! Your account is pending admin approval.',
            adminId: result.insertId
        });
    } catch (error) {
        console.error('Admin registration error:', error);
        res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
};

// Login admin (only if status is 'approved')
const login = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
        // Find admin by email
        const [admins] = await db.query(
            'SELECT id, name, email, password, status FROM admins WHERE email = ?',
            [email]
        );

        if (admins.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const admin = admins[0];

        // Check password
        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Check if approved
        if (admin.status === 'pending') {
            return res.status(403).json({
                error: 'Your account is pending approval. Please contact the super admin.',
                status: 'pending'
            });
        }

        if (admin.status === 'rejected') {
            return res.status(403).json({
                error: 'Your registration has been rejected.',
                status: 'rejected'
            });
        }

        const access = await loadAdminAccess(admin.id);
        if (!access?.assignment) {
            return res.status(403).json({
                error: 'Your account is approved, but its administrative responsibility has not been assigned.',
                status: 'unassigned'
            });
        }

        // Generate JWT token with isAdmin flag
        const token = jwt.sign(
            {
                id: admin.id,
                email: admin.email,
                name: admin.name,
                isAdmin: true
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Log login
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        await db.query(
            'INSERT INTO admin_login_logs (admin_id, ip_address, status) VALUES (?, ?, ?)',
            [admin.id, ip, 'success']
        );

        res.json({
            success: true,
            message: 'Login successful',
            token,
            admin: {
                id: admin.id,
                name: admin.name,
                email: admin.email,
                assignment: access.assignment
            }
        });
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ error: 'Login failed. Please try again.' });
    }
};

// current admin info
const getMe = async (req, res) => {
    try {
        res.json(req.admin);
    } catch (error) {
        console.error('Get admin error:', error);
        res.status(500).json({ error: 'Failed to get admin info' });
    }
};

module.exports = { register, login, getMe };
