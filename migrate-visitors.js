/**
 * Migration: Add missing columns to visitors table
 * Run with: node migrate-visitors.js
 *
 * Compatible with MySQL 5.7+ (no IF NOT EXISTS on ADD COLUMN).
 * Adds: photo_url, visitor_type, visit_frequency
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

async function columnExists(conn, dbName, table, column) {
  const [rows] = await conn.execute(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [dbName, table, column]
  );
  return rows[0].cnt > 0;
}

async function migrate() {
  const dbName = process.env.DB_NAME || 'society_management';

  const connection = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306'),
    database: dbName,
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || 'password',
  });

  console.log('Connected to database:', dbName);

  const migrations = [
    {
      column: 'photo_url',
      sql: `ALTER TABLE visitors ADD COLUMN photo_url TEXT AFTER mobile`,
    },
    {
      column: 'visitor_type',
      sql: `ALTER TABLE visitors ADD COLUMN visitor_type VARCHAR(50) DEFAULT 'GUEST' AFTER photo_url`,
    },
    {
      column: 'visit_frequency',
      sql: `ALTER TABLE visitors ADD COLUMN visit_frequency ENUM('one_time','regular') DEFAULT 'one_time' AFTER visitor_type`,
    },
  ];

  for (const m of migrations) {
    const exists = await columnExists(connection, dbName, 'visitors', m.column);
    if (exists) {
      console.log(`⏭  Column already exists, skipping: ${m.column}`);
    } else {
      try {
        await connection.execute(m.sql);
        console.log(`✅  Added column: ${m.column}`);
      } catch (err) {
        console.error(`❌  Failed to add ${m.column}:`, err.message);
      }
    }
  }

  await connection.end();
  console.log('\nMigration complete.');
}

migrate().catch(console.error);
