const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const db = require('../config/db');

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key_change_this_in_prod';

exports.register = async (req, res) => {
    // Input Validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, nid, mobile, dob, address, gender } = req.body;

    try {
        // check if NID or Email exists in reg_info
        const [existing] = await db.query(
            'SELECT id FROM reg_info WHERE email = ? OR nid = ?',
            [email, nid]
        );

        if (existing.length > 0) {
            return res.status(400).json({ error: 'User with this Email or NID already exists in REG INFO' });
        }

        // Hash Password
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        // Insert into reg_info
        const [result] = await db.query(
            'INSERT INTO reg_info (name, email, password, nid, mobile, dob, address, gender) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [username, email, passwordHash, nid, mobile, dob, address, gender]
        );

        // Insert into user_info (Mirroring initial data)
        await db.query(
            'INSERT INTO user_info (user_id, name, email, nid, mobile, dob, address, gender) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [result.insertId, username, email, nid, mobile, dob, address, gender]
        );

        // Generate Token immediately
        const token = jwt.sign(
            { id: result.insertId, username: username, nid: nid },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.status(201).json({
            message: 'Registration Successful! Logging you in...',
            token,
            user: {
                id: result.insertId,
                name: username,
                email: email,
                nid: nid
            }
        });
    } catch (error) {
        console.error('Registration Error:', error);
        res.status(500).json({ error: 'Server error during registration' });
    }
};

exports.login = async (req, res) => {
    const { email, password } = req.body;

    try {
        const [users] = await db.query(
            'SELECT * FROM reg_info WHERE email = ?',
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = users[0];

        // Check Password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            // strict reg_info check
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate Token
        const token = jwt.sign(
            { id: user.id, username: user.name, nid: user.nid },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        // Record Login Log
        try {
            await db.query(
                'INSERT INTO login_logs (user_id, ip_address, user_agent) VALUES (?, ?, ?)',
                [user.id, req.ip || req.connection.remoteAddress, req.headers['user-agent']]
            );
        } catch (logError) {
            console.error('Logging Error:', logError);
            // non-blocking log
        }

        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                nid: user.nid
            }
        });

    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ error: 'Server error during login' });
    }
};

const nodemailer = require('nodemailer');

// nodemailer setup
const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    auth: {
        user: 'ethereal.user@ethereal.email', // placeholder
        pass: 'ethereal.pass'
    }
});

// get test account
let testAccount = null;
async function getTransporter() {
    if (!testAccount) {
        testAccount = await nodemailer.createTestAccount();
        // recreate with test creds
        return nodemailer.createTransport({
            host: testAccount.smtp.host,
            port: testAccount.smtp.port,
            secure: testAccount.smtp.secure,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass
            }
        });
    }
    return transporter;
}


exports.sendResetOTP = async (req, res) => {
    const { email, nid } = req.body;

    try {
        const [users] = await db.query(
            'SELECT * FROM reg_info WHERE email = ? AND nid = ?',
            [email, nid]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'No account found with this Email and NID.' });
        }

        const user = users[0];

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Set expiry (15 mins from now)
        const expiry = new Date(Date.now() + 15 * 60 * 1000);

        await db.query(
            'UPDATE reg_info SET reset_otp = ?, reset_otp_expires = ? WHERE id = ?',
            [otp, expiry, user.id]
        );

        // Send Email
        const mailer = await getTransporter();
        const info = await mailer.sendMail({
            from: '"Govt Portal Security" <security@gov.bd>',
            to: email,
            subject: "Password Reset Secret Code",
            text: `Your Secret Code for Password Reset is: ${otp}`,
            html: `<b>Your Secret Code for Password Reset is: ${otp}</b><br>It expires in 15 minutes.`
        });

        console.log("Message sent: %s", info.messageId);
        console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));

        res.json({
            message: 'Secret Code sent to your email!',
            previewUrl: nodemailer.getTestMessageUrl(info) // for demo
        });

    } catch (error) {
        console.error('Send OTP Error:', error);
        res.status(500).json({ error: 'Server error sending OTP' });
    }
};

exports.verifyResetOTP = async (req, res) => {
    const { email, nid, otp, newPassword } = req.body;

    try {
        const [users] = await db.query(
            'SELECT * FROM reg_info WHERE email = ? AND nid = ?',
            [email, nid]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const user = users[0];

        // Check OTP
        if (user.reset_otp !== otp) {
            return res.status(400).json({ error: 'Invalid Secret Code' });
        }

        // Check Expiry
        if (new Date() > new Date(user.reset_otp_expires)) {
            return res.status(400).json({ error: 'Secret Code expired' });
        }

        // Hash New Password
        const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

        // update Password and Clear OTP
        await db.query(
            'UPDATE reg_info SET password = ?, reset_otp = NULL, reset_otp_expires = NULL WHERE id = ?',
            [passwordHash, user.id]
        );

        res.json({ message: 'Password changed successfully! You can login now.' });

    } catch (error) {
        console.error('Verify OTP Error:', error);
        res.status(500).json({ error: 'Server error resetting password' });
    }
};
