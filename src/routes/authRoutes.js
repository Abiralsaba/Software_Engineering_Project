const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');

const router = express.Router();

router.post(
    '/register',
    [
        body('username').trim().isLength({ min: 2, max: 200 }).withMessage('Full name is required'),
        body('email').trim().isEmail().normalizeEmail().withMessage('Valid email is required'),
        body('password').isLength({ min: 8, max: 72 }).withMessage('Password must be 8 to 72 characters long'),
        body('nid').trim().matches(/^(?:\d{10}|\d{13}|\d{17})$/).withMessage('NID must contain 10, 13, or 17 digits'),
        body('mobile').trim().matches(/^(?:\+?88)?01\d{9}$/).withMessage('Valid Bangladesh mobile number is required'),
        body('dob').isISO8601({ strict: true }).withMessage('Valid date of birth is required'),
        body('address').trim().isLength({ min: 3, max: 1000 }).withMessage('Address is required'),
        body('gender').isIn(['Male', 'Female', 'Other']).withMessage('Valid gender is required')
    ],
    authController.register
);

router.post(
    '/login',
    [
        body('email').isEmail().withMessage('Valid email is required'),
        body('password').notEmpty().withMessage('Password is required')
    ],
    authController.login
);

router.post(
    '/send-reset-otp',
    [
        body('email').isEmail().withMessage('Valid email is required'),
        body('nid').notEmpty().withMessage('NID is required')
    ],
    authController.sendResetOTP
);

router.post(
    '/reset-password-verify',
    [
        body('email').isEmail().withMessage('Valid email is required'),
        body('nid').notEmpty().withMessage('NID is required'),
        body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
        body('newPassword').isLength({ min: 6 }).withMessage('New Password must be at least 6 characters')
    ],
    authController.verifyResetOTP
);

module.exports = router;
