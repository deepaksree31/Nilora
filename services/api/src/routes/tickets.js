const router = require('express').Router();
const cfg = require('../config');
const { db } = require('../lib/clients');
const { requireRole, userId } = require('../lib/auth');
const limit = require('../lib/limit');
const { ticketUrl } = require('../lib/songs');
const { wrap, httpError } = require('../lib/util');

async function findSong(req) {
  const [[s]] = await db.query('SELECT id,audio_key,is_hidden FROM songs WHERE id=?', [req.params.id]);
  if (!s || !s.audio_key || (s.is_hidden && req.auth.role !== 'admin')) throw httpError(404, 'Song not found.');
  return s;
}

// PLAY: guests, users and admins. Returns a signed stream URL valid about 2 minutes.
router.post('/songs/:id(\\d+)/play-ticket',
  requireRole('guest', 'user', 'admin'), limit('play', 120, 60, req => req.auth.sub),
  wrap(async (req, res) => {
    const s = await findSong(req);
    if (req.auth.role === 'user') db.query('INSERT INTO play_history (user_id,song_id) VALUES (?,?)', [userId(req), s.id]).catch(() => {});
    res.json(ticketUrl('play', s.id, req.auth.sub, cfg.ttl.play));
  }));

// DOWNLOAD: logged-in users only. A guest gets 401 LOGIN_REQUIRED, which is the app's cue to show the login prompt.
router.post('/songs/:id(\\d+)/download-ticket',
  requireRole('user', 'admin'), limit('download', 30, 60, req => req.auth.sub),
  wrap(async (req, res) => {
    const s = await findSong(req);
    if (req.auth.role === 'user') await db.query('INSERT IGNORE INTO user_downloads (user_id,song_id) VALUES (?,?)', [userId(req), s.id]);
    res.json(ticketUrl('download', s.id, req.auth.sub, cfg.ttl.download));
  }));

// LIKES and profile: logged-in users only
const user = requireRole('user');
router.post('/songs/:id(\\d+)/like', user, wrap(async (req, res) => {
  await db.query('INSERT IGNORE INTO user_likes (user_id,song_id) VALUES (?,?)', [userId(req), req.params.id]);
  res.json({ ok: true });
}));
router.delete('/songs/:id(\\d+)/like', user, wrap(async (req, res) => {
  await db.query('DELETE FROM user_likes WHERE user_id=? AND song_id=?', [userId(req), req.params.id]);
  res.json({ ok: true });
}));
router.get('/me', user, wrap(async (req, res) => {
  const id = userId(req);
  const [[u]] = await db.query('SELECT id,name,email FROM users WHERE id=?', [id]);
  if (!u) throw httpError(401, 'Account not found.', 'TOKEN_INVALID');
  const [likes] = await db.query('SELECT song_id FROM user_likes WHERE user_id=?', [id]);
  const [dls] = await db.query('SELECT song_id FROM user_downloads WHERE user_id=?', [id]);
  res.json({ user: u, likes: likes.map(x => x.song_id), downloads: dls.map(x => x.song_id) });
}));

module.exports = router;
