const express = require('express');
const router = express.Router();
const { triggerEmergencyAlert } = require('../controllers/emergencyController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.post('/trigger', authenticateToken, authorizeRoles('security', 'committee'), triggerEmergencyAlert);

module.exports = router;
