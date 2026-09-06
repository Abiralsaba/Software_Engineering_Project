// admin Authentication Routes - Public routes for admin login and ..

const express = require('express');
const { body } = require('express-validator');
const adminAuthController = require('../controllers/adminAuthController');
const adminMiddleware = require('../middleware/adminMiddleware');

const router = express.Router();

// Register new admin (pending approval)
router.post(
    '/register',
    [
        body('name').notEmpty().withMessage('Name is required'),
        body('email').isEmail().withMessage('Valid email is required'),
        body('nid').notEmpty().withMessage('NID is required'),
        body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
        body('mobile').optional()
    ],
    adminAuthController.register
);

// Login admin (must be approved)
router.post(
    '/login',
    [
        body('email').isEmail().withMessage('Valid email is required'),
        body('password').notEmpty().withMessage('Password is required')
    ],
    adminAuthController.login
);

// get current admin info (protected)
router.get('/me', adminMiddleware, adminAuthController.getMe);

module.exports = router;
