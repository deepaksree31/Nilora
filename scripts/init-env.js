// Usage: node scripts/init-env.js
// Creates .env from .env.example with random secrets. Never overwrites an existing .env.
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const root = path.join(__dirname, '..');
const target = path.join(root, '.env');
if (fs.existsSync(target)) { console.log('.env already exists - left unchanged.'); process.exit(0); }
const rnd = (n = 24) => crypto.randomBytes(n).toString('base64url');
const fill = {
  MYSQL_ROOT_PASSWORD: rnd(), MYSQL_PASSWORD: rnd(), MINIO_ROOT_PASSWORD: rnd(),
  JWT_SECRET: rnd(48), TICKET_SECRET: rnd(48),
};
let text = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
for (const [k, v] of Object.entries(fill)) text = text.replace(new RegExp('^' + k + '=.*$', 'm'), k + '=' + v);
fs.writeFileSync(target, text, { mode: 0o600 });
console.log('Created .env with fresh random secrets. Keep it private.');
