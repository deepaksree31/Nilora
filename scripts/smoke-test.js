// End-to-end check of the playback path against a RUNNING stack. Needs Node 20+, no packages.
//   node scripts/smoke-test.js
// Env (optional): API=http://localhost:8080  ADMIN_EMAIL=admin@example.com  ADMIN_PASSWORD=StrongPass123
// Requires DEV_EXPOSE_OTP=true in .env (so the test can read the signup code) and an admin created with:
//   docker compose exec api node src/scripts/create-admin.js admin@example.com StrongPass123
const API = process.env.API || 'http://localhost:8080';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'StrongPass123';
let failed = 0;
const ok = (name, cond, extra = '') => { console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (cond ? '' : '  ' + extra)); if (!cond) failed++; };

function wav(seconds = 3, rate = 8000) { // a small 440 Hz test tone, 16-bit mono
  const n = seconds * rate, buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 440 * i / rate) * 12000), 44 + i * 2);
  return buf;
}
async function j(path, { method = 'GET', token, json, form } = {}) {
  const r = await fetch(API + path, { method, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(json ? { 'Content-Type': 'application/json' } : {}) }, body: form || (json ? JSON.stringify(json) : undefined) });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}

(async () => {
  const tone = wav();
  // 1. admin uploads a song
  const login = await j('/v1/admin/login', { method: 'POST', json: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
  ok('admin login', login.status === 200, JSON.stringify(login.data));
  const A = login.data.accessToken;
  const fd = new FormData();
  fd.append('title', 'Smoke Test Tone'); fd.append('music', 'Test Band'); fd.append('categories', JSON.stringify(['Chill'])); fd.append('durationSec', '3');
  fd.append('audio', new Blob([tone], { type: 'audio/wav' }), 'tone.wav');
  const up = await j('/v1/admin/songs', { method: 'POST', token: A, form: fd });
  ok('admin uploads a song to MinIO', up.status === 200 && up.data.id, JSON.stringify(up.data));
  const id = up.data.id;

  // 2. a guest, with no login, browses and plays
  const g = await j('/v1/session/guest', { method: 'POST' });
  ok('guest session without login', g.status === 200 && g.data.role === 'guest');
  const G = g.data.accessToken;
  ok('catalog needs a token', (await j('/v1/home')).status === 401);
  const home = await j('/v1/home', { token: G });
  ok('guest sees the default home page with the song', home.status === 200 && JSON.stringify(home.data).includes('Smoke Test Tone'));

  const pt = await j(`/v1/songs/${id}/play-ticket`, { method: 'POST', token: G });
  ok('guest gets a play ticket', pt.status === 200 && pt.data.url, JSON.stringify(pt.data));
  const url = pt.data.url;
  const part = await fetch(url, { headers: { Range: 'bytes=0-99' } });
  const body = Buffer.from(await part.arrayBuffer());
  ok('Range request returns 206 with 100 bytes', part.status === 206 && body.length === 100, 'status ' + part.status + ' len ' + body.length);
  ok('Content-Range is correct', part.headers.get('content-range') === `bytes 0-99/${tone.length}`, String(part.headers.get('content-range')));
  const full = await fetch(url);
  ok('full stream returns the whole file', full.status === 200 && Buffer.from(await full.arrayBuffer()).equals(tone));
  ok('seek past the end gives 416', (await fetch(url, { headers: { Range: `bytes=${tone.length + 10}-` } })).status === 416);

  // 3. tampered or wrong tickets are refused
  const u = new URL(url);
  const badSig = new URL(url); badSig.searchParams.set('sig', u.searchParams.get('sig').slice(0, -2) + 'AA');
  ok('tampered signature is refused', (await fetch(badSig)).status === 403);
  const badExp = new URL(url); badExp.searchParams.set('exp', String(Number(u.searchParams.get('exp')) + 5000));
  ok('extended expiry is refused', (await fetch(badExp)).status === 403);
  const asDownload = new URL(url.replace('/stream/', '/download/'));
  ok('a play ticket cannot be used as a download ticket', (await fetch(asDownload)).status === 403);
  ok('stream URL without a ticket is refused', (await fetch(`${u.origin}/stream/${id}`)).status === 403);

  // 4. download needs login
  const gd = await j(`/v1/songs/${id}/download-ticket`, { method: 'POST', token: G });
  ok('guest download -> 401 LOGIN_REQUIRED (the app shows the login prompt)', gd.status === 401 && gd.data.code === 'LOGIN_REQUIRED', JSON.stringify(gd.data));

  const email = `smoke_${Date.now()}@example.com`;
  const su = await j('/v1/auth/signup', { method: 'POST', json: { name: 'Smoke Tester', email, password: 'Passw0rdTest' } });
  ok('signup returns a dev code (DEV_EXPOSE_OTP=true)', su.status === 200 && su.data.devCode, JSON.stringify(su.data));
  const ver = await j('/v1/auth/verify', { method: 'POST', json: { email, code: su.data.devCode } });
  ok('verify creates the account and logs in', ver.status === 200 && ver.data.accessToken && ver.data.refreshToken, JSON.stringify(ver.data));
  const U = ver.data.accessToken;
  const ud = await j(`/v1/songs/${id}/download-ticket`, { method: 'POST', token: U });
  ok('logged-in user gets a download ticket', ud.status === 200 && ud.data.url, JSON.stringify(ud.data));
  const dl = await fetch(ud.data.url);
  ok('download is an attachment with the full file', dl.status === 200 && /attachment/.test(dl.headers.get('content-disposition') || '') && Buffer.from(await dl.arrayBuffer()).equals(tone));
  const rf = await j('/v1/auth/refresh', { method: 'POST', json: { refreshToken: ver.data.refreshToken } });
  ok('refresh token works once', rf.status === 200 && rf.data.accessToken);
  ok('old refresh token is rejected after rotation', (await j('/v1/auth/refresh', { method: 'POST', json: { refreshToken: ver.data.refreshToken } })).status === 401);

  // 5. guests cannot reach admin
  const adminRes = await j('/v1/admin/songs', { token: G });
  ok('guest cannot use admin endpoints', adminRes.status === 401 || adminRes.status === 403, 'status: ' + adminRes.status);

  // cleanup
  await j(`/v1/admin/songs/${id}`, { method: 'DELETE', token: A });
  console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('Smoke test crashed:', e.message); process.exit(1); });
