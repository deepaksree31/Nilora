// Parses an HTTP Range header for one byte range.
// Returns null (no/ignored range -> send whole file), 'invalid' (-> 416), or {start, end} (inclusive).
function parseRange(header, size) {
  if (!header) return null;
  const h = String(header).trim();
  if (h.includes(',')) return null; // multi-range: ignore, send the whole file
  const m = /^bytes=(\d*)-(\d*)$/.exec(h);
  if (!m) return 'invalid';
  const a = m[1], b = m[2];
  if (a === '' && b === '') return 'invalid';
  let start, end;
  if (a === '') {                       // suffix: last N bytes
    const n = Number(b);
    if (!n) return 'invalid';
    start = Math.max(0, size - n);
    end = size - 1;
  } else {
    start = Number(a);
    end = b === '' ? size - 1 : Math.min(Number(b), size - 1);
  }
  if (start >= size || start > end) return 'invalid';
  return { start, end };
}
module.exports = { parseRange };
