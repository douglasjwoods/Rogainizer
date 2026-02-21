import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const host = process.env.DB_HOST || 'localhost';
const port = Number(process.env.DB_PORT || 3306);
const user = process.env.DB_USER;
const password = process.env.DB_PASSWORD;

if (!user) {
  console.error('DB_USER is required.');
  process.exit(1);
}

const sqlPath = path.resolve(__dirname, '..', 'sql', 'init.sql');

async function run() {
  const sql = await fs.readFile(sqlPath, 'utf8');

  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
    multipleStatements: true
  });

  try {
    await connection.query(sql);
    console.log(`Successfully executed ${sqlPath}`);
  } finally {
    await connection.end();
  }
}

run().catch((error) => {
  console.error('Failed to execute init.sql');
  console.error(error.message);
  process.exit(1);
});
