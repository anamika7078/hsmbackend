const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { generateToken } = require('../middleware/auth');
const { sendOTP, verifyOTP } = require('../services/otpService');
const { validationResult } = require('express-validator');

// Email/Password login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Check if user exists
    const userQuery = await db.query(
      'SELECT id, name, email, mobile, role, is_active, is_verified, password_hash FROM users WHERE email = ?',
      [email]
    );

    if (userQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found. Please check your email.'
      });
    }

    const user = userQuery.rows[0];
    console.log('User found:', { id: user.id, email: user.email, is_active: user.is_active, has_password: !!user.password_hash });

    if (!user.is_active) {
      console.log('Login failed: Account deactivated');
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Please contact society admin.'
      });
    }

    // Check if user has password
    if (!user.password_hash) {
      console.log('Login failed: No password hash');
      return res.status(400).json({
        success: false,
        message: 'No password set for this account. Please use OTP login or contact admin.'
      });
    }

    // Verify password
    console.log('Verifying password...');
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    console.log('Password valid:', isValidPassword);
    
    if (!isValidPassword) {
      console.log('Login failed: Invalid password');
      return res.status(401).json({
        success: false,
        message: 'Invalid password'
      });
    }

    // Generate JWT token
    console.log('Generating token for user:', user.id, 'role:', user.role);
    const token = generateToken(user.id, user.role);
    console.log('Token generated successfully');

    const responseData = {
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          mobile: user.mobile,
          role: user.role,
          is_verified: user.is_verified
        }
      }
    };

    console.log('Sending response');
    res.status(200).json(responseData);
    console.log('Response sent successfully');
  } catch (error) {
    console.error('Error in login:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
};

// Send OTP for login
const sendLoginOTP = async (req, res) => {
  try {
    const { mobile } = req.body;

    if (!mobile) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number is required'
      });
    }

    // Check if user exists
    const userQuery = await db.query(
      'SELECT id, name, mobile, role, is_active FROM users WHERE mobile = ?',
      [mobile]
    );

    if (userQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found. Please contact society admin.'
      });
    }

    const user = userQuery.rows[0];

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Please contact society admin.'
      });
    }

    // Send OTP
    const otpResult = await sendOTP(mobile);

    res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      data: {
        mobile: mobile,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Error in sendLoginOTP:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send OTP'
    });
  }
};

// Verify OTP and login
const verifyLoginOTP = async (req, res) => {
  try {
    const { mobile, otp } = req.body;

    if (!mobile || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number and OTP are required'
      });
    }

    // Verify OTP
    const otpResult = await verifyOTP(mobile, otp);
    if (!otpResult.success) {
      return res.status(400).json({
        success: false,
        message: otpResult.message
      });
    }

    // Get user details
    const userQuery = await db.query(
      'SELECT id, name, email, mobile, role, is_active, is_verified FROM users WHERE mobile = ?',
      [mobile]
    );

    if (userQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = userQuery.rows[0];

    // Generate JWT token
    const token = generateToken(user.id, user.role);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          mobile: user.mobile,
          role: user.role,
          is_verified: user.is_verified
        }
      }
    });
  } catch (error) {
    console.error('Error in verifyLoginOTP:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
};

// Register new user (for committee members only)
const registerUser = async (req, res) => {
  try {
    const { name, email, mobile, password, role } = req.body;

    // Validate input
    if (!name || !mobile || !role) {
      return res.status(400).json({
        success: false,
        message: 'Name, mobile, and role are required'
      });
    }

    if (!['committee', 'member', 'security'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role'
      });
    }

    // Check if user already exists
    let existingUserQuery;
    if (email) {
      existingUserQuery = await db.query(
        'SELECT id FROM users WHERE mobile = ? OR email = ?',
        [mobile, email]
      );
    } else {
      existingUserQuery = await db.query(
        'SELECT id FROM users WHERE mobile = ?',
        [mobile]
      );
    }

    if (existingUserQuery.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'User with this mobile or email already exists'
      });
    }

    // Hash password if provided
    let passwordHash = null;
    if (password) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    // Insert new user
    const insertQuery = await db.query(
      'INSERT INTO users (name, email, mobile, password_hash, role, is_verified) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email || null, mobile, passwordHash, role, true]
    );

    const newUser = {
      id: insertQuery.insertId,
      name,
      email,
      mobile,
      role,
      is_verified: true
    };

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: newUser
    });
  } catch (error) {
    console.error('Error in registerUser:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed'
    });
  }
};

// Get current user profile
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const userQuery = await db.query(
      'SELECT u.id, u.name, u.email, u.mobile, u.role, u.is_active, u.is_verified, u.created_at FROM users u WHERE u.id = ?',
      [userId]
    );

    if (userQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = userQuery.rows[0];

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error in getProfile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile'
    });
  }
};

// Update profile
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, email } = req.body;

    const updateQuery = await db.query(
      'UPDATE users SET name = ?, email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, email, userId]
    );

    if (updateQuery.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get updated user data
    const userQuery = await db.query(
      'SELECT id, name, email, mobile, role FROM users WHERE id = ?',
      [userId]
    );

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: userQuery.rows[0]
    });
  } catch (error) {
    console.error('Error in updateProfile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    // Get current password hash
    const userQuery = await db.query(
      'SELECT password_hash FROM users WHERE id = ?',
      [userId]
    );

    if (userQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = userQuery.rows[0];

    // If user has password, verify current password
    if (user.password_hash) {
      const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isValidPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await db.query(
      'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newPasswordHash, userId]
    );

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Error in changePassword:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password'
    });
  }
};

module.exports = {
  login,
  sendLoginOTP,
  verifyLoginOTP,
  registerUser,
  getProfile,
  updateProfile,
  changePassword
};
