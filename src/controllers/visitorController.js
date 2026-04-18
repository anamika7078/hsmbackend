const db = require('../config/database');

const getAllVisitors = async (req, res) => {
  try {
    const { status = 'all' } = req.query;
    const params = [];
    let where = '';

    if (status !== 'all') {
      where = 'WHERE v.status = ?';
      params.push(status);
    }

    const result = await db.query(
      `
      SELECT v.*, f.flat_number, w.name AS wing_name, u.name AS member_name
      FROM visitors v
      LEFT JOIN flats f ON v.visiting_flat_id = f.id
      LEFT JOIN wings w ON f.wing_id = w.id
      LEFT JOIN users u ON v.visiting_member_id = u.id
      ${where}
      ORDER BY v.created_at DESC
    `,
      params,
    );

    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch visitors' });
  }
};

const getMyVisitors = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await db.query(
      `
      SELECT v.*, f.flat_number, w.name AS wing_name, u.name AS member_name
      FROM visitors v
      LEFT JOIN flats f ON v.visiting_flat_id = f.id
      LEFT JOIN wings w ON f.wing_id = w.id
      LEFT JOIN users u ON v.visiting_member_id = u.id
      WHERE v.visiting_member_id = ? 
         OR v.visiting_flat_id IN (SELECT flat_id FROM member_flats WHERE user_id = ?)
      ORDER BY v.created_at DESC
    `,
      [userId, userId],
    );

    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch your visitors' });
  }
};

const createVisitorRequest = async (req, res) => {
  try {
    const { name, mobile, visitor_type, visit_frequency, purpose, vehicle_number, visiting_flat_id, expected_arrival } = req.body;
    const isSecurity = req.user.role === 'security';
    const photo_url = req.file ? `/uploads/visitors/${req.file.filename}` : req.body.photo_url || null;

    if (!name || !mobile || !visiting_flat_id) {
      console.log('Validation failed:', { name, mobile, visiting_flat_id });
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // Fetch visiting_member_id first
    const memberQuery = await db.query(
      'SELECT user_id FROM member_flats WHERE flat_id = ? LIMIT 1',
      [visiting_flat_id]
    );
    const visiting_member_id = memberQuery.rows.length > 0 ? memberQuery.rows[0].user_id : null;

    const query = `
      INSERT INTO visitors 
      (name, mobile, photo_url, visitor_type, visit_frequency, purpose, vehicle_number, visiting_flat_id, visiting_member_id, expected_arrival, status) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const status = isSecurity ? 'pending' : 'approved';
    const params = [
      name, 
      mobile,
      photo_url,
      visitor_type || 'guest',
      visit_frequency || 'one_time',
      purpose || null, 
      vehicle_number || null, 
      visiting_flat_id, 
      visiting_member_id, 
      expected_arrival || null, 
      status
    ];

    console.log('Attempting visitor insert with params:', params);
    const created = await db.query(query, params);

    res.status(201).json({ success: true, message: 'Visitor request created', data: { id: created.insertId, photo_url } });
  } catch (error) {
    console.error('Error in createVisitorRequest:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create visitor request', 
      error: error.message 
    });
  }
};

const respondToVisitor = async (req, res) => {
  try {
    const visitorId = req.params.id || req.body.id;
    const { status } = req.body;

    if (!visitorId || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Valid visitor id and status required' });
    }

    const updated = await db.query(
      'UPDATE visitors SET status = ?, approved_by = ? WHERE id = ?',
      [status, req.user.id, visitorId],
    );

    if (!updated.affectedRows) {
      return res.status(404).json({ success: false, message: 'Visitor not found' });
    }

    res.status(200).json({ success: true, message: `Visitor ${status}` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to respond to visitor' });
  }
};

const checkInVisitor = async (req, res) => {
  try {
    const visitorId = req.params.id || req.body.id;
    if (!visitorId) {
      return res.status(400).json({ success: false, message: 'Visitor id is required' });
    }
    const updated = await db.query(
      'UPDATE visitors SET status = ?, actual_arrival = CURRENT_TIMESTAMP WHERE id = ? AND status = ?',
      ['checked_in', visitorId, 'approved'],
    );

    if (!updated.affectedRows) {
      return res.status(400).json({ success: false, message: 'Visitor is not approved or not found' });
    }

    res.status(200).json({ success: true, message: 'Visitor checked in' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to check in visitor' });
  }
};

const checkOutVisitor = async (req, res) => {
  try {
    const visitorId = req.params.id || req.body.id;
    const updated = await db.query(
      'UPDATE visitors SET status = ?, actual_departure = CURRENT_TIMESTAMP WHERE id = ? AND status = ?',
      ['checked_out', visitorId, 'checked_in'],
    );

    if (!updated.affectedRows) {
      return res.status(400).json({ success: false, message: 'Visitor is not checked in or not found' });
    }

    res.status(200).json({ success: true, message: 'Visitor checked out' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to check out visitor' });
  }
};

const getVisitorStats = async (req, res) => {
  try {
    const stats = await db.query(`
      SELECT
        COUNT(*) AS total_visitors,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending_visitors,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) AS approved_visitors,
        COUNT(CASE WHEN status = 'checked_in' THEN 1 END) AS checked_in_visitors,
        COUNT(CASE WHEN status = 'checked_out' THEN 1 END) AS checked_out_visitors
      FROM visitors
    `);

    res.status(200).json({ success: true, data: stats.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch visitor stats' });
  }
};

const getActiveVisitors = async (req, res) => {
  try {
    const visitors = await db.query(
      `SELECT id, name, mobile, purpose, actual_arrival, status
       FROM visitors
       WHERE status IN (?, ?)
       ORDER BY actual_arrival DESC`,
      ['approved', 'checked_in'],
    );

    res.status(200).json({ success: true, data: visitors.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch active visitors' });
  }
};

const updateVisitor = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, mobile, visitor_type, purpose, vehicle_number, visiting_flat_id } = req.body;

    if (!id) return res.status(400).json({ success: false, message: 'Visitor ID is required' });

    const query = `
      UPDATE visitors 
      SET name = ?, mobile = ?, visitor_type = ?, purpose = ?, vehicle_number = ?, visiting_flat_id = ? 
      WHERE id = ?
    `;
    const params = [name, mobile, visitor_type, purpose, vehicle_number, visiting_flat_id, id];

    const result = await db.query(query, params);

    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Visitor not found' });
    }

    res.status(200).json({ success: true, message: 'Visitor updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update visitor' });
  }
};

const deleteVisitor = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, message: 'Visitor ID is required' });

    const result = await db.query('DELETE FROM visitors WHERE id = ?', [id]);

    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Visitor not found' });
    }

    res.status(200).json({ success: true, message: 'Visitor deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete visitor' });
  }
};

module.exports = {
  getAllVisitors,
  createVisitorRequest,
  respondToVisitor,
  checkInVisitor,
  checkOutVisitor,
  getVisitorStats,
  getActiveVisitors,
  getMyVisitors,
  updateVisitor,
  deleteVisitor,
};
