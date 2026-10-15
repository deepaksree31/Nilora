const router = require('express').Router();
const bcrypt = require('bcryptjs');
const multer = require('multer');
const os = require('os');
const fs = require('fs');
const cfg = require('../config');
const { db, minio } = require('../lib/clients');
const { issueAccess, requireRole } = require('../lib/auth');
const limit = require('../lib/limit');
const { hydrate } = require('../lib/songs');
const { wrap, httpError, EMAIL_RX, pwOk } = require('../lib/util');

// ---- admin login (separate admins table, 12-hour token) ----
router.post('/login', limit('admin-login', 10, 900), wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const [[a]] = await db.query('SELECT * FROM admins WHERE email=?', [email]);
  if (!a || !(await bcrypt.compare(String(req.body.password || ''), a.password_hash))) throw httpError(401, 'Wrong admin email or password.', 'BAD_CREDENTIALS');
  res.json({ accessToken: issueAccess('admin', 'a_' + a.id, 12 * 3600), expiresIn: 12 * 3600 });
}));

const admin = requireRole('admin');
router.use(admin);

router.post('/password', wrap(async (req, res) => {
  const id = Number(String(req.auth.sub).slice(2));
  const [[a]] = await db.query('SELECT * FROM admins WHERE id=?', [id]);
  if (!a || !(await bcrypt.compare(String(req.body.current || ''), a.password_hash))) throw httpError(400, 'Current password is incorrect.');
  if (!pwOk(req.body.password)) throw httpError(400, 'New password needs 8+ characters with letters and numbers.');
  await db.query('UPDATE admins SET password_hash=? WHERE id=?', [await bcrypt.hash(req.body.password, 10), id]);
  res.json({ ok: true });
}));

router.get('/songs', wrap(async (req, res) => {
  const [rows] = await db.query('SELECT * FROM songs ORDER BY id DESC');
  res.json({ songs: await hydrate(rows, { admin: true }) });
}));

router.get('/users', wrap(async (req, res) => {
  const [u] = await db.query('SELECT id,name,email,created_at FROM users ORDER BY id DESC LIMIT 500');
  res.json({ users: u });
}));

// ---- uploads: temp file on disk, then copied into the private MinIO buckets ----
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 100 * 1024 * 1024, files: 2 },
  fileFilter: (req, f, cb) => {
    const ok = (f.fieldname === 'audio' && /^audio\//.test(f.mimetype)) || (f.fieldname === 'cover' && /^image\//.test(f.mimetype));
    cb(ok ? null : httpError(400, `Wrong file type for "${f.fieldname}".`), ok);
  },
}).fields([{ name: 'audio', maxCount: 1 }, { name: 'cover', maxCount: 1 }]);

async function artistId(conn, name, type) {
  const [[ex]] = await conn.query('SELECT id FROM artists WHERE name=?', [name]);
  if (ex) return ex.id;
  const [r] = await conn.query('INSERT INTO artists (name,type) VALUES (?,?)', [name, type]);
  return r.insertId;
}
async function categoryIds(conn, label) { // "Chill" or "Chill › Lo-fi"
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
const color = v => (/^#[0-9a-fA-F]{6}$/.test(String(v || '')) ? v : null);

async function saveSong(req, res, existingId) {
  const f = req.files || {};
  const audio = f.audio && f.audio[0], cover = f.cover && f.cover[0];
  const cleanTmp = () => [audio, cover].forEach(x => x && fs.unlink(x.path, () => {}));
  try {
    const b = req.body;
    const title = String(b.title || '').trim().slice(0, 150);
    const artistsIn = [[b.male, 'male'], [b.female, 'female'], [b.music, 'music']]
      .map(([n, t]) => [String(n || '').trim().slice(0, 60), t]).filter(([n]) => n);
    let cats = [];
    try { cats = JSON.parse(b.categories || '[]'); if (!Array.isArray(cats)) cats = []; } catch (err) { throw httpError(400, 'categories must be a JSON list.'); }
    if (!title || !artistsIn.length) throw httpError(400, 'Song title and at least one artist (male, female or music) are required.');
    if (!existingId && !audio) throw httpError(400, 'An audio file is required for a new song.');

    const conn = await db.getConnection();
    let id = existingId;
    try {
      await conn.beginTransaction();
      const vals = [title, String(b.album || 'Single').slice(0, 150), Number(b.durationSec) > 0 ? Math.round(Number(b.durationSec)) : 180,
        color(b.bgColor), String(b.logo || '♪').slice(0, 16), color(b.logoColor)];
      if (existingId) {
        const [r] = await conn.query('UPDATE songs SET title=?,album=?,duration_sec=?,bg_color=?,logo=?,logo_color=? WHERE id=?', [...vals, existingId]);
        if (!r.affectedRows) throw httpError(404, 'Song not found.');
      } else {
        const [r] = await conn.query('INSERT INTO songs (title,album,duration_sec,bg_color,logo,logo_color) VALUES (?,?,?,?,?,?)', vals);
        id = r.insertId;
      }
      await conn.query('DELETE FROM song_artists WHERE song_id=?', [id]);
      for (const [n, t] of artistsIn) await conn.query('INSERT IGNORE INTO song_artists VALUES (?,?)', [id, await artistId(conn, n, t)]);
      await conn.query('DELETE FROM song_categories WHERE song_id=?', [id]);
      for (const label of cats.slice(0, 20)) { const [c, s] = await categoryIds(conn, label); await conn.query('INSERT IGNORE INTO song_categories VALUES (?,?,?)', [id, c, s]); }
      await conn.commit();
    } catch (err) { await conn.rollback(); throw err; } finally { conn.release(); }

    try {
      if (audio) {
        await minio.fPutObject(cfg.audioBucket, `audio/${id}/original`, audio.path, { 'Content-Type': audio.mimetype });
        await db.query('UPDATE songs SET audio_key=?,audio_mime=?,audio_size=? WHERE id=?', [`audio/${id}/original`, audio.mimetype, audio.size, id]);
      }
      if (cover) {
        await minio.fPutObject(cfg.imageBucket, `images/${id}/cover`, cover.path, { 'Content-Type': cover.mimetype });
        await db.query('UPDATE songs SET cover_key=? WHERE id=?', [`images/${id}/cover`, id]);
      }
    } catch (err) {
      if (!existingId) await db.query('DELETE FROM songs WHERE id=?', [id]).catch(() => {}); // no half-created songs
      throw err;
    }
    res.json({ ok: true, id });
  } finally { cleanTmp(); }
}

router.post('/songs', upload, wrap((req, res) => saveSong(req, res, null)));
router.put('/songs/:id(\\d+)', upload, wrap((req, res) => saveSong(req, res, Number(req.params.id))));

router.patch('/songs/:id(\\d+)/hidden', wrap(async (req, res) => {
  await db.query('UPDATE songs SET is_hidden=? WHERE id=?', [req.body.hidden ? 1 : 0, req.params.id]);
  res.json({ ok: true });
}));

router.delete('/songs/:id(\\d+)', wrap(async (req, res) => {
  const id = req.params.id;
  await db.query('DELETE FROM songs WHERE id=?', [id]);
  await minio.removeObject(cfg.audioBucket, `audio/${id}/original`).catch(() => {});
  await minio.removeObject(cfg.imageBucket, `images/${id}/cover`).catch(() => {});
  res.json({ ok: true });
}));

module.exports = router;
