const db = require('../config/database');

const triggerEmergencyAlert = async (req, res) => {
  try {
    const { message, type = 'emergency' } = req.body;
    const created_by = req.user.id;

    if (!message) {
      return res.status(400).json({ success: false, message: 'Emergency message is required' });
    }

    // 1. Create a high-priority notice
    const noticeResult = await db.query(
      'INSERT INTO notices (title, content, notice_type, priority, target_audience, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      ['🚨 EMERGENCY ALERT', message, 'emergency', 'urgent', 'all', created_by]
    );

    // 2. Create in-app notifications for ALL active users
    // This could be slow for huge societies, but okay for moderate ones.
    // In production, use a message queue or broad-cast via WebSockets.
    const users = await db.query('SELECT id FROM users WHERE is_active = 1');
    
    for (const user of users.rows) {
      await db.query(
        'INSERT INTO notifications (user_id, title, message, type, reference_id) VALUES (?, ?, ?, ?, ?)',
        [user.id, '🚨 EMERGENCY ALERT', message, 'notice', noticeResult.insertId]
      );
    }

    res.status(201).json({ 
      success: true, 
      message: 'Emergency alert broadcasted to all residents',
      noticeId: noticeResult.insertId
    });
  } catch (error) {
    console.error('Error in triggerEmergencyAlert:', error);
    res.status(500).json({ success: false, message: 'Failed to trigger emergency alert' });
  }
};

module.exports = {
  triggerEmergencyAlert
};
