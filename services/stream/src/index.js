// NILORA stream service: turns a valid signed ticket into bytes from private MinIO storage.
// It never talks to MySQL. Object keys follow a fixed convention built from the song id:
//   audio:  bucket nilora-audio   key audio/<id>/original
//   cover:  bucket nilora-images  key images/<id>/cover
const express = require('express');
const cors = require('cors');
const Minio = require('minio');
const Redis = require('ioredis');
const { verify } = require('./ticket');
const { parseRange } = require('./range');

const e = process.env;
const need = k => { if (!e[k]) { console.error('Missing env ' + k); process.exit(1); } return e[k]; };
const SECRET = need('TICKET_SECRET');
if (SECRET.length < 24) { console.error('TICKET_SECRET must be 24+ characters'); process.exit(1); }
const PORT = Number(e.PORT) || 8081;
const AUDIO_BUCKET = e.AUDIO_BUCKET || 'nilora-audio';
const IMAGE_BUCKET = e.IMAGE_BUCKET || 'nilora-images';
const DL_MAX_USES = 3;

const mc = new Minio.Client({
  endPoint: e.MINIO_ENDPOINT || 'minio',
  port: Number(e.MINIO_PORT) || 9000,
  useSSL: e.MINIO_USE_SSL === 'true',
  accessKey: need('MINIO_ROOT_USER'),
  secretKey: need('MINIO_ROOT_PASSWORD'),
});
const redis = new Redis(e.REDIS_URL || 'redis://redis:6379', { maxRetriesPerRequest: 2 });

const EXT = { 'audio/mpeg': '.mp3', 'audio/mp3': '.mp3', 'audio/mp4': '.m4a', 'audio/x-m4a': '.m4a', 'audio/aac': '.aac',
  'audio/wav': '.wav', 'audio/x-wav': '.wav', 'audio/wave': '.wav', 'audio/ogg': '.ogg', 'audio/opus': '.opus', 'audio/flac': '.flac', 'audio/webm': '.webm' };

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(cors({
  origin: (e.CORS_ORIGIN || '*') === '*' ? true : e.CORS_ORIGIN.split(','),
  exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length', 'Content-Disposition'],
}));

app.get('/healthz', (req, res) => res.json({ ok: true }));
app.get('/readyz', async (req, res) => {
  try { await redis.ping(); await mc.bucketExists(AUDIO_BUCKET); res.json({ ok: true }); }
  catch (err) { res.status(503).json({ ok: false }); }
});

function serve(kind, bucket, keyOf, opts = {}) {
  return async (req, res) => {
    const id = req.params.id;
    if (!/^\d{1,10}$/.test(id)) return res.status(404).json({ error: 'Not found' });
    const bad = verify(SECRET, kind, id, req.query);
    if (bad) return res.status(403).json({ error: 'Ticket ' + bad, code: 'TICKET_' + bad.toUpperCase() });

    if (kind === 'download') { // a download ticket works a few times for 60 s, then is spent
      try {
        const k = 'dl:' + req.query.sig;
        const n = await redis.incr(k);
        if (n === 1) await redis.expire(k, 120);
        if (n > DL_MAX_USES) return res.status(403).json({ error: 'Ticket used up', code: 'TICKET_USED' });
      } catch (err) { return res.status(503).json({ error: 'Try again' }); }
    }

    let st;
    try { st = await mc.statObject(bucket, keyOf(id)); }
    catch (err) { return res.status(404).json({ error: 'Not found' }); }

    const size = st.size;
    const mime = (st.metaData && (st.metaData['content-type'] || st.metaData['Content-Type'])) || 'application/octet-stream';
    const range = parseRange(req.headers.range, size);
    if (range === 'invalid') { res.set('Content-Range', 'bytes */' + size); return res.status(416).end(); }

    res.set({
      'Accept-Ranges': 'bytes',
      'Content-Type': mime,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': kind === 'img' ? 'public, max-age=3600' : 'private, no-store',
    });
    if (st.etag) res.set('ETag', '"' + st.etag + '"');
    if (opts.attachment) res.set('Content-Disposition', 'attachment; filename="song-' + id + (EXT[mime] || '') + '"');

    let start = 0, end = size - 1;
    if (range) { start = range.start; end = range.end; res.status(206).set('Content-Range', `bytes ${start}-${end}/${size}`); }
    else res.status(200);
    const length = end - start + 1;
    res.set('Content-Length', String(length));
    if (req.method === 'HEAD') return res.end();

    try {
      const stream = range ? await mc.getPartialObject(bucket, keyOf(id), start, length) : await mc.getObject(bucket, keyOf(id));
      stream.on('error', () => res.destroy());
      res.on('close', () => { if (stream.destroy) stream.destroy(); });
      stream.pipe(res);
    } catch (err) { if (!res.headersSent) res.status(500).end(); else res.destroy(); }
  };
}

app.get('/stream/:id', serve('play', AUDIO_BUCKET, id => `audio/${id}/original`));
app.get('/download/:id', serve('download', AUDIO_BUCKET, id => `audio/${id}/original`, { attachment: true }));
app.get('/img/:id', serve('img', IMAGE_BUCKET, id => `images/${id}/cover`));

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.listen(PORT, () => console.log('NILORA stream listening on ' + PORT));
