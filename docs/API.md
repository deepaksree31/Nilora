# NILORA API v1 (as implemented in entry #8)

Base URL: `PUBLIC_API_URL` (default `http://localhost:8080`). All bodies are JSON unless noted. Errors look like `{ "error": "message", "code": "CODE" }`.

## Tokens
- **Guest token:** from `POST /v1/session/guest`, 15 minutes, no login.
- **User token:** from login/verify/refresh, 15 minutes, plus a rotating refresh token (30 days).
- **Admin token:** from `/v1/admin/login`, 12 hours.
- Send as `Authorization: Bearer <token>`.

## Error codes
`TOKEN_INVALID` (401, renew the token) - `LOGIN_REQUIRED` (401, a guest tried something that needs an account: show the login prompt) - `FORBIDDEN` (403) - `RATE_LIMITED` (429) - `BAD_CREDENTIALS` (401) - `NOT_FOUND` (404).

## Endpoints

| Method and path | Who | Purpose |
| --- | --- | --- |
| `POST /v1/session/guest` | Anyone (30/min per IP) | `{accessToken, expiresIn, role:"guest"}` |
| `POST /v1/auth/signup` `{name,email,password}` | Anyone | Sends a 6-digit code (10 min). Dev mode (`DEV_EXPOSE_OTP=true`) also returns `devCode`. |
| `POST /v1/auth/verify` `{email,code}` | Anyone | Creates the account; returns `{accessToken, refreshToken, expiresIn, user}` |
| `POST /v1/auth/login` `{email,password}` | Anyone | Same response as verify |
| `POST /v1/auth/refresh` `{refreshToken}` | Anyone | Rotates: old refresh token stops working |
| `POST /v1/auth/logout` `{refreshToken}` | Anyone | Ends the session |
| `GET /v1/home` | Guest, user, admin | `{sections:[{title, songs:[Song]}]}` - default recommendations |
| `GET /v1/songs?category=&limit=&offset=` | Guest+ | `{songs:[Song]}` |
| `GET /v1/songs/:id` | Guest+ | One `Song` |
| `GET /v1/search?q=` | Guest+ | `{songs:[Song]}` (min 2 characters) |
| `GET /v1/library` | Guest+ | `{categories:[{id,name,color,subs}], artists:[{id,name,type}]}` |
| `POST /v1/songs/:id/play-ticket` | Guest+ | `{url, expiresAt}` - signed stream URL, about 2 minutes |
| `POST /v1/songs/:id/download-ticket` | User, admin | `{url, expiresAt}` - signed URL, 60 seconds, works at most 3 times. Guest gets 401 `LOGIN_REQUIRED`. |
| `POST/DELETE /v1/songs/:id/like` | User | Like or unlike |
| `GET /v1/me` | User | `{user, likes:[songId], downloads:[songId]}` |
| `POST /v1/admin/login` `{email,password}` | Anyone (10 per 15 min) | Admin token |
| `GET /v1/admin/songs`, `GET /v1/admin/users` | Admin | Lists (songs include hidden ones) |
| `POST /v1/admin/songs` (multipart) | Admin | Fields: `title`, `male`/`female`/`music` (artist names, at least one), `album`, `durationSec`, `bgColor`, `logo`, `logoColor`, `categories` (JSON list like `["Chill","Chill › Lo-fi"]`); files: `audio` (required), `cover` |
| `PUT /v1/admin/songs/:id` (multipart) | Admin | Same fields; files optional |
| `PATCH /v1/admin/songs/:id/hidden` `{hidden}` | Admin | Hide or show |
| `DELETE /v1/admin/songs/:id` | Admin | Deletes the row and both files |
| `POST /v1/admin/password` `{current,password}` | Admin | Change admin password |
| `GET /healthz`, `GET /readyz` | Anyone | Probes (api and stream) |

## Song object
`{ id, title, album, durationSec, bgColor, logo, logoColor, artists:[{name,type}], categories:[{name,sub}], coverUrl, hasAudio }`
`coverUrl` is a signed image URL, stable for 1 to 2 hours. There is no audio URL in a Song: audio is reached only through a play ticket.

## Stream service (separate port, default 8081)
| Path | Needs | Notes |
| --- | --- | --- |
| `GET /stream/:id?exp=&sub=&sig=` | Play ticket | Range supported (206/416). `Cache-Control: private, no-store` |
| `GET /download/:id?exp=&sub=&sig=` | Download ticket | `Content-Disposition: attachment`; 3 uses max |
| `GET /img/:id?exp=&sub=&sig=` | Image ticket | Cover image |

Ticket signature: `HMAC-SHA256(TICKET_SECRET, kind.id.sub.exp)`, base64url. A bad, changed, expired or wrong-kind ticket gets 403 (`TICKET_INVALID`, `TICKET_EXPIRED`, `TICKET_MALFORMED`, `TICKET_USED`).

## Storage keys (MinIO, private)
- Audio: bucket `nilora-audio`, key `audio/<songId>/original` (content type stored as object metadata)
- Covers: bucket `nilora-images`, key `images/<songId>/cover`
- MySQL stores `audio_key` and `cover_key`, never URLs.
