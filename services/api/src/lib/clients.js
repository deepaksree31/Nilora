const mysql = require('mysql2/promise');
const Redis = require('ioredis');
const Minio = require('minio');
const cfg = require('../config');

const db = mysql.createPool({ ...cfg.mysql, waitForConnections: true, connectionLimit: 10, charset: 'utf8mb4' });
const redis = new Redis(cfg.redisUrl, { maxRetriesPerRequest: 2 });
const minio = new Minio.Client(cfg.minio);

async function ensureBuckets() {
  for (const b of [cfg.audioBucket, cfg.imageBucket]) {
    if (!(await minio.bucketExists(b))) { await minio.makeBucket(b); console.log('Created bucket', b); }
  }
}
module.exports = { db, redis, minio, ensureBuckets };
