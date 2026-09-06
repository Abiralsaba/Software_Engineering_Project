const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();
const fs = require('fs');

// Debugging: Log crashes
process.on('uncaughtException', (err) => {
    const msg = `Uncaught Exception: ${err.stack}\n`;
    console.error(msg);
    fs.appendFileSync('server_crash.log', msg);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    const msg = `Unhandled Rejection: ${reason}\n`;
    console.error(msg);
    fs.appendFileSync('server_crash.log', msg);
    process.exit(1);
});

process.on('exit', (code) => {
    const msg = `Process exited with code: ${code}\n`;
    console.log(msg);
    fs.appendFileSync('server_crash.log', msg);
});

const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();

const publicDirectory = path.join(__dirname, '../public');
const reactDistDirectory = path.join(__dirname, '../client/dist');
const reactIndexFile = path.join(reactDistDirectory, 'index.html');
const reactFrontendEnabled = process.env.FRONTEND_MODE === 'react';
const migratedReactRoutes = [
    '/',
    '/index.html',
    '/register.html',
    '/forgot-password.html',
    '/admin-login.html',
    '/dashboard.html',
    '/profile.html',
    '/documents.html',
    '/history.html',
    '/events.html',
    '/contact.html',
    '/market.html',
    '/todo.html',
    '/community.html',
    '/shop.html',
    '/nid.html',
    '/passport.html',
    '/health.html',
    '/water.html',
    '/tax.html',
    '/education.html',
    '/land.html',
    '/agriculture.html',
    '/admission.html',
    '/apply.html',
    '/reports.html',
    '/admin-nid.html',
    '/admin-passport.html',
    '/admin-health.html',
    '/admin-water.html'
];

// ... (middleware)

// Security Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "cdn.jsdelivr.net", "cdnjs.cloudflare.com", "'unsafe-inline'"],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "fonts.googleapis.com", "cdnjs.cloudflare.com", "cdn.jsdelivr.net", "'unsafe-inline'"],
            fontSrc: ["'self'", "fonts.gstatic.com", "cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "cdn.jsdelivr.net", "https://ui-avatars.com", "blob:"],
            connectSrc: ["'self'", "https://api.open-meteo.com", "https://power.larc.nasa.gov"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: null,
        },
    },
    hsts: false, // Disable HSTS for localhost
}));
app.use(cors()); // Enable CORS
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded form data

// Rate Limiting to prevent brute force
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: Number(process.env.API_RATE_LIMIT_MAX) || 100, // browser regression may explicitly raise this; normal default remains 100
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// React is an opt-in, route-by-route cutover while legacy pages remain available.
// API routes, uploads and every unmigrated .html URL continue to use the existing backend/public tree.
if (reactFrontendEnabled && fs.existsSync(reactIndexFile)) {
    app.use('/assets', express.static(path.join(reactDistDirectory, 'assets')));
    app.get(migratedReactRoutes, (req, res) => res.sendFile(reactIndexFile));
} else if (reactFrontendEnabled) {
    console.warn('FRONTEND_MODE=react requested, but client/dist is missing. Serving the legacy frontend.');
}

// Static Files
app.use(express.static(publicDirectory));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/user', userRoutes);
const departmentRoutes = require('./routes/departmentRoutes');
app.use('/api/departments', departmentRoutes);
const paymentRoutes = require('./routes/paymentRoutes');
app.use('/api/payment', paymentRoutes);
const communityRoutes = require('./routes/communityRoutes');
app.use('/api/community', communityRoutes);
const reportsRoutes = require('./routes/reportsRoutes');
app.use('/api/reports', reportsRoutes);
const shopRoutes = require('./routes/shopRoutes');
app.use('/api/shop', shopRoutes);
const educationRoutes = require('./routes/educationRoutes');
app.use('/api/education', educationRoutes);
const universityRoutes = require('./routes/universityRoutes');
app.use('/api/university', universityRoutes);
const stipendRoutes = require('./routes/stipendRoutes');
app.use('/api/stipends', stipendRoutes);
const contactRoutes = require('./routes/contactRoutes');
app.use('/api/contact', contactRoutes);
const noticeRoutes = require('./routes/noticeRoutes');
app.use('/api/notices', noticeRoutes);
const agricultureRoutes = require('./routes/agricultureRoutes');
app.use('/api/agriculture', agricultureRoutes);
const taxRoutes = require('./routes/taxRoutes');
app.use('/api/tax', taxRoutes);
const passportRoutes = require('./routes/passportRoutes');
app.use('/api/passport', passportRoutes);
const nidRoutes = require('./routes/nidRoutes');
app.use('/api/nid', nidRoutes);
const healthRoutes = require('./routes/healthRoutes');
app.use('/api/health', healthRoutes);
const medicineRoutes = require('./routes/medicineRoutes');
const medicineScanRoutes = require('./routes/medicineScanRoutes');
app.use('/api/medicines', medicineRoutes);
app.use('/api/medicine-scans', medicineScanRoutes);
const waterRoutes = require('./routes/waterRoutes');
app.use('/api/water', waterRoutes);

// Admin Routes
const adminAuthRoutes = require('./routes/adminAuthRoutes');
const adminRoutes = require('./routes/adminRoutes');
app.use('/api/admin', adminAuthRoutes);
app.use('/api/admin', adminRoutes);


// Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Max 5MB allowed.' });
    }
    if (err) {
        // handle Multer string errors if any remain
        const msg = (typeof err === 'string') ? err : (err.message || 'Something went wrong!');
        return res.status(500).json({ error: msg });
    }
    next();
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    // Debug: Force keep-alive
    setInterval(() => {
        // console.log('Server heartbeat...');
    }, 10000);
});
