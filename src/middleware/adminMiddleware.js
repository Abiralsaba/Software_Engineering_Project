// admin Authentication Middleware - Verifies JWT token and ensures..

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const adminMiddleware = (req, res, next) => {
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

        req.admin = decoded;
        next();
    } catch (error) {
        console.error('Admin auth error:', error.message);

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired. Please login again.' });
        }

        return res.status(401).json({ error: 'Invalid token' });
    }
};

module.exports = adminMiddleware;
