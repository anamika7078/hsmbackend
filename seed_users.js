require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./src/config/database');

async function seedTestUsers() {
  try {
    const password = 'Password@123';
    const hash = await bcrypt.hash(password, 10);
    
    // Seed and Get Users
    const users = [
      { name: 'Admin User', email: 'admin@gmail.com', mobile: '9999999999', role: 'committee' },
      { name: 'Society Member', email: 'member@gmail.com', mobile: '8888888888', role: 'member' },
      { name: 'Security Guard', email: 'security@gmail.com', mobile: '7777777777', role: 'security' }
    ];

    console.log('--- TEST CREDENTIALS ---');
    console.log('Password for all users:', password);
    
    for (const u of users) {
      await db.query(`
        INSERT INTO users (name, email, mobile, password_hash, role, is_verified)
        VALUES (?, ?, ?, ?, ?, TRUE)
        ON DUPLICATE KEY UPDATE password_hash = ?
      `, [u.name, u.email, u.mobile, hash, u.role, hash]);
      
      console.log(`Role: ${u.role.padEnd(10)} | Email: ${u.email}`);
    }
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seedTestUsers();
