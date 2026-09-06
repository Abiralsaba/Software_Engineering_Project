const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');

const router = express.Router();

router.post(
    '/register',
    [
        body('username').notEmpty().withMessage('Username is required'),
        body('email').isEmail().withMessage('Valid email is required'),
        body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
        body('nid').notEmpty().withMessage('NID is required'),
        body('mobile').notEmpty().withMessage('Mobile number is required'),
        body('dob').notEmpty().withMessage('Date of birth is required'),
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
