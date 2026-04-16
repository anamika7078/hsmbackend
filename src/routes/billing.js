const express = require('express');
const router = express.Router();
const {
  getAllBills,
  generateBills,
  getMyBills,
  makePayment,
  getPaymentHistory,
  getBillingStats,
  updateBill,
  deleteBill
} = require('../controllers/billingController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Committee only routes
router.get('/', authenticateToken, authorizeRoles('committee'), getAllBills);
router.post('/generate', authenticateToken, authorizeRoles('committee'), generateBills);
router.get('/stats', authenticateToken, authorizeRoles('committee'), getBillingStats);
router.put('/:id', authenticateToken, authorizeRoles('committee'), updateBill);
router.delete('/:id', authenticateToken, authorizeRoles('committee'), deleteBill);

// Member routes
router.get('/my-bills', authenticateToken, authorizeRoles('member'), getMyBills);
router.post('/pay', authenticateToken, authorizeRoles('member'), makePayment);
router.get('/payments', authenticateToken, authorizeRoles('member'), getPaymentHistory);

module.exports = router;
