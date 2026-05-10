# soundcloak-api

A JSON REST API wrapper for [soundcloak](https://git.maid.zone/stuff/soundcloak) — a SoundCloud privacy frontend. Deploy it to Cloudflare Pages in minutes.

## Deploy to Cloudflare Pages

```bash
git clone <this-repo>
cd soundcloak-api
npm install
npm run deploy
```

Or connect the repo to Cloudflare Pages dashboard with:
- **Build command**: *(leave empty)*
- **Build output directory**: `public`
- **Root directory**: `/`

No build step required — Cloudflare Pages Functions handles routing automatically.

---

## Configuration

Edit `config.json` to point at your soundcloak instance and set defaults:

```json
{
  "instance": "https://sc1.maid.zone",
  "preferences": {
    "player": "restream",
    "restreamAudio": "mp3",
    "hlsAudio": "aac",
    "autoplayNextTrack": true,
    "defaultAutoplayMode": "normal",
    "autoplayNextRelatedTrack": true
  },
  "pagination": {
    "defaultLimit": 20,
    "maxLimit": 50
  }
}
```

| Key | Values | Description |
|---|---|---|
| `instance` | URL | Your soundcloak instance base URL |
| `restreamAudio` | `mp3` \| `aac` | Audio format for stream URLs |
| `defaultLimit` | number | Default results per page |
| `maxLimit` | number | Max results per page (cap) |

---

## Endpoints

### `GET /api`
Returns this documentation as JSON.

---

### Search

#### `GET /api/search`
Search tracks, users, playlists or everything.

| Param | Type | Required | Description |
|---|---|---|---|
| `q` | string | ✅ | Search query |
| `type` | `any` \| `tracks` \| `users` \| `playlists` | | Default: `any` |
| `limit` | number | | Results per page (max from config) |
| `cursor` | string | | `next_cursor` from previous response |

**Response:**
```json
{
  "query": "lofi beats",
  "type": "tracks",
  "total": 1000,
  "count": 20,
  "next_cursor": "limit=20&offset=20&...",
  "collection": [
    {
      "id": 123456,
      "permalink": "lofi-beats-vol-1",
      "title": "Lofi Beats Vol. 1",
      "artwork": "https://...",
      "genre": "Lo-fi",
      "duration_ms": 180000,
      "plays": 50000,
      "likes": 1200,
      "stream_url": "https://your-domain.com/api/proxy/stream?url=https%3A%2F%2Fsc1.maid.zone%2F_%2Fapi%2Frestream%2Fartist%2Flofi-beats-vol-1%3Faudio%3Dmpeg",
      "user": { "permalink": "artist", "username": "Artist Name", ... }
    }
  ]
}
```

---

### Tracks

#### `GET /api/track/:user/:permalink`
Get full track details including stream URL.

```
GET /api/track/rick-astley/never-gonna-give-you-up
```

**Response fields:**
| Field | Description |
|---|---|
| `stream_url` | Direct audio stream (mp3/aac per config) |
| `isrc` | ISRC code if available |
| `policy` | `allow`, `snip` (30s only), `block` |
| `station` | Station URN for radio mode |

---

#### `GET /api/track/:user/:permalink/related`
Related tracks recommendations.

| Param | Description |
|---|---|
| `limit` | Results per page |
| `cursor` | Pagination cursor |

---

#### `GET /api/track/:user/:permalink/comments`
Track comments (threaded).

| Param | Description |
|---|---|
| `limit` | Results per page |
| `cursor` | Pagination cursor |

**Comment shape:**
```json
{
  "id": 789,
  "body": "🔥🔥🔥",
  "timestamp_ms": 42000,
  "created_at": "2023-01-01T00:00:00Z",
  "author": { "permalink": "commenter", "username": "Commenter", ... }
}
```

---

#### `GET /api/track/:user/:permalink/albums`
Albums that contain this track.

#### `GET /api/track/:user/:permalink/playlists`
Playlists that contain this track.

---

### Users

#### `GET /api/user/:permalink`
Full user profile.

```
GET /api/user/rick-astley
```

**Response includes:** followers, following, track count, playlist count, web links, creation date.

---

#### `GET /api/user/:permalink/tracks`
User's tracks.

#### `GET /api/user/:permalink/popular-tracks`
User's most-played tracks.

#### `GET /api/user/:permalink/playlists`
User's playlists (excludes albums).

#### `GET /api/user/:permalink/albums`
User's albums.

#### `GET /api/user/:permalink/reposts`
User's reposts. Mixed `kind: "track" | "playlist"`.

#### `GET /api/user/:permalink/likes`
User's liked tracks and playlists. Mixed `kind: "track" | "playlist"`.

#### `GET /api/user/:permalink/followers`
Users who follow this user.

#### `GET /api/user/:permalink/following`
Users this person follows.

#### `GET /api/user/:permalink/related`
Similar/related artist recommendations.

---

### Playlists & Albums

#### `GET /api/playlist/:user/:permalink`
Get playlist/album with tracks.

```
GET /api/playlist/rick-astley/greatest-hits
```

| Param | Default | Description |
|---|---|---|
| `tracks` | `true` | Set `false` to skip track list |

---

### Discover

#### `GET /api/discover`
Curated featured selections (mixed tracks, playlists, users).

```json
{
  "count": 5,
  "collection": [
    {
      "id": "featured:trending",
      "title": "Trending",
      "kind": "selection",
      "items": [...]
    }
  ]
}
```

---

### Tags

#### `GET /api/tags/:tag`
Recent tracks with this tag.

#### `GET /api/tags/:tag/popular`
Popular tracks with this tag.

#### `GET /api/tags/:tag/playlists`
Playlists with this tag.

---

## Pagination

All list endpoints return:
```json
{
  "total": 1000,
  "count": 20,
  "next_cursor": "limit=20&offset=20&linked_partitioning=1",
  "collection": [...]
}
```

To get the next page, pass `next_cursor` as the `cursor` param:
```
GET /api/search?q=lofi&cursor=limit%3D20%26offset%3D20%26...
```

If `next_cursor` is `null`, you've reached the end.

---

## Error Responses

```json
{
  "error": "Track not found",
  "details": "Upstream error: 404 Not Found"
}
```

| Status | Meaning |
|---|---|
| `400` | Bad request / missing params |
| `404` | Resource not found |
| `502` | Upstream soundcloak error |

---

## CORS

All endpoints include:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, OPTIONS
```

Safe to call from any browser origin.