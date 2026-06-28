---
title: soundcloak-api
emoji: 🎵
colorFrom: blue
colorTo: indigo
sdk: docker
pinned: false
license: other
app_file: server.js
---

![Banner](/public/assets/banner.png)

# soundcloak-api

A JSON REST API wrapper for [soundcloak](https://git.maid.zone/stuff/soundcloak) — a SoundCloud privacy frontend.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/track/:user/:permalink` | Track details + stream URL |
| GET | `/api/track/:user/:permalink/related` | Related tracks |
| GET | `/api/track/:user/:permalink/comments` | Track comments |
| GET | `/api/track/:user/:permalink/albums` | Albums containing track |
| GET | `/api/track/:user/:permalink/playlists` | Playlists containing track |
| GET | `/api/user/:permalink` | User profile + sub-endpoint links |
| GET | `/api/user/:permalink/tracks` | User tracks |
| GET | `/api/user/:permalink/popular-tracks` | User's top tracks |
| GET | `/api/user/:permalink/playlists` | User playlists |
| GET | `/api/user/:permalink/albums` | User albums |
| GET | `/api/user/:permalink/reposts` | User reposts |
| GET | `/api/user/:permalink/likes` | User likes |
| GET | `/api/user/:permalink/followers` | User followers |
| GET | `/api/user/:permalink/following` | Users this person follows |
| GET | `/api/user/:permalink/related` | Related artists |
| GET | `/api/playlist/:user/:permalink` | Playlist with tracks |
| GET | `/api/search` | Search tracks, users, playlists |
| GET | `/api/discover` | Featured playlists and selections |
| GET | `/api/tags/:tag` | Recent tracks for a tag |
| GET | `/api/tags/:tag/popular` | Popular tracks for a tag |
| GET | `/api/tags/:tag/playlists` | Playlists for a tag |
| GET | `/api/proxy/image` | Proxied artwork image |
| GET | `/api/proxy/stream` | Proxied audio stream |

## Pagination

Endpoints that return lists accept these query params:

| Param | Default | Max | Description |
|-------|---------|-----|-------------|
| `limit` | 20 | 50 | Results per page |
| `cursor` | — | — | Value from `next_cursor` in previous response |

Responses include `next_cursor` when more pages exist. Pass it as `?cursor=` on the next request.

The playlist endpoint additionally supports `?pagination=id1,id2,...` for fetching specific track IDs by page — this mirrors soundcloak's native pagination format.

## Stack

- **Runtime:** Node.js with Express
- **Container:** Docker with Alpine Linux
- **Upstream:** soundcloak `/api/v2` proxy
- **Config:** `config.json` at project root

## Documentation

See the [`DOCUMENTATION`](/DOCUMENTATION) folder for per-endpoint details, response shapes, and examples.