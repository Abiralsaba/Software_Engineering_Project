const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');


// verify token
const verifyToken = require('../middleware/authMiddleware');

router.use(verifyToken); // Protect all dashboard routes

router.get('/summary', dashboardController.getSummary);
router.get('/todos', dashboardController.getTodos);
router.post('/todos', dashboardController.createTodo);
router.put('/todos/:id/move', dashboardController.updateTodoStatus);
router.delete('/todos/:id', dashboardController.deleteTodo);
router.get('/departments', dashboardController.getDepartments);
router.post('/services/request', dashboardController.submitServiceRequest);
router.get('/services/active', dashboardController.getActiveRequests);
router.put('/services/status', dashboardController.updateRequestStatus);
router.get('/services/completed', dashboardController.getCompletedTasks);
router.get('/notifications', dashboardController.getNotifications);
router.put('/notifications/:id/read', dashboardController.markNotificationRead);
// Multer Setup
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure directory exists
const uploadDir = path.join(__dirname, '../../public/uploads/user_docs');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir)
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, uniqueSuffix + path.extname(file.originalname))
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|pdf/;
        const allow = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);
        if (allow && mimetype) {
            return cb(null, true);
        } else {
            cb(new Error('Error: Images and PDFs Only! (Got: ' + file.mimetype + ')'));
        }
    }
});

router.get('/documents', dashboardController.getDocuments);
router.post('/documents/upload-official', upload.single('document'), dashboardController.uploadOfficialDocument);
// User Personal Documents
router.post('/documents/upload', upload.single('document'), dashboardController.uploadUserDocument);
router.get('/documents/user', dashboardController.getUserDocuments);
router.put('/documents/update/:id', upload.single('document'), dashboardController.updateUserDocument);

router.get('/history', dashboardController.getHistory);

module.exports = router;
