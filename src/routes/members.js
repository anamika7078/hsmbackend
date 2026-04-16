const express = require('express');
const router = express.Router();
const {
  getAllMembers,
  getMemberById,
  approveMember,
  rejectMember,
  updateMember,
  deleteMember,
  getMemberStats
} = require('../controllers/memberController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Committee only routes
router.get('/', authenticateToken, authorizeRoles('committee'), getAllMembers);
router.get('/stats', authenticateToken, authorizeRoles('committee'), getMemberStats);
router.get('/:id', authenticateToken, authorizeRoles('committee'), getMemberById);
router.put('/:id', authenticateToken, authorizeRoles('committee'), updateMember);
router.delete('/:id', authenticateToken, authorizeRoles('committee'), deleteMember);
router.post('/:id/approve', authenticateToken, authorizeRoles('committee'), approveMember);
router.post('/:id/reject', authenticateToken, authorizeRoles('committee'), rejectMember);
router.post('/approve/:id', authenticateToken, authorizeRoles('committee'), approveMember);
router.post('/reject/:id', authenticateToken, authorizeRoles('committee'), rejectMember);

module.exports = router;
