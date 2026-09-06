const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const upload = require('../middleware/uploadMiddleware');
const jwt = require('jsonwebtoken');

// verify token
const verifyToken = require('../middleware/authMiddleware');

router.use(verifyToken);

router.get('/profile', userController.getProfile);
router.put('/profile', userController.updateProfile);
router.post('/profile/photo', upload.single('photo'), userController.uploadPhoto);

module.exports = router;
