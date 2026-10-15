const router = require('express').Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const cfg = require('../config');
const { db, redis } = require('../lib/clients');
const { issueUserTokens, sha } = require('../lib/auth');
const limit = require('../lib/limit');
const mail = require('../lib/mail');
const { wrap, EMAIL_RX, pwOk, httpError } = require('../lib/util');

const norm = v => String(v || '').trim().toLowerCase();

// 1) signup: nothing is saved permanently yet; a 6-digit code is sent to the email
router.post('/signup', limit('signup', 10, 900), wrap(async (req, res) => {
  const name = String(req.body.name || '').trim(), email = norm(req.body.email), pw = req.body.password;
  if (name.length < 2 || name.length > 80) throw httpError(400, 'Enter your full name.');
  if (!EMAIL_RX.test(email) || email.length > 254) throw httpError(400, 'Enter a valid email address.');
  if (!pwOk(pw)) throw httpError(400, 'Password needs 8+ characters with letters and numbers.');
  const [[ex]] = await db.query('SELECT id FROM users WHERE email=?', [email]);
  if (ex) throw httpError(409, 'An account with this email already exists. Log in instead.');
  const code = String(crypto.randomInt(100000, 1000000));
  await redis.set('otp:verify:' + email, JSON.stringify({ name, pwHash: await bcrypt.hash(pw, 10), codeHash: await bcrypt.hash(code, 8), attempts: 0 }), 'EX', 600);
  await mail.sendCode(email, code);
  res.json({ ok: true, ...(cfg.exposeOtp ? { devCode: code } : {}) });
}));

// 2) verify the code: creates the user and logs them in
router.post('/verify', limit('verify', 20, 900), wrap(async (req, res) => {
  const email = norm(req.body.email), key = 'otp:verify:' + email;
  const raw = await redis.get(key);
  if (!raw) throw httpError(400, 'This code is invalid or has expired. Sign up again.');
  const rec = JSON.parse(raw);
  if (rec.attempts >= 5) { await redis.del(key); throw httpError(429, 'Too many wrong attempts. Sign up again.'); }
  if (!(await bcrypt.compare(String(req.body.code || ''), rec.codeHash))) {
    rec.attempts += 1;
    await redis.set(key, JSON.stringify(rec), 'KEEPTTL');
    throw httpError(400, 'That code is incorrect.');
  }
  await redis.del(key);
  let id;
  try {
    const [r] = await db.query('INSERT INTO users (name,email,password_hash) VALUES (?,?,?)', [rec.name, email, rec.pwHash]);
    id = r.insertId;
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw httpError(409, 'An account with this email already exists.');
    throw err;
  }
  res.json(await issueUserTokens({ id, name: rec.name, email }));
}));

router.post('/login', limit('login', 20, 900), wrap(async (req, res) => {
  const email = norm(req.body.email), pw = String(req.body.password || '');
  const [[u]] = await db.query('SELECT * FROM users WHERE email=?', [email]);
  if (!u || !(await bcrypt.compare(pw, u.password_hash))) throw httpError(401, 'Incorrect email or password.', 'BAD_CREDENTIALS');
  res.json(await issueUserTokens(u));
}));

// refresh tokens rotate: the old one stops working the moment a new one is issued
router.post('/refresh', limit('refresh', 60, 900), wrap(async (req, res) => {
  const token = String(req.body.refreshToken || ''), key = 'rt:' + sha(token);
  const uid = token ? await redis.get(key) : null;
  if (!uid) throw httpError(401, 'Session expired. Please log in again.', 'TOKEN_INVALID');
  await redis.del(key);
  const [[u]] = await db.query('SELECT id,name,email FROM users WHERE id=?', [uid]);
  if (!u) throw httpError(401, 'Account not found.', 'TOKEN_INVALID');
  res.json(await issueUserTokens(u));
}));

router.post('/logout', wrap(async (req, res) => {
  const token = String(req.body.refreshToken || '');
  if (token) await redis.del('rt:' + sha(token));
  res.json({ ok: true });
}));

module.exports = router;
