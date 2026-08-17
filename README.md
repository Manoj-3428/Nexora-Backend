# Nexora Backend

Privacy-first, location-aware, **temporary peer-to-peer file-sharing** backend.

The backend is the **control plane** — identity, authentication, authorization, pool
lifecycle, access control, discovery metadata, file metadata, and realtime state.
The actual high-bandwidth file/video transfer stays **peer-to-peer** (WebRTC / local
network); Nexora never proxies file bytes through the server. `PoolItem` stores only
*metadata* + local/stream references, and Socket.IO relays WebRTC signaling.

---

## 1. Stack

| Concern | Choice |
| --- | --- |
| Runtime / framework | Node.js + **Express 5** |
| Database | **MongoDB** via Mongoose 9 (incl. `2dsphere` geospatial index) |
| Auth | **JWT** (device-bound, `tokenVersion` invalidation) |
| Realtime | **Socket.IO 4** (rooms per pool + per user; WebRTC signaling) |
| Validation | Joi |
| Security | helmet, CORS allow-list, rate limiting, NoSQL/XSS input sanitization |
| Background jobs | `node-cron` cleanup worker (expiry + stale sessions) |
| Logging | Winston + morgan |
| Tests | Jest + supertest + mongodb-memory-server |

**Layering:** `routes → controllers → services → models`. Controllers never touch the
DB directly; all business logic lives in services.

---

## 2. Getting started

```bash
npm install
cp .env.example .env   # then edit values
npm run dev            # nodemon
npm start              # production
npm test               # Jest (spins up an in-memory MongoDB)
```

### Environment variables

| Var | Required | Default | Notes |
| --- | --- | --- | --- |
| `MONGODB_URI` | ✅ | — | Mongo connection string |
| `JWT_SECRET` | ✅ | — | Secret for signing JWTs |
| `PORT` | ❌ | `5000` | HTTP port |
| `NODE_ENV` | ❌ | `development` | `production` locks CORS to `FRONTEND_URL`; `test` bypasses rate limits |
| `FRONTEND_URL` | prod only | — | Allowed CORS origin in production |

**Base URL:** all endpoints are prefixed with **`/api/v1`**.
Example: `POST http://localhost:5000/api/v1/auth/register`.

---

## 3. Conventions

### Response envelope

Success:
```json
{ "success": true, "message": "Human readable", "data": { } }
```

Error:
```json
{ "success": false, "message": "Human readable", "code": "POOL_EXPIRED" }
```
`code` is a stable machine-readable string (see below). In non-production, an extra
`error` field carries the raw message for debugging.

### Error codes

`USERNAME_TAKEN`, `USER_NOT_FOUND`, `POOL_NOT_FOUND`, `POOL_EXPIRED`, `POOL_ENDED`,
`POOL_FULL`, `ACCESS_DENIED`, `PASSWORD_REQUIRED`, `INVALID_PASSWORD`, `NOT_AUTHORIZED`,
`ALREADY_JOINED`, `FILE_NOT_FOUND`, `CONNECTION_FAILED`, `INVALID_LOCATION`,
`VALIDATION_ERROR`.

### Authentication

Send the JWT as a bearer token:
```
Authorization: Bearer <token>
```
Tokens are **device-bound** (`deviceId` in the JWT must match the user's current device)
and carry a `tokenVersion`; logging in from a new device or calling `logout` invalidates
prior tokens. Token lifetime: 30 days.

### Pagination

List endpoints accept `?page=` (default 1) and `?limit=` (default 20, max 100) and return:
```json
{ "items": [ ], "pagination": { "page":1,"limit":20,"total":42,"totalPages":3,"hasNextPage":true,"hasPrevPage":false } }
```

### Rate limits

- Auth endpoints: 20 requests / 15 min / IP.
- All `/api` endpoints: 200 requests / 15 min / IP.

---

## 4. Authentication API

### `POST /auth/register` — public
Creates an account and **auto-generates a unique username** from the name (e.g.
`John Doe → john_doe`, then `john_doe1` on collision). You may pass a preferred
`username` to override.

Request:
```json
{
  "firstName": "John",      // firstName+lastName preferred…
  "lastName": "Doe",
  "name": "John Doe",       // …or legacy single name (min 2 chars)
  "username": "johnd",      // optional; auto-generated if omitted
  "email": "john@x.com",
  "password": "secret1",    // min 6 chars
  "deviceId": "device-uuid" // required
}
```
Response `201`:
```json
{ "success": true, "data": { "userId":"…","username":"john_doe","name":"John Doe","firstName":"John","lastName":"Doe","email":"john@x.com" } }
```
Errors: `409 USERNAME_TAKEN` (duplicate email/username), `400 VALIDATION_ERROR`.

### `POST /auth/login` — public
Request: `{ "email", "password", "deviceId" }`
Response `200`: `{ "data": { "user": { "userId","name","username","email","deviceId" }, "token": "<jwt>" } }`
Errors: `401 NOT_AUTHORIZED`.

### `POST /auth/logout` — 🔒
Invalidates all existing tokens for the user (bumps `tokenVersion`).

### `GET /auth/profile` — 🔒
Returns the current user (`userId, username, name, firstName, lastName, email, profilePic, deviceId`).
Equivalent to `GET /users/me`.

---

## 5. Users API  🔒 (all)

### `GET /users/me`
Full self profile (includes `profileVisibility`, `connectionStatus`, timestamps).

### `PATCH /users/me`  (also `PUT /users/profile`)
Update profile. Any subset of:
```json
{ "name","firstName","lastName","username","profilePic","profileVisibility","publicKey" }
```
Changing `username` enforces uniqueness → `409 USERNAME_TAKEN` on collision,
`400 VALIDATION_ERROR` on bad format.

### `GET /users/username/check?username=<name>`
**This is the "does this username exist?" endpoint.** Checks format + DB availability.
Response:
```json
{ "data": { "username":"john_doe", "valid": true, "available": false } }
```
`available:false` ⇒ taken. `valid:false` ⇒ bad format (`reason:"INVALID_FORMAT"`).

### `GET /users/search?username=<prefix>&limit=`
Username-prefix search (indexed) for adding people to private pools. Returns a safe
projection only — **never** email/password:
```json
{ "data": [ { "userId","username","name","firstName","lastName","profilePic" } ] }
```

### `PATCH /users/connection-status`
Body `{ "status": "ONLINE" | "OFFLINE" | … }`. Updates presence + `lastSeen`.

---

## 6. Pools API  🔒 (all)

A **pool** is a temporary sharing environment. Key concepts:

- **Type:** `PUBLIC` (discoverable + open) or `PRIVATE` (password and/or explicit authorization).
- **Status:** `ACTIVE`, `EXPIRED` (auto, past `expiresAt`), `ENDED` (owner ended; `CLOSED` is a legacy alias). `POOL_FULL` is enforced at join time via capacity.
- **Three distinct people sets** — do not conflate them:
  - **Authorized users** (`allowedUsers`): owner-granted access to a *private* pool.
  - **Participants** (`PoolParticipant`): users who have **joined** the pool.
  - **Active sessions** (`ActiveSession`): users currently **connected** in realtime (heartbeat).
- **Pool code** (`poolCode`): short, human/QR-friendly join identifier, separate from the internal `poolId`.

Password hashes and exact coordinates are **never** returned. Response detail is
**role-aware**: owners see everything (incl. transport info + exact location + authorized
list); members see connection details; non-members of a private pool see only
discovery-safe fields.

### `POST /pools` — create
```json
{
  "poolName": "Movie Night",            // 3–100 chars, required
  "hostDeviceId": "device-uuid",        // required
  "isPublic": false,                    // default true
  "passwordProtected": true,            // default false
  "password": "poolpass",               // required if passwordProtected
  "maxParticipants": 10,                // 2–100, default 10
  "expiresAt": "2026-08-17T14:00:00Z",  // OR durationMs
  "durationMs": 7200000,                // 5 min – 24 h
  "discoveryEnabled": true,             // default true
  "categories": ["video"],
  "latitude": 12.9716,                  // optional discovery location
  "longitude": 77.5946,
  "localIp": "192.168.1.20",            // P2P coordination (optional)
  "port": 8080,
  "protocolType": "WEBRTC"              // WEBRTC | WIFI_DIRECT | HOTSPOT
}
```
Response `201` (owner view) includes `poolId`, `poolCode`, `type`, `currentParticipantCount:1`.
Errors: `400 INVALID_LOCATION`, `400 PASSWORD_REQUIRED`, `400 VALIDATION_ERROR`.

### `GET /pools/:poolId` — role-aware details
Returns the pool shaped to the caller's relationship (owner / member / other).

### `GET /pools/code/:code` — resolve a QR / join code
Looks up a pool by its `poolCode` and returns the same role-aware details.

### `PATCH /pools/:poolId`  (also `PUT /pools/:poolId`) — owner only
Updatable: `poolName, isPublic, passwordProtected, password, maxParticipants,
expiresAt|durationMs, discoveryEnabled, categories`. `maxParticipants` cannot drop below
the current participant count. Ownership cannot be changed. Emits `pool:updated`.

### `DELETE /pools/:poolId` — owner only
Hard-deletes the pool + its participants/sessions. Emits `pool:deleted`.

### `POST /pools/:poolId/end` — owner only, **idempotent**
Marks the pool `ENDED`, sets `endedAt`, revokes live sessions, rejects new joins, emits
`pool:ended` (+ legacy `pool:closed`), preserves history. Ending an already-ended pool
returns `200`. (`PATCH /pools/:poolId/close` is the legacy alias.)

---

## 7. Discovery API  🔒

### `GET /pools/discover?latitude=&longitude=&radius=`
Geospatial discovery of **active, discovery-enabled** pools using a `2dsphere`
`$geoNear` query (no full-collection scan). `radius` in metres, default & max `5000`
(~5 km). Excludes expired/ended/hidden pools.

**Location privacy:** exact coordinates are **never** returned — only an approximate
distance + coarse proximity label:
```json
{ "data": [ {
  "poolId","poolCode","poolName","type","passwordProtected","poolStatus",
  "maxParticipants","currentParticipantCount","expiresAt","createdBy": {"userId","username","name","profilePic"},
  "distanceMeters": 412, "distance": "400 m away", "proximity": "Nearby"
} ] }
```
Proximity buckets: `Very close` (<100m), `Nearby` (<500m), `Within range` (<1500m),
`In area` (≤5km).

If `latitude`/`longitude` are omitted, returns a non-GPS active listing (distance null).
`GET /pools/discover/nearby` and `GET /pools/nearby` are aliases (the latter kept for
backward compatibility).

> **Local (same-network) discovery** is intended to happen device-to-device and does not
> need the server; the backend only provides the wider ~5 km discovery + authentication.

---

## 8. Membership & access API  🔒

### `POST /pools/:poolId/join`
Body: `{ "password": "…" }` (only needed for a password-protected private pool you're not
authorized for). Server validates, in order: pool exists → not ended → not expired →
active → not already joined → access (public / authorized / password) → capacity. On
success creates a participant, bumps counts, emits `pool:user_joined`.

Errors: `POOL_NOT_FOUND`, `POOL_ENDED`, `POOL_EXPIRED`, `ALREADY_JOINED (409)`,
`PASSWORD_REQUIRED (401)`, `INVALID_PASSWORD (401)`, `ACCESS_DENIED (403)`, `POOL_FULL (403)`.

### `POST /pools/:poolId/leave`
Marks your participation `LEFT`, drops your sessions, emits `pool:user_left`.

### `POST /pools/:poolId/verify-password`
Body `{ "password" }`. Validates a private pool's password without joining. `INVALID_PASSWORD` on mismatch.

### Authorized users (owner only)
Authorized users can access a private pool **without** entering the password.

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| `GET` | `/pools/:poolId/authorized-users` | — | List authorized users (safe projection) |
| `POST` | `/pools/:poolId/authorized-users` | `{ "userId" }` or `{ "username" }` | Grant access; emits `access:granted` to that user |
| `DELETE` | `/pools/:poolId/authorized-users/:userId` | — | Revoke; drops participation/session for private pools; emits `access:revoked` |

`:userId` is the public `userId` (also accepts a username or Mongo id).

### Participants
| Method | Path | Who | Notes |
| --- | --- | --- | --- |
| `GET` | `/pools/:poolId/participants` | owner or participant | Paginated list of joined users (`user, role, joinMethod, joinedAt`) |
| `DELETE` | `/pools/:poolId/participants/:userId` | owner | Remove a participant; emits `pool:participant_removed` + `access:revoked` |
| `POST` | `/pools/:poolId/participants/:userId/remove` | owner | Alias of the delete above |

---

## 9. Files API  🔒

Files are **metadata records** describing content served peer-to-peer. Mounted at both
`/pools/:poolId/items` and `/pools/:poolId/files` (identical). Access requires the pool
be `ACTIVE` and the caller be owner / authorized / participant / (any user for public).

| Method | Path | Who | Purpose |
| --- | --- | --- | --- |
| `POST` | `/pools/:poolId/files` | owner | Register file metadata after a P2P transfer is set up. Emits `file:added` |
| `GET` | `/pools/:poolId/files?itemType=` | allowed users | List files |
| `GET` | `/pools/:poolId/files/:itemId` | allowed users | File details |
| `PUT` | `/pools/:poolId/files/:itemId` | owner | Update metadata (name, thumbnail, streamUrl) |
| `DELETE` | `/pools/:poolId/files/:itemId` | owner or uploader | Remove; emits `file:removed` |

Add-file body:
```json
{
  "itemName": "clip.mp4", "itemType": "VIDEO", "mimeType": "video/mp4",
  "size": 1048576, "duration": 210, "thumbnail": "data:…",
  "checksumHash": "…", "streamUrl": "local/peer reference", "streamable": true
}
```
`itemType` ∈ `VIDEO | AUDIO | IMAGE | DOCUMENT | …`. `streamUrl`/`streamable` describe a
**local/peer** endpoint, not a cloud CDN.

---

## 10. History & activity  🔒

### `GET /pools/history?type=&status=&page=&limit=`
Pools related to the current user.
- `type` = `created` | `joined` (omit for both).
- `status` = `active` | `expired` | `ended`.
Each item includes an `isOwner` flag. Historical metadata is returned even for
expired/ended pools, but **content stays gated** — history never re-opens file access.

### `GET /pools/:poolId/history`
Historical detail for a single pool (must be owner or past participant).

### `GET /activity?type=&poolId=&page=&limit=`
Activity feed for the current user. `type` ∈ `POOL_CREATED, POOL_JOINED, POOL_LEFT,
USER_ADDED, USER_REMOVED, FILE_ADDED, FILE_REMOVED, POOL_ENDED, POOL_EXPIRED`.

### Analytics (existing)
- `GET /history/user?limit=` — the user's access history.
- `GET /history/pool/:poolId` — per-item view/duration aggregates for a pool.
- `GET /history/item/:itemId` — aggregates for one item.

### `GET /health`  (public)
`GET /api/v1/health` → uptime + DB connection state.

---

## 11. Realtime (Socket.IO)

Connect to the same origin with the JWT in the handshake:
```js
const socket = io(BASE_URL, { auth: { token: `Bearer ${jwt}` } });
```
On connect the server joins you to your personal room `user_<userId>`. Join a pool room
by emitting `pool:user_joined` with `{ poolId }`.

**Rooms:** `pool_<poolId>` (per pool) and `user_<userId>` (per user, for direct events).

### Client → server
| Event | Payload | Effect |
| --- | --- | --- |
| `pool:user_joined` | `{ poolId }` | Join the pool room; notifies peers |
| `pool:user_left` | `{ poolId }` | Leave the pool room |
| `session:heartbeat` | `{ poolId }` | Keep `ActiveSession` alive (send ~every 30s) |
| `session:sync` | `{ poolId,itemId,action,currentTime }` | Playback sync to peers |
| `session:reconnect` | `{ poolId }` | Re-join room after a drop |
| `webrtc:offer` / `webrtc:answer` / `webrtc:ice_candidate` | `{ targetSocketId, … }` | WebRTC signaling relay |
| `access:revoked` | `{ poolId, targetUserId }` | Owner-driven revoke broadcast |

### Server → client
| Event | When |
| --- | --- |
| `pool:user_joined` / `pool:user_left` | A participant joins/leaves |
| `pool:updated` | Pool config changed |
| `pool:ended` / `pool:closed` | Owner ended the pool |
| `pool:expired` | Pool passed `expiresAt` (cleanup worker) |
| `pool:deleted` | Pool deleted |
| `pool:participant_removed` | Owner removed a participant |
| `access:granted` / `access:revoked` | Authorization changed (sent to `user_<userId>`) |
| `file:added` / `file:removed` | Pool file list changed |
| `session:peer_reconnected` | A peer reconnected |

> **Heartbeats matter:** a session with no heartbeat for 60s is cleaned up by the worker,
> which emits `pool:user_left` (`reason:"timeout"`).

---

## 12. Lifecycle & cleanup

A `node-cron` worker runs every 30s and is the **authoritative** source for expiry:

1. Deletes stale `ActiveSession`s (no heartbeat > 60s) → emits `pool:user_left`.
2. Flips `ACTIVE` pools past `expiresAt` to `EXPIRED` → emits `pool:expired` + `pool:closed`,
   logs `POOL_EXPIRED` activity, deletes their sessions.

Request-time checks also reject expired/ended pools, so access never relies on the client
countdown. Pool **metadata** is retained for history; **content/session** state is cleaned
up.

---

## 13. Data models (summary)

- **User** — `userId, username (unique), firstName, lastName, name, email, passwordHash,
  profilePic, deviceId, connectionStatus, tokenVersion, profileVisibility, timestamps`.
- **Pool** — `poolId, poolCode, poolName, createdBy, type(isPublic), passwordProtected,
  passwordHash, allowedUsers[], maxParticipants, currentParticipantCount, activeUsersCount,
  poolStatus, discoveryEnabled, location(2dsphere), expiresAt, endedAt, totalFiles,
  totalSize, categories, protocolType, hostDeviceId, localIp, port, timestamps`.
- **PoolParticipant** — `poolId, userId, role(OWNER|MEMBER), status(JOINED|LEFT|REMOVED),
  joinMethod, joinedAt, leftAt` (unique per pool+user).
- **PoolItem** (file metadata) — `itemId, poolId, ownerId, itemName, itemType, mimeType,
  size, duration, thumbnail, checksumHash, streamUrl, streamable, localPath`.
- **ActiveSession** — realtime presence (`sessionId, poolId, userId, lastHeartbeat, …`).
- **Activity** — feed rows (`type, userId, actorId, poolId, itemId, metadata`).
- **AccessHistory** — per-access analytics.

### Indexes
User: `email`, `username` (unique/sparse). Pool: `{status,isPublic,expiresAt}`,
`{status,expiresAt}`, `{createdBy,createdAt}`, `location:2dsphere`, `poolCode`.
PoolParticipant: unique `{poolId,userId}`, `{poolId,status}`, `{userId,status,createdAt}`.
PoolItem: `{poolId,itemType}`. Activity: `{userId,createdAt}`, `{userId,type,createdAt}`.

---

## 14. Security notes

- Passwords & pool passwords are bcrypt-hashed; never stored or returned in plaintext.
- Authorization is enforced per request: authenticated user → pool exists → active →
  role/access. Protects against IDOR, unauthorized removal/file access, expired-pool
  access, and ownership tampering.
- Input sanitization strips MongoDB operator injection (`$`/`.` keys) and escapes HTML in
  request bodies (Express-5-safe, in place).
- Device-bound JWTs + `tokenVersion` allow instant revocation.
- Sensitive endpoints are rate-limited.

---

## 15. Endpoint index

```
Auth
  POST   /api/v1/auth/register
  POST   /api/v1/auth/login
  POST   /api/v1/auth/logout            🔒
  GET    /api/v1/auth/profile           🔒

Users 🔒
  GET    /api/v1/users/me
  PATCH  /api/v1/users/me
  GET    /api/v1/users/username/check?username=
  GET    /api/v1/users/search?username=
  PUT    /api/v1/users/profile
  PATCH  /api/v1/users/connection-status

Pools 🔒
  POST   /api/v1/pools
  GET    /api/v1/pools/discover?latitude=&longitude=&radius=
  GET    /api/v1/pools/discover/nearby
  GET    /api/v1/pools/nearby
  GET    /api/v1/pools/history?type=&status=&page=&limit=
  GET    /api/v1/pools/code/:code
  GET    /api/v1/pools/:poolId
  GET    /api/v1/pools/:poolId/history
  PUT    /api/v1/pools/:poolId
  PATCH  /api/v1/pools/:poolId
  DELETE /api/v1/pools/:poolId
  PATCH  /api/v1/pools/:poolId/close
  POST   /api/v1/pools/:poolId/end
  POST   /api/v1/pools/:poolId/join
  POST   /api/v1/pools/:poolId/leave
  POST   /api/v1/pools/:poolId/verify-password
  GET    /api/v1/pools/:poolId/authorized-users
  POST   /api/v1/pools/:poolId/authorized-users
  DELETE /api/v1/pools/:poolId/authorized-users/:userId
  GET    /api/v1/pools/:poolId/participants
  DELETE /api/v1/pools/:poolId/participants/:userId
  POST   /api/v1/pools/:poolId/participants/:userId/remove

Files 🔒  (also under /items)
  POST   /api/v1/pools/:poolId/files
  GET    /api/v1/pools/:poolId/files
  GET    /api/v1/pools/:poolId/files/:itemId
  PUT    /api/v1/pools/:poolId/files/:itemId
  DELETE /api/v1/pools/:poolId/files/:itemId

History / Activity 🔒
  GET    /api/v1/activity?type=&poolId=&page=&limit=
  GET    /api/v1/history/user?limit=
  GET    /api/v1/history/pool/:poolId
  GET    /api/v1/history/item/:itemId

Health
  GET    /api/v1/health
```

🔒 = requires `Authorization: Bearer <token>`
