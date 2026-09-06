// Admin Routes - API endpoints for admin dashboard operations

const express = require('express');
const router = express.Router();
const db = require('../config/db');
const adminMiddleware = require('../middleware/adminMiddleware');

// Apply admin middleware to all routes
router.use(adminMiddleware);

// ==========================================
// USERS MANAGEMENT
// ==========================================

// GET /users
router.get('/users', async (req, res) => {
    try {
        const [users] = await db.query(`
            SELECT 
                id, name, email, nid, mobile, dob, gender, 
                photo_url, created_at
            FROM reg_info 
            ORDER BY created_at DESC
        `);
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// users
router.get('/new-users', async (req, res) => {
    try {
        const [users] = await db.query(`
            SELECT 
                id, name, email, nid, mobile, dob, gender, 
                photo_url, created_at 
            FROM reg_info 
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            ORDER BY created_at DESC
        `);
        res.json(users);
    } catch (error) {
        console.error('Error fetching new users:', error);
        res.status(500).json({ error: 'Failed to fetch new users' });
    }
});

// ==========================================
// SERVICE REQUESTS MANAGEMENT
// ==========================================

// requests
router.get('/service-requests', async (req, res) => {
    try {
        const status = req.query.status; // Optional filter
        let query = `
            SELECT 
                sr.id, sr.service_type, sr.details, sr.status, sr.created_at,
                u.id as user_id, u.name as user_name, u.email as user_email
            FROM service_requests sr
            LEFT JOIN reg_info u ON sr.user_id = u.id
        `;
        const params = [];

        if (status) {
            query += ` WHERE sr.status = ?`;
            params.push(status);
        }

        query += ` ORDER BY sr.created_at DESC`;

        const [requests] = await db.query(query, params);
        res.json(requests);
    } catch (error) {
        console.error('Error fetching service requests:', error);
        res.status(500).json({ error: 'Failed to fetch service requests' });
    }
});

// requests/:id/approve
router.put('/service-requests/:id/approve', async (req, res) => {
    try {
        const { id } = req.params;

        // Update status
        await db.query(
            `UPDATE service_requests SET status = 'approved' WHERE id = ?`,
            [id]
        );

        // get user for notif
        const [request] = await db.query(
            `SELECT user_id, service_type FROM service_requests WHERE id = ?`,
            [id]
        );

        if (request.length > 0) {
            // Add notification
            await db.query(
                `INSERT INTO notifications (user_id, type, message, is_read) VALUES (?, ?, ?, false)`,
                [request[0].user_id, 'Service Request', `Your ${request[0].service_type} request has been approved!`]
            );
        }

        // log action
        console.log('Attempting to log admin action: APPROVE service_requests', id);
        try {
            const [logResult] = await db.query(
                `INSERT INTO admin_actions_log (admin_id, action_type, target_table, target_id, old_status, new_status) 
                 VALUES (?, 'APPROVE', 'service_requests', ?, 'pending', 'approved')`,
                [req.admin.id, id]
            );
            console.log('Admin action logged successfully:', logResult);
        } catch (logError) {
            console.error('Failed to log admin action:', logError);
        }

        // audit log
        await db.query(
            `INSERT INTO audit_log (table_name, record_id, action, old_values, new_values, changed_fields, user_id)
             VALUES (?, ?, 'UPDATE', ?, ?, 'status', ?)`,
            [
                'service_requests',
                id,
                JSON.stringify({ status: 'pending' }),
                JSON.stringify({ status: 'approved' }),
                req.admin.id
            ]
        );

        res.json({ success: true, message: 'Service request approved' });
    } catch (error) {
        console.error('Error approving service request:', error);
        res.status(500).json({ error: 'Failed to approve request' });
    }
});

// requests/:id/reject
router.put('/service-requests/:id/reject', async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        await db.query(
            `UPDATE service_requests SET status = 'rejected' WHERE id = ?`,
            [id]
        );

        // get user for notif
        const [request] = await db.query(
            `SELECT user_id, service_type FROM service_requests WHERE id = ?`,
            [id]
        );

        if (request.length > 0) {
            const message = reason
                ? `Your ${request[0].service_type} request was rejected. Reason: ${reason}`
                : `Your ${request[0].service_type} request was rejected.`;

            await db.query(
                `INSERT INTO notifications (user_id, type, message, is_read) VALUES (?, ?, ?, false)`,
                [request[0].user_id, 'Service Request', message]
            );
        }

        // log action
        await db.query(
            `INSERT INTO admin_actions_log (admin_id, action_type, target_table, target_id, old_status, new_status, notes) 
             VALUES (?, 'REJECT', 'service_requests', ?, 'pending', 'rejected', ?)`,
            [req.admin.id, id, reason || null]
        );

        // audit log
        await db.query(
            `INSERT INTO audit_log (table_name, record_id, action, old_values, new_values, changed_fields, user_id)
             VALUES (?, ?, 'UPDATE', ?, ?, 'status', ?)`,
            [
                'service_requests',
                id,
                JSON.stringify({ status: 'pending' }),
                JSON.stringify({ status: 'rejected', reason: reason }),
                req.admin.id
            ]
        );

        res.json({ success: true, message: 'Service request rejected' });
    } catch (error) {
        console.error('Error rejecting service request:', error);
        res.status(500).json({ error: 'Failed to reject request' });
    }
});

// ==========================================
// LAND MUTATIONS MANAGEMENT
// ==========================================

// mutations
router.get('/land-mutations', async (req, res) => {
    try {
        const status = req.query.status;
        let query = `
            SELECT 
                m.*,
                d.name as division_name,
                dist.name as district_name,
                u.name as upazila_name,
                applicant.name as applicant_name,
                applicant.nid as applicant_nid,
                buyer.name as buyer_name,
                buyer.nid as buyer_display_nid
            FROM land_mutations_v2 m
            LEFT JOIN divisions d ON m.division_id = d.id
            LEFT JOIN districts dist ON m.district_id = dist.id
            LEFT JOIN upazilas u ON m.upazila_id = u.id
            LEFT JOIN reg_info applicant ON m.user_id = applicant.id
            LEFT JOIN reg_info buyer ON m.buyer_id = buyer.id
        `;
        const params = [];

        if (status) {
            query += ` WHERE m.status = ?`;
            params.push(status);
        }

        query += ` ORDER BY m.created_at DESC`;

        const [mutations] = await db.query(query, params);
        res.json(mutations);
    } catch (error) {
        console.error('Error fetching land mutations:', error);
        res.status(500).json({ error: 'Failed to fetch land mutations' });
    }
});

// mutations/:id/approve - This includes transferring lan..
router.put('/land-mutations/:id/approve', async (req, res) => {
    const connection = await db.getConnection();
    console.log(`[Admin] Starting approval for mutation ID: ${req.params.id}`);

    try {
        await connection.beginTransaction();

        const { id } = req.params;

        // Get mutation details
        const [mutations] = await connection.query(
            `SELECT * FROM land_mutations_v2 WHERE id = ? FOR UPDATE`,
            [id]
        );

        if (mutations.length === 0) {
            console.log(`[Admin] Mutation ${id} not found`);
            await connection.rollback();
            return res.status(404).json({ error: 'Mutation not found' });
        }

        const mutation = mutations[0];
        console.log('[Admin] Mutation details:', mutation);

        if (mutation.status !== 'Pending') {
            await connection.rollback();
            return res.status(409).json({ error: `Mutation is already ${mutation.status}` });
        }

        // Updating the status invokes after_mutation_approval. The database
        // trigger is the single authority for the ownership transfer.
        await connection.query(
            `UPDATE land_mutations_v2 SET status = 'Approved' WHERE id = ?`,
            [id]
        );
        console.log('[Admin] Status updated to Approved');

        // notify user
        await connection.query(
            `INSERT INTO notifications (user_id, type, message, is_read) 
             VALUES (?, 'Land Mutation', 'Your land mutation request has been approved!', false)`,
            [mutation.user_id]
        );

        // audit log
        await connection.query(
            `INSERT INTO audit_log (table_name, record_id, action, old_values, new_values, changed_fields, user_id)
             VALUES (?, ?, 'UPDATE', ?, ?, 'status', ?)`,
            [
                'land_mutations_v2',
                id,
                JSON.stringify({ status: mutation.status }),
                JSON.stringify({ status: 'Approved' }),
                req.admin.id
            ]
        );

        // log action
        await connection.query(
            `INSERT INTO admin_actions_log (admin_id, action_type, target_table, target_id, old_status, new_status) 
             VALUES (?, 'APPROVE', 'land_mutations_v2', ?, 'Pending', 'Approved')`,
            [req.admin.id, id]
        );
        console.log('[Admin] Action logged');

        await connection.commit();
        console.log('[Admin] Transaction committed successfully');
        res.json({ success: true, message: 'Land mutation approved and ownership transferred' });
    } catch (error) {
        await connection.rollback();
        console.error('Error approving land mutation:', error);
        // return the exact SQL error message to the frontend for debugging
        res.status(500).json({
            error: error.sqlMessage || error.message || 'Failed to approve mutation',
            details: error.code // e.g., ER_BAD_FIELD_ERROR
        });
    } finally {
        connection.release();
    }
});

// mutations/:id/reject
router.put('/land-mutations/:id/reject', async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        // get mutation for notif
        const [mutation] = await db.query(
            `SELECT user_id, tracking_number FROM land_mutations_v2 WHERE id = ?`,
            [id]
        );

        await db.query(
            `UPDATE land_mutations_v2 SET status = 'Rejected' WHERE id = ?`,
            [id]
        );

        if (mutation.length > 0) {
            const message = reason
                ? `Your land mutation (${mutation[0].tracking_number}) was rejected. Reason: ${reason}`
                : `Your land mutation (${mutation[0].tracking_number}) was rejected.`;

            await db.query(
                `INSERT INTO notifications (user_id, type, message, is_read) VALUES (?, ?, ?, false)`,
                [mutation[0].user_id, 'Land Mutation', message]
            );
        }

        // log action
        await db.query(
            `INSERT INTO admin_actions_log (admin_id, action_type, target_table, target_id, old_status, new_status, notes) 
             VALUES (?, 'REJECT', 'land_mutations_v2', ?, 'Pending', 'Rejected', ?)`,
            [req.admin.id, id, reason || null]
        );

        // audit log
        await db.query(
            `INSERT INTO audit_log (table_name, record_id, action, old_values, new_values, changed_fields, user_id)
             VALUES (?, ?, 'UPDATE', ?, ?, 'status', ?)`,
            [
                'land_mutations_v2',
                id,
                JSON.stringify({ status: 'Pending' }),
                JSON.stringify({ status: 'Rejected', reason: reason }),
                'status',
                req.admin.id
            ]
        );

        res.json({ success: true, message: 'Land mutation rejected' });
    } catch (error) {
        console.error('Error rejecting land mutation:', error);
        res.status(500).json({ error: 'Failed to reject mutation' });
    }
});

// ==========================================
// COMMUNITY GROUPS MANAGEMENT
// ==========================================

// groups
router.get('/community-groups', async (req, res) => {
    try {
        const status = req.query.status;
        let query = `
            SELECT 
                g.*,
                u.name as creator_name,
                u.email as creator_email,
                (SELECT COUNT(*) FROM community_members WHERE group_id = g.id) as member_count,
                (SELECT COUNT(*) FROM community_posts WHERE group_id = g.id) as post_count
            FROM community_groups g
            LEFT JOIN reg_info u ON g.created_by = u.id
        `;
        const params = [];

        if (status) {
            query += ` WHERE g.status = ?`;
            params.push(status);
        }

        query += ` ORDER BY g.created_at DESC`;

        const [groups] = await db.query(query, params);
        res.json(groups);
    } catch (error) {
        console.error('Error fetching community groups:', error);
        res.status(500).json({ error: 'Failed to fetch groups' });
    }
});

// groups/:id/approve
router.put('/community-groups/:id/approve', async (req, res) => {
    try {
        const { id } = req.params;

        await db.query(
            `UPDATE community_groups SET status = 'approved' WHERE id = ?`,
            [id]
        );

        // get group for notif
        const [group] = await db.query(
            `SELECT created_by, name FROM community_groups WHERE id = ?`,
            [id]
        );

        if (group.length > 0) {
            await db.query(
                `INSERT INTO notifications (user_id, type, message, is_read) VALUES (?, ?, ?, false)`,
                [group[0].created_by, 'Community', `Your group "${group[0].name}" has been approved!`]
            );
        }

        // log action
        await db.query(
            `INSERT INTO admin_actions_log (admin_id, action_type, target_table, target_id, old_status, new_status) 
             VALUES (?, 'APPROVE', 'community_groups', ?, 'pending', 'approved')`,
            [req.admin.id, id]
        );

        res.json({ success: true, message: 'Community group approved' });
    } catch (error) {
        console.error('Error approving community group:', error);
        res.status(500).json({ error: 'Failed to approve group' });
    }
});

// groups/:id/reject
router.put('/community-groups/:id/reject', async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        await db.query(
            `UPDATE community_groups SET status = 'rejected' WHERE id = ?`,
            [id]
        );

        // get group for notif
        const [group] = await db.query(
            `SELECT created_by, name FROM community_groups WHERE id = ?`,
            [id]
        );

        if (group.length > 0) {
            const message = reason
                ? `Your group "${group[0].name}" was rejected. Reason: ${reason}`
                : `Your group "${group[0].name}" was rejected.`;

            await db.query(
                `INSERT INTO notifications (user_id, type, message, is_read) VALUES (?, ?, ?, false)`,
                [group[0].created_by, 'Community', message]
            );
        }

        // log action
        await db.query(
            `INSERT INTO admin_actions_log (admin_id, action_type, target_table, target_id, old_status, new_status, notes) 
             VALUES (?, 'REJECT', 'community_groups', ?, 'pending', 'rejected', ?)`,
            [req.admin.id, id, reason || null]
        );

        res.json({ success: true, message: 'Community group rejected' });
    } catch (error) {
        console.error('Error rejecting community group:', error);
        res.status(500).json({ error: 'Failed to reject group' });
    }
});

// ==========================================
// COMMUNITY POSTS MANAGEMENT
// ==========================================

// posts
router.get('/community-posts', async (req, res) => {
    try {
        const status = req.query.status;
        let query = `
            SELECT 
                p.*,
                u.name as author_name,
                u.email as author_email,
                g.name as group_name,
                (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as like_count,
                (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id) as comment_count
            FROM community_posts p
            LEFT JOIN reg_info u ON p.user_id = u.id
            LEFT JOIN community_groups g ON p.group_id = g.id
        `;
        const params = [];

        if (status) {
            query += ` WHERE p.status = ?`;
            params.push(status);
        }

        query += ` ORDER BY p.created_at DESC`;

        const [posts] = await db.query(query, params);
        res.json(posts);
    } catch (error) {
        console.error('Error fetching community posts:', error);
        res.status(500).json({ error: 'Failed to fetch posts' });
    }
});

// posts/:id/approve
router.put('/community-posts/:id/approve', async (req, res) => {
    try {
        const { id } = req.params;

        await db.query(
            `UPDATE community_posts SET status = 'approved' WHERE id = ?`,
            [id]
        );

        // get post for notif
        const [post] = await db.query(
            `SELECT p.user_id, g.name as group_name 
             FROM community_posts p 
             LEFT JOIN community_groups g ON p.group_id = g.id 
             WHERE p.id = ?`,
            [id]
        );

        if (post.length > 0) {
            await db.query(
                `INSERT INTO notifications (user_id, type, message, is_read) VALUES (?, ?, ?, false)`,
                [post[0].user_id, 'Community', `Your post in "${post[0].group_name}" has been approved!`]
            );
        }

        // log action
        await db.query(
            `INSERT INTO admin_actions_log (admin_id, action_type, target_table, target_id, old_status, new_status) 
             VALUES (?, 'APPROVE', 'community_posts', ?, 'pending', 'approved')`,
            [req.admin.id, id]
        );

        res.json({ success: true, message: 'Post approved' });
    } catch (error) {
        console.error('Error approving post:', error);
        res.status(500).json({ error: 'Failed to approve post' });
    }
});

// posts/:id/reject
router.put('/community-posts/:id/reject', async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        await db.query(
            `UPDATE community_posts SET status = 'rejected' WHERE id = ?`,
            [id]
        );

        // get post for notif
        const [post] = await db.query(
            `SELECT p.user_id, g.name as group_name 
             FROM community_posts p 
             LEFT JOIN community_groups g ON p.group_id = g.id 
             WHERE p.id = ?`,
            [id]
        );

        if (post.length > 0) {
            const message = reason
                ? `Your post in "${post[0].group_name}" was rejected. Reason: ${reason}`
                : `Your post in "${post[0].group_name}" was rejected.`;

            await db.query(
                `INSERT INTO notifications (user_id, type, message, is_read) VALUES (?, ?, ?, false)`,
                [post[0].user_id, 'Community', message]
            );
        }

        // log action
        await db.query(
            `INSERT INTO admin_actions_log (admin_id, action_type, target_table, target_id, old_status, new_status, notes) 
             VALUES (?, 'REJECT', 'community_posts', ?, 'pending', 'rejected', ?)`,
            [req.admin.id, id, reason || null]
        );

        res.json({ success: true, message: 'Post rejected' });
    } catch (error) {
        console.error('Error rejecting post:', error);
        res.status(500).json({ error: 'Failed to reject post' });
    }
});

// ==========================================
// SHOP MANAGEMENT
// ==========================================

const multer = require('multer');
const path = require('path');

// multer config
const productStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../../public/uploads/products'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'product-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const productUpload = multer({
    storage: productStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Only image files are allowed'));
    }
});

// items
router.get('/shop-items', async (req, res) => {
    try {
        const [items] = await db.query('SELECT * FROM shop_items ORDER BY created_at DESC');
        res.json(items);
    } catch (error) {
        console.error('Error fetching shop items:', error);
        res.status(500).json({ error: 'Failed to fetch shop items' });
    }
});

// items
router.post('/shop-items', productUpload.single('image'), async (req, res) => {
    try {
        const { name, description, price, stock_quantity } = req.body;

        let image_url = '<i class="fas fa-box"></i>'; // Default icon
        if (req.file) {
            image_url = `/uploads/products/${req.file.filename}`;
        }

        const [result] = await db.query(
            `INSERT INTO shop_items (name, description, price, image_url, stock_quantity) 
             VALUES (?, ?, ?, ?, ?)`,
            [name, description, price, image_url, stock_quantity || 100]
        );

        res.json({
            success: true,
            message: 'Product added successfully',
            item: { id: result.insertId, name, description, price, image_url }
        });
    } catch (error) {
        console.error('Error adding shop item:', error);
        res.status(500).json({ error: 'Failed to add product' });
    }
});

// items/:id
router.put('/shop-items/:id', productUpload.single('image'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, price, stock_quantity } = req.body;

        let updateQuery = `UPDATE shop_items SET name=?, description=?, price=?, stock_quantity=?`;
        let queryParams = [name, description, price, stock_quantity];

        if (req.file) {
            updateQuery += `, image_url=?`;
            queryParams.push(`/uploads/products/${req.file.filename}`);
        }

        updateQuery += ` WHERE id=?`;
        queryParams.push(id);

        await db.query(updateQuery, queryParams);

        res.json({
            success: true,
            message: 'Product updated successfully'
        });
    } catch (error) {
        console.error('Error updating shop item:', error);
        res.status(500).json({ error: 'Failed to update product' });
    }
});



// items/:id
router.delete('/shop-items/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('DELETE FROM shop_items WHERE id = ?', [id]);
        res.json({ success: true, message: 'Product deleted successfully' });
    } catch (error) {
        console.error('Error deleting shop item:', error);
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

// (Existing Code)

// ==========================================
// STIPEND MANAGEMENT
// ==========================================

// GET /stipends
router.get('/stipends', async (req, res) => {
    try {
        const [stipends] = await db.query('SELECT * FROM stipends ORDER BY created_at DESC');
        res.json(stipends);
    } catch (error) {
        console.error('Error fetching stipends:', error);
        res.status(500).json({ error: 'Failed to fetch stipends' });
    }
});

// POST /stipends
router.post('/stipends', async (req, res) => {
    try {
        const { title, description, amount, type, min_gpa, max_income, deadline, is_active } = req.body;

        await db.query(
            `INSERT INTO stipends (title, description, amount, type, min_gpa, max_income, deadline, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [title, description, amount, type, min_gpa || 0, max_income, deadline, is_active ? 1 : 0]
        );

        res.json({ success: true, message: 'Stipend added successfully' });
    } catch (error) {
        console.error('Error adding stipend:', error);
        res.status(500).json({ error: 'Failed to add stipend' });
    }
});

// applications
router.get('/stipend-applications', async (req, res) => {
    try {
        const [apps] = await db.query(`
            SELECT 
                sa.*,
                s.title AS stipend_title,
                u.name AS student_name,
                u.nid AS student_nid
            FROM stipend_applications sa
            JOIN stipends s ON sa.stipend_id = s.id
            JOIN reg_info u ON sa.user_id = u.id
            ORDER BY sa.submitted_at DESC
        `);
        res.json(apps);
    } catch (error) {
        console.error('Error fetching stipend applications:', error);
        res.status(500).json({ error: 'Failed to fetch applications' });
    }
});

// applications/:id/status
router.put('/stipend-applications/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, remarks } = req.body; // Approved / Rejected

        await db.query(
            'UPDATE stipend_applications SET status = ? WHERE id = ?',
            [status, id]
        );

        res.json({ success: true, message: `Application ${status}` });
    } catch (error) {
        console.error('Error updating status:', error);
        res.status(500).json({ error: 'Failed to update status' });
    }
});


router.get('/orders', async (req, res) => {
    try {
        const [orders] = await db.query(`
            SELECT 
                o.*,
                u.name as customer_name,
                u.email as customer_email
            FROM Ordered_item o
            LEFT JOIN reg_info u ON o.user_id = u.id
            ORDER BY o.created_at DESC
        `);
        res.json(orders);
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// PUT /orders/:id/status
router.put('/orders/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'DELIVERED', 'CANCELED', 'PENDING'

        await db.query(
            'UPDATE Ordered_item SET payment_status = ? WHERE id = ?',
            [status, id]
        );

        res.json({ success: true, message: 'Order status updated' });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ error: 'Failed to update order status' });
    }
});

// ==========================================
// MARKET PRICE MANAGEMENT
// ==========================================

// prices
router.get('/market-prices', async (req, res) => {
    try {
        const [prices] = await db.query('SELECT * FROM market_prices ORDER BY category, item_name');
        res.json(prices);
    } catch (error) {
        console.error('Error fetching market prices:', error);
        res.status(500).json({ error: 'Failed to fetch market prices' });
    }
});

// prices
router.post('/market-prices', async (req, res) => {
    try {
        const { item_name, item_name_bn, category, unit, price } = req.body;

        if (!item_name || !price || !unit) {
            return res.status(400).json({ error: 'Item name, price, and unit are required' });
        }

        const [result] = await db.query(
            `INSERT INTO market_prices (item_name, item_name_bn, category, unit, price, updated_by)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [item_name, item_name_bn || null, category || 'Other', unit, price, req.admin.id]
        );

        res.json({ success: true, message: 'Market price added', id: result.insertId });
    } catch (error) {
        console.error('Error adding market price:', error);
        res.status(500).json({ error: 'Failed to add market price' });
    }
});

// prices/:id
router.put('/market-prices/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { item_name, item_name_bn, category, unit, price } = req.body;

        await db.query(
            `UPDATE market_prices SET item_name=?, item_name_bn=?, category=?, unit=?, price=?, updated_by=?, effective_date=CURDATE()
             WHERE id=?`,
            [item_name, item_name_bn || null, category, unit, price, req.admin.id, id]
        );

        res.json({ success: true, message: 'Market price updated' });
    } catch (error) {
        console.error('Error updating market price:', error);
        res.status(500).json({ error: 'Failed to update market price' });
    }
});

// prices/:id
router.delete('/market-prices/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('DELETE FROM market_prices WHERE id = ?', [id]);
        res.json({ success: true, message: 'Market price deleted' });
    } catch (error) {
        console.error('Error deleting market price:', error);
        res.status(500).json({ error: 'Failed to delete market price' });
    }
});

// ==========================================
// PRICE COMPLAINTS MANAGEMENT
// ==========================================

// GET /complaints
router.get('/complaints', async (req, res) => {
    try {
        const status = req.query.status;
        let query = `
            SELECT c.*, u.name as reporter_name, u.email as reporter_email
            FROM price_complaints c
            LEFT JOIN reg_info u ON c.user_id = u.id
        `;
        const params = [];

        if (status) {
            query += ' WHERE c.status = ?';
            params.push(status);
        }

        query += ' ORDER BY c.created_at DESC';
        const [complaints] = await db.query(query, params);
        res.json(complaints);
    } catch (error) {
        console.error('Error fetching complaints:', error);
        res.status(500).json({ error: 'Failed to fetch complaints' });
    }
});

// PUT /complaints/:id
router.put('/complaints/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, admin_notes } = req.body;

        await db.query(
            'UPDATE price_complaints SET status = ?, admin_notes = ? WHERE id = ?',
            [status, admin_notes || null, id]
        );

        // Notify the user
        const [complaint] = await db.query('SELECT user_id, shop_name FROM price_complaints WHERE id = ?', [id]);
        if (complaint.length > 0) {
            const statusMsg = status === 'resolved' ? 'resolved' : status === 'investigating' ? 'being investigated' : 'dismissed';
            await db.query(
                `INSERT INTO notifications (user_id, type, message, is_read) VALUES (?, ?, ?, false)`,
                [complaint[0].user_id, 'Market', `Your complaint against "${complaint[0].shop_name}" is now ${statusMsg}.`]
            );
        }

        res.json({ success: true, message: 'Complaint updated' });
    } catch (error) {
        console.error('Error updating complaint:', error);
        res.status(500).json({ error: 'Failed to update complaint' });
    }
});

// ==========================================
// EDUCATION RESULTS MANAGEMENT
// ==========================================

// GET /education/boards
router.get('/education/boards', async (req, res) => {
    try {
        const [boards] = await db.query('SELECT * FROM education_boards ORDER BY name');
        res.json(boards);
    } catch (error) {
        console.error('Error fetching boards:', error);
        res.status(500).json({ error: 'Failed to fetch boards' });
    }
});

// GET /education/institutions/:boardId
router.get('/education/institutions/:boardId', async (req, res) => {
    try {
        const { boardId } = req.params;
        const [institutions] = await db.query(
            'SELECT * FROM education_institutions WHERE board_id = ? ORDER BY name',
            [boardId]
        );
        res.json(institutions);
    } catch (error) {
        console.error('Error fetching institutions:', error);
        res.status(500).json({ error: 'Failed to fetch institutions' });
    }
});

// examType: jsc, ssc, hsc
router.get('/education/results/:examType', async (req, res) => {
    try {
        const { examType } = req.params;
        const { year, search } = req.query;

        const validExamTypes = ['jsc', 'ssc', 'hsc'];
        if (!validExamTypes.includes(examType.toLowerCase())) {
            return res.status(400).json({ error: 'Invalid exam type' });
        }

        const tableName = `${examType.toLowerCase()}_results`;

        let query = `
            SELECT r.*, b.name as board_name
            FROM ${tableName} r
            LEFT JOIN education_boards b ON r.board_id = b.id
            WHERE 1=1
        `;
        const params = [];

        if (year) {
            query += ` AND r.exam_year = ?`;
            params.push(year);
        }

        if (search) {
            query += ` AND (r.roll_number LIKE ? OR r.student_name LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }

        query += ` ORDER BY r.created_at DESC`;

        const [results] = await db.query(query, params);
        res.json(results);
    } catch (error) {
        console.error('Error fetching education results:', error);
        res.status(500).json({ error: 'Failed to fetch results' });
    }
});

// POST /education/results/:examType
router.post('/education/results/:examType', async (req, res) => {
    try {
        const { examType } = req.params;
        const data = req.body;

        const validExamTypes = ['jsc', 'ssc', 'hsc'];
        if (!validExamTypes.includes(examType.toLowerCase())) {
            return res.status(400).json({ error: 'Invalid exam type' });
        }

        const tableName = `${examType.toLowerCase()}_results`;

        // Build dynamic insert based on exam type
        let columns = ['roll_number', 'registration_number', 'exam_year', 'student_name',
            'father_name', 'mother_name', 'date_of_birth', 'institution_name',
            'board_id', 'gpa', 'result_status'];

        if (examType.toLowerCase() === 'jsc') {
            columns.push('bangla', 'english', 'mathematics', 'general_science',
                'bangladesh_global_studies', 'religion', 'ict');
        } else if (examType.toLowerCase() === 'ssc') {
            columns.push('exam_group', 'bangla_1st', 'bangla_2nd', 'english_1st', 'english_2nd',
                'mathematics', 'physics', 'chemistry', 'biology', 'higher_math',
                'bangladesh_global_studies', 'religion', 'ict');
        } else if (examType.toLowerCase() === 'hsc') {
            columns.push('exam_group', 'bangla_1st', 'bangla_2nd', 'english_1st', 'english_2nd',
                'physics_1st', 'physics_2nd', 'chemistry_1st', 'chemistry_2nd',
                'biology_1st', 'biology_2nd', 'higher_math_1st', 'higher_math_2nd',
                'ict', 'optional_subject_name', 'optional_subject_grade');
        }

        const values = columns.map(col => data[col] || null);
        const placeholders = columns.map(() => '?').join(', ');

        const [result] = await db.query(
            `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`,
            values
        );

        res.json({
            success: true,
            message: 'Result added successfully',
            id: result.insertId
        });
    } catch (error) {
        console.error('Error adding result:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Result already exists for this roll number and year' });
        }
        res.status(500).json({ error: 'Failed to add result' });
    }
});

// PUT /education/results/:examType/:id
router.put('/education/results/:examType/:id', async (req, res) => {
    try {
        const { examType, id } = req.params;
        const data = req.body;

        const validExamTypes = ['jsc', 'ssc', 'hsc'];
        if (!validExamTypes.includes(examType.toLowerCase())) {
            return res.status(400).json({ error: 'Invalid exam type' });
        }

        const tableName = `${examType.toLowerCase()}_results`;

        // Build dynamic update
        const updateFields = [];
        const values = [];

        for (const [key, value] of Object.entries(data)) {
            if (key !== 'id' && value !== undefined) {
                updateFields.push(`${key} = ?`);
                values.push(value);
            }
        }

        values.push(id);

        await db.query(
            `UPDATE ${tableName} SET ${updateFields.join(', ')} WHERE id = ?`,
            values
        );

        res.json({ success: true, message: 'Result updated successfully' });
    } catch (error) {
        console.error('Error updating result:', error);
        res.status(500).json({ error: 'Failed to update result' });
    }
});

// DELETE /education/results/:examType/:id
router.delete('/education/results/:examType/:id', async (req, res) => {
    try {
        const { examType, id } = req.params;

        const validExamTypes = ['jsc', 'ssc', 'hsc'];
        if (!validExamTypes.includes(examType.toLowerCase())) {
            return res.status(400).json({ error: 'Invalid exam type' });
        }

        const tableName = `${examType.toLowerCase()}_results`;

        await db.query(`DELETE FROM ${tableName} WHERE id = ?`, [id]);

        res.json({ success: true, message: 'Result deleted successfully' });
    } catch (error) {
        console.error('Error deleting result:', error);
        res.status(500).json({ error: 'Failed to delete result' });
    }
});

// GET /education/stats
router.get('/education/stats', async (req, res) => {
    try {
        const [jscCount] = await db.query('SELECT COUNT(*) as count FROM jsc_results');
        const [sscCount] = await db.query('SELECT COUNT(*) as count FROM ssc_results');
        const [hscCount] = await db.query('SELECT COUNT(*) as count FROM hsc_results');

        res.json({
            jsc: jscCount[0].count,
            ssc: sscCount[0].count,
            hsc: hscCount[0].count,
            total: jscCount[0].count + sscCount[0].count + hscCount[0].count
        });
    } catch (error) {
        console.error('Error fetching education stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// ==========================================
// UNIVERSITY ADMISSION MANAGEMENT
// ==========================================

// GET /universities
router.get('/universities', async (req, res) => {
    try {
        const [universities] = await db.query(`
            SELECT id, name, name_bn, code AS short_code, type AS university_type, 
                   location, website, logo_url, description, is_active
            FROM universities ORDER BY name
        `);
        res.json({ success: true, data: universities });
    } catch (error) {
        console.error('Error fetching universities:', error);
        res.status(500).json({ error: 'Failed to fetch universities' });
    }
});

// POST /universities
router.post('/universities', async (req, res) => {
    try {
        const {
            name, name_bn,
            code, short_code, // Accept both 'code' and 'short_code'
            type, university_type, // Accept both 'type' and 'university_type'
            location, website, logo_url, description
        } = req.body;

        const universityCode = code || short_code;
        const universityType = type || university_type || 'General';

        if (!name || !universityCode) {
            return res.status(400).json({ success: false, message: 'Name and code are required' });
        }

        const [result] = await db.query(`
            INSERT INTO universities (name, name_bn, code, type, location, website, logo_url, description)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [name, name_bn || null, universityCode, universityType, location, website, logo_url || null, description || null]);

        res.json({ success: true, id: result.insertId, message: 'University added successfully' });
    } catch (error) {
        console.error('Error adding university:', error);
        res.status(500).json({ success: false, message: 'Failed to add university', error: error.sqlMessage || error.message });
    }
});

// PUT /universities/:id
router.put('/universities/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name, name_bn,
            code, short_code,
            type, university_type,
            location, website, logo_url, description, is_active
        } = req.body;

        const universityCode = code || short_code;
        const universityTypeVal = type || university_type;

        await db.query(`
            UPDATE universities SET 
                name = ?, name_bn = ?, code = ?, type = ?, location = ?, 
                website = ?, logo_url = ?, description = ?, is_active = ?
            WHERE id = ?
        `, [name, name_bn, universityCode, universityTypeVal, location, website, logo_url, description, is_active !== false, id]);

        res.json({ success: true, message: 'University updated successfully' });
    } catch (error) {
        console.error('Error updating university:', error);
        res.status(500).json({ success: false, message: 'Failed to update university' });
    }
});

// posts
router.get('/admission-posts', async (req, res) => {
    try {
        const [posts] = await db.query(`
            SELECT ap.id, ap.university_id, ap.session, ap.unit_code AS unit, 
                   ap.unit_name, ap.min_gpa, ap.required_group, ap.application_fee,
                   ap.start_date AS application_start, ap.end_date AS application_end,
                   ap.exam_date, ap.total_seats, ap.status, ap.requirements,
                   u.name AS university_name, u.code AS university_code,
                (SELECT COUNT(*) FROM university_applications WHERE admission_post_id = ap.id) AS application_count,
                (SELECT COUNT(*) FROM university_applications WHERE admission_post_id = ap.id AND payment_status = 'Paid') AS paid_count
            FROM admission_posts ap
            JOIN universities u ON ap.university_id = u.id
            ORDER BY ap.created_at DESC
        `);
        res.json({ success: true, data: posts });
    } catch (error) {
        console.error('Error fetching admission posts:', error);
        res.status(500).json({ error: 'Failed to fetch admission posts' });
    }
});

// posts
router.post('/admission-posts', async (req, res) => {
    try {
        const {
            university_id, session,
            unit, unit_code: unitCodeAlt, // Accept both 'unit' and 'unit_code'
            unit_name, unit_description,
            min_gpa, min_gpa_science, min_gpa_english, required_group,
            application_fee,
            application_start, start_date: startDateAlt, // Accept both names
            application_end, end_date: endDateAlt,
            exam_date, result_date,
            total_seats, status, requirements, instructions
        } = req.body;

        // Use whichever field name was provided
        const unitCode = unit || unitCodeAlt;
        const startDate = application_start || startDateAlt;
        const endDate = application_end || endDateAlt;

        // Generate unit name if not provided
        const unitName = unit_name || `Unit ${unitCode}`;

        if (!university_id || !session || !unitCode || !startDate || !endDate) {
            return res.status(400).json({ success: false, message: 'Missing required fields: university_id, session, unit, application_start, application_end' });
        }

        const [result] = await db.query(`
            INSERT INTO admission_posts (
                university_id, session, unit_code, unit_name, unit_description,
                min_gpa, min_gpa_science, min_gpa_english, required_group,
                application_fee, start_date, end_date, exam_date, result_date,
                total_seats, status, requirements, instructions
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            university_id, session, unitCode, unitName, unit_description,
            min_gpa || 3.50, min_gpa_science, min_gpa_english, required_group || 'Any',
            application_fee || 1000, startDate, endDate, exam_date, result_date,
            total_seats, status || 'Upcoming', requirements, instructions
        ]);

        res.json({ success: true, id: result.insertId, message: 'Admission post created successfully' });
    } catch (error) {
        console.error('Error creating admission post:', error);
        res.status(500).json({ error: 'Failed to create admission post' });
    }
});

// posts/:id
router.put('/admission-posts/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            university_id, session,
            unit, unit_code: unitCodeAlt,
            unit_name, unit_description,
            min_gpa, min_gpa_science, min_gpa_english, required_group,
            application_fee,
            application_start, start_date: startDateAlt,
            application_end, end_date: endDateAlt,
            exam_date, result_date,
            total_seats, status, requirements, instructions
        } = req.body;

        // Use whichever field name was provided
        const unitCode = unit || unitCodeAlt;
        const startDate = application_start || startDateAlt;
        const endDate = application_end || endDateAlt;
        const unitName = unit_name || `Unit ${unitCode}`;

        await db.query(`
            UPDATE admission_posts SET
                session = ?, unit_code = ?, unit_name = ?,
                min_gpa = ?, required_group = ?,
                application_fee = ?, start_date = ?, end_date = ?, exam_date = ?,
                total_seats = ?, status = ?
            WHERE id = ?
        `, [
            session, unitCode, unitName,
            min_gpa, required_group,
            application_fee, startDate, endDate, exam_date,
            total_seats, status, id
        ]);

        res.json({ success: true, message: 'Admission post updated successfully' });
    } catch (error) {
        console.error('Error updating admission post:', error);
        res.status(500).json({ success: false, message: 'Failed to update admission post' });
    }
});

// posts/:id
router.delete('/admission-posts/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // check if there are any applications
        const [apps] = await db.query('SELECT COUNT(*) AS count FROM university_applications WHERE admission_post_id = ?', [id]);
        if (apps[0].count > 0) {
            return res.status(400).json({ error: 'Cannot delete admission post with existing applications' });
        }

        await db.query('DELETE FROM admission_posts WHERE id = ?', [id]);
        res.json({ success: true, message: 'Admission post deleted successfully' });
    } catch (error) {
        console.error('Error deleting admission post:', error);
        res.status(500).json({ error: 'Failed to delete admission post' });
    }
});

// applications
router.get('/university-applications', async (req, res) => {
    try {
        const { status, admission_id } = req.query;

        let query = `
            SELECT ua.*, ap.unit_name, ap.unit_code, u.name AS university_name, u.code AS university_code
            FROM university_applications ua
            JOIN admission_posts ap ON ua.admission_post_id = ap.id
            JOIN universities u ON ap.university_id = u.id
            WHERE 1=1
        `;
        const params = [];

        if (status) {
            query += ' AND ua.application_status = ?';
            params.push(status);
        }

        if (admission_id) {
            query += ' AND ua.admission_post_id = ?';
            params.push(admission_id);
        }

        query += ' ORDER BY ua.created_at DESC';

        const [applications] = await db.query(query, params);
        // Map unit_code to unit for frontend compatibility
        const mappedApps = applications.map(app => ({
            ...app,
            unit: app.unit_code,
            university_id: app.university_id || 0
        }));
        res.json({ success: true, data: mappedApps });
    } catch (error) {
        console.error('Error fetching applications:', error);
        res.status(500).json({ error: 'Failed to fetch applications' });
    }
});

// applications/:id/verify
router.put('/university-applications/:id/verify', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, rejection_reason } = req.body;

        await db.query(`
            UPDATE university_applications SET 
                application_status = ?,
                rejection_reason = ?,
                verified_at = NOW()
            WHERE id = ?
        `, [status, rejection_reason, id]);

        res.json({ success: true, message: 'Application status updated' });
    } catch (error) {
        console.error('Error verifying application:', error);
        res.status(500).json({ error: 'Failed to verify application' });
    }
});

// stats
router.get('/admission-stats', async (req, res) => {
    try {
        const [universities] = await db.query('SELECT COUNT(*) AS count FROM universities WHERE is_active = TRUE');
        const [activeAdmissions] = await db.query('SELECT COUNT(*) AS count FROM admission_posts WHERE status = "Active"');
        const [totalApplications] = await db.query('SELECT COUNT(*) AS count FROM university_applications');
        const [paidApplications] = await db.query('SELECT COUNT(*) AS count FROM university_applications WHERE payment_status = "Paid"');
        const [totalRevenue] = await db.query('SELECT COALESCE(SUM(payment_amount), 0) AS total FROM university_applications WHERE payment_status = "Paid"');

        const [pendingApps] = await db.query('SELECT COUNT(*) AS count FROM university_applications WHERE application_status = "Submitted"');
        const [totalPosts] = await db.query('SELECT COUNT(*) AS count FROM admission_posts');

        res.json({
            success: true,
            data: {
                totalUniversities: universities[0].count,
                totalPosts: totalPosts[0].count,
                activeAdmissions: activeAdmissions[0].count,
                totalApplications: totalApplications[0].count,
                pendingApplications: pendingApps[0].count,
                paidApplications: paidApplications[0].count,
                totalRevenue: totalRevenue[0].total
            }
        });
    } catch (error) {
        console.error('Error fetching admission stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// ==========================================
// TAX / NBR MANAGEMENT
// ==========================================

// GET /tax/stats
router.get('/tax/stats', async (req, res) => {
    try {
        const [tinStats] = await db.query(`
            SELECT 
                COUNT(*) as total_tin,
                SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pending_tin,
                SUM(CASE WHEN status = 'Approved' THEN 1 ELSE 0 END) as approved_tin,
                SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END) as rejected_tin
            FROM nbr_tin_registrations
        `);

        const [returnStats] = await db.query(`
            SELECT 
                COUNT(*) as total_returns,
                SUM(CASE WHEN status = 'Submitted' OR status = 'Under Review' THEN 1 ELSE 0 END) as pending_returns,
                SUM(CASE WHEN status = 'Accepted' THEN 1 ELSE 0 END) as accepted_returns,
                COALESCE(SUM(total_income), 0) as total_income_declared,
                COALESCE(SUM(net_tax_liability), 0) as total_tax_liability,
                COALESCE(SUM(tax_due), 0) as total_tax_due
            FROM nbr_tax_returns
        `);

        const [paymentStats] = await db.query(`
            SELECT 
                COUNT(*) as total_payments,
                COALESCE(SUM(CASE WHEN status = 'Verified' THEN amount ELSE 0 END), 0) as verified_revenue,
                COALESCE(SUM(CASE WHEN status = 'Pending' THEN amount ELSE 0 END), 0) as pending_revenue,
                COALESCE(SUM(amount), 0) as total_revenue
            FROM nbr_tax_payments
        `);

        const [vatStats] = await db.query(`
            SELECT 
                COUNT(*) as total_vat,
                SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pending_vat,
                SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) as active_vat
            FROM nbr_vat_registrations
        `);

        const [noticeStats] = await db.query(`
            SELECT COUNT(*) as total_notices FROM nbr_tax_notices
        `);

        res.json({
            tin: tinStats[0],
            returns: returnStats[0],
            payments: paymentStats[0],
            vat: vatStats[0],
            notices: noticeStats[0]
        });
    } catch (error) {
        console.error('Error fetching tax stats:', error);
        res.status(500).json({ error: 'Failed to fetch tax stats' });
    }
});

// GET /tax/returns
router.get('/tax/returns', async (req, res) => {
    try {
        const { status } = req.query;
        let query = `
            SELECT r.*, u.name as user_name, u.email as user_email, u.nid as user_nid,
                   t.tin_number
            FROM nbr_tax_returns r
            LEFT JOIN reg_info u ON r.user_id = u.id
            LEFT JOIN nbr_tin_registrations t ON r.tin_id = t.id
        `;
        const params = [];
        if (status) {
            query += ' WHERE r.status = ?';
            params.push(status);
        }
        query += ' ORDER BY r.created_at DESC';

        const [rows] = await db.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching tax returns:', error);
        res.status(500).json({ error: 'Failed to fetch returns' });
    }
});

// PUT /tax/returns/:id/status
router.put('/tax/returns/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, remarks } = req.body;

        await db.query(
            `UPDATE nbr_tax_returns SET status = ?, admin_remarks = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?`,
            [status, remarks || null, req.admin.id, id]
        );

        // Notify user
        const [ret] = await db.query('SELECT user_id, submission_ref FROM nbr_tax_returns WHERE id = ?', [id]);
        if (ret.length > 0) {
            await db.query(
                `INSERT INTO notifications (user_id, type, message, is_read) VALUES (?, 'Tax', ?, false)`,
                [ret[0].user_id, `Your tax return (${ret[0].submission_ref}) status updated to: ${status}`]
            );
        }

        res.json({ success: true, message: 'Return status updated' });
    } catch (error) {
        console.error('Error updating return:', error);
        res.status(500).json({ error: 'Failed to update return' });
    }
});

// applications
router.get('/tax/tin-applications', async (req, res) => {
    try {
        const { status } = req.query;
        let query = `
            SELECT t.*, u.name as user_name, u.email as user_email, 
                   z.zone_name, z.zone_code
            FROM nbr_tin_registrations t
            LEFT JOIN reg_info u ON t.user_id = u.id
            LEFT JOIN nbr_tax_zones z ON t.zone_id = z.id
        `;
        const params = [];
        if (status) {
            query += ' WHERE t.status = ?';
            params.push(status);
        }
        query += ' ORDER BY t.created_at DESC';

        const [rows] = await db.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching TIN apps:', error);
        res.status(500).json({ error: 'Failed to fetch TIN applications' });
    }
});

// PUT /tax/tin/:id/approve
router.put('/tax/tin/:id/approve', async (req, res) => {
    try {
        const { id } = req.params;
        const { action, remarks } = req.body; // action: 'approve' or 'reject'

        if (action === 'approve') {
            // Generate TIN number: 12-digit
            const tinNumber = `${Math.floor(100000000000 + Math.random() * 900000000000)}`;

            await db.query(
                `UPDATE nbr_tin_registrations SET status = 'Approved', tin_number = ?, remarks = ?, 
                 approved_by = ?, approved_at = NOW() WHERE id = ?`,
                [tinNumber, remarks || null, req.admin.id, id]
            );

            // Notify user
            const [tin] = await db.query('SELECT user_id, taxpayer_name FROM nbr_tin_registrations WHERE id = ?', [id]);
            if (tin.length > 0) {
                await db.query(
                    `INSERT INTO notifications (user_id, type, message, is_read) VALUES (?, 'Tax', ?, false)`,
                    [tin[0].user_id, `Your TIN has been approved! TIN: ${tinNumber}`]
                );
            }

            res.json({ success: true, message: 'TIN approved', tin_number: tinNumber });
        } else {
            await db.query(
                `UPDATE nbr_tin_registrations SET status = 'Rejected', remarks = ?, 
                 approved_by = ?, approved_at = NOW() WHERE id = ?`,
                [remarks || 'Application rejected', req.admin.id, id]
            );

            const [tin] = await db.query('SELECT user_id FROM nbr_tin_registrations WHERE id = ?', [id]);
            if (tin.length > 0) {
                await db.query(
                    `INSERT INTO notifications (user_id, type, message, is_read) VALUES (?, 'Tax', ?, false)`,
                    [tin[0].user_id, `Your TIN application was rejected. Reason: ${remarks || 'Not specified'}`]
                );
            }

            res.json({ success: true, message: 'TIN rejected' });
        }
    } catch (error) {
        console.error('Error processing TIN:', error);
        res.status(500).json({ error: 'Failed to process TIN application' });
    }
});

// GET /tax/payments
router.get('/tax/payments', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT p.*, u.name as user_name, u.email as user_email,
                   t.tin_number
            FROM nbr_tax_payments p
            LEFT JOIN reg_info u ON p.user_id = u.id
            LEFT JOIN nbr_tin_registrations t ON p.tin_id = t.id
            ORDER BY p.created_at DESC
        `);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching payments:', error);
        res.status(500).json({ error: 'Failed to fetch payments' });
    }
});

// PUT /tax/payments/:id/verify
router.put('/tax/payments/:id/verify', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        await db.query(
            'UPDATE nbr_tax_payments SET status = ? WHERE id = ?',
            [status || 'Verified', id]
        );

        res.json({ success: true, message: 'Payment status updated' });
    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({ error: 'Failed to verify payment' });
    }
});

// POST /tax/notices
router.post('/tax/notices', async (req, res) => {
    try {
        const { user_id, tin_id, notice_type, subject, message, due_date, priority } = req.body;

        await db.query(
            `INSERT INTO nbr_tax_notices 
             (user_id, tin_id, notice_type, subject, message, due_date, priority, issued_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [user_id, tin_id || null, notice_type || 'Information', subject, message,
                due_date || null, priority || 'Medium', req.admin.id]
        );

        // Notify user
        await db.query(
            `INSERT INTO notifications (user_id, type, message, is_read) VALUES (?, 'Tax Notice', ?, false)`,
            [user_id, `New tax notice: ${subject}`]
        );

        res.json({ success: true, message: 'Notice issued successfully' });
    } catch (error) {
        console.error('Error issuing notice:', error);
        res.status(500).json({ error: 'Failed to issue notice' });
    }
});

// GET /tax/notices
router.get('/tax/notices', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT n.*, u.name as user_name, u.email as user_email,
                   t.tin_number
            FROM nbr_tax_notices n
            LEFT JOIN reg_info u ON n.user_id = u.id
            LEFT JOIN nbr_tin_registrations t ON n.tin_id = t.id
            ORDER BY n.created_at DESC
        `);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching notices:', error);
        res.status(500).json({ error: 'Failed to fetch notices' });
    }
});

module.exports = router;
