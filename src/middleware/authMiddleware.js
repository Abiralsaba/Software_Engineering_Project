const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).json({ error: 'No token provided' });

    jwt.verify(token.split(' ')[1], process.env.JWT_SECRET || 'your-secret-key', (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Unauthorized' });
        // Applicant UUIDs must never enter legacy routes that interpret id as reg_info.id.
        const { isApplicant, denial } = require('../assistant/identity');
        if (isApplicant(decoded)) return res.status(403).json(denial);
        req.user = decoded;
        next();
    });
};

module.exports = verifyToken;
