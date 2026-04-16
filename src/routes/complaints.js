const express = require('express');
const router = express.Router();
const {
  getAllComplaints,
  createComplaint,
  getComplaintById,
  updateComplaintStatus,
  getMyComplaints,
  getComplaintStats,
  deleteComplaint
} = require('../controllers/complaintController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Committee only routes
router.get('/', authenticateToken, authorizeRoles('committee'), getAllComplaints);
// Stats route (Committee)
router.get('/stats', authenticateToken, authorizeRoles('committee'), getComplaintStats);

// Member routes
router.post('/', authenticateToken, authorizeRoles('member'), createComplaint);
router.get('/my-complaints', authenticateToken, authorizeRoles('member'), getMyComplaints);

// Parameterized routes (Should be last to avoid shadowing)
router.get('/:id', authenticateToken, getComplaintById);
router.put('/:id/status', authenticateToken, authorizeRoles('committee'), updateComplaintStatus);
router.post('/update', authenticateToken, authorizeRoles('committee'), updateComplaintStatus);
router.delete('/:id', authenticateToken, authorizeRoles('committee'), deleteComplaint);

module.exports = router;
