// Usage:  node create-admin.js admin@example.com "YourStrongPassword1"
require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
(async () => {
  const [email, pw] = process.argv.slice(2);
  if (!email || !pw || pw.length < 8) { console.log('Usage: node create-admin.js <email> <password (8+ chars)>'); process.exit(1); }
  const db = await mysql.createConnection({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
  await db.query('INSERT INTO admins (email,password_hash) VALUES (?,?) ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash)', [email.toLowerCase(), await bcrypt.hash(pw, 10)]);
  console.log('Admin saved:', email); await db.end();
})().catch(e => { console.error(e.message); process.exit(1); });
