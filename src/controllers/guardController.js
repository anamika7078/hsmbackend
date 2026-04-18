const db = require('../config/database');

// Get all guards
const getAllGuards = async (req, res) => {
  try {
    const { page = 1, limit = 10, is_active = 'all' } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    let queryParams = [];

    if (is_active !== 'all') {
      whereClause += ` AND g.is_active = $${queryParams.length + 1}`;
      queryParams.push(is_active === 'true');
    }

    if (req.query.society_id && req.query.society_id !== '') {
      whereClause += ` AND g.society_id = $${queryParams.length + 1}`;
      queryParams.push(req.query.society_id);
    }

    const query = `
      SELECT g.*, s.name as society_name
      FROM guards g
      LEFT JOIN societies s ON g.society_id = s.id
      ${whereClause}
      ORDER BY g.created_at DESC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `;

    queryParams.push(limit, offset);

    const result = await db.query(query, queryParams);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM guards g
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, queryParams.slice(0, -2));

    res.status(200).json({
      success: true,
      data: {
        guards: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countResult.rows[0].total),
          totalPages: Math.ceil(countResult.rows[0].total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error in getAllGuards:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch guards'
    });
  }
};

// Create guard (committee only)
const createGuard = async (req, res) => {
  try {
    const { name, mobile, email, shift, password, society_id } = req.body;

    if (!name || !mobile || !society_id) {
      return res.status(400).json({
        success: false,
        message: 'Name, mobile and Society ID are required'
      });
    }

    // 1. Check if user already exists in users table or guards table
    const existingUser = await db.query(
      'SELECT id FROM users WHERE mobile = ?',
      [mobile]
    );

    let userId;
    if (existingUser.rows.length > 0) {
      userId = existingUser.rows[0].id;
      // If user exists, check if they already have a guard profile
      const existingGuard = await db.query('SELECT id FROM guards WHERE user_id = ?', [userId]);
      if (existingGuard.rows.length > 0) {
        return res.status(400).json({ success: false, message: 'Guard profile already exists for this mobile' });
      }
    } else {
      // 2. Create User account first
      const bcrypt = require('bcryptjs');
      const defaultPassword = password || 'Guard@123';
      const passwordHash = await bcrypt.hash(defaultPassword, 10);
      
      const userResult = await db.query(
        'INSERT INTO users (name, email, mobile, password_hash, role, is_verified) VALUES (?, ?, ?, ?, ?, ?)',
        [name, email || null, mobile, passwordHash, 'security', true]
      );
      userId = userResult.insertId;
    }

    // 3. Create Guard profile
    const result = await db.query(
      'INSERT INTO guards (user_id, name, mobile, email, shift, society_id) VALUES ($1, $2, $3, $4, $5, $6)',
      [userId, name, mobile, email, shift || 'day', society_id]
    );

    const createdGuard = await db.query('SELECT * FROM guards WHERE id = $1', [result.insertId]);

    res.status(201).json({
      success: true,
      message: 'Guard created and user account provisioned successfully',
      data: createdGuard.rows[0],
      credentials: { mobile, password: password || 'Guard@123' }
    });
  } catch (error) {
    console.error('Error in createGuard:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create guard' });
  }
};

// Update guard (committee only)
const updateGuard = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, mobile, email, shift, is_active, password } = req.body;

    // 1. Update Guard Profile
    const result = await db.query(
      'UPDATE guards SET name = $1, mobile = $2, email = $3, shift = $4, is_active = $5 WHERE id = $6',
      [name, mobile, email, shift, is_active, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Guard not found' });
    }

    // 2. Sync with Users table and update password if provided
    const guardUser = await db.query('SELECT user_id FROM guards WHERE id = $1', [id]);
    if (guardUser.rows.length > 0) {
      const userId = guardUser.rows[0].user_id;
      let userUpdateSql = 'UPDATE users SET name = $1, mobile = $2, email = $3, is_active = $4';
      let userParams = [name, mobile, email, is_active];

      if (password && password.trim() !== '') {
        const bcrypt = require('bcryptjs');
        const passwordHash = await bcrypt.hash(password, 10);
        userUpdateSql += ', password_hash = $5 WHERE id = $6';
        userParams.push(passwordHash, userId);
      } else {
        userUpdateSql += ' WHERE id = $5';
        userParams.push(userId);
      }
      await db.query(userUpdateSql, userParams);
    }

    const updatedGuard = await db.query('SELECT * FROM guards WHERE id = ?', [id]);

    res.status(200).json({
      success: true,
      message: 'Guard profile and security account updated successfully',
      data: updatedGuard.rows[0]
    });
  } catch (error) {
    console.error('Error in updateGuard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update guard'
    });
  }
};

// Delete guard (committee only)
const deleteGuard = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query('DELETE FROM guards WHERE id = $1', [id]);

    if (!result.affectedRows) {
      return res.status(404).json({
        success: false,
        message: 'Guard not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Guard deleted successfully'
    });
  } catch (error) {
    console.error('Error in deleteGuard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete guard'
    });
  }
};

// Get guard logs
const getGuardLogs = async (req, res) => {
  try {
    const { page = 1, limit = 10, guard_id, date } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    let queryParams = [];

    if (guard_id) {
      whereClause += ' AND gl.guard_id = $1';
      queryParams.push(guard_id);
    }

    if (date) {
      const paramIndex = queryParams.length + 1;
      whereClause += ` AND gl.shift_date = $${paramIndex}`;
      queryParams.push(date);
    }

    const query = `
      SELECT gl.*, g.name as guard_name, g.mobile as guard_mobile
      FROM guard_logs gl
      LEFT JOIN guards g ON gl.guard_id = g.id
      ${whereClause}
      ORDER BY gl.shift_date DESC, gl.check_in_time DESC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `;

    queryParams.push(limit, offset);

    const result = await db.query(query, queryParams);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM guard_logs gl
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, queryParams.slice(0, -2));

    res.status(200).json({
      success: true,
      data: {
        logs: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countResult.rows[0].total),
          totalPages: Math.ceil(countResult.rows[0].total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error in getGuardLogs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch guard logs'
    });
  }
};

// Check in guard (security)
const checkInGuard = async (req, res) => {
  try {
    const userId = req.user.id; // User ID from token
    const { notes } = req.body;

    // 1. Get Guard profile from user_id
    const guardQuery = await db.query(
      'SELECT id FROM guards WHERE user_id = ? AND is_active = true',
      [userId]
    );

    if (guardQuery.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Guard profile not found or inactive' });
    }
    const guardId = guardQuery.rows[0].id;

    // Check if already checked in today
    const existingLogQuery = await db.query(
      'SELECT id FROM guard_logs WHERE guard_id = $1 AND shift_date = CURRENT_DATE AND check_out_time IS NULL',
      [guardId]
    );

    if (existingLogQuery.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Already checked in today'
      });
    }

    const result = await db.query(
      'INSERT INTO guard_logs (guard_id, check_in_time, shift_date, notes) VALUES ($1, CURRENT_TIMESTAMP, CURRENT_DATE, $2)',
      [guardId, notes]
    );

    const createdLog = await db.query('SELECT * FROM guard_logs WHERE id = ?', [result.insertId]);

    res.status(201).json({
      success: true,
      message: 'Check-in successful',
      data: createdLog.rows[0]
    });
  } catch (error) {
    console.error('Error in checkInGuard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check in'
    });
  }
};

// Check out guard (security)
const checkOutGuard = async (req, res) => {
  try {
    const userId = req.user.id;
    const { notes } = req.body;

    // 1. Get Guard profile from user_id
    const guardQuery = await db.query(
      'SELECT id FROM guards WHERE user_id = ? AND is_active = true',
      [userId]
    );

    if (guardQuery.rows.length === 0) {
       return res.status(404).json({ success: false, message: 'Guard profile not found' });
    }
    const guardId = guardQuery.rows[0].id;

    // 2. Get today's check-in log
    const logQuery = await db.query(
      'SELECT id FROM guard_logs WHERE guard_id = ? AND shift_date = CURRENT_DATE AND check_out_time IS NULL',
      [guardId]
    );

    if (logQuery.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No active check-in found for today'
      });
    }

    const result = await db.query(
      'UPDATE guard_logs SET check_out_time = CURRENT_TIMESTAMP, notes = $1 WHERE id = $2',
      [notes, logQuery.rows[0].id]
    );

    const updatedLog = await db.query('SELECT * FROM guard_logs WHERE id = ?', [logQuery.rows[0].id]);

    res.status(200).json({
      success: true,
      message: 'Check-out successful',
      data: updatedLog.rows[0]
    });
  } catch (error) {
    console.error('Error in checkOutGuard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check out'
    });
  }
};

// Get guard statistics
const getGuardStats = async (req, res) => {
  try {
    const { society_id } = req.query;
    let whereClause = '';
    let queryParams = [];

    if (society_id) {
      whereClause = 'WHERE society_id = $1';
      queryParams.push(society_id);
    }

    const stats = await db.query(`
      SELECT 
        COUNT(*) as total_guards,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_guards,
        COUNT(CASE WHEN is_active = false THEN 1 END) as inactive_guards,
        COUNT(CASE WHEN shift = 'day' THEN 1 END) as day_shift_guards,
        COUNT(CASE WHEN shift = 'night' THEN 1 END) as night_shift_guards
      FROM guards
      ${whereClause}
    `, queryParams);

    res.status(200).json({
      success: true,
      data: stats.rows[0]
    });
  } catch (error) {
    console.error('Error in getGuardStats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch guard statistics'
    });
  }
};

// Get active duty log for logged-in guard
const getActiveDuty = async (req, res) => {
  try {
    const userId = req.user.id;

    const guardQuery = await db.query(
      'SELECT id FROM guards WHERE user_id = ? AND is_active = true',
      [userId]
    );

    if (guardQuery.rows.length === 0) {
      return res.status(200).json({ success: true, isOnDuty: false });
    }

    const guardId = guardQuery.rows[0].id;

    const logQuery = await db.query(
      'SELECT id, check_in_time FROM guard_logs WHERE guard_id = ? AND shift_date = CURRENT_DATE AND check_out_time IS NULL',
      [guardId]
    );

    res.status(200).json({
      success: true,
      isOnDuty: logQuery.rows.length > 0,
      dutyId: logQuery.rows.length > 0 ? logQuery.rows[0].id : null,
      startTime: logQuery.rows.length > 0 ? logQuery.rows[0].check_in_time : null
    });
  } catch (error) {
    console.error('Error in getActiveDuty:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch duty status' });
  }
};

module.exports = {
  getAllGuards,
  createGuard,
  updateGuard,
  deleteGuard,
  getGuardLogs,
  checkInGuard,
  checkOutGuard,
  getGuardStats,
  getActiveDuty
};
