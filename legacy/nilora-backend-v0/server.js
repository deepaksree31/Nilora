require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const mysql = require('mysql2/promise');
const nodemailer = require('nodemailer');

const {
  PORT = 3000, DB_HOST, DB_USER, DB_PASSWORD, DB_NAME,
  JWT_SECRET, FRONTEND_ORIGIN = '*',
  SMTP_HOST, SMTP_PORT = 465, SMTP_USER, SMTP_PASS, MAIL_FROM,
} = process.env;

if (!JWT_SECRET || JWT_SECRET.length < 24) { console.error('Set a long JWT_SECRET in .env'); process.exit(1); }

/* ---------------- database ---------------- */
const db = mysql.createPool({
  host: DB_HOST, user: DB_USER, password: DB_PASSWORD, database: DB_NAME,
  waitForConnections: true, connectionLimit: 10, charset: 'utf8mb4',
});

/* ---------------- uploads folders ---------------- */
const UP = path.join(__dirname, 'uploads');
['audio', 'covers', 'artists', 'categories'].forEach(d => fs.mkdirSync(path.join(UP, d), { recursive: true }));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(UP, file.fieldname === 'audio' ? 'audio' : req.imgDir || 'covers')),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1e6) + path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '')),
});
const upload = multer({
  storage,
  limits: { fileSize: 60 * 1024 * 1024 }, // 60 MB per file
  fileFilter: (req, file, cb) => {
    const ok = file.fieldname === 'audio' ? /^audio\//.test(file.mimetype) : /^image\//.test(file.mimetype);
    cb(ok ? null : new Error('Wrong file type for ' + file.fieldname), ok);
  },
});
const rmFile = rel => { if (rel) fs.unlink(path.join(UP, rel), () => {}); };
const rel = f => (f ? path.relative(UP, f.path).split(path.sep).join('/') : null);

/* ---------------- app ---------------- */
const app = express();
app.use(cors({ origin: FRONTEND_ORIGIN === '*' ? true : FRONTEND_ORIGIN.split(',') }));
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(UP, { maxAge: '7d' })); // supports Range requests -> audio seeking works

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts. Try again later.' } });
const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);

/* ---------------- helpers ---------------- */
const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const pwOk = p => typeof p === 'string' && p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);
const genCode = () => String(Math.floor(100000 + Math.random() * 900000));
const sign = (payload, exp = '30d') => jwt.sign(payload, JWT_SECRET, { expiresIn: exp });

const mailer = SMTP_HOST && SMTP_USER ? nodemailer.createTransport({
  host: SMTP_HOST, port: Number(SMTP_PORT), secure: Number(SMTP_PORT) === 465, auth: { user: SMTP_USER, pass: SMTP_PASS },
}) : null;

async function sendCodeMail(to, code, purpose) {
  if (!mailer) { console.log(`[DEV] SMTP not set. Code for ${to}: ${code}`); return; }
  const what = purpose === 'reset' ? 'reset your password' : 'verify your email';
  await mailer.sendMail({
    from: MAIL_FROM || SMTP_USER, to,
    subject: `NILORA code: ${code}`,
    text: `Use this code to ${what}: ${code}\nIt expires in 10 minutes. If you did not ask for it, ignore this email.`,
  });
}

async function issueOtp(email, purpose, extra = {}) {
  await db.query('DELETE FROM email_otps WHERE email=? AND purpose=?', [email, purpose]);
  const code = genCode();
  await db.query(
    `INSERT INTO email_otps (email,purpose,code_hash,pending_name,pending_hash,expires_at)
     VALUES (?,?,?,?,?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
    [email, purpose, await bcrypt.hash(code, 8), extra.name || null, extra.hash || null]);
  await sendCodeMail(email, code, purpose);
}

// returns the OTP row if code is right, else throws a friendly error
async function checkOtp(email, purpose, code) {
  const [[row]] = await db.query('SELECT * FROM email_otps WHERE email=? AND purpose=? AND expires_at>NOW() ORDER BY id DESC LIMIT 1', [email, purpose]);
  if (!row) throw Object.assign(new Error('This code is invalid or has expired. Request a new one.'), { status: 400 });
  if (row.attempts >= 5) throw Object.assign(new Error('Too many wrong attempts. Request a new code.'), { status: 429 });
  if (!(await bcrypt.compare(String(code || ''), row.code_hash))) {
    await db.query('UPDATE email_otps SET attempts=attempts+1 WHERE id=?', [row.id]);
    throw Object.assign(new Error('That code is incorrect.'), { status: 400 });
  }
  await db.query('DELETE FROM email_otps WHERE id=?', [row.id]);
  return row;
}

const userAuth = (req, res, next) => {
  try { const t = (req.headers.authorization || '').replace('Bearer ', ''); const p = jwt.verify(t, JWT_SECRET); if (p.role !== 'user') throw 0; req.user = p; next(); }
  catch { res.status(401).json({ error: 'Please log in.' }); }
};
const adminAuth = (req, res, next) => {
  try { const t = (req.headers.authorization || '').replace('Bearer ', ''); const p = jwt.verify(t, JWT_SECRET); if (p.role !== 'admin') throw 0; req.admin = p; next(); }
  catch { res.status(401).json({ error: 'Admin login required.' }); }
};

/* =====================================================================
   AUTH  (users)
   ===================================================================== */
// 1) signup -> saves nothing permanent yet, emails a 6-digit code
app.post('/api/auth/signup', authLimiter, wrap(async (req, res) => {
  const name = String(req.body.name || '').trim(), email = String(req.body.email || '').trim().toLowerCase(), pw = req.body.password;
  if (name.length < 2) return res.status(400).json({ error: 'Enter your full name.' });
  if (!EMAIL_RX.test(email) || email.length > 254) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (!pwOk(pw)) return res.status(400).json({ error: 'Password needs 8+ characters with letters and numbers.' });
  const [[ex]] = await db.query('SELECT id FROM users WHERE email=?', [email]);
  if (ex) return res.status(409).json({ error: 'An account with this email already exists. Log in instead.' });
  await issueOtp(email, 'verify', { name, hash: await bcrypt.hash(pw, 10) });
  res.json({ ok: true });
}));

// 2) verify code -> creates the user row, returns login token
app.post('/api/auth/verify', authLimiter, wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const row = await checkOtp(email, 'verify', req.body.code);
  const [r] = await db.query('INSERT INTO users (name,email,password_hash,email_verified) VALUES (?,?,?,1)', [row.pending_name, email, row.pending_hash]);
  res.json({ token: sign({ role: 'user', id: r.insertId }), user: { id: r.insertId, name: row.pending_name, email } });
}));

app.post('/api/auth/resend', authLimiter, wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const [[old]] = await db.query("SELECT pending_name,pending_hash FROM email_otps WHERE email=? AND purpose='verify' ORDER BY id DESC LIMIT 1", [email]);
  if (!old) return res.status(400).json({ error: 'Session ended. Please sign up again.' });
  await issueOtp(email, 'verify', { name: old.pending_name, hash: old.pending_hash });
  res.json({ ok: true });
}));

app.post('/api/auth/login', authLimiter, wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase(), pw = String(req.body.password || '');
  const [[u]] = await db.query('SELECT * FROM users WHERE email=?', [email]);
  if (!u || !(await bcrypt.compare(pw, u.password_hash))) return res.status(401).json({ error: 'Incorrect email or password.' });
  res.json({ token: sign({ role: 'user', id: u.id }), user: { id: u.id, name: u.name, email: u.email } });
}));

// forgot password
app.post('/api/auth/forgot', authLimiter, wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const [[u]] = await db.query('SELECT id FROM users WHERE email=?', [email]);
  if (u) await issueOtp(email, 'reset');
  res.json({ ok: true }); // same answer either way (does not reveal which emails exist)
}));
app.post('/api/auth/reset', authLimiter, wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!pwOk(req.body.password)) return res.status(400).json({ error: 'Password needs 8+ characters with letters and numbers.' });
  await checkOtp(email, 'reset', req.body.code);
  await db.query('UPDATE users SET password_hash=? WHERE email=?', [await bcrypt.hash(req.body.password, 10), email]);
  res.json({ ok: true });
}));

app.get('/api/me', userAuth, wrap(async (req, res) => {
  const [[u]] = await db.query('SELECT id,name,email FROM users WHERE id=?', [req.user.id]);
  if (!u) return res.status(401).json({ error: 'Account not found.' });
  const [likes] = await db.query('SELECT song_id FROM user_likes WHERE user_id=?', [u.id]);
  const [dls] = await db.query('SELECT song_id FROM user_downloads WHERE user_id=?', [u.id]);
  const [hist] = await db.query('SELECT song_id FROM play_history WHERE user_id=? GROUP BY song_id ORDER BY MAX(played_at) DESC LIMIT 12', [u.id]);
  res.json({ user: u, likes: likes.map(x => x.song_id), downloads: dls.map(x => x.song_id), history: hist.map(x => x.song_id) });
}));
app.put('/api/me', userAuth, wrap(async (req, res) => {
  const n = String(req.body.name || '').trim(); if (n.length < 2) return res.status(400).json({ error: 'Enter a name.' });
  await db.query('UPDATE users SET name=? WHERE id=?', [n.slice(0, 80), req.user.id]); res.json({ ok: true });
}));

/* =====================================================================
   MUSIC  (public read)
   ===================================================================== */
async function loadSongs(includeHidden) {
  const [songs] = await db.query(`SELECT * FROM songs ${includeHidden ? '' : 'WHERE is_hidden=0'} ORDER BY id`);
  const [sa] = await db.query('SELECT sa.song_id, a.name, a.type FROM song_artists sa JOIN artists a ON a.id=sa.artist_id');
  const [sc] = await db.query(`SELECT sc.song_id, c.name cat, s.name sub FROM song_categories sc
    JOIN categories c ON c.id=sc.category_id LEFT JOIN subcategories s ON s.id=sc.subcategory_id`);
  return songs.map(s => {
    const as = sa.filter(x => x.song_id === s.id), cs = sc.filter(x => x.song_id === s.id);
    const by = t => (as.find(x => x.type === t) || {}).name || '';
    return {
      id: s.id, title: s.title, album: s.album, len: s.duration_sec, c: s.bg_color, e: s.logo, lc: s.logo_color || '',
      hid: !!s.is_hidden,
      artist: as.map(x => x.name).join(', '), am: by('male'), af: by('female'), ao: by('music'),
      cats: cs.map(x => x.sub ? `${x.cat} › ${x.sub}` : x.cat), cat: cs.length ? cs[0].cat : '',
      coverUrl: s.cover_path ? '/uploads/' + s.cover_path : '', audioUrl: s.audio_path ? '/uploads/' + s.audio_path : '',
    };
  });
}
app.get('/api/songs', wrap(async (req, res) => res.json(await loadSongs(false))));

app.get('/api/library', wrap(async (req, res) => {
  const [cats] = await db.query('SELECT * FROM categories ORDER BY sort_order,id');
  const [subs] = await db.query('SELECT * FROM subcategories ORDER BY id');
  const [artists] = await db.query('SELECT * FROM artists ORDER BY name');
  res.json({
    categories: cats.map(c => ({ id: c.id, name: c.name, color: c.bg_color, img: c.image_path ? '/uploads/' + c.image_path : '', subs: subs.filter(s => s.category_id === c.id).map(s => s.name) })),
    artists: artists.map(a => ({ id: a.id, name: a.name, ty: a.type, img: a.image_path ? '/uploads/' + a.image_path : '' })),
  });
}));

/* user activity */
app.post('/api/songs/:id/like', userAuth, wrap(async (req, res) => {
  await db.query('INSERT IGNORE INTO user_likes (user_id,song_id) VALUES (?,?)', [req.user.id, req.params.id]); res.json({ ok: true });
}));
app.delete('/api/songs/:id/like', userAuth, wrap(async (req, res) => {
  await db.query('DELETE FROM user_likes WHERE user_id=? AND song_id=?', [req.user.id, req.params.id]); res.json({ ok: true });
}));
app.post('/api/songs/:id/play', userAuth, wrap(async (req, res) => {
  await db.query('INSERT INTO play_history (user_id,song_id) VALUES (?,?)', [req.user.id, req.params.id]); res.json({ ok: true });
}));
app.post('/api/songs/:id/download', userAuth, wrap(async (req, res) => {
  await db.query('INSERT IGNORE INTO user_downloads (user_id,song_id) VALUES (?,?)', [req.user.id, req.params.id]); res.json({ ok: true });
}));

/* =====================================================================
   ADMIN
   ===================================================================== */
app.post('/api/admin/login', authLimiter, wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const [[a]] = await db.query('SELECT * FROM admins WHERE email=?', [email]);
  if (!a || !(await bcrypt.compare(String(req.body.password || ''), a.password_hash))) return res.status(401).json({ error: 'Wrong admin email or password.' });
  res.json({ token: sign({ role: 'admin', id: a.id }, '12h') });
}));
app.post('/api/admin/password', adminAuth, wrap(async (req, res) => {
  const [[a]] = await db.query('SELECT * FROM admins WHERE id=?', [req.admin.id]);
  if (!(await bcrypt.compare(String(req.body.current || ''), a.password_hash))) return res.status(400).json({ error: 'Current password is incorrect.' });
  if (!pwOk(req.body.password)) return res.status(400).json({ error: 'New password needs 8+ characters with letters and numbers.' });
  await db.query('UPDATE admins SET password_hash=? WHERE id=?', [await bcrypt.hash(req.body.password, 10), a.id]);
  res.json({ ok: true });
}));

app.get('/api/admin/songs', adminAuth, wrap(async (req, res) => res.json(await loadSongs(true))));
app.get('/api/admin/users', adminAuth, wrap(async (req, res) => {
  const [u] = await db.query('SELECT id,name,email,email_verified,created_at FROM users ORDER BY id DESC'); res.json(u);
}));

/* ---- artist/category helpers ---- */
async function artistId(conn, name, type) {
  name = String(name || '').trim(); if (!name) return null;
  const [[ex]] = await conn.query('SELECT id FROM artists WHERE name=?', [name]);
  if (ex) return ex.id;
  const [r] = await conn.query('INSERT INTO artists (name,type) VALUES (?,?)', [name, type]); return r.insertId;
}
async function catIds(conn, label) { // "Chill" or "Chill › Lo-fi"
  const [cn, sn] = String(label).split(' › ');
  let [[c]] = await conn.query('SELECT id FROM categories WHERE name=?', [cn]);
  if (!c) { const [r] = await conn.query('INSERT INTO categories (name) VALUES (?)', [cn.slice(0, 30)]); c = { id: r.insertId }; }
  let sid = 0;
  if (sn) {
    let [[s]] = await conn.query('SELECT id FROM subcategories WHERE category_id=? AND name=?', [c.id, sn]);
    if (!s) { const [r] = await conn.query('INSERT INTO subcategories (category_id,name) VALUES (?,?)', [c.id, sn.slice(0, 30)]); s = { id: r.insertId }; }
    sid = s.id;
  }
  return [c.id, sid];
}

/* ---- songs: add / update / hide / delete ---- */
const songFiles = (req, res, next) => { req.imgDir = 'covers'; upload.fields([{ name: 'cover', maxCount: 1 }, { name: 'audio', maxCount: 1 }])(req, res, next); };

async function saveSong(req, res, id) {
  const b = req.body, f = req.files || {};
  const cover = f.cover && f.cover[0], audio = f.audio && f.audio[0];
  const title = String(b.title || '').trim();
  const cats = JSON.parse(b.cats || '[]');
  const artistsIn = [[b.am, 'male'], [b.af, 'female'], [b.ao, 'music']].filter(x => String(x[0] || '').trim());
  if (!title || !artistsIn.length) { [cover, audio].forEach(x => x && rmFile(rel(x))); return res.status(400).json({ error: 'Song title and at least one artist are required.' }); }
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    let oldCover = null, oldAudio = null;
    if (id) {
      const [[old]] = await conn.query('SELECT cover_path,audio_path FROM songs WHERE id=?', [id]);
      if (!old) { await conn.rollback(); return res.status(404).json({ error: 'Song not found.' }); }
      oldCover = old.cover_path; oldAudio = old.audio_path;
      await conn.query(
        `UPDATE songs SET title=?,album=?,duration_sec=?,bg_color=?,logo=?,logo_color=?,
          cover_path=COALESCE(?,cover_path), audio_path=COALESCE(?,audio_path), audio_mime=COALESCE(?,audio_mime), audio_size=COALESCE(?,audio_size) WHERE id=?`,
        [title, b.album || 'Single', +b.len || 180, b.c || null, b.e || '♪', b.lc || null, rel(cover), rel(audio), audio ? audio.mimetype : null, audio ? audio.size : null, id]);
    } else {
      const [r] = await conn.query(
        `INSERT INTO songs (title,album,duration_sec,bg_color,logo,logo_color,cover_path,audio_path,audio_mime,audio_size) VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [title, b.album || 'Single', +b.len || 180, b.c || null, b.e || '♪', b.lc || null, rel(cover), rel(audio), audio ? audio.mimetype : null, audio ? audio.size : null]);
      id = r.insertId;
    }
    await conn.query('DELETE FROM song_artists WHERE song_id=?', [id]);
    for (const [n, t] of artistsIn) { const aid = await artistId(conn, n, t); await conn.query('INSERT IGNORE INTO song_artists VALUES (?,?)', [id, aid]); }
    await conn.query('DELETE FROM song_categories WHERE song_id=?', [id]);
    for (const label of cats) { const [c, s] = await catIds(conn, label); await conn.query('INSERT IGNORE INTO song_categories VALUES (?,?,?)', [id, c, s]); }
    await conn.commit();
    if (cover && oldCover) rmFile(oldCover);
    if (audio && oldAudio) rmFile(oldAudio);
    res.json({ ok: true, id });
  } catch (e) { await conn.rollback(); [cover, audio].forEach(x => x && rmFile(rel(x))); throw e; }
  finally { conn.release(); }
}
app.post('/api/admin/songs', adminAuth, songFiles, wrap((req, res) => saveSong(req, res, null)));
app.put('/api/admin/songs/:id', adminAuth, songFiles, wrap((req, res) => saveSong(req, res, +req.params.id)));
app.patch('/api/admin/songs/:id/hidden', adminAuth, wrap(async (req, res) => {
  await db.query('UPDATE songs SET is_hidden=? WHERE id=?', [req.body.hidden ? 1 : 0, req.params.id]); res.json({ ok: true });
}));
app.delete('/api/admin/songs/:id', adminAuth, wrap(async (req, res) => {
  const [[s]] = await db.query('SELECT cover_path,audio_path FROM songs WHERE id=?', [req.params.id]);
  await db.query('DELETE FROM songs WHERE id=?', [req.params.id]);
  if (s) { rmFile(s.cover_path); rmFile(s.audio_path); }
  res.json({ ok: true });
}));

/* ---- artists ---- */
const artistFile = (req, res, next) => { req.imgDir = 'artists'; upload.single('image')(req, res, next); };
app.post('/api/admin/artists', adminAuth, artistFile, wrap(async (req, res) => {
  const name = String(req.body.name || '').trim(), type = req.body.type;
  if (!name || !['male', 'female', 'music'].includes(type)) { rmFile(rel(req.file)); return res.status(400).json({ error: 'Name and type are required.' }); }
  const [[ex]] = await db.query('SELECT id,image_path FROM artists WHERE name=?', [name]);
  if (ex) { // existing artist (maybe from a song): update type/image
    await db.query('UPDATE artists SET type=?, image_path=COALESCE(?,image_path) WHERE id=?', [type, rel(req.file), ex.id]);
    if (req.file && ex.image_path) rmFile(ex.image_path);
    return res.json({ ok: true, id: ex.id });
  }
  const [r] = await db.query('INSERT INTO artists (name,type,image_path) VALUES (?,?,?)', [name, type, rel(req.file)]); res.json({ ok: true, id: r.insertId });
}));
app.put('/api/admin/artists/:id', adminAuth, artistFile, wrap(async (req, res) => {
  const [[ex]] = await db.query('SELECT image_path FROM artists WHERE id=?', [req.params.id]);
  if (!ex) return res.status(404).json({ error: 'Artist not found.' });
  await db.query('UPDATE artists SET name=COALESCE(?,name), type=COALESCE(?,type), image_path=COALESCE(?,image_path) WHERE id=?',
    [req.body.name ? String(req.body.name).trim() : null, req.body.type || null, rel(req.file), req.params.id]);
  if (req.file && ex.image_path) rmFile(ex.image_path);
  res.json({ ok: true });
}));
app.delete('/api/admin/artists/:id', adminAuth, wrap(async (req, res) => {
  const [[a]] = await db.query('SELECT image_path FROM artists WHERE id=?', [req.params.id]);
  await db.query('DELETE FROM artists WHERE id=?', [req.params.id]); if (a) rmFile(a.image_path); res.json({ ok: true });
}));

/* ---- categories & subcategories ---- */
const catFile = (req, res, next) => { req.imgDir = 'categories'; upload.single('image')(req, res, next); };
app.post('/api/admin/categories', adminAuth, catFile, wrap(async (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 30);
  if (!name) { rmFile(rel(req.file)); return res.status(400).json({ error: 'Enter a name.' }); }
  try { const [r] = await db.query('INSERT INTO categories (name,bg_color,image_path,sort_order) VALUES (?,?,?,(SELECT COALESCE(MAX(sort_order),0)+1 FROM (SELECT sort_order FROM categories) t))', [name, req.body.color || null, rel(req.file)]); res.json({ ok: true, id: r.insertId }); }
  catch (e) { rmFile(rel(req.file)); if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Category already exists.' }); throw e; }
}));
app.put('/api/admin/categories/:id', adminAuth, catFile, wrap(async (req, res) => {
  const [[ex]] = await db.query('SELECT image_path FROM categories WHERE id=?', [req.params.id]);
  if (!ex) return res.status(404).json({ error: 'Category not found.' });
  await db.query('UPDATE categories SET name=COALESCE(?,name), bg_color=COALESCE(?,bg_color), image_path=COALESCE(?,image_path) WHERE id=?',
    [req.body.name ? String(req.body.name).trim().slice(0, 30) : null, req.body.color || null, rel(req.file), req.params.id]);
  if (req.file && ex.image_path) rmFile(ex.image_path);
  res.json({ ok: true });
}));
app.delete('/api/admin/categories/:id', adminAuth, wrap(async (req, res) => {
  const [[c]] = await db.query('SELECT image_path FROM categories WHERE id=?', [req.params.id]);
  await db.query('DELETE FROM subcategories WHERE category_id=?', [req.params.id]);
  await db.query('DELETE FROM categories WHERE id=?', [req.params.id]); if (c) rmFile(c.image_path); res.json({ ok: true });
}));
app.post('/api/admin/categories/:id/subs', adminAuth, wrap(async (req, res) => {
  const n = String(req.body.name || '').trim().slice(0, 30); if (!n || n.includes('›')) return res.status(400).json({ error: 'Invalid name.' });
  await db.query('INSERT IGNORE INTO subcategories (category_id,name) VALUES (?,?)', [req.params.id, n]); res.json({ ok: true });
}));
app.delete('/api/admin/subs/:id', adminAuth, wrap(async (req, res) => {
  await db.query('DELETE FROM song_categories WHERE subcategory_id=?', [req.params.id]);
  await db.query('DELETE FROM subcategories WHERE id=?', [req.params.id]); res.json({ ok: true });
}));

/* ---------------- serve your HTML too (optional) ---------------- */
app.use(express.static(path.join(__dirname, 'public'))); // put NILORA.html inside /public and rename to index.html

/* ---------------- errors ---------------- */
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || /Wrong file type/.test(err.message)) return res.status(400).json({ error: err.message });
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error(err); res.status(500).json({ error: 'Server error. Try again.' });
});

db.query('SELECT 1').then(() => app.listen(PORT, () => console.log(`NILORA server running → http://localhost:${PORT}`)))
  .catch(e => { console.error('Cannot connect to MySQL:', e.message); process.exit(1); });
