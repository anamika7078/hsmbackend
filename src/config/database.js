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
      // Allow idempotent schema bootstrapping across MySQL/MariaDB variants.
      // 1061: duplicate key name, 1062: duplicate entry, 1050: table exists
      if ([1061, 1062, 1050].includes(error.errno)) {
        continue;
      }
      throw error;
    }
  }
};

async function initializeDatabase() {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const host = process.env.DB_HOST || 'localhost';
    const port = Number(process.env.DB_PORT || 3306);
    const user = process.env.DB_USER || 'root';
    const password = process.env.DB_PASSWORD || '';
    const database = process.env.DB_NAME || 'society_management';

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
