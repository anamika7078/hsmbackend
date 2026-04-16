const express = require('express');
const router = express.Router();
const { logVehicleEntry, logVehicleExit, getVehicleLogs } = require('../controllers/vehicleLogController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.get('/', authenticateToken, getVehicleLogs);
router.post('/entry', authenticateToken, authorizeRoles('security', 'committee'), logVehicleEntry);
router.put('/exit/:id', authenticateToken, authorizeRoles('security', 'committee'), logVehicleExit);

module.exports = router;
