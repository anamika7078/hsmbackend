const express = require('express');
const router = express.Router();
const {
  getSocietyDetails,
  updateSocietyDetails,
  uploadLogo,
  getAllWings,
  createWing,
  updateWing,
  deleteWing,
  getAllFlats,
  createFlat,
  updateFlat,
  deleteFlat
} = require('../controllers/societyController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Society details routes
router.get('/details', authenticateToken, getSocietyDetails);
router.put('/details', authenticateToken, authorizeRoles('committee'), updateSocietyDetails);
router.post('/logo', authenticateToken, authorizeRoles('committee'), upload.single('logo'), uploadLogo);

// Wing routes
router.get('/wings', authenticateToken, getAllWings);
router.post('/wings', authenticateToken, authorizeRoles('committee'), createWing);
router.put('/wings/:id', authenticateToken, authorizeRoles('committee'), updateWing);
router.delete('/wings/:id', authenticateToken, authorizeRoles('committee'), deleteWing);

// Flat routes
router.get('/flats', authenticateToken, getAllFlats);
router.post('/flats', authenticateToken, authorizeRoles('committee'), createFlat);
router.put('/flats/:id', authenticateToken, authorizeRoles('committee'), updateFlat);
router.delete('/flats/:id', authenticateToken, authorizeRoles('committee'), deleteFlat);

module.exports = router;
