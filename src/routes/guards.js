const express = require('express');
const router = express.Router();
const {
  getAllGuards,
  createGuard,
  updateGuard,
  deleteGuard,
  getGuardLogs,
  checkInGuard,
  checkOutGuard,
  getGuardStats,
  getActiveDuty
} = require('../controllers/guardController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Committee only routes
router.get('/', authenticateToken, authorizeRoles('committee'), getAllGuards);
router.post('/', authenticateToken, authorizeRoles('committee'), createGuard);
router.put('/:id', authenticateToken, authorizeRoles('committee'), updateGuard);
router.delete('/:id', authenticateToken, authorizeRoles('committee'), deleteGuard);
router.get('/stats', authenticateToken, authorizeRoles('committee'), getGuardStats);
router.get('/logs', authenticateToken, authorizeRoles('committee'), getGuardLogs);

// Security only routes
router.get('/duty', authenticateToken, authorizeRoles('security'), getActiveDuty);
router.post('/check-in', authenticateToken, authorizeRoles('security'), checkInGuard);
router.post('/check-out', authenticateToken, authorizeRoles('security'), checkOutGuard);

module.exports = router;
