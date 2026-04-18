const db = require('../config/database');

// Get all staff
const getAllStaff = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', role = 'all', status = 'all' } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    let queryParams = [];

    if (search) {
      whereClause += ' AND (s.name LIKE ? OR s.mobile LIKE ?)';
      const searchParam = `%${search}%`;
      queryParams.push(searchParam, searchParam);
    }

    if (role !== 'all') {
      whereClause += ' AND s.role = ?';
      queryParams.push(role);
    }

    if (status !== 'all') {
      whereClause += ' AND s.is_active = ?';
      queryParams.push(status === 'active' ? 1 : 0);
    }

    const query = `
      SELECT s.*, soc.name as society_name
      FROM staff s
      LEFT JOIN societies soc ON s.society_id = soc.id
      ${whereClause}
      ORDER BY s.created_at DESC
      LIMIT ? OFFSET ?
    `;

    queryParams.push(parseInt(limit), parseInt(offset));

    const result = await db.query(query, queryParams);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM staff s
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, queryParams.slice(0, -2));

    res.status(200).json({
      success: true,
      data: {
        staff: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countResult.rows[0].total),
          totalPages: Math.ceil(parseInt(countResult.rows[0].total) / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error in getAllStaff:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch staff' });
  }
};

// Get staff by ID
const getStaffById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM staff WHERE id = ?', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }

    // Get assigned flats
    const flatsResult = await db.query(`
      SELECT f.*, w.name as wing_name 
      FROM staff_flats sf
      JOIN flats f ON sf.flat_id = f.id
      JOIN wings w ON f.wing_id = w.id
      WHERE sf.staff_id = ?
    `, [id]);

    res.status(200).json({
      success: true,
      data: {
        ...result.rows[0],
        flats: flatsResult.rows
      }
    });
  } catch (error) {
    console.error('Error in getStaffById:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch staff details' });
  }
};

// Create staff
const createStaff = async (req, res) => {
  try {
    const { name, mobile, email, role, staff_type, id_proof_type, id_proof_number, society_id, flat_ids } = req.body;

    if (!name || !mobile || !role) {
      return res.status(400).json({ success: false, message: 'Name, mobile and role are required' });
    }

    // Check if mobile already exists
    const existingStaff = await db.query('SELECT id FROM staff WHERE mobile = ?', [mobile]);
    if (existingStaff.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Staff with this mobile number already exists' });
    }

    const sid = society_id || (await db.query('SELECT id FROM societies LIMIT 1')).rows[0]?.id;

    const result = await db.query(
      `INSERT INTO staff (name, mobile, email, role, staff_type, id_proof_type, id_proof_number, society_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, mobile, email || null, role, staff_type || 'regular', id_proof_type, id_proof_number, sid]
    );

    const staffId = result.insertId;

    // Assign flats if provided
    if (flat_ids && Array.isArray(flat_ids)) {
      for (const flatId of flat_ids) {
        await db.query('INSERT INTO staff_flats (staff_id, flat_id) VALUES (?, ?)', [staffId, flatId]);
      }
    }

    const createdStaff = await db.query('SELECT * FROM staff WHERE id = ?', [staffId]);

    res.status(201).json({
      success: true,
      message: 'Staff created successfully',
      data: createdStaff.rows[0]
    });
  } catch (error) {
    console.error('Error in createStaff:', error);
    res.status(500).json({ success: false, message: 'Failed to create staff' });
  }
};

// Update staff
const updateStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, mobile, email, role, staff_type, id_proof_type, id_proof_number, is_active, flat_ids } = req.body;

    const result = await db.query(
      `UPDATE staff SET name = ?, mobile = ?, email = ?, role = ?, staff_type = ?, 
       id_proof_type = ?, id_proof_number = ?, is_active = ? WHERE id = ?`,
      [name, mobile, email, role, staff_type, id_proof_type, id_proof_number, is_active ? 1 : 0, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }

    // Update flat associations
    if (flat_ids && Array.isArray(flat_ids)) {
      await db.query('DELETE FROM staff_flats WHERE staff_id = ?', [id]);
      for (const flatId of flat_ids) {
        await db.query('INSERT INTO staff_flats (staff_id, flat_id) VALUES (?, ?)', [id, flatId]);
      }
    }

    const updatedStaff = await db.query('SELECT * FROM staff WHERE id = ?', [id]);

    res.status(200).json({
      success: true,
      message: 'Staff updated successfully',
      data: updatedStaff.rows[0]
    });
  } catch (error) {
    console.error('Error in updateStaff:', error);
    res.status(500).json({ success: false, message: 'Failed to update staff' });
  }
};

// Delete staff
const deleteStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM staff WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }

    res.status(200).json({ success: true, message: 'Staff deleted successfully' });
  } catch (error) {
    console.error('Error in deleteStaff:', error);
    res.status(500).json({ success: false, message: 'Failed to delete staff' });
  }
};

// Staff Entry/Check-in
const checkInStaff = async (req, res) => {
  try {
    const { staff_id, gate_name, notes } = req.body;

    // Check if staff is active
    const staff = await db.query('SELECT is_active FROM staff WHERE id = ?', [staff_id]);
    if (staff.rows.length === 0 || !staff.rows[0].is_active) {
       return res.status(400).json({ success: false, message: 'Staff is either not found or inactive' });
    }

    // Check if already checked in
    const existingLog = await db.query(
      'SELECT id FROM staff_logs WHERE staff_id = ? AND shift_date = CURRENT_DATE AND check_out_time IS NULL',
      [staff_id]
    );

    if (existingLog.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Staff is already checked in' });
    }

    await db.query(
      'INSERT INTO staff_logs (staff_id, check_in_time, entry_gate, notes, shift_date) VALUES (?, CURRENT_TIMESTAMP, ?, ?, CURRENT_DATE)',
      [staff_id, gate_name || 'Main Gate', notes]
    );

    res.status(201).json({ success: true, message: 'Staff checked in successfully' });
  } catch (error) {
    console.error('Error in checkInStaff:', error);
    res.status(500).json({ success: false, message: 'Failed to check in staff' });
  }
};

// Staff Exit/Check-out
const checkOutStaff = async (req, res) => {
  try {
    const { staff_id, gate_name, notes } = req.body;

    const existingLog = await db.query(
      'SELECT id FROM staff_logs WHERE staff_id = ? AND check_out_time IS NULL ORDER BY check_in_time DESC LIMIT 1',
      [staff_id]
    );

    if (existingLog.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No active check-in found for this staff' });
    }

    await db.query(
      'UPDATE staff_logs SET check_out_time = CURRENT_TIMESTAMP, exit_gate = ?, notes = CONCAT(IFNULL(notes, \'\'), ?) WHERE id = ?',
      [gate_name || 'Main Gate', notes ? ` | Exit Notes: ${notes}` : '', existingLog.rows[0].id]
    );

    res.status(200).json({ success: true, message: 'Staff checked out successfully' });
  } catch (error) {
    console.error('Error in checkOutStaff:', error);
    res.status(500).json({ success: false, message: 'Failed to check out staff' });
  }
};

module.exports = {
  getAllStaff,
  getStaffById,
  createStaff,
  updateStaff,
  deleteStaff,
  checkInStaff,
  checkOutStaff
};
