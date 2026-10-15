const { redis } = require('./clients');
// Fixed-window rate limit kept in Redis. If Redis is down it lets the request through (fail-open).
module.exports = (name, max, windowSec, keyFn = req => req.ip) => async (req, res, next) => {
  try {
    const k = `rl:${name}:${keyFn(req)}`;
    const n = await redis.incr(k);
    if (n === 1) await redis.expire(k, windowSec);
    if (n > max) return res.status(429).json({ error: 'Too many requests. Slow down.', code: 'RATE_LIMITED' });
  } catch (err) { /* fail-open */ }
  next();
};
