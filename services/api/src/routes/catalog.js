const router = require('express').Router();
const { db } = require('../lib/clients');
const { requireRole } = require('../lib/auth');
const limit = require('../lib/limit');
const { hydrate } = require('../lib/songs');
const { wrap, httpError } = require('../lib/util');

const anyone = requireRole('guest', 'user', 'admin');
const perSub = limit('catalog', 240, 60, req => req.auth.sub);

// Default home page: standard recommendations for everyone, no login needed.
router.get('/home', anyone, perSub, wrap(async (req, res) => {
  const [latest] = await db.query('SELECT * FROM songs WHERE is_hidden=0 AND audio_key IS NOT NULL ORDER BY id DESC LIMIT 12');
  const sections = [{ title: 'New and fresh', songs: await hydrate(latest) }];
  const [cats] = await db.query('SELECT id,name FROM categories ORDER BY sort_order, id LIMIT 6');
  for (const c of cats) {
    const [rows] = await db.query(`SELECT DISTINCT s.* FROM songs s JOIN song_categories sc ON sc.song_id=s.id
       WHERE sc.category_id=? AND s.is_hidden=0 AND s.audio_key IS NOT NULL ORDER BY s.id DESC LIMIT 10`, [c.id]);
    if (rows.length) sections.push({ title: c.name, songs: await hydrate(rows) });
  }
  res.json({ sections: sections.filter(s => s.songs.length) });
}));

router.get('/songs', anyone, perSub, wrap(async (req, res) => {
  const limitN = Math.min(Number(req.query.limit) || 30, 100), offset = Math.max(Number(req.query.offset) || 0, 0);
  const cat = String(req.query.category || '').trim();
  const [rows] = cat
    ? await db.query(`SELECT DISTINCT s.* FROM songs s JOIN song_categories sc ON sc.song_id=s.id JOIN categories c ON c.id=sc.category_id
        WHERE c.name=? AND s.is_hidden=0 AND s.audio_key IS NOT NULL ORDER BY s.id DESC LIMIT ? OFFSET ?`, [cat, limitN, offset])
    : await db.query('SELECT * FROM songs WHERE is_hidden=0 AND audio_key IS NOT NULL ORDER BY id DESC LIMIT ? OFFSET ?', [limitN, offset]);
  res.json({ songs: await hydrate(rows) });
}));

router.get('/songs/:id(\\d+)', anyone, perSub, wrap(async (req, res) => {
  const [rows] = await db.query('SELECT * FROM songs WHERE id=? AND is_hidden=0', [req.params.id]);
  if (!rows.length) throw httpError(404, 'Song not found.');
  res.json((await hydrate(rows))[0]);
}));

router.get('/search', anyone, perSub, wrap(async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 60);
  if (q.length < 2) return res.json({ songs: [] });
  const like = '%' + q.replace(/[%_]/g, '') + '%';
  const [rows] = await db.query(`SELECT * FROM songs s WHERE s.is_hidden=0 AND s.audio_key IS NOT NULL AND
     (s.title LIKE ? OR s.album LIKE ? OR EXISTS (SELECT 1 FROM song_artists sa JOIN artists a ON a.id=sa.artist_id WHERE sa.song_id=s.id AND a.name LIKE ?))
     ORDER BY s.id DESC LIMIT 40`, [like, like, like]);
  res.json({ songs: await hydrate(rows) });
}));

router.get('/library', anyone, perSub, wrap(async (req, res) => {
  const [cats] = await db.query('SELECT id,name,bg_color FROM categories ORDER BY sort_order,id');
  const [subs] = await db.query('SELECT category_id,name FROM subcategories ORDER BY id');
  const [artists] = await db.query('SELECT id,name,type FROM artists ORDER BY name');
  res.json({
    categories: cats.map(c => ({ id: c.id, name: c.name, color: c.bg_color, subs: subs.filter(s => s.category_id === c.id).map(s => s.name) })),
    artists,
  });
}));

module.exports = router;
