const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getMonthlyReport,
  getVisitorReport,
  getBillingReport,
  getComplaintReport
} = require('../controllers/reportController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// All authenticated users can access dashboard stats
router.get('/dashboard', authenticateToken, getDashboardStats);

// Committee only reports
router.get('/monthly', authenticateToken, authorizeRoles('committee'), getMonthlyReport);
router.get('/visitors', authenticateToken, authorizeRoles('committee'), getVisitorReport);
router.get('/billing', authenticateToken, authorizeRoles('committee'), getBillingReport);
router.get('/complaints', authenticateToken, authorizeRoles('committee'), getComplaintReport);

module.exports = router;
