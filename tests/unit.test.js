// Run with:  node --test tests/unit.test.js        (no packages needed)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const apiTicket = require('../services/api/src/lib/ticket');
const streamTicket = require('../services/stream/src/ticket');
const { parseRange } = require('../services/stream/src/range');

const SECRET = 'x'.repeat(32);
const NOW = 1_700_000_000;

test('ticket.js is identical in api and stream', () => {
  const a = fs.readFileSync(path.join(__dirname, '../services/api/src/lib/ticket.js'), 'utf8');
  const b = fs.readFileSync(path.join(__dirname, '../services/stream/src/ticket.js'), 'utf8');
  assert.strictEqual(a, b);
});

test('a ticket signed by api verifies in stream', () => {
  const sig = apiTicket.sign(SECRET, 'play', '7', 'g_abc', NOW + 120);
  assert.strictEqual(streamTicket.verify(SECRET, 'play', '7', { exp: String(NOW + 120), sub: 'g_abc', sig }, NOW), null);
});

test('expired ticket is refused', () => {
  const sig = apiTicket.sign(SECRET, 'play', '7', 'g_abc', NOW - 1);
  assert.strictEqual(streamTicket.verify(SECRET, 'play', '7', { exp: String(NOW - 1), sub: 'g_abc', sig }, NOW), 'expired');
});

test('tampering with song id, kind, sub, exp or signature is refused', () => {
  const exp = NOW + 120;
  const sig = apiTicket.sign(SECRET, 'play', '7', 'g_abc', exp);
  const good = { exp: String(exp), sub: 'g_abc', sig };
  assert.strictEqual(streamTicket.verify(SECRET, 'play', '8', good, NOW), 'invalid');          // other song
  assert.strictEqual(streamTicket.verify(SECRET, 'download', '7', good, NOW), 'invalid');      // play ticket used as download
  assert.strictEqual(streamTicket.verify(SECRET, 'play', '7', { ...good, sub: 'u_1' }, NOW), 'invalid');
  assert.strictEqual(streamTicket.verify(SECRET, 'play', '7', { ...good, exp: String(exp + 9999) }, NOW), 'invalid');
  assert.strictEqual(streamTicket.verify(SECRET, 'play', '7', { ...good, sig: sig.slice(0, -2) + 'AA' }, NOW), 'invalid');
  assert.strictEqual(streamTicket.verify('y'.repeat(32), 'play', '7', good, NOW), 'invalid');   // wrong secret
});

test('missing or garbage fields are refused', () => {
  assert.strictEqual(streamTicket.verify(SECRET, 'play', '7', {}, NOW), 'malformed');
  assert.strictEqual(streamTicket.verify(SECRET, 'play', '7', { exp: 'abc', sub: 's', sig: 'z' }, NOW), 'malformed');
});

test('parseRange handles the cases players send', () => {
  assert.strictEqual(parseRange(undefined, 1000), null);
  assert.deepStrictEqual(parseRange('bytes=0-99', 1000), { start: 0, end: 99 });
  assert.deepStrictEqual(parseRange('bytes=500-', 1000), { start: 500, end: 999 });
  assert.deepStrictEqual(parseRange('bytes=-100', 1000), { start: 900, end: 999 });
  assert.deepStrictEqual(parseRange('bytes=900-5000', 1000), { start: 900, end: 999 });
  assert.strictEqual(parseRange('bytes=1000-', 1000), 'invalid');
  assert.strictEqual(parseRange('bytes=50-10', 1000), 'invalid');
  assert.strictEqual(parseRange('bytes=-', 1000), 'invalid');
  assert.strictEqual(parseRange('items=0-1', 1000), 'invalid');
  assert.strictEqual(parseRange('bytes=0-1,5-6', 1000), null);
});
