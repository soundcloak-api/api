import express from 'express';
import fs from 'fs';
import {
  json, error, proxy, getOrigin,
  formatTrack, formatUser, formatPlaylist, formatPaginated, parsePagination,
  handleOptions, proxyImage, proxyStream, BASE, PREFS
} from './utils.js';

let cachedClientId = null;
let clientIdExpiry = 0;

async function getSoundCloudClientId() {
  if (cachedClientId && Date.now() < clientIdExpiry) return cachedClientId;

  const page = await fetch('https://soundcloud.com', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
  });
  const html = await page.text();

  const scripts = [...html.matchAll(/<script[^>]+src="(https:\/\/a-v2\.sndcdn\.com\/assets\/[^"]+\.js)"/g)].map(m => m[1]);

  for (const src of scripts.slice(-5)) {
    const js = await fetch(src, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const text = await js.text();
    const match = text.match(/client_id\s*:\s*"([a-zA-Z0-9]{32})"/);
    if (match) {
      cachedClientId = match[1];
      clientIdExpiry = Date.now() + 1000 * 60 * 60 * 6;
      return cachedClientId;
    }
  }

  throw new Error('Could not extract SoundCloud client_id');
}

const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

const app = express();
const PORT = process.env.PORT || 7860;

app.use(express.json());

app.get('/', (req, res) => {
  res.redirect('/api');
});

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

const getOriginFromRequest = (req) => {
  return `${req.protocol}://${req.get('host')}`;
};

app.get('/api', (req, res) => {
  const origin = getOriginFromRequest(req);
  res.json({
    name: "soundcloak-api",
    version: "1.0.0",
    description: "JSON REST API wrapper for soundcloak / SoundCloud",
    instance: config.instance,
    config: config.preferences,
    endpoints: {
      search: {
        "GET /api/search": "Search anything (tracks, users, playlists)",
        params: {
          q: "Search query (required)",
          type: "any | tracks | users | playlists (default: any)",
          limit: "Results per page (default: 20, max: 50)",
          cursor: "Pagination cursor from next_cursor field",
        },
      },
      tracks: {
        "GET /api/track/:user/:permalink": "Get track details + stream URL",
        "GET /api/track/:user/:permalink/related": "Related tracks",
        "GET /api/track/:user/:permalink/comments": "Track comments",
        "GET /api/track/:user/:permalink/albums": "Albums containing track",
        "GET /api/track/:user/:permalink/playlists": "Playlists containing track",
      },
      users: {
        "GET /api/user/:permalink": "Get user profile",
        "GET /api/user/:permalink/tracks": "User tracks",
        "GET /api/user/:permalink/popular-tracks": "User's popular tracks",
        "GET /api/user/:permalink/playlists": "User playlists",
        "GET /api/user/:permalink/albums": "User albums",
        "GET /api/user/:permalink/reposts": "User reposts",
        "GET /api/user/:permalink/likes": "User likes",
        "GET /api/user/:permalink/followers": "User followers",
        "GET /api/user/:permalink/following": "Users this person follows",
        "GET /api/user/:permalink/related": "Related/similar users",
      },
      playlists: {
        "GET /api/playlist/:user/:permalink": "Get playlist with tracks",
      },
      discover: {
        "GET /api/discover": "Discover featured playlists & selections",
      },
      tags: {
        "GET /api/tags/:tag": "Recent tracks for a tag",
        "GET /api/tags/:tag/popular": "Popular tracks for a tag",
        "GET /api/tags/:tag/playlists": "Playlists for a tag",
      },
    },
  });
});

app.get('/api/search', async (req, res) => {
  try {
    const origin = getOriginFromRequest(req);
    const q = req.query.q;
    if (!q) return errorResponse(res, "Missing required param: q");

    const type = req.query.type || "any";
    const { limit, cursor } = parsePaginationFromQuery(req.query);

    const validTypes = ["any", "tracks", "users", "playlists"];
    if (!validTypes.includes(type)) return errorResponse(res, `Invalid type. Must be one of: ${validTypes.join(", ")}`);

    let path;
    const params = { q, limit };
    if (cursor) params.pagination = cursor;

    if (type === "any") path = "/_/api/v2/search";
    else if (type === "tracks") path = "/_/api/v2/search/tracks";
    else if (type === "users") path = "/_/api/v2/search/users";
    else if (type === "playlists") path = "/_/api/v2/search/playlists";

    const data = await proxy(path, params);

    let formatted;
    if (type === "tracks") {
      formatted = formatPaginated(data, (t) => formatTrack(t, origin));
    } else if (type === "users") {
      formatted = formatPaginated(data, (u) => formatUser(u, false, origin));
    } else if (type === "playlists") {
      formatted = formatPaginated(data, (p) => formatPlaylist(p, false, origin));
    } else {
      formatted = formatPaginated(data, (item) => {
        if (item.kind === "track") return { kind: "track", ...formatTrack(item, origin) };
        if (item.kind === "user") return { kind: "user", ...formatUser(item, false, origin) };
        if (item.kind === "playlist" || item.kind === "album") return { kind: item.kind, ...formatPlaylist(item, false, origin) };
        return { kind: item.kind, raw: item };
      });
    }

    res.json({ query: q, type, ...formatted });
  } catch (err) {
    errorResponse(res, "Search failed", 502, err.message);
  }
});

app.get('/api/track/:user/:permalink', async (req, res) => {
  try {
    const { user, permalink } = req.params;
    if (!user || !permalink) return errorResponse(res, "Missing user or permalink");
    const origin = getOriginFromRequest(req);
    const commentLimit = Math.min(parseInt(req.query.comment_limit || "10", 10), 50);

    const data = await proxy("/_/api/v2/resolve", {
      url: `https://soundcloud.com/${user}/${permalink}`,
    });
    if (!data || data.kind !== "track") return errorResponse(res, "Track not found", 404);

    const audioFormat = PREFS.restreamAudio === "aac" ? "aac" : "mpeg";
    const track = formatTrack(data, origin);
    track.stream_url = `${BASE}/_/api/restream/${user}/${permalink}?audio=${audioFormat}`;
    track.download_url = `${BASE}/_/download/${user}/${permalink}`;
    track.station_urn = data.station_urn || (data.id ? `soundcloud:system-playlists:track-stations:${data.id}` : null);
    track.links = {
      related: `${origin}/api/track/${user}/${permalink}/related`,
      comments: `${origin}/api/track/${user}/${permalink}/comments`,
      albums: `${origin}/api/track/${user}/${permalink}/albums`,
      playlists: `${origin}/api/track/${user}/${permalink}/playlists`,
    };

    const commentData = await proxy(`/_/api/v2/tracks/${data.id}/comments`, {
      limit: commentLimit,
      threaded: 1,
    });
    const comments = formatPaginated(commentData, (c) => formatComment(c, origin));
    track.comments_preview = comments;

    res.json(track);
  } catch (err) {
    errorResponse(res, "Track fetch failed", 502, err.message);
  }
});

app.get('/api/track/:user/:permalink/related', async (req, res) => {
  try {
    const { user, permalink } = req.params;
    const origin = getOriginFromRequest(req);
    const { limit, cursor } = parsePaginationFromQuery(req.query);

    const data = await proxy("/_/api/v2/resolve", {
      url: `https://soundcloud.com/${user}/${permalink}`,
    });
    if (!data || data.kind !== "track") return errorResponse(res, "Track not found", 404);

    const relatedData = await proxy(`/_/api/v2/tracks/${data.id}/related`, { limit, cursor });
    const formatted = formatPaginated(relatedData, (t) => formatTrack(t, origin));

    res.json(formatted);
  } catch (err) {
    errorResponse(res, "Related tracks fetch failed", 502, err.message);
  }
});

app.get('/api/track/:user/:permalink/comments', async (req, res) => {
  try {
    const { user, permalink } = req.params;
    const origin = getOriginFromRequest(req);
    const { limit, cursor } = parsePaginationFromQuery(req.query);

    const data = await proxy("/_/api/v2/resolve", {
      url: `https://soundcloud.com/${user}/${permalink}`,
    });
    if (!data || data.kind !== "track") return errorResponse(res, "Track not found", 404);

    const commentData = await proxy(`/_/api/v2/tracks/${data.id}/comments`, {
      limit,
      threaded: 1,
      cursor,
    });
    const formatted = formatPaginated(commentData, (c) => formatComment(c, origin));

    res.json(formatted);
  } catch (err) {
    errorResponse(res, "Comments fetch failed", 502, err.message);
  }
});

app.get('/api/track/:user/:permalink/albums', async (req, res) => {
  try {
    const { user, permalink } = req.params;
    const origin = getOriginFromRequest(req);
    const { limit, cursor } = parsePaginationFromQuery(req.query);

    const data = await proxy("/_/api/v2/resolve", {
      url: `https://soundcloud.com/${user}/${permalink}`,
    });
    if (!data || data.kind !== "track") return errorResponse(res, "Track not found", 404);

    const albumsData = await proxy(`/_/api/v2/tracks/${data.id}/albums`, { limit, cursor });
    const formatted = formatPaginated(albumsData, (p) => formatPlaylist(p, false, origin));

    res.json(formatted);
  } catch (err) {
    errorResponse(res, "Albums fetch failed", 502, err.message);
  }
});

app.get('/api/track/:user/:permalink/playlists', async (req, res) => {
  try {
    const { user, permalink } = req.params;
    const origin = getOriginFromRequest(req);
    const { limit, cursor } = parsePaginationFromQuery(req.query);

    const data = await proxy("/_/api/v2/resolve", {
      url: `https://soundcloud.com/${user}/${permalink}`,
    });
    if (!data || data.kind !== "track") return errorResponse(res, "Track not found", 404);

    const playlistsData = await proxy(`/_/api/v2/tracks/${data.id}/playlists`, { limit, cursor });
    const formatted = formatPaginated(playlistsData, (p) => formatPlaylist(p, false, origin));

    res.json(formatted);
  } catch (err) {
    errorResponse(res, "Playlists fetch failed", 502, err.message);
  }
});

app.get('/api/user/:permalink', async (req, res) => {
  try {
    const origin = getOriginFromRequest(req);
    const { permalink } = req.params;
    if (!permalink) return errorResponse(res, "Missing permalink");

    const data = await proxy("/_/api/v2/resolve", { url: `https://soundcloud.com/${permalink}` });
    if (!data || data.kind !== "user") return errorResponse(res, "User not found", 404);

    const user = formatUser(data, false, origin);

    user.station_urn = data.station_urn || (data.id ? `soundcloud:system-playlists:artist-stations:${data.id}` : null);
    user.links = {
      tracks: `${origin}/api/user/${permalink}/tracks`,
      popular_tracks: `${origin}/api/user/${permalink}/popular-tracks`,
      playlists: `${origin}/api/user/${permalink}/playlists`,
      albums: `${origin}/api/user/${permalink}/albums`,
      reposts: `${origin}/api/user/${permalink}/reposts`,
      likes: `${origin}/api/user/${permalink}/likes`,
      followers: `${origin}/api/user/${permalink}/followers`,
      following: `${origin}/api/user/${permalink}/following`,
      related: `${origin}/api/user/${permalink}/related`,
    };

    res.json(user);
  } catch (err) {
    errorResponse(res, "User fetch failed", 502, err.message);
  }
});

app.get('/api/user/:permalink/tracks', async (req, res) => {
  try {
    const { permalink } = req.params;
    const origin = getOriginFromRequest(req);
    const { limit, cursor } = parsePaginationFromQuery(req.query);

    const data = await proxy("/_/api/v2/resolve", { url: `https://soundcloud.com/${permalink}` });
    if (!data || data.kind !== "user") return errorResponse(res, "User not found", 404);

    const tracksData = await proxy(`/_/api/v2/users/${data.id}/tracks`, { limit, cursor });
    const formatted = formatPaginated(tracksData, (t) => formatTrack(t, origin));

    res.json(formatted);
  } catch (err) {
    errorResponse(res, "User tracks fetch failed", 502, err.message);
  }
});

app.get('/api/user/:permalink/popular-tracks', async (req, res) => {
  try {
    const { permalink } = req.params;
    const origin = getOriginFromRequest(req);

    const data = await proxy("/_/api/v2/resolve", { url: `https://soundcloud.com/${permalink}` });
    if (!data || data.kind !== "user") return errorResponse(res, "User not found", 404);

    const tracksData = await proxy(`/_/api/v2/users/${data.id}/toptracks`, { limit: 20 });
    const tracks = (tracksData.collection || []).map((t) => formatTrack(t, origin));

    res.json({
      user: { id: data.id, permalink: data.permalink, username: data.username },
      count: tracks.length,
      collection: tracks,
    });
  } catch (err) {
    errorResponse(res, "Popular tracks fetch failed", 502, err.message);
  }
});

app.get('/api/user/:permalink/playlists', async (req, res) => {
  try {
    const { permalink } = req.params;
    const origin = getOriginFromRequest(req);
    const { limit, cursor } = parsePaginationFromQuery(req.query);

    const data = await proxy("/_/api/v2/resolve", { url: `https://soundcloud.com/${permalink}` });
    if (!data || data.kind !== "user") return errorResponse(res, "User not found", 404);

    const playlistsData = await proxy(`/_/api/v2/users/${data.id}/playlists`, { limit, cursor });
    const formatted = formatPaginated(playlistsData, (p) => formatPlaylist(p, false, origin));

    res.json(formatted);
  } catch (err) {
    errorResponse(res, "User playlists fetch failed", 502, err.message);
  }
});

app.get('/api/user/:permalink/albums', async (req, res) => {
  try {
    const { permalink } = req.params;
    const origin = getOriginFromRequest(req);
    const { limit, cursor } = parsePaginationFromQuery(req.query);

    const data = await proxy("/_/api/v2/resolve", { url: `https://soundcloud.com/${permalink}` });
    if (!data || data.kind !== "user") return errorResponse(res, "User not found", 404);

    const albumsData = await proxy(`/_/api/v2/users/${data.id}/albums`, { limit, cursor });
    const formatted = formatPaginated(albumsData, (p) => formatPlaylist(p, false, origin));

    res.json(formatted);
  } catch (err) {
    errorResponse(res, "User albums fetch failed", 502, err.message);
  }
});

app.get('/api/user/:permalink/reposts', async (req, res) => {
  try {
    const { permalink } = req.params;
    const origin = getOriginFromRequest(req);
    const { limit, cursor } = parsePaginationFromQuery(req.query);

    const user = await proxy("/_/api/v2/resolve", { url: `https://soundcloud.com/${permalink}` });
    if (!user || user.kind !== "user") return errorResponse(res, "User not found", 404);

    const clientId = await getSoundCloudClientId();
    const params = new URLSearchParams({ limit, client_id: clientId });
    if (cursor) params.set('pagination', cursor);

    const scRes = await fetch(`https://api-v2.soundcloud.com/stream/users/${user.id}/reposts?${params}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
    });

    if (!scRes.ok) return errorResponse(res, "Upstream reposts fetch failed", 502, `HTTP ${scRes.status}`);

    const data = await scRes.json();
    const formatted = formatPaginated(data, (r) => {
      if (r.type === "track-repost" && r.track) return { kind: "track", ...formatTrack(r.track, origin) };
      if (r.type === "playlist-repost" && r.playlist) return { kind: "playlist", ...formatPlaylist(r.playlist, false, origin) };
      return { kind: r.type || "unknown", raw: r };
    });

    res.json(formatted);
  } catch (err) {
    errorResponse(res, "User reposts fetch failed", 502, err.message);
  }
});

app.get('/api/user/:permalink/likes', async (req, res) => {
  try {
    const { permalink } = req.params;
    const origin = getOriginFromRequest(req);
    const { limit, cursor } = parsePaginationFromQuery(req.query);

    const data = await proxy("/_/api/v2/resolve", { url: `https://soundcloud.com/${permalink}` });
    if (!data || data.kind !== "user") return errorResponse(res, "User not found", 404);

    const params = { limit };
    if (cursor) params.pagination = cursor;
    const likesData = await proxy(`/_/api/v2/users/${data.id}/likes`, params);
    const formatted = formatPaginated(likesData, (l) => {
      if (l.track) return { kind: "track", ...formatTrack(l.track, origin) };
      if (l.playlist) return { kind: "playlist", ...formatPlaylist(l.playlist, false, origin) };
      return { kind: "unknown", raw: l };
    });

    res.json(formatted);
  } catch (err) {
    errorResponse(res, "User likes fetch failed", 502, err.message);
  }
});

app.get('/api/user/:permalink/followers', async (req, res) => {
  try {
    const { permalink } = req.params;
    const origin = getOriginFromRequest(req);
    const { limit, cursor } = parsePaginationFromQuery(req.query);

    const data = await proxy("/_/api/v2/resolve", { url: `https://soundcloud.com/${permalink}` });
    if (!data || data.kind !== "user") return errorResponse(res, "User not found", 404);

    const followersData = await proxy(`/_/api/v2/users/${data.id}/followers`, { limit, cursor });
    const formatted = formatPaginated(followersData, (u) => formatUser(u, false, origin));

    res.json(formatted);
  } catch (err) {
    errorResponse(res, "User followers fetch failed", 502, err.message);
  }
});

app.get('/api/user/:permalink/following', async (req, res) => {
  try {
    const { permalink } = req.params;
    const origin = getOriginFromRequest(req);
    const { limit, cursor } = parsePaginationFromQuery(req.query);

    const data = await proxy("/_/api/v2/resolve", { url: `https://soundcloud.com/${permalink}` });
    if (!data || data.kind !== "user") return errorResponse(res, "User not found", 404);

    const followingData = await proxy(`/_/api/v2/users/${data.id}/following`, { limit, cursor });
    const formatted = formatPaginated(followingData, (u) => formatUser(u, false, origin));

    res.json(formatted);
  } catch (err) {
    errorResponse(res, "User following fetch failed", 502, err.message);
  }
});

app.get('/api/user/:permalink/related', async (req, res) => {
  try {
    const { permalink } = req.params;
    const origin = getOriginFromRequest(req);

    const data = await proxy("/_/api/v2/resolve", { url: `https://soundcloud.com/${permalink}` });
    if (!data || data.kind !== "user") return errorResponse(res, "User not found", 404);

    const relatedData = await proxy(`/_/api/v2/users/${data.id}/relatedartists`, { limit: 20 });
    const users = (relatedData.collection || []).map((u) => formatUser(u, false, origin));

    res.json({
      user: { id: data.id, permalink: data.permalink, username: data.username },
      count: users.length,
      collection: users,
    });
  } catch (err) {
    errorResponse(res, "Related users fetch failed", 502, err.message);
  }
});

app.get('/api/playlist/:user/:permalink', async (req, res) => {
  try {
    const origin = getOriginFromRequest(req);
    const { user, permalink } = req.params;
    const includeTracks = req.query.tracks !== "false";
    const paginationParam = req.query.pagination;

    const data = await proxy("/_/api/v2/resolve", {
      url: `https://soundcloud.com/${user}/sets/${permalink}`,
    });

    if (!data || (data.kind !== "playlist" && data.kind !== "album")) return errorResponse(res, "Playlist not found", 404);

    const fmt = PREFS.restreamAudio === "aac" ? "aac" : "mpeg";

    const playlist = formatPlaylist(data, false, origin);

    if (includeTracks) {
      let tracks;

      if (paginationParam) {
        const ids = paginationParam.split(",").map((id) => id.trim()).filter(Boolean);
        const chunks = [];
        for (let i = 0; i < ids.length; i += 50) {
          chunks.push(ids.slice(i, i + 50));
        }
        const fetched = await Promise.all(
          chunks.map((chunk) =>
            proxy("/_/api/v2/tracks", { ids: chunk.join(",") })
          )
        );
        const trackMap = new Map();
        for (const batch of fetched) {
          for (const t of Array.isArray(batch) ? batch : (batch.collection || [])) {
            trackMap.set(String(t.id), t);
          }
        }
        const allIds = paginationParam.split(",").map((id) => id.trim()).filter(Boolean);
        tracks = allIds.map((id) => {
          const t = trackMap.get(id);
          if (!t) return { id: Number(id), stream_url: null, user: null };
          const formatted = formatTrack(t, origin);
          if (formatted?.user?.permalink && formatted?.permalink) {
            formatted.stream_url = `${BASE}/_/api/restream/${formatted.user.permalink}/${formatted.permalink}?audio=${fmt}`;
          }
          return formatted;
        });
      } else {
        tracks = (data.tracks || []).map((t) => {
          const formatted = formatTrack(t, origin);
          if (formatted?.user?.permalink && formatted?.permalink) {
            formatted.stream_url = `${BASE}/_/api/restream/${formatted.user.permalink}/${formatted.permalink}?audio=${fmt}`;
          }
          return formatted;
        });

        const stubIds = tracks
          .filter((t) => !t.title)
          .map((t) => String(t.id));

        if (stubIds.length > 0) {
          const chunks = [];
          for (let i = 0; i < stubIds.length; i += 50) {
            chunks.push(stubIds.slice(i, i + 50));
          }
          const fetched = await Promise.all(
            chunks.map((chunk) =>
              proxy("/_/api/v2/tracks", { ids: chunk.join(",") })
            )
          );
          const stubMap = new Map();
          for (const batch of fetched) {
            for (const t of Array.isArray(batch) ? batch : (batch.collection || [])) {
              stubMap.set(String(t.id), t);
            }
          }
          tracks = tracks.map((t) => {
            if (t.title) return t;
            const full = stubMap.get(String(t.id));
            if (!full) return t;
            const formatted = formatTrack(full, origin);
            if (formatted?.user?.permalink && formatted?.permalink) {
              formatted.stream_url = `${BASE}/_/api/restream/${formatted.user.permalink}/${formatted.permalink}?audio=${fmt}`;
            }
            return formatted;
          });
        }

        const remainingStubs = tracks.filter((t) => !t.title).map((t) => String(t.id));
        if (remainingStubs.length > 0) {
          playlist.next_cursor = remainingStubs.join(",");
        }
      }

      playlist.tracks = tracks;
    }

    res.json(playlist);
  } catch (err) {
    errorResponse(res, "Playlist fetch failed", 502, err.message);
  }
});

app.get('/api/discover', async (req, res) => {
  try {
    const origin = getOriginFromRequest(req);

    const data = await proxy("/_/api/v2/mixed-selections", { variant_ids: "promoted_tracks" });

    const selections = (data.collection || [])
      .filter((s) => s.items?.collection?.length > 0)
      .map((sel) => ({
        id: sel.id,
        title: sel.title,
        description: sel.description || null,
        kind: sel.kind,
        items: (sel.items?.collection || []).map((item) => {
          if (item.kind === "track") return { kind: "track", ...formatTrack(item, origin) };
          if (item.kind === "playlist" || item.kind === "album") return { kind: item.kind, ...formatPlaylist(item, false, origin) };
          if (item.kind === "user") return { kind: "user", ...formatUser(item, false, origin) };
          return {
            kind: item.kind,
            id: item.id,
            permalink: item.permalink,
            title: item.title || item.username,
            artwork: proxyImage(item.artwork_url || item.avatar_url, origin),
            href: item.permalink ? `${origin}/${item.permalink}` : null,
          };
        }),
      }));

    res.json({ count: selections.length, collection: selections });
  } catch (err) {
    errorResponse(res, "Failed to fetch discover feed", 502, err.message);
  }
});

app.get('/api/tags/:tag', async (req, res) => {
  try {
    const { tag } = req.params;
    const origin = getOriginFromRequest(req);
    const { limit, cursor } = parsePaginationFromQuery(req.query);

    const data = await proxy(`/_/api/v2/tags/${tag}`, { limit, cursor });
    const formatted = formatPaginated(data, (t) => formatTrack(t, origin));

    res.json(formatted);
  } catch (err) {
    errorResponse(res, "Tag tracks fetch failed", 502, err.message);
  }
});

app.get('/api/tags/:tag/popular', async (req, res) => {
  try {
    const { tag } = req.params;
    const origin = getOriginFromRequest(req);
    const { limit, cursor } = parsePaginationFromQuery(req.query);

    const data = await proxy(`/_/api/v2/tags/${tag}/popular`, { limit, cursor });
    const formatted = formatPaginated(data, (t) => formatTrack(t, origin));

    res.json(formatted);
  } catch (err) {
    errorResponse(res, "Popular tag tracks fetch failed", 502, err.message);
  }
});

app.get('/api/tags/:tag/playlists', async (req, res) => {
  try {
    const { tag } = req.params;
    const origin = getOriginFromRequest(req);
    const { limit, cursor } = parsePaginationFromQuery(req.query);

    const data = await proxy(`/_/api/v2/tags/${tag}/playlists`, { limit, cursor });
    const formatted = formatPaginated(data, (p) => formatPlaylist(p, false, origin));

    res.json(formatted);
  } catch (err) {
    errorResponse(res, "Tag playlists fetch failed", 502, err.message);
  }
});

const ALLOWED_HOSTS = ["sc1.maid.zone"];

app.get('/api/proxy/stream', async (req, res) => {
  if (!config.preferences.proxyStreams) {
    return res.status(403).json({ error: "Stream proxying is disabled in config" });
  }

  const target = req.query.url;

  if (!target) {
    return res.status(400).json({ error: "Missing url param" });
  }

  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return res.status(400).json({ error: "Invalid url" });
  }

  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    return res.status(403).json({ error: "Host not allowed" });
  }

  try {
    const response = await fetch(parsed.toString(), {
      headers: { "User-Agent": "soundcloak-api/1.0" },
    });

    if (!response.ok) {
      return res.status(502).json({ error: "Stream fetch failed", status: response.status });
    }

    const contentType = response.headers.get("content-type") || "audio/mpeg";

    res.header('Content-Type', contentType);
    res.header('Cache-Control', 'public, max-age=3600');
    res.header('Access-Control-Allow-Origin', '*');

    response.body.pipe(res);
  } catch (err) {
    res.status(502).json({ error: "Stream proxy failed", message: err.message });
  }
});

app.get('/api/proxy/image', async (req, res) => {
  if (!config.preferences.proxyImages) {
    return res.status(403).json({ error: "Image proxying is disabled in config" });
  }

  const target = req.query.url;

  if (!target) {
    return res.status(400).json({ error: "Missing url param" });
  }

  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return res.status(400).json({ error: "Invalid url" });
  }

  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    return res.status(403).json({ error: "Host not allowed" });
  }

  try {
    const response = await fetch(parsed.toString(), {
      headers: { "User-Agent": "soundcloak-api/1.0" },
    });

    if (!response.ok) {
      return res.status(502).json({ error: "Image fetch failed", status: response.status });
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";

    res.header('Content-Type', contentType);
    res.header('Cache-Control', 'public, max-age=3600');
    res.header('Access-Control-Allow-Origin', '*');

    response.body.pipe(res);
  } catch (err) {
    res.status(502).json({ error: "Image proxy failed", message: err.message });
  }
});

function errorResponse(res, message, status = 400, details = null) {
  res.status(status).json({ error: message, ...(details && { details }) });
}

function parsePaginationFromQuery(query) {
  const limit = Math.min(
    parseInt(query.limit || config.pagination.defaultLimit, 10),
    config.pagination.maxLimit
  );
  const cursor = query.cursor || null;
  const offset = parseInt(query.offset || 0, 10);
  return { limit, cursor, offset };
}

function formatComment(c, origin) {
  return {
    id: c.id,
    body: c.body,
    timestamp_ms: c.timestamp,
    created_at: c.created_at,
    author: formatUser(c.user, true, origin),
  };
}

app.listen(PORT, () => {
  console.log(`SoundCloud API server running on port http://localhost:${PORT}`);
});