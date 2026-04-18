const db = require('../config/database');

// Get all societies
const getAllSocieties = async (req, res) => {
  try {
    const query = `
      SELECT s.*, 
             COUNT(DISTINCT w.id) as total_wings,
             COUNT(DISTINCT f.id) as total_flats,
             COUNT(DISTINCT CASE WHEN f.is_occupied = true THEN f.id END) as occupied_flats
      FROM societies s
      LEFT JOIN wings w ON s.id = w.society_id
      LEFT JOIN flats f ON w.id = f.wing_id
      GROUP BY s.id
      ORDER BY s.name ASC
    `;

    const result = await db.query(query);

    res.status(200).json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error in getAllSocieties:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch societies'
    });
  }
};

// Create new society
const createSociety = async (req, res) => {
  try {
    const { name, address, landmark, city, state, pincode, registration_number, email, phone } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Society name is required'
      });
    }

    const result = await db.query(
      `INSERT INTO societies (name, address, landmark, city, state, pincode, registration_number, email, phone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, address, landmark, city, state, pincode, registration_number, email, phone]
    );

    const createdSociety = await db.query('SELECT * FROM societies WHERE id = ?', [result.insertId]);

    res.status(201).json({
      success: true,
      message: 'Society created successfully',
      data: createdSociety.rows[0]
    });
  } catch (error) {
    console.error('Error in createSociety:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create society'
    });
  }
};

// Get society details (by ID)
const getSocietyDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const targetId = id || null;

    let query = `
      SELECT s.*, 
             COUNT(DISTINCT w.id) as total_wings,
             COUNT(DISTINCT f.id) as total_flats,
             COUNT(DISTINCT CASE WHEN f.is_occupied = true THEN f.id END) as occupied_flats
      FROM societies s
      LEFT JOIN wings w ON s.id = w.society_id
      LEFT JOIN flats f ON w.id = f.wing_id
    `;
    
    let queryParams = [];
    if (targetId) {
      query += ` WHERE s.id = ?`;
      queryParams.push(targetId);
    }
    
    query += ` GROUP BY s.id ORDER BY s.id LIMIT 1`;

    const result = await db.query(query, queryParams);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Society not found'
      });
    }

    res.status(200).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error in getSocietyDetails:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch society details'
    });
  }
};

// Update society details
const updateSocietyDetails = async (req, res) => {
  try {
    const { name, address, landmark, city, state, pincode, registration_number, email, phone } = req.body;

    const result = await db.query(
      `UPDATE societies 
       SET name = $1, address = $2, landmark = $3, city = $4, state = $5, pincode = $6, 
           registration_number = $7, email = $8, phone = $9, updated_at = CURRENT_TIMESTAMP
       LIMIT 1`,
      [name, address, landmark, city, state, pincode, registration_number, email, phone]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        success: false,
        message: 'Society not found'
      });
    }

    const updatedSociety = await db.query('SELECT * FROM societies ORDER BY id LIMIT 1');

    res.status(200).json({
      success: true,
      message: 'Society details updated successfully',
      data: updatedSociety.rows[0]
    });
  } catch (error) {
    console.error('Error in updateSocietyDetails:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update society details'
    });
  }
};

// Upload society logo
const uploadLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const logoUrl = `/uploads/${req.file.filename}`;

    await db.query(
      'UPDATE societies SET logo = $1, updated_at = CURRENT_TIMESTAMP LIMIT 1',
      [logoUrl]
    );

    res.status(200).json({
      success: true,
      message: 'Logo uploaded successfully',
      data: { logo: logoUrl }
    });
  } catch (error) {
    console.error('Error in uploadLogo:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload logo'
    });
  }
};

// Get all wings
const getAllWings = async (req, res) => {
  try {
    const query = `
      SELECT w.*, 
             COUNT(f.id) as total_flats,
             COUNT(CASE WHEN f.is_occupied = true THEN 1 END) as occupied_flats
      FROM wings w
      LEFT JOIN flats f ON w.id = f.wing_id
      GROUP BY w.id
      ORDER BY w.name
    `;

    const result = await db.query(query);

    res.status(200).json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error in getAllWings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch wings'
    });
  }
};

// Create wing
const createWing = async (req, res) => {
  try {
    const { society_id, name, floors, flats_per_floor } = req.body;

    if (!name || !society_id) {
      return res.status(400).json({
        success: false,
        message: 'Wing name and Society ID are required'
      });
    }

    const result = await db.query(
      'INSERT INTO wings (society_id, name, floors, flats_per_floor) VALUES (?, ?, ?, ?)',
      [society_id, name, floors || 0, flats_per_floor || 0]
    );

    const createdWing = await db.query('SELECT * FROM wings WHERE id = ?', [result.insertId]);

    res.status(201).json({
      success: true,
      message: 'Wing created successfully',
      data: createdWing.rows[0]
    });
  } catch (error) {
    console.error('Error in createWing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create wing'
    });
  }
};

// Update wing
const updateWing = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, floors, flats_per_floor } = req.body;

    const result = await db.query(
      'UPDATE wings SET name = $1, floors = $2, flats_per_floor = $3 WHERE id = $4',
      [name, floors, flats_per_floor, id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        success: false,
        message: 'Wing not found'
      });
    }

    const updatedWing = await db.query('SELECT * FROM wings WHERE id = ?', [id]);

    res.status(200).json({
      success: true,
      message: 'Wing updated successfully',
      data: updatedWing.rows[0]
    });
  } catch (error) {
    console.error('Error in updateWing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update wing'
    });
  }
};

// Delete wing
const deleteWing = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if wing has flats
    const flatsQuery = await db.query('SELECT COUNT(*) as count FROM flats WHERE wing_id = $1', [id]);

    if (parseInt(flatsQuery.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete wing with existing flats'
      });
    }

    const result = await db.query('DELETE FROM wings WHERE id = $1', [id]);

    if (!result.affectedRows) {
      return res.status(404).json({
        success: false,
        message: 'Wing not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Wing deleted successfully'
    });
  } catch (error) {
    console.error('Error in deleteWing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete wing'
    });
  }
};

// Get all flats
const getAllFlats = async (req, res) => {
  try {
    const { wingId } = req.query;
    let whereClause = '';
    let queryParams = [];

    if (wingId) {
      whereClause = 'WHERE f.wing_id = $1';
      queryParams.push(wingId);
    }

    const query = `
      SELECT f.*, w.name as wing_name,
             u.id as owner_id, u.name as owner_name, u.mobile as owner_mobile,
             mf.ownership_type
      FROM flats f
      LEFT JOIN wings w ON f.wing_id = w.id
      LEFT JOIN member_flats mf ON f.id = mf.flat_id AND mf.is_primary = true
      LEFT JOIN users u ON mf.user_id = u.id
      ${whereClause}
      ORDER BY w.name, f.floor_number, f.flat_number
    `;

    const result = await db.query(query, queryParams);

    res.status(200).json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error in getAllFlats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch flats'
    });
  }
};

// Create flat
const createFlat = async (req, res) => {
  try {
    const { wing_id, flat_number, floor_number, type, area_sqft } = req.body;

    if (!wing_id || !flat_number || !floor_number) {
      return res.status(400).json({
        success: false,
        message: 'Wing ID, flat number, and floor number are required'
      });
    }

    // Check if flat number already exists in the wing
    const existingFlat = await db.query(
      'SELECT id FROM flats WHERE wing_id = $1 AND flat_number = $2',
      [wing_id, flat_number]
    );

    if (existingFlat.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Flat number already exists in this wing'
      });
    }

    const result = await db.query(
      'INSERT INTO flats (wing_id, flat_number, floor_number, type, area_sqft) VALUES ($1, $2, $3, $4, $5)',
      [wing_id, flat_number, floor_number, type, area_sqft]
    );

    const createdFlat = await db.query('SELECT * FROM flats WHERE id = ?', [result.insertId]);

    res.status(201).json({
      success: true,
      message: 'Flat created successfully',
      data: createdFlat.rows[0]
    });
  } catch (error) {
    console.error('Error in createFlat:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create flat'
    });
  }
};

// Update flat
const updateFlat = async (req, res) => {
  try {
    const { id } = req.params;
    const { flat_number, floor_number, type, area_sqft, is_occupied } = req.body;

    const result = await db.query(
      'UPDATE flats SET flat_number = $1, floor_number = $2, type = $3, area_sqft = $4, is_occupied = $5 WHERE id = $6',
      [flat_number, floor_number, type, area_sqft, is_occupied, id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        success: false,
        message: 'Flat not found'
      });
    }

    const updatedFlat = await db.query('SELECT * FROM flats WHERE id = ?', [id]);

    res.status(200).json({
      success: true,
      message: 'Flat updated successfully',
      data: updatedFlat.rows[0]
    });
  } catch (error) {
    console.error('Error in updateFlat:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update flat'
    });
  }
};

// Delete flat
const deleteFlat = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if flat is occupied
    const flatQuery = await db.query('SELECT is_occupied FROM flats WHERE id = $1', [id]);

    if (flatQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Flat not found'
      });
    }

    if (flatQuery.rows[0].is_occupied) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete occupied flat'
      });
    }

    const result = await db.query('DELETE FROM flats WHERE id = $1', [id]);

    res.status(200).json({
      success: true,
      message: 'Flat deleted successfully'
    });
  } catch (error) {
    console.error('Error in deleteFlat:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete flat'
    });
  }
};

module.exports = {
  getAllSocieties,
  getSocietyDetails,
  createSociety,
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
};
