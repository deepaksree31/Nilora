const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const cfg = require('../config');
const { redis } = require('./clients');

// Roles: guest (anonymous, no login), user, admin. sub looks like g_xxx / u_12 / a_3.
const issueAccess = (role, sub, ttl) => jwt.sign({ role, sub }, cfg.jwtSecret, { algorithm: 'HS256', expiresIn: ttl });

function requireRole(...roles) {
  return (req, res, next) => {
    const h = req.headers.authorization || '';
    let p;
    try { p = jwt.verify(h.startsWith('Bearer ') ? h.slice(7) : '', cfg.jwtSecret, { algorithms: ['HS256'] }); }
    catch (err) { return res.status(401).json({ error: 'Token missing or expired.', code: 'TOKEN_INVALID' }); }
    if (!roles.includes(p.role)) {
      if (p.role === 'guest') return res.status(401).json({ error: 'Please log in to do this.', code: 'LOGIN_REQUIRED' });
      return res.status(403).json({ error: 'Not allowed.', code: 'FORBIDDEN' });
    }
    req.auth = p;
    next();
  };
}

const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const userId = req => Number(String(req.auth.sub).slice(2));

async function issueUserTokens(user) {
  const refreshToken = crypto.randomBytes(32).toString('hex');
  await redis.set('rt:' + sha(refreshToken), String(user.id), 'EX', cfg.ttl.refreshDays * 86400);
  return {
    accessToken: issueAccess('user', 'u_' + user.id, cfg.ttl.access),
    refreshToken, expiresIn: cfg.ttl.access,
    user: { id: user.id, name: user.name, email: user.email },
  };
}
module.exports = { issueAccess, requireRole, issueUserTokens, sha, userId };
