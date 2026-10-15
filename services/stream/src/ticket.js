// Signed, short-lived tickets. SAME FILE exists in services/api/src/lib/ticket.js.
// tests/unit.test.js checks that both copies behave identically.
const crypto = require('crypto');

function sign(secret, kind, id, sub, exp) {
  return crypto.createHmac('sha256', secret).update([kind, id, sub, exp].join('.')).digest('base64url');
}

// Returns null when valid, or a short reason string.
function verify(secret, kind, id, query, nowSec = Math.floor(Date.now() / 1000)) {
  const exp = Number(query.exp);
  const sub = String(query.sub || '');
  const sig = String(query.sig || '');
  if (!Number.isInteger(exp) || !sub || !sig) return 'malformed';
  if (exp < nowSec) return 'expired';
  const expected = sign(secret, kind, String(id), sub, exp);
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return 'invalid';
  return null;
}

module.exports = { sign, verify };
