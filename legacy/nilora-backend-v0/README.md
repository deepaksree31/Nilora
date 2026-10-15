# NILORA — Database + Backend Guide (step by step)

## What you get

| File | What it is |
|---|---|
| `schema.sql` | MySQL database: users (email + password), OTP codes, admins, songs, artists, categories, likes, downloads, history |
| `server.js` | Node.js backend (Express) — login, signup, email codes, admin upload of songs/images |
| `create-admin.js` | Creates your admin login (password stored safely hashed) |
| `nilora-api.js` | Small file for NILORA.html that talks to the backend |
| `.env.example` | Your private settings (DB password, email, secret) |
| `package.json` | List of libraries to install |

**How it works:** `NILORA.html (browser)  →  server.js (Node)  →  MySQL database`
Audio/image files are saved in the `uploads/` folder; MySQL stores the *path* to each file plus all text data.
Passwords are stored as **bcrypt hashes**, never as plain text.

---

## STEP 1 — Install the tools (one time)
1. **Node.js** (LTS): https://nodejs.org → install → check: `node -v`
2. **MySQL**: install *MySQL Community Server + Workbench*, or **XAMPP** (easier: start "MySQL" in the XAMPP panel). Remember the root password (XAMPP default: empty).

## STEP 2 — Create the database
Open a terminal in the `nilora-backend` folder:
```
mysql -u root -p < schema.sql
```
(XAMPP on Windows: `C:\xampp\mysql\bin\mysql.exe -u root < schema.sql`, or open `schema.sql` in MySQL Workbench / phpMyAdmin → Import, and run it.)
You should now see a database called **nilora** with 13 tables.

## STEP 3 — Install the backend libraries
```
cd nilora-backend
npm install
```

## STEP 4 — Fill in your settings
1. Copy `.env.example` to a new file named `.env`.
2. Set `DB_PASSWORD` (your MySQL password).
3. Set `JWT_SECRET` — generate one:
   `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
4. **Email codes (Gmail):** Google Account → Security → turn on 2-Step Verification → *App passwords* → create one → put it in `SMTP_PASS`, and your Gmail in `SMTP_USER`.
   *(Skip this while testing: the 6-digit code is printed in the terminal instead.)*

## STEP 5 — Create the admin login
```
node create-admin.js admin@yourmail.com "StrongPass123"
```

## STEP 6 — Start the server
```
npm start
```
You should see: `NILORA server running → http://localhost:3000`
Test in browser: http://localhost:3000/api/songs → shows `[]` (empty list) — the backend and database are connected.

## STEP 7 — Connect NILORA.html to the backend
1. Create a folder `public/` inside `nilora-backend`, copy **NILORA.html** into it (rename to `index.html`) and copy `nilora-api.js` there too.
2. In the HTML, add this line just **before** the big `<script>` tag:
   ```html
   <script src="nilora-api.js"></script>
   ```
3. Open **http://localhost:3000** (the server now serves your page).
4. Replace the functions below (they currently save to `localStorage`/IndexedDB in the browser; the new versions save to MySQL).

### 7a. Load songs on start (replace `loadMedia()` call at startup)
```js
loadFromServer().catch(e => toast('Server not reachable: ' + e.message));
```

### 7b. Login (replace `authGo`)
```js
async function authGo(){
  aE('aerr','');const e=$('ae').value.trim().toLowerCase(),p=$('ap').value;
  if(!RX.test(e))return aE('aerr','Enter a valid email address.');
  if(!p)return aE('aerr','Enter your password.');
  try{
    const u=await NL.login(e,p,$('arem').checked);
    setUser({name:u.name,email:u.email},$('arem').checked);$('ap').value='';applyUser();render();
  }catch(err){aE('aerr',err.message)}
}
```

### 7c. Signup + email code (replace `signGo`, `sendCode`, `resend`, `verGo`)
```js
async function signGo(){
  aE('serr','');const n=$('an').value.trim(),e=$('se').value.trim().toLowerCase(),p=$('sp').value,b=$('sgo');
  if(n.length<2)return aE('serr','Enter your full name.');
  if(!pwOk(p))return aE('serr',PWMSG);
  if(p!==$('sp2').value)return aE('serr','Passwords do not match.');
  b.disabled=true;b.textContent='Sending code...';
  try{
    const m=await chkEmail(e,true);if(m)return aE('serr',m);
    await NL.signup(n,e,p);
    pend={n,e};$('vmail').textContent=e;
    [0,1,2,3,4,5].forEach(i=>$('c'+i).value='');aView('verify');cool(30);
  }catch(err){aE('serr',err.message)}
  finally{b.disabled=false;b.textContent='Create account'}
}
async function resend(){ if(!pend)return; try{await NL.resend(pend.e);cool(30)}catch(err){aE('verr',err.message)} }
async function verGo(){
  aE('verr','');const c=getCode();
  if(c.length<6)return aE('verr','Enter the 6-digit code.');
  try{
    const u=await NL.verify(pend.e,c,true);
    setUser({name:u.name,email:u.email},true);pend=null;clearInterval(otpT);$('sp').value='';applyUser();render();
    toast('Email verified. Welcome to NILORA!');
  }catch(err){aE('verr',err.message);const b=$('cbox');b.classList.add('bad');setTimeout(()=>b.classList.remove('bad'),400)}
}
```
Also **delete** the `EMAILJS` line (your EmailJS keys are visible to everyone who opens the page — the backend now sends the email instead).

### 7d. Forgot password (replace `sendOtp`, `verifyOtp`)
```js
async function sendOtp(){
  const e=$('fpe').value.trim().toLowerCase();ferr('');
  {const m=await chkEmail(e,false);if(m)return ferr(m)}
  try{await NL.forgot(e)}catch(err){return ferr(err.message)}
  $('fp1').hidden=true;$('fp2').hidden=false;
  $('fpm').textContent='If an account exists for '+e+', a 6-digit code is on its way.';
}
async function verifyOtp(){
  const c=$('fpo').value.trim(),p=$('fpn').value,e=$('fpe').value.trim().toLowerCase();ferr('');
  if(!pwOk(p))return ferr(PWMSG);
  try{await NL.reset(e,c,p)}catch(err){return ferr(err.message)}
  $('ae').value=e;$('fp').classList.remove('show');$('fpo').value=$('fpn').value='';toast('Password updated');
}
```

### 7e. Admin login (replace `admOk` / `unlock`)
The admin panel now needs email + password from the `admins` table. Change `gate()` to add an email box with `id="aemail"`, then:
```js
async function unlock(){
  try{await NL.adminLogin($('aemail').value,$('pin').value);aOk=true;$('atabs').style.display='';aRender()}
  catch(e){$('perr').textContent=e.message;$('perr').style.display='block'}
}
```

### 7f. Admin: save / hide / delete songs (the music upload part)
In `saveSong()`, replace the part that does `T.push(...)` / `putMedia(...)` / `saveS()` with:
```js
try{
  await NL.saveSong(aEdit,{
    title:g('f_t'),album:g('f_b')||'Single',len:Math.round(len),c:$('f_k').value,e:g('f_e')||'♪',lc:d.lc,
    am,af,ao,cats,coverFile:$('f_cv').files[0],audioFile:$('f_au').files[0]
  });
  await loadFromServer();aRender();
  toast((aEdit!=null?'Song updated':'Song added')+' — saved to database');
}catch(e){toast(e.message)}
```
and for the buttons:
```js
async function togHid(id){const t=song(id);await NL.hideSong(id,!t.hid);await loadFromServer();aRender()}
// in delSong(): replace "delMedia(id);...T=T.filter(...);saveS();" with:
//   await NL.deleteSong(id); await loadFromServer(); aRender();
```
Artists and categories work the same way: `NL.saveArtist(...)`, `NL.deleteArtist(...)`, `NL.saveCategory(...)`, `NL.addSub(...)` — then call `loadFromServer()`.

### 7g. Likes / history
```js
function toggleLike(id){ const on=!liked.has(id); on?liked.add(id):liked.delete(id); saveLikes(); NL.like(id,on).catch(()=>{}); if(cur>=0)sync(); render() }
// inside recordPlay(i): add   NL.played(i);
```

## STEP 8 — Test everything
1. Open http://localhost:3000 → **Sign up** → code arrives by email (or in the terminal) → account created.
2. In MySQL: `SELECT id,name,email,password_hash FROM nilora.users;` → password shows as a long hash ✔
3. Open admin panel (tap avatar 5×, or `#admin`) → log in → **Add song** with image + audio.
4. Check: `SELECT id,title,audio_path FROM nilora.songs;` and look in `uploads/audio/` ✔

## STEP 9 — Put it online (when ready)
- Host the folder on a VPS / Render / Railway; use a managed MySQL (PlanetScale alternatives: Aiven, Railway MySQL, AWS RDS).
- Set the same `.env` values on the host. Use **HTTPS**. Set `FRONTEND_ORIGIN` to your real site URL (not `*`).
- Back up the database **and** the `uploads/` folder regularly.
- For many/large songs later, move `uploads/` to cloud storage (S3 / Cloudflare R2) — only the paths in MySQL change.

## Security notes about your current HTML
- The default admin password `nilora@admin` is visible in the page source — the backend replaces it with a real admin account.
- EmailJS keys in the page are public — remove them after switching to the backend (Step 7c).
- Never upload `.env` or share your MySQL password.

## Useful SQL
```sql
SELECT email, name, created_at FROM users ORDER BY id DESC;             -- all users
SELECT s.title, GROUP_CONCAT(a.name) artists, s.audio_path
  FROM songs s LEFT JOIN song_artists sa ON sa.song_id=s.id
  LEFT JOIN artists a ON a.id=sa.artist_id GROUP BY s.id;                -- all songs + artists
SELECT s.title, COUNT(*) likes FROM user_likes l JOIN songs s ON s.id=l.song_id GROUP BY s.id ORDER BY likes DESC;
```
