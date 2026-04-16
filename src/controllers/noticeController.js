const db = require('../config/database');
const { sendNoticeEmail } = require('../services/emailService');
const { sendNoticeWhatsApp } = require('../services/whatsappService');

// ─── Helper: fetch members to notify based on target_audience ────────────────
const getMembersToNotify = async (targetAudience) => {
  let roleFilter;
  switch (targetAudience) {
    case 'committee': roleFilter = "role = 'committee'"; break;
    case 'members':   roleFilter = "role = 'member'";    break;
    case 'security':  roleFilter = "role = 'security'";  break;
    default:          roleFilter = "role IN ('member', 'committee', 'security')"; // 'all'
  }

  const result = await db.query(
    `SELECT id, name, email, mobile FROM users WHERE is_active = TRUE AND is_verified = TRUE AND ${roleFilter}`
  );
  return result.rows;
};

// ─── Helper: save in-app notification rows for each user ────────────────────
const saveInAppNotifications = async (users, notice) => {
  if (!users || users.length === 0) return;

  const values = users
    .map((u) => `(${u.id}, ${db.escape ? db.escape(notice.title) : JSON.stringify(notice.title)}, ${db.escape ? db.escape(notice.content.substring(0, 200)) : JSON.stringify(notice.content.substring(0, 200))}, 'notice', ${notice.id})`)
    .join(', ');

  // Use individual inserts to avoid escape dependency
  for (const user of users) {
    try {
      await db.query(
        `INSERT INTO notifications (user_id, title, message, type, reference_id) VALUES (?, ?, ?, 'notice', ?)`,
        [user.id, notice.title, notice.content.substring(0, 200), notice.id]
      );
    } catch (err) {
      console.error(`Failed to save notification for user ${user.id}:`, err.message);
    }
  }
};

// ─── Get all notices ──────────────────────────────────────────────────────────
const getAllNotices = async (req, res) => {
  try {
    const { page = 1, limit = 10, type = 'all', priority = 'all' } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE n.is_active = true';
    let queryParams = [];

    if (type !== 'all') {
      whereClause += ' AND n.notice_type = ?';
      queryParams.push(type);
    }

    if (priority !== 'all') {
      whereClause += ` AND n.priority = ?`;
      queryParams.push(priority);
    }

    const query = `
      SELECT n.*, u.name as created_by_name
      FROM notices n
      LEFT JOIN users u ON n.created_by = u.id
      ${whereClause}
      ORDER BY n.priority DESC, n.created_at DESC
      LIMIT ? OFFSET ?
    `;

    queryParams.push(parseInt(limit), parseInt(offset));
    const result = await db.query(query, queryParams);

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM notices n ${whereClause}`,
      queryParams.slice(0, -2)
    );

    res.status(200).json({
      success: true,
      data: {
        notices: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countResult.rows[0].total),
          totalPages: Math.ceil(countResult.rows[0].total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error in getAllNotices:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch notices' });
  }
};

// ─── Create notice ────────────────────────────────────────────────────────────
const createNotice = async (req, res) => {
  try {
    const { title, content, notice_type, priority, target_audience, expires_at } = req.body;
    const userId = req.user.id;

    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'Title and content are required' });
    }

    const noticeTypeVal   = notice_type    || 'general';
    const priorityVal     = priority       || 'normal';
    const audienceVal     = target_audience || 'all';

    const result = await db.query(
      `INSERT INTO notices (title, content, notice_type, priority, target_audience, expires_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [title, content, noticeTypeVal, priorityVal, audienceVal, expires_at || null, userId]
    );

    const noticeId = result.insertId;

    // Fetch the full notice with creator name
    const createdRows = await db.query(
      `SELECT n.*, u.name as created_by_name FROM notices n
       LEFT JOIN users u ON n.created_by = u.id
       WHERE n.id = ?`,
      [noticeId]
    );
    const createdNotice = createdRows.rows[0];

    // ── Dispatch notifications (non-blocking) ────────────────────────────────
    setImmediate(async () => {
      try {
        const members = await getMembersToNotify(audienceVal);
        console.log(`📨 Notifying ${members.length} member(s) about notice: "${title}"`);

        // 1) Save in-app notifications
        await saveInAppNotifications(members, createdNotice);

        // 2) Send email notifications
        const emails = members.map((m) => m.email).filter(Boolean);
        if (emails.length > 0) {
          await sendNoticeEmail(emails, createdNotice);
        }

        // 3) Send WhatsApp notifications
        await sendNoticeWhatsApp(members, createdNotice);

        // 4) Emit socket event if io is available
        const io = req.app.get('io');
        if (io) {
          io.emit('new_notice', {
            id: noticeId,
            title,
            notice_type: noticeTypeVal,
            priority: priorityVal,
            target_audience: audienceVal,
            created_by_name: createdNotice?.created_by_name || 'Admin',
            created_at: createdNotice?.created_at,
          });
          console.log('🔔 Socket event "new_notice" emitted');
        }
      } catch (notifyErr) {
        console.error('Error dispatching notifications:', notifyErr.message);
      }
    });

    res.status(201).json({
      success: true,
      message: 'Notice created successfully. Members will be notified.',
      data: createdNotice
    });
  } catch (error) {
    console.error('Error in createNotice:', error);
    res.status(500).json({ success: false, message: 'Failed to create notice' });
  }
};

// ─── Get notice by ID ─────────────────────────────────────────────────────────
const getNoticeById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT n.*, u.name as created_by_name FROM notices n
       LEFT JOIN users u ON n.created_by = u.id
       WHERE n.id = ?`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Notice not found' });
    }

    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error in getNoticeById:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch notice' });
  }
};

// ─── Update notice ────────────────────────────────────────────────────────────
const updateNotice = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, notice_type, priority, target_audience, expires_at, is_active } = req.body;

    const result = await db.query(
      `UPDATE notices
       SET title = ?, content = ?, notice_type = ?, priority = ?, target_audience = ?,
           expires_at = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [title, content, notice_type, priority, target_audience, expires_at || null, is_active !== undefined ? is_active : true, id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Notice not found' });
    }

    const updatedRows = await db.query(
      `SELECT n.*, u.name as created_by_name FROM notices n
       LEFT JOIN users u ON n.created_by = u.id
       WHERE n.id = ?`,
      [id]
    );

    res.status(200).json({
      success: true,
      message: 'Notice updated successfully',
      data: updatedRows.rows[0]
    });
  } catch (error) {
    console.error('Error in updateNotice:', error);
    res.status(500).json({ success: false, message: 'Failed to update notice' });
  }
};

// ─── Delete notice ────────────────────────────────────────────────────────────
const deleteNotice = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query('DELETE FROM notices WHERE id = ?', [id]);

    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Notice not found' });
    }

    // Also clean up in-app notifications for this notice
    await db.query("DELETE FROM notifications WHERE type = 'notice' AND reference_id = ?", [id]);

    res.status(200).json({ success: true, message: 'Notice deleted successfully' });
  } catch (error) {
    console.error('Error in deleteNotice:', error);
    res.status(500).json({ success: false, message: 'Failed to delete notice' });
  }
};

// ─── Get my notices ───────────────────────────────────────────────────────────
const getMyNotices = async (req, res) => {
  try {
    const userRole = req.user.role;

    const result = await db.query(
      `SELECT n.*, u.name as created_by_name
       FROM notices n
       LEFT JOIN users u ON n.created_by = u.id
       WHERE n.is_active = TRUE
         AND (n.target_audience = ? OR n.target_audience = 'all')
         AND (n.expires_at IS NULL OR n.expires_at > CURRENT_TIMESTAMP)
       ORDER BY n.priority DESC, n.created_at DESC
       LIMIT 50`,
      [userRole]
    );

    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error in getMyNotices:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch notices' });
  }
};

// ─── Get in-app notifications for the logged-in user ─────────────────────────
const getMyNotifications = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
      [userId]
    );

    const unreadCount = result.rows.filter((n) => !n.is_read).length;

    res.status(200).json({
      success: true,
      data: {
        notifications: result.rows,
        unread_count: unreadCount,
      }
    });
  } catch (error) {
    console.error('Error in getMyNotifications:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
};

// ─── Mark notification(s) as read ────────────────────────────────────────────
const markNotificationsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { ids } = req.body; // array of notification IDs, or empty to mark all

    if (ids && ids.length > 0) {
      const placeholders = ids.map(() => '?').join(',');
      await db.query(
        `UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND id IN (${placeholders})`,
        [userId, ...ids]
      );
    } else {
      await db.query(
        'UPDATE notifications SET is_read = TRUE WHERE user_id = ?',
        [userId]
      );
    }

    res.status(200).json({ success: true, message: 'Notifications marked as read' });
  } catch (error) {
    console.error('Error in markNotificationsRead:', error);
    res.status(500).json({ success: false, message: 'Failed to update notifications' });
  }
};

module.exports = {
  getAllNotices,
  createNotice,
  getNoticeById,
  updateNotice,
  deleteNotice,
  getMyNotices,
  getMyNotifications,
  markNotificationsRead,
};
