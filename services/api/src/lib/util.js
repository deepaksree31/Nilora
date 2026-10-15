const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const pwOk = p => typeof p === 'string' && p.length >= 8 && p.length <= 100 && /[A-Za-z]/.test(p) && /\d/.test(p);
const httpError = (status, message, code) => Object.assign(new Error(message), { status, code });
module.exports = { wrap, EMAIL_RX, pwOk, httpError };
