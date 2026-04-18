const db = require('../config/database');

// Get all members (committee only)
const getAllMembers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', status = 'all', society_id } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = "WHERE u.role = 'member'";
    let queryParams = [];

    if (society_id && society_id !== '') {
      whereClause += ` AND w.society_id = $${queryParams.length + 1}`;
      queryParams.push(society_id);
    }

    if (search) {
      whereClause += ` AND (u.name LIKE $${queryParams.length + 1} OR u.mobile LIKE $${queryParams.length + 2} OR u.email LIKE $${queryParams.length + 3})`;
      queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (status !== 'all') {
      if (status === 'verified') {
        whereClause += ` AND u.is_verified = 1`;
      } else if (status === 'unverified') {
        whereClause += ` AND u.is_verified = 0`;
      }
    }

    const query = `
      SELECT u.id, u.name, u.email, u.mobile, u.role, u.is_active, u.is_verified, u.created_at,
             f.flat_number, w.name as wing_name, s.name as society_name
      FROM users u
      LEFT JOIN member_flats mf ON u.id = mf.user_id AND mf.is_primary = 1
      LEFT JOIN flats f ON mf.flat_id = f.id
      LEFT JOIN wings w ON f.wing_id = w.id
      LEFT JOIN societies s ON w.society_id = s.id
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `;

    queryParams.push(parseInt(limit), offset);

    const result = await db.query(query, queryParams);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM users u
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, queryParams.slice(0, -2));

    res.status(200).json({
      success: true,
      data: {
        members: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countResult.rows[0].total),
          totalPages: Math.ceil(countResult.rows[0].total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error in getAllMembers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch members'
    });
  }
};

// Get member by ID
const getMemberById = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT u.id, u.name, u.email, u.mobile, u.role, u.is_active, u.is_verified, u.created_at,
             f.flat_number, f.id as flat_id, w.name as wing_name, w.id as wing_id, s.name as society_name
      FROM users u
      LEFT JOIN member_flats mf ON u.id = mf.user_id AND mf.is_primary = 1
      LEFT JOIN flats f ON mf.flat_id = f.id
      LEFT JOIN wings w ON f.wing_id = w.id
      LEFT JOIN societies s ON w.society_id = s.id
      WHERE u.id = ?
    `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    res.status(200).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error in getMemberById:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch member'
    });
  }
};

// Approve member (committee only)
const approveMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { flatId, ownershipType } = req.body;

    // Check if member exists
    const memberQuery = await db.query(
      'SELECT id, name, mobile FROM users WHERE id = ? AND role = ?',
      [id, 'member']
    );

    if (memberQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    // Verify member
    await db.query(
      'UPDATE users SET is_verified = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );

    // Assign flat if provided
    if (flatId && ownershipType) {
      const flatQuery = await db.query(
        'SELECT id FROM flats WHERE id = ? AND is_occupied = 0',
        [flatId]
      );

      if (flatQuery.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Flat not available'
        });
      }

      // Mark previous primary mapping as non-primary for this user
      await db.query(
        'UPDATE member_flats SET is_primary = 0 WHERE user_id = ?',
        [id]
      );

      // Map member with flat
      await db.query(
        `INSERT INTO member_flats (user_id, flat_id, ownership_type, is_primary, start_date)
         VALUES (?, ?, ?, 1, CURRENT_DATE)
         ON DUPLICATE KEY UPDATE ownership_type = VALUES(ownership_type), is_primary = 1`,
        [id, flatId, ownershipType]
      );

      // Mark flat occupied
      await db.query(
        'UPDATE flats SET is_occupied = 1 WHERE id = ?',
        [flatId]
      );
    }

    res.status(200).json({
      success: true,
      message: 'Member approved successfully'
    });
  } catch (error) {
    console.error('Error in approveMember:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to approve member'
    });
  }
};

// Reject member (committee only)
const rejectMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const result = await db.query(
      'UPDATE users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND role = ?',
      [id, 'member']
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    // Get updated member data
    const memberQuery = await db.query(
      'SELECT id, name FROM users WHERE id = ?',
      [id]
    );

    res.status(200).json({
      success: true,
      message: 'Member rejected successfully',
      data: memberQuery.rows[0]
    });
  } catch (error) {
    console.error('Error in rejectMember:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject member'
    });
  }
};

// Update member details
const updateMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, mobile, is_active } = req.body;

    const result = await db.query(
      'UPDATE users SET name = ?, email = ?, mobile = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, email, mobile, is_active ? 1 : 0, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    // Get updated member data
    const memberQuery = await db.query(
      'SELECT id, name, email, mobile, role, is_active FROM users WHERE id = ?',
      [id]
    );

    res.status(200).json({
      success: true,
      message: 'Member updated successfully',
      data: memberQuery.rows[0]
    });
  } catch (error) {
    console.error('Error in updateMember:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update member'
    });
  }
};

// Get member statistics
const getMemberStats = async (req, res) => {
  try {
    const { society_id } = req.query;
    let whereClause = "WHERE u.role = 'member'";
    let queryParams = [];

    if (society_id && society_id !== '') {
      whereClause += ' AND w.society_id = $1';
      queryParams.push(society_id);
    }

    const stats = await db.query(`
      SELECT 
        COUNT(DISTINCT u.id) as total_members,
        COUNT(DISTINCT CASE WHEN u.is_verified = 1 THEN u.id END) as verified_members,
        COUNT(DISTINCT CASE WHEN u.is_verified = 0 THEN u.id END) as unverified_members,
        COUNT(DISTINCT CASE WHEN u.is_active = 1 THEN u.id END) as active_members,
        COUNT(DISTINCT CASE WHEN u.is_active = 0 THEN u.id END) as inactive_members
      FROM users u
      LEFT JOIN member_flats mf ON u.id = mf.user_id
      LEFT JOIN flats f ON mf.flat_id = f.id
      LEFT JOIN wings w ON f.wing_id = w.id
      ${whereClause}
    `, queryParams);

    res.status(200).json({
      success: true,
      data: stats.rows[0]
    });
  } catch (error) {
    console.error('Error in getMemberStats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch member statistics'
    });
  }
};

// Delete member (hard delete)
const deleteMember = async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting committee members
    const memberCheck = await db.query(
      'SELECT id, role FROM users WHERE id = ?',
      [id]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    if (memberCheck.rows[0].role === 'committee') {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete committee members'
      });
    }

    // Remove flat associations first
    await db.query('DELETE FROM member_flats WHERE user_id = ?', [id]);

    // Delete the user
    await db.query('DELETE FROM users WHERE id = ?', [id]);

    res.status(200).json({
      success: true,
      message: 'Member deleted successfully'
    });
  } catch (error) {
    console.error('Error in deleteMember:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete member'
    });
  }
};

module.exports = {
  getAllMembers,
  getMemberById,
  approveMember,
  rejectMember,
  updateMember,
  deleteMember,
  getMemberStats
};
