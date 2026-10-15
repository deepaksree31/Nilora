// Usage (inside the running stack):
//   docker compose exec api node src/scripts/create-admin.js admin@example.com "StrongPass123"
const bcrypt = require('bcryptjs');
const { db } = require('../lib/clients');
const { EMAIL_RX, pwOk } = require('../lib/util');
(async () => {
  const [email, pw] = process.argv.slice(2);
  if (!email || !EMAIL_RX.test(email) || !pwOk(pw)) { console.log('Usage: node src/scripts/create-admin.js <email> <password: 8+ chars, letters and numbers>'); process.exit(1); }
  await db.query('INSERT INTO admins (email,password_hash) VALUES (?,?) ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash)', [email.toLowerCase(), await bcrypt.hash(pw, 10)]);
  console.log('Admin saved:', email.toLowerCase());
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
