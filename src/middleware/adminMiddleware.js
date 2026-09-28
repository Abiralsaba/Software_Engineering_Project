// admin Authentication Middleware - Verifies JWT token and ensures..

const jwt = require('jsonwebtoken');
const { loadAdminAccess } = require('../admin/accessControl');
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const adminMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);

        // check if this is an admin token
        if (!decoded.isAdmin) {
            return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
        }

        const admin = await loadAdminAccess(decoded.id);
        if (!admin || admin.status !== 'approved') {
            return res.status(403).json({
                error: 'This administrator account is not active.',
                code: 'ADMIN_ACCOUNT_INACTIVE'
            });
        }
        if (!admin.assignment) {
            return res.status(403).json({
                error: 'Your administrative responsibility has not been assigned yet.',
                code: 'ADMIN_ROLE_UNASSIGNED'
            });
        }

        req.admin = admin;
        next();
    } catch (error) {
        console.error('Admin auth error:', error.message);

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired. Please login again.' });
        }

        if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_FIELD_ERROR') {
            return res.status(503).json({
                error: 'Administrator access setup is not complete. Please contact the platform administrator.',
                code: 'ADMIN_ACCESS_SETUP_REQUIRED'
            });
        }

        return res.status(401).json({ error: 'Invalid token' });
    }
};

module.exports = adminMiddleware;
