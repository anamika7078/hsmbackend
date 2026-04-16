const db = require('../config/database');

// Log vehicle entry
const logVehicleEntry = async (req, res) => {
  try {
    const { vehicle_number, vehicle_type, visiting_flat_id } = req.body;
    const guard_id = req.user.id;

    if (!vehicle_number || !vehicle_type) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle number and type are required'
      });
    }

    const result = await db.query(
      'INSERT INTO vehicle_logs (vehicle_number, vehicle_type, visiting_flat_id, guard_id) VALUES (?, ?, ?, ?)',
      [vehicle_number, vehicle_type, visiting_flat_id, guard_id]
    );

    res.status(201).json({
      success: true,
      message: 'Vehicle entry logged successfully',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('Error in logVehicleEntry:', error);
    res.status(500).json({ success: false, message: 'Failed to log vehicle entry' });
  }
};

// Log vehicle exit
const logVehicleExit = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'UPDATE vehicle_logs SET exit_time = CURRENT_TIMESTAMP, status = \'exited\' WHERE id = ? AND status = \'inside\'',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Vehicle not found or already exited' });
    }

    res.status(200).json({ success: true, message: 'Vehicle exit logged successfully' });
  } catch (error) {
    console.error('Error in logVehicleExit:', error);
    res.status(500).json({ success: false, message: 'Failed to log vehicle exit' });
  }
};

// Get all vehicle logs
const getVehicleLogs = async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;
    let query = `
      SELECT vl.*, f.flat_number, w.name as wing_name
      FROM vehicle_logs vl
      LEFT JOIN flats f ON vl.visiting_flat_id = f.id
      LEFT JOIN wings w ON f.wing_id = w.id
    `;
    let params = [];

    if (status) {
      query += ' WHERE vl.status = ?';
      params.push(status);
    }

    query += ' ORDER BY vl.entry_time DESC LIMIT ?';
    params.push(parseInt(limit));

    const result = await db.query(query, params);
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error in getVehicleLogs:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch vehicle logs' });
  }
};

module.exports = {
  logVehicleEntry,
  logVehicleExit,
  getVehicleLogs
};
