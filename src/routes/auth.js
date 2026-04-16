const express = require('express');
const router = express.Router();
const {
  sendLoginOTP,
  verifyLoginOTP,
  login,
  registerUser,
  getProfile,
  updateProfile,
  changePassword
} = require('../controllers/authController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Public routes
router.post('/send-otp', sendLoginOTP);
router.post('/verify-otp', verifyLoginOTP);
router.post('/login', login);
router.post('/forgot-password', forgotPasswordRequest);
router.post('/reset-password', resetPasswordWithOTP);

// Protected routes
router.get('/profile', authenticateToken, getProfile);
router.put('/profile', authenticateToken, updateProfile);
router.put('/change-password', authenticateToken, changePassword);

// Committee only routes
router.post('/register', authenticateToken, authorizeRoles('committee'), registerUser);

module.exports = router;
