const express = require('express');
const router = express.Router();
const {
  getAllNotices,
  createNotice,
  getNoticeById,
  updateNotice,
  deleteNotice,
  getMyNotices,
  getMyNotifications,
  markNotificationsRead,
} = require('../controllers/noticeController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// ── In-app notifications (all authenticated users) ───────────────────────────
router.get('/notifications', authenticateToken, getMyNotifications);
router.put('/notifications/read', authenticateToken, markNotificationsRead);

// ── My notices (all authenticated users) ─────────────────────────────────────
router.get('/my-notices', authenticateToken, getMyNotices);

// ── Committee-only notice CRUD ────────────────────────────────────────────────
router.get('/', authenticateToken, authorizeRoles('committee'), getAllNotices);
router.post('/', authenticateToken, authorizeRoles('committee'), createNotice);
router.get('/:id', authenticateToken, getNoticeById);
router.put('/:id', authenticateToken, authorizeRoles('committee'), updateNotice);
router.delete('/:id', authenticateToken, authorizeRoles('committee'), deleteNotice);

module.exports = router;
