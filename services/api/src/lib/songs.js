const { db } = require('./clients');
const cfg = require('../config');
const { sign } = require('./ticket');

const PATH = { play: 'stream', download: 'download', img: 'img' };

// A signed URL on the stream service. absExp lets cover images share one stable URL for ~1-2 hours.
function ticketUrl(kind, id, sub, ttlSec, absExp) {
  const exp = absExp || Math.floor(Date.now() / 1000) + ttlSec;
  const sig = sign(cfg.ticketSecret, kind, String(id), sub, exp);
  return { url: `${cfg.streamBase}/${PATH[kind]}/${id}?exp=${exp}&sub=${encodeURIComponent(sub)}&sig=${sig}`, expiresAt: exp };
}
const coverUrl = id => ticketUrl('img', id, 'public', 0, (Math.floor(Date.now() / 1000 / 3600) + 2) * 3600).url;

// Adds artists, categories and a signed cover URL to song rows.
async function hydrate(rows, { admin = false } = {}) {
  if (!rows.length) return [];
  const ids = rows.map(r => r.id);
  const [sa] = await db.query('SELECT sa.song_id, a.name, a.type FROM song_artists sa JOIN artists a ON a.id=sa.artist_id WHERE sa.song_id IN (?)', [ids]);
  const [sc] = await db.query(`SELECT sc.song_id, c.name cat, s.name sub FROM song_categories sc
     JOIN categories c ON c.id=sc.category_id LEFT JOIN subcategories s ON s.id=sc.subcategory_id WHERE sc.song_id IN (?)`, [ids]);
  return rows.map(r => ({
    id: r.id, title: r.title, album: r.album, durationSec: r.duration_sec,
    bgColor: r.bg_color, logo: r.logo, logoColor: r.logo_color,
    artists: sa.filter(x => x.song_id === r.id).map(x => ({ name: x.name, type: x.type })),
    categories: sc.filter(x => x.song_id === r.id).map(x => ({ name: x.cat, sub: x.sub || null })),
    coverUrl: r.cover_key ? coverUrl(r.id) : null,
    hasAudio: !!r.audio_key,
    ...(admin ? { hidden: !!r.is_hidden, audioMime: r.audio_mime, audioSize: r.audio_size } : {}),
  }));
}
module.exports = { ticketUrl, coverUrl, hydrate };
