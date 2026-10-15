# NILORA

Music streaming with private, ticket-protected audio. Guests listen with no login; login is asked only for Download.

```
Browser / Flutter app  ->  web (static)  |  api (accounts, catalog, admin)  |  stream (audio)
                                              |  MySQL + Redis                 |  private MinIO
```

## Quick start (Docker Desktop + Node.js installed)
```
node scripts/init-env.js
docker compose up --build
docker compose exec api node src/scripts/create-admin.js admin@example.com StrongPass123
```
- Admin page (upload songs): http://localhost:3000/admin.html
- App: http://localhost:3000
- Check everything: `node scripts/smoke-test.js`
- Unit tests (no Docker): `node --test tests/unit.test.js`

## Read next
- `docs/SOP.md` - the handbook (start here)
- `docs/RULES.md` - standing rules for any AI or person working on this
- `docs/CONVERSATION_LOG.md` - everything decided so far
- `docs/API.md` - API v1 contract

## Folders
`clients/flutter` `services/api` `services/stream` `services/web` `db/migrations` `scripts` `tests` `docs` `legacy`
