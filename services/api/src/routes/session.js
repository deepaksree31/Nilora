const router = require('express').Router();
const crypto = require('crypto');
const cfg = require('../config');
const { issueAccess } = require('../lib/auth');
const limit = require('../lib/limit');

// Anyone may ask for a guest token. No login, no personal data. Guests can browse and play, never download.
router.post('/guest', limit('guest', 30, 60), (req, res) => {
  const sub = 'g_' + crypto.randomBytes(9).toString('hex');
  res.json({ accessToken: issueAccess('guest', sub, cfg.ttl.guest), expiresIn: cfg.ttl.guest, role: 'guest' });
});
module.exports = router;
