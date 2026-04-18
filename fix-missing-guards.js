require('dotenv').config();
const db = require('./src/config/database');

async function run() {
  try {
    const userQuery = await db.query("SELECT * FROM users WHERE role = 'security'");
    const users = userQuery.rows;
    console.log('Security Users:', users);

    // Get a default society
    const socQuery = await db.query("SELECT id FROM societies LIMIT 1");
    if (socQuery.rows.length === 0) {
      console.log('No societies found, creating one...');
      await db.query("INSERT INTO societies (name, address, city, state, pincode) VALUES ('Galaxy Residence', '123 SG Road', 'Ahmedabad', 'Gujarat', '380015')");
    }
    const defaultSocId = socQuery.rows.length > 0 ? socQuery.rows[0].id : 1;

    for (let u of users) {
      const gQuery = await db.query('SELECT * FROM guards WHERE user_id = ?', [u.id]);
      if (gQuery.rows.length === 0) {
        console.log('Inserting guard for user:', u.id, u.name);
        await db.query(
          'INSERT INTO guards (user_id, name, mobile, email, shift, society_id) VALUES (?, ?, ?, ?, ?, ?)',
          [u.id, u.name, u.mobile, u.email, 'day', defaultSocId]
        );
      } else {
        console.log(`User ${u.id} already has guard record with society_id ${gQuery.rows[0].society_id}`);
      }
    }
    console.log('Done fixing missing guard links.');
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
