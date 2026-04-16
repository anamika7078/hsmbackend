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

// Public/Member routes
router.get('/', authenticateToken, getAllVisitors);
router.get('/stats', authenticateToken, getVisitorStats);
router.get('/active', authenticateToken, getActiveVisitors);
router.post('/request', authenticateToken, authorizeRoles('member', 'security'), createVisitorRequest);
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
