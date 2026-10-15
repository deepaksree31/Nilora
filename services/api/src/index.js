const express = require('express');
const cors = require('cors');
const multer = require('multer');
const cfg = require('./config');
const { db, redis, minio, ensureBuckets } = require('./lib/clients');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(cors({ origin: cfg.corsOrigin === '*' ? true : cfg.corsOrigin.split(',') }));
app.use(express.json({ limit: '100kb' }));

app.get('/healthz', (req, res) => res.json({ ok: true }));
app.get('/readyz', async (req, res) => {
  try { await db.query('SELECT 1'); await redis.ping(); await minio.bucketExists(cfg.audioBucket); res.json({ ok: true }); }
  catch (err) { res.status(503).json({ ok: false }); }
});

// Order matters: public login routes first, then token-protected ones.
app.use('/v1/session', require('./routes/session'));
app.use('/v1/auth', require('./routes/auth'));
app.use('/v1/admin', require('./routes/admin'));
app.use('/v1', require('./routes/catalog'));
app.use('/v1', require('./routes/tickets'));

app.use((req, res) => res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' }));
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) return res.status(400).json({ error: err.message });
  if (err.status) return res.status(err.status).json({ error: err.message, code: err.code });
  console.error(err);
  res.status(500).json({ error: 'Server error. Try again.', code: 'SERVER_ERROR' });
});

(async () => {
  for (let i = 1; ; i++) { // wait for MySQL/MinIO/Redis if they are still starting
    try { await db.query('SELECT 1'); await ensureBuckets(); break; }
    catch (err) { if (i >= 30) { console.error('Startup failed:', err.message); process.exit(1); } console.log('Waiting for dependencies...', err.code || err.message); await new Promise(r => setTimeout(r, 2000)); }
  }
  app.listen(cfg.port, () => console.log('NILORA api listening on ' + cfg.port));
})();
