const e = process.env;
const need = k => { if (!e[k]) { console.error('Missing env ' + k); process.exit(1); } return e[k]; };

const cfg = {
  port: Number(e.PORT) || 8080,
  jwtSecret: need('JWT_SECRET'),
  ticketSecret: need('TICKET_SECRET'),
  streamBase: (e.PUBLIC_STREAM_URL || 'http://localhost:8081').replace(/\/$/, ''),
  corsOrigin: e.CORS_ORIGIN || '*',
  mysql: { host: e.MYSQL_HOST || 'mysql', user: need('MYSQL_USER'), password: need('MYSQL_PASSWORD'), database: e.MYSQL_DATABASE || 'nilora' },
  redisUrl: e.REDIS_URL || 'redis://redis:6379',
  minio: {
    endPoint: e.MINIO_ENDPOINT || 'minio', port: Number(e.MINIO_PORT) || 9000, useSSL: e.MINIO_USE_SSL === 'true',
    accessKey: need('MINIO_ROOT_USER'), secretKey: need('MINIO_ROOT_PASSWORD'),
  },
  audioBucket: e.AUDIO_BUCKET || 'nilora-audio',
  imageBucket: e.IMAGE_BUCKET || 'nilora-images',
  exposeOtp: e.DEV_EXPOSE_OTP === 'true',
  smtp: e.SMTP_HOST ? { host: e.SMTP_HOST, port: Number(e.SMTP_PORT) || 465, user: e.SMTP_USER, pass: e.SMTP_PASS, from: e.MAIL_FROM || e.SMTP_USER } : null,
  // seconds
  ttl: { guest: 900, access: 900, refreshDays: 30, play: 120, download: 60 },
};
if (cfg.jwtSecret.length < 24 || cfg.ticketSecret.length < 24) { console.error('JWT_SECRET and TICKET_SECRET must be 24+ characters'); process.exit(1); }
module.exports = cfg;
