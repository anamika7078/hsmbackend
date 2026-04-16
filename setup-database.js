const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function setupDatabase() {
  try {
    // Create connection without specifying database
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'password'
    });

    console.log('Connected to MySQL server');

    // Create database if not exists
    await connection.execute(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'society_management'}`);
    console.log('Database created or already exists');

    // Close connection and reconnect to the specific database
    await connection.end();

    const dbConnection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      database: process.env.DB_NAME || 'society_management',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'password'
    });

    console.log('Connected to database');

    // Read and execute SQL file
    const sqlFile = path.join(__dirname, 'src/models/init.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    // Split SQL file into individual statements
    const statements = sql.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        await dbConnection.execute(statement);
        console.log('Executed:', statement.substring(0, 50) + '...');
      }
    }

    console.log('Database setup completed successfully!');
    await dbConnection.end();

  } catch (error) {
    console.error('Database setup failed:', error);
    process.exit(1);
  }
}

setupDatabase();
