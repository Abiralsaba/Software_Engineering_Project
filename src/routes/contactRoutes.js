const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verifyToken = require('../middleware/authMiddleware');

// Optional: verify token to link to user, but allow public submissions if needed?
// for this app, let's assume users are logged in as per current flow (token in localStorage)
router.use(verifyToken);

router.post('/', async (req, res) => {
    try {
        const { department, subject, message } = req.body;
        const userId = req.user.id;

        if (!department || !subject || !message) {
            return res.status(400).json({ error: 'Department, subject, and message are required' });
        }

        const [result] = await db.query(
            'INSERT INTO contact_messages (user_id, department, subject, message) VALUES (?, ?, ?, ?)',
            [userId, department, subject, message]
        );

        res.json({ success: true, message: 'Message sent successfully', ticketId: result.insertId });

    } catch (error) {
        console.error('Error saving contact message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

module.exports = router;
