const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// All staff routes require authentication
router.use(authenticateToken);

// Committee can manage staff
router.get('/', authorizeRoles('committee', 'security'), staffController.getAllStaff);
router.get('/:id', authorizeRoles('committee', 'security'), staffController.getStaffById);
router.post('/', authorizeRoles('committee'), staffController.createStaff);
router.put('/:id', authorizeRoles('committee'), staffController.updateStaff);
router.delete('/:id', authorizeRoles('committee'), staffController.deleteStaff);

// Entry/Exit tracking (used by security)
router.post('/check-in', authorizeRoles('security', 'committee'), staffController.checkInStaff);
router.post('/check-out', authorizeRoles('security', 'committee'), staffController.checkOutStaff);

module.exports = router;
