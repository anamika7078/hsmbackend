require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./src/config/database');

async function resetAdminPassword() {
  try {
    const password = '123';
    const hash = await bcrypt.hash(password, 10);
    const email = 'admin@gmail.com';

    await db.query(`
      UPDATE users 
      SET password_hash = ?, is_active = TRUE 
      WHERE email = ?
    `, [hash, email]);
    
    console.log('--- PASSWORD RESET SUCCESS ---');
    console.log('Email:    ', email);
    console.log('Password: ', password);
    console.log('------------------------------');
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

resetAdminPassword();
