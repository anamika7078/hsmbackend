const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

let pool;
let initPromise;

const normalizeSql = (sql) => sql.replace(/\$[0-9]+/g, '?');

const executeSchema = async (connection) => {
  const sqlFilePath = path.join(__dirname, '../models/init.sql');
  const sqlRaw = fs.readFileSync(sqlFilePath, 'utf8');
  const sqlWithoutComments = sqlRaw.replace(/^\s*--.*$/gm, '');
  const statements = sqlWithoutComments
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    try {
      await connection.query(statement);
    } catch (error) {
      if ([1061, 1062, 1050].includes(error.errno)) {
        continue;
      }
      throw error;
    }
  }

  // --- MIGRATIONS / SELF-HEALING ---
  try {
    // Ensure 'societies' table exists (it should from init.sql, but just in case)
    // Ensure 'guards' table has the necessary columns if it was created long ago
    const [columns] = await connection.query("SHOW COLUMNS FROM guards");
    const columnNames = columns.map(c => c.Field);
    
    if (!columnNames.includes('user_id')) {
      console.log('Migrating: Adding user_id to guards');
      await connection.query("ALTER TABLE guards ADD COLUMN user_id INT AFTER id");
    }
    
    if (!columnNames.includes('society_id')) {
      console.log('Migrating: Adding society_id to guards');
      await connection.query("ALTER TABLE guards ADD COLUMN society_id INT AFTER shift");
    }

    // Ensure wings has society_id
    const [wingCols] = await connection.query("SHOW COLUMNS FROM wings");
    const wingColNames = wingCols.map(c => c.Field);
    if (!wingColNames.includes('society_id')) {
      console.log('Migrating: Adding society_id to wings');
      await connection.query("ALTER TABLE wings ADD COLUMN society_id INT AFTER id");
    }

    // Ensure staff has society_id
    const [staffCols] = await connection.query("SHOW COLUMNS FROM staff");
    const staffColNames = staffCols.map(c => c.Field);
    if (!staffColNames.includes('society_id')) {
      console.log('Migrating: Adding society_id to staff');
      await connection.query("ALTER TABLE staff ADD COLUMN society_id INT AFTER id_proof_number");
    }

    // Ensure visitors has photo_url
    const [visitorCols] = await connection.query("SHOW COLUMNS FROM visitors");
    const visitorColNames = visitorCols.map(c => c.Field);
    if (!visitorColNames.includes('photo_url')) {
      console.log('Migrating: Adding photo_url to visitors');
      await connection.query("ALTER TABLE visitors ADD COLUMN photo_url TEXT AFTER mobile");
    }

  } catch (error) {
    console.warn('Migration check failed (might be first run):', error.message);
  }
};

async function initializeDatabase() {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    let host = 'localhost', port = 3306, user = 'root', password = '', database = 'society_management';

    if (process.env.DATABASE_URL) {
      const dbUrl = new URL(process.env.DATABASE_URL);
      host = dbUrl.hostname;
      port = Number(dbUrl.port) || 3306;
      user = decodeURIComponent(dbUrl.username);
      password = decodeURIComponent(dbUrl.password);
      database = decodeURIComponent(dbUrl.pathname.replace(/^\//, ''));
    } else {
      host = process.env.DB_HOST || 'localhost';
      port = Number(process.env.DB_PORT || 3306);
      user = process.env.DB_USER || 'root';
      password = process.env.DB_PASSWORD || '';
      database = process.env.DB_NAME || 'society_management';
    }

    const adminConnection = await mysql.createConnection({ host, port, user, password, multipleStatements: true });
    await adminConnection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
    await adminConnection.end();

    pool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      multipleStatements: true,
    });

    const connection = await pool.getConnection();
    try {
      await executeSchema(connection);
      console.log('Connected to MySQL and initialized schema');
    } finally {
      connection.release();
    }
  })();

  return initPromise;
}

module.exports = {
  initializeDatabase,
  query: async (sql, params = []) => {
    await initializeDatabase();
    const normalizedSql = normalizeSql(sql);
    console.log('Executing query:', { sql: normalizedSql, params });
    const [result] = await pool.query(normalizedSql, params);

    if (Array.isArray(result)) {
      return { rows: result };
    }

    return {
      rows: [],
      insertId: result.insertId,
      affectedRows: result.affectedRows,
    };
  },
};
