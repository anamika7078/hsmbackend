const db = require('../config/database');

// Get all complaints
const getAllComplaints = async (req, res) => {
  try {
    const { page = 1, limit = 10, status = 'all', category = 'all' } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    let queryParams = [];

    if (status !== 'all') {
      whereClause += ' AND c.status = ?';
      queryParams.push(status);
    }

    if (category !== 'all') {
      whereClause += ` AND c.category = ?`;
      queryParams.push(category);
    }

    const query = `
      SELECT c.*, 
             uc.name as complainant_name, uc.mobile as complainant_mobile,
             ua.name as assigned_to_name,
             f.flat_number, w.name as wing_name
      FROM complaints c
      LEFT JOIN users uc ON c.complainant_id = uc.id
      LEFT JOIN users ua ON c.assigned_to = ua.id
      LEFT JOIN flats f ON c.flat_id = f.id
      LEFT JOIN wings w ON f.wing_id = w.id
      ${whereClause}
      ORDER BY c.priority DESC, c.created_at DESC
      LIMIT ? OFFSET ?
    `;

    queryParams.push(parseInt(limit), parseInt(offset));

    const result = await db.query(query, queryParams);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM complaints c
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, queryParams.slice(0, -2));

    res.status(200).json({
      success: true,
      data: {
        complaints: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countResult.rows[0].total),
          totalPages: Math.ceil(countResult.rows[0].total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error in getAllComplaints:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch complaints'
    });
  }
};

// Create complaint (member)
const createComplaint = async (req, res) => {
  try {
    const { title, description, category, priority, flat_id } = req.body;
    const userId = req.user.id;

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: 'Title and description are required'
      });
    }

    // If flat_id is not provided, use member's primary flat
    let flatId = flat_id;
    if (!flatId) {
      const flatQuery = await db.query(
        'SELECT flat_id FROM member_flats WHERE user_id = ? AND is_primary = true',
        [userId]
      );
      
      if (flatQuery.rows.length > 0) {
        flatId = flatQuery.rows[0].flat_id;
      }
    }

    const result = await db.query(
      `INSERT INTO complaints (complainant_id, title, description, category, priority, flat_id) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, title, description, category || 'other', priority || 'medium', flatId]
    );

    const createdComplaint = await db.query('SELECT * FROM complaints WHERE id = ?', [result.insertId]);

    res.status(201).json({
      success: true,
      message: 'Complaint created successfully',
      data: createdComplaint.rows[0]
    });
  } catch (error) {
    console.error('Error in createComplaint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create complaint'
    });
  }
};

// Get complaint by ID
const getComplaintById = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT c.*, 
             uc.name as complainant_name, uc.mobile as complainant_mobile,
             ua.name as assigned_to_name,
             f.flat_number, w.name as wing_name
      FROM complaints c
      LEFT JOIN users uc ON c.complainant_id = uc.id
      LEFT JOIN users ua ON c.assigned_to = ua.id
      LEFT JOIN flats f ON c.flat_id = f.id
      LEFT JOIN wings w ON f.wing_id = w.id
      WHERE c.id = ?
    `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    res.status(200).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error in getComplaintById:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch complaint'
    });
  }
};

// Update complaint status (committee)
const updateComplaintStatus = async (req, res) => {
  try {
    const id = req.params.id || req.body.id;
    const { status, assigned_to, resolution_notes } = req.body;

    if (!['open', 'in_progress', 'resolved', 'closed', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    let updateQuery = `
      UPDATE complaints 
      SET status = ?, assigned_to = ?, resolution_notes = ?, updated_at = CURRENT_TIMESTAMP
    `;
    let queryParams = [status, assigned_to, resolution_notes];

    if (status === 'resolved') {
      updateQuery += ', resolved_at = CURRENT_TIMESTAMP';
    }

    updateQuery += ' WHERE id = ?';
    queryParams.push(id);

    const result = await db.query(updateQuery, queryParams);

    if (!result.affectedRows) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    const updatedComplaint = await db.query('SELECT * FROM complaints WHERE id = ?', [id]);

    res.status(200).json({
      success: true,
      message: 'Complaint updated successfully',
      data: updatedComplaint.rows[0]
    });
  } catch (error) {
    console.error('Error in updateComplaintStatus:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update complaint'
    });
  }
};

// Get my complaints (member)
const getMyComplaints = async (req, res) => {
  try {
    const userId = req.user.id;

    const query = `
      SELECT c.*, 
             ua.name as assigned_to_name,
             f.flat_number, w.name as wing_name
      FROM complaints c
      LEFT JOIN users ua ON c.assigned_to = ua.id
      LEFT JOIN flats f ON c.flat_id = f.id
      LEFT JOIN wings w ON f.wing_id = w.id
      WHERE c.complainant_id = ?
      ORDER BY c.created_at DESC
    `;

    const result = await db.query(query, [userId]);

    res.status(200).json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error in getMyComplaints:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch complaints'
    });
  }
};

// Get complaint statistics
const getComplaintStats = async (req, res) => {
  try {
    const stats = await db.query(`
      SELECT 
        COUNT(*) as total_complaints,
        COUNT(CASE WHEN status = 'open' THEN 1 END) as open_complaints,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_complaints,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_complaints,
        COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_complaints,
        COUNT(CASE WHEN priority = 'critical' THEN 1 END) as critical_complaints,
        COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 END) as today_complaints
      FROM complaints
    `);

    res.status(200).json({
      success: true,
      data: stats.rows[0]
    });
  } catch (error) {
    console.error('Error in getComplaintStats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch complaint statistics'
    });
  }
};

const deleteComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM complaints WHERE id = ?', [id]);

    if (!result.affectedRows) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Complaint deleted successfully'
    });
  } catch (error) {
    console.error('Error in deleteComplaint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete complaint'
    });
  }
};

module.exports = {
  getAllComplaints,
  createComplaint,
  getComplaintById,
  updateComplaintStatus,
  getMyComplaints,
  getComplaintStats,
  deleteComplaint
};
