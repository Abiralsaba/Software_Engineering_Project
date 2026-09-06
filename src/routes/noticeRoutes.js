// Government Notices Routes - Public: list & view notices

const express = require('express');
const router = express.Router();
const db = require('../config/db');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Admin auth middleware
function adminAuth(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (!decoded.isAdmin) return res.status(403).json({ error: 'Admin access required' });
        req.admin = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}

// =====================
// PUBLIC ROUTES
// =====================

// list notices with search, filter, pagination
router.get('/', async (req, res) => {
    try {
        const { search, department, category, priority, status, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        let where = ['1=1'];
        let params = [];

        // Default to published notices for public view
        if (status) {
            where.push('n.status = ?');
            params.push(status);
        } else {
            where.push("n.status = 'Published'");
        }

        if (search) {
            where.push('(n.title LIKE ? OR n.title_bn LIKE ? OR n.content LIKE ? OR n.reference_no LIKE ?)');
            const s = `%${search}%`;
            params.push(s, s, s, s);
        }

        if (department) {
            where.push('n.department = ?');
            params.push(department);
        }

        if (category) {
            where.push('n.category = ?');
            params.push(category);
        }

        if (priority) {
            where.push('n.priority = ?');
            params.push(priority);
        }

        const whereClause = where.join(' AND ');

        // Get total count
        const [countResult] = await db.query(
            `SELECT COUNT(*) as total FROM govt_notices n WHERE ${whereClause}`,
            params
        );

        // get notices with creator name
        const [notices] = await db.query(
            `SELECT n.*, a.name AS created_by_name 
             FROM govt_notices n
             LEFT JOIN admins a ON n.created_by = a.id
             WHERE ${whereClause} 
             ORDER BY 
                CASE n.priority WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 WHEN 'Low' THEN 3 END,
                n.publish_date DESC
             LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), parseInt(offset)]
        );

        // get distinct departments for filter
        const [departments] = await db.query(
            'SELECT DISTINCT department FROM govt_notices ORDER BY department'
        );

        res.json({
            notices,
            total: countResult[0].total,
            page: parseInt(page),
            totalPages: Math.ceil(countResult[0].total / limit),
            departments: departments.map(d => d.department)
        });
    } catch (error) {
        console.error('Fetch notices error:', error);
        res.status(500).json({ error: 'Failed to fetch notices' });
    }
});

// admin: list all notices including drafts
router.get('/admin/all', adminAuth, async (req, res) => {
    try {
        const [notices] = await db.query(
            `SELECT n.*, a.name AS created_by_name 
             FROM govt_notices n 
             LEFT JOIN admins a ON n.created_by = a.id 
             ORDER BY n.created_at DESC`
        );
        res.json(notices);
    } catch (error) {
        console.error('Admin fetch notices error:', error);
        res.status(500).json({ error: 'Failed to fetch notices' });
    }
});

// single notice detail
router.get('/:id', async (req, res) => {
    try {
        const [notices] = await db.query(
            `SELECT n.*, a.name AS created_by_name 
             FROM govt_notices n 
             LEFT JOIN admins a ON n.created_by = a.id 
             WHERE n.id = ?`, [req.params.id]);
        if (notices.length === 0) {
            return res.status(404).json({ error: 'Notice not found' });
        }
        res.json(notices[0]);
    } catch (error) {
        console.error('Fetch notice error:', error);
        res.status(500).json({ error: 'Failed to fetch notice' });
    }
});

// admin: create notice
router.post('/', adminAuth, async (req, res) => {
    try {
        const {
            title, title_bn, department, category, priority,
            content, reference_no, publish_date, expiry_date,
            attachment_url, status
        } = req.body;

        if (!title || !department || !content || !publish_date) {
            return res.status(400).json({ error: 'Title, department, content, and publish date are required' });
        }

        const [result] = await db.query(
            `INSERT INTO govt_notices 
             (title, title_bn, department, category, priority, content, reference_no, 
              publish_date, expiry_date, attachment_url, status, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [title, title_bn || null, department, category || 'General', priority || 'Medium',
                content, reference_no || null, publish_date, expiry_date || null,
                attachment_url || null, status || 'Published', req.admin.id]
        );

        res.status(201).json({
            success: true,
            message: 'Notice created successfully',
            noticeId: result.insertId
        });
    } catch (error) {
        console.error('Create notice error:', error);
        res.status(500).json({ error: 'Failed to create notice' });
    }
});

// admin: delete notice
router.delete('/:id', adminAuth, async (req, res) => {
    try {
        const [result] = await db.query('DELETE FROM govt_notices WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Notice not found' });
        }
        res.json({ success: true, message: 'Notice deleted successfully' });
    } catch (error) {
        console.error('Delete notice error:', error);
        res.status(500).json({ error: 'Failed to delete notice' });
    }
});

// admin: update/edit notice
router.put('/:id', adminAuth, async (req, res) => {
    try {
        const {
            title, title_bn, department, category, priority,
            content, reference_no, publish_date, expiry_date,
            attachment_url, status
        } = req.body;

        if (!title || !department || !content || !publish_date) {
            return res.status(400).json({ error: 'Title, department, content, and publish date are required' });
        }

        const [result] = await db.query(
            `UPDATE govt_notices SET 
                title = ?, title_bn = ?, department = ?, category = ?, priority = ?,
                content = ?, reference_no = ?, publish_date = ?, expiry_date = ?,
                attachment_url = ?, status = ?
             WHERE id = ?`,
            [title, title_bn || null, department, category || 'General', priority || 'Medium',
                content, reference_no || null, publish_date, expiry_date || null,
                attachment_url || null, status || 'Published', req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Notice not found' });
        }

        res.json({ success: true, message: 'Notice updated successfully' });
    } catch (error) {
        console.error('Update notice error:', error);
        res.status(500).json({ error: 'Failed to update notice' });
    }
});

module.exports = router;
