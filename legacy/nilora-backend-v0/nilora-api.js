/* =====================================================================
   nilora-api.js  — the "bridge" between NILORA.html and the backend.
   Add this BEFORE your big <script> in NILORA.html:
       <script src="nilora-api.js"></script>
   (or paste the whole file inside a <script> tag)
   ===================================================================== */
const API = location.protocol === 'file:' ? 'http://localhost:3000' : '';   // '' = same server

const tok = {
  get user()  { return sessionStorage.getItem('nl_tok') || localStorage.getItem('nl_tok') || ''; },
  set user(v) { v ? null : (sessionStorage.removeItem('nl_tok'), localStorage.removeItem('nl_tok')); },
  save(t, remember) { sessionStorage.removeItem('nl_tok'); localStorage.removeItem('nl_tok'); (remember ? localStorage : sessionStorage).setItem('nl_tok', t); },
  admin: ''                                                                  // admin token lives in memory only
};

async function api(path, { method = 'GET', body, admin = false, form = null } = {}) {
  const headers = {};
  const t = admin ? tok.admin : tok.user;
  if (t) headers.Authorization = 'Bearer ' + t;
  if (body) headers['Content-Type'] = 'application/json';
  const r = await fetch(API + path, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Request failed (' + r.status + ')');
  return data;
}
const U = p => (p ? API + p : '');            // turns "/uploads/audio/x.mp3" into a full URL

/* ---------- USER: signup / login / reset ---------- */
const NL = {
  signup:  (name, email, password)  => api('/api/auth/signup',  { method: 'POST', body: { name, email, password } }),
  verify:  async (email, code, remember = true) => { const d = await api('/api/auth/verify', { method: 'POST', body: { email, code } }); tok.save(d.token, remember); return d.user; },
  resend:  email                    => api('/api/auth/resend',  { method: 'POST', body: { email } }),
  login:   async (email, password, remember) => { const d = await api('/api/auth/login', { method: 'POST', body: { email, password } }); tok.save(d.token, remember); return d.user; },
  forgot:  email                    => api('/api/auth/forgot',  { method: 'POST', body: { email } }),
  reset:   (email, code, password)  => api('/api/auth/reset',   { method: 'POST', body: { email, code, password } }),
  me:      ()                       => api('/api/me'),
  logout:  () => { tok.user = ''; },

  /* ---------- MUSIC (everyone) ---------- */
  songs:   () => api('/api/songs'),
  library: () => api('/api/library'),
  like:    (id, on) => api(`/api/songs/${id}/like`, { method: on ? 'POST' : 'DELETE' }),
  played:  id => api(`/api/songs/${id}/play`, { method: 'POST' }).catch(() => {}),
  downloaded: id => api(`/api/songs/${id}/download`, { method: 'POST' }).catch(() => {}),

  /* ---------- ADMIN ---------- */
  adminLogin: async (email, password) => { const d = await api('/api/admin/login', { method: 'POST', body: { email, password } }); tok.admin = d.token; },
  adminSongs: () => api('/api/admin/songs', { admin: true }),
  saveSong: (id, f) => {                       // f = {title, album, len, c, e, lc, am, af, ao, cats[], coverFile, audioFile}
    const fd = new FormData();
    ['title', 'album', 'len', 'c', 'e', 'lc', 'am', 'af', 'ao'].forEach(k => fd.append(k, f[k] ?? ''));
    fd.append('cats', JSON.stringify(f.cats || []));
    if (f.coverFile) fd.append('cover', f.coverFile);
    if (f.audioFile) fd.append('audio', f.audioFile);
    return api(id == null ? '/api/admin/songs' : '/api/admin/songs/' + id, { method: id == null ? 'POST' : 'PUT', admin: true, form: fd });
  },
  hideSong:   (id, hidden) => api(`/api/admin/songs/${id}/hidden`, { method: 'PATCH', admin: true, body: { hidden } }),
  deleteSong: id => api('/api/admin/songs/' + id, { method: 'DELETE', admin: true }),
  saveArtist: (id, name, type, imageFile) => {
    const fd = new FormData(); fd.append('name', name); fd.append('type', type); if (imageFile) fd.append('image', imageFile);
    return api(id == null ? '/api/admin/artists' : '/api/admin/artists/' + id, { method: id == null ? 'POST' : 'PUT', admin: true, form: fd });
  },
  deleteArtist: id => api('/api/admin/artists/' + id, { method: 'DELETE', admin: true }),
  saveCategory: (id, name, color, imageFile) => {
    const fd = new FormData(); fd.append('name', name); fd.append('color', color || ''); if (imageFile) fd.append('image', imageFile);
    return api(id == null ? '/api/admin/categories' : '/api/admin/categories/' + id, { method: id == null ? 'POST' : 'PUT', admin: true, form: fd });
  },
  deleteCategory: id => api('/api/admin/categories/' + id, { method: 'DELETE', admin: true }),
  addSub: (catId, name) => api(`/api/admin/categories/${catId}/subs`, { method: 'POST', admin: true, body: { name } }),
  deleteSub: id => api('/api/admin/subs/' + id, { method: 'DELETE', admin: true }),
  changeAdminPw: (current, password) => api('/api/admin/password', { method: 'POST', admin: true, body: { current, password } }),
};

/* ---------- load songs from the server into your existing "T" array ---------- */
async function loadFromServer() {
  const [songs, lib] = await Promise.all([NL.songs(), NL.library()]);
  T = songs.map(s => ({ ...s, c: s.c || G[s.id % 8] }));
  songs.forEach(s => { MEDIA[s.id] = { c: U(s.coverUrl), a: U(s.audioUrl), ab: null }; });  // players read MEDIA[id].a
  CATS = lib.categories.map(c => c.name);
  lib.categories.forEach(c => { CM[c.name] = { c: c.color || '', img: U(c.img) }; if (c.subs.length) SUB[c.name] = c.subs; });
  AR = lib.artists.map(a => ({ name: a.name, ty: a.ty, img: U(a.img) }));
  render();
}
