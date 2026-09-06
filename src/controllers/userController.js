const db = require('../config/db');
const path = require('path');
const fs = require('fs');

// Get Profile
exports.getProfile = async (req, res) => {
    try {
        const [user] = await db.query(
            'SELECT name, email, nid, mobile, dob, address, gender, photo_url as profile_image FROM reg_info WHERE id = ?',
            [req.user.id]
        );

        if (user.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error' });
    }
};

// Update Profile
exports.updateProfile = async (req, res) => {
    const { name, mobile, address, gender } = req.body;
    const userId = req.user.id;

    try {
        // 1. Fetch current data to compare
        const [currentRows] = await db.query('SELECT * FROM reg_info WHERE id = ?', [userId]);
        if (currentRows.length === 0) return res.status(404).json({ error: 'User not found' });

        const oldData = currentRows[0];

        // 2. Identify changes
        const changes = {};
        const oldValues = {};
        const newValues = {};
        let hasChanges = false;

        const fields = ['name', 'mobile', 'address', 'gender'];
        fields.forEach(field => {
            if (req.body[field] !== undefined && req.body[field] !== oldData[field]) {
                changes[field] = true;
                oldValues[field] = oldData[field];
                newValues[field] = req.body[field];
                hasChanges = true;
            }
        });

        if (!hasChanges) {
            return res.json({ message: 'No changes detected' });
        }

        // 3. Update reg_info
        await db.query(
            'UPDATE reg_info SET name = ?, mobile = ?, address = ?, gender = ? WHERE id = ?',
            [name, mobile, address, gender, userId]
        );

        // 3.5 Update user_info (Mirroring)
        // check if user_info record exists first or just update
        await db.query(
            'UPDATE user_info SET name = ?, mobile = ?, address = ?, gender = ? WHERE user_id = ?',
            [name, mobile, address, gender, userId]
        );

        // 4. Insert into edit_req
        // 'edited_by' can be 'Self' or user's name. Let's use 'Self' or userId for now.
        await db.query(
            'INSERT INTO edit_req (user_id, edited_by, edited_fields, old_values, new_values) VALUES (?, ?, ?, ?, ?)',
            [
                userId,
                'Self', // or req.user.email
                JSON.stringify(Object.keys(changes)),
                JSON.stringify(oldValues),
                JSON.stringify(newValues)
            ]
        );

        res.json({ message: 'Profile updated and logged successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update user' });
    }
};

// Upload Photo
exports.uploadPhoto = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const photoUrl = '/uploads/' + req.file.filename;

    try {
        await db.query('UPDATE reg_info SET photo_url = ? WHERE id = ?', [photoUrl, req.user.id]);
        res.json({ message: 'Photo uploaded successfully', imagePath: photoUrl });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database update failed' });
    }
};
