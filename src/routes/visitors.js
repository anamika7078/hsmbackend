const express = require('express');
const router = express.Router();
const {
  getAllVisitors,
  createVisitorRequest,
  respondToVisitor,
  checkInVisitor,
  checkOutVisitor,
  getVisitorStats,
  getActiveVisitors,
  getMyVisitors,
  updateVisitor,
  deleteVisitor
} = require('../controllers/visitorController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'public/uploads/visitors';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'visitor-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Public/Member routes
router.get('/', authenticateToken, getAllVisitors);
router.get('/stats', authenticateToken, getVisitorStats);
router.get('/active', authenticateToken, getActiveVisitors);
router.post('/request', authenticateToken, authorizeRoles('member', 'security'), upload.single('photo'), createVisitorRequest);
router.post('/respond', authenticateToken, authorizeRoles('member'), respondToVisitor);
router.put('/respond/:id', authenticateToken, authorizeRoles('member'), respondToVisitor);
router.get('/my-visitors', authenticateToken, authorizeRoles('member'), getMyVisitors);

// Committee/Security routes
router.put('/:id', authenticateToken, authorizeRoles('committee', 'security'), updateVisitor);
router.delete('/:id', authenticateToken, authorizeRoles('committee', 'security'), deleteVisitor);

// Security only routes
router.post('/:id/check-in', authenticateToken, authorizeRoles('security'), checkInVisitor);
router.post('/:id/check-out', authenticateToken, authorizeRoles('security'), checkOutVisitor);
router.post('/entry', authenticateToken, authorizeRoles('security'), checkInVisitor);
router.post('/exit', authenticateToken, authorizeRoles('security'), checkOutVisitor);

module.exports = router;
