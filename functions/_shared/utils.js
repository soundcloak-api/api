import config from "../../config.json";

export const BASE = config.instance;
export const PREFS = config.preferences;

export function proxyImage(url, origin) {
  if (!url) return null;
  const full = url.replace("-large", "-t500x500");
  return `${origin}/api/proxy/image?url=${encodeURIComponent(full)}`;
}

export function proxyStream(url, origin) {
  if (!url) return null;
  return `${origin}/api/proxy/stream?url=${encodeURIComponent(url)}`;
}

export function scHref(userPermalink, trackPermalink) {
  if (!userPermalink || !trackPermalink) return null;
  return `https://soundcloud.com/${userPermalink}/${trackPermalink}`;
}

export function scUserHref(userPermalink) {
  if (!userPermalink) return null;
  return `https://soundcloud.com/${userPermalink}`;
}

export function scPlaylistHref(userPermalink, playlistPermalink) {
  if (!userPermalink || !playlistPermalink) return null;
  return `https://soundcloud.com/${userPermalink}/sets/${playlistPermalink}`;
}

export function getOrigin(request) {
  return new URL(request.url).origin;
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": "public, max-age=60",
    },
  });
}

export function error(message, status = 400, details = null) {
  return json({ error: message, ...(details && { details }) }, status);
}

export async function proxy(path, params = {}) {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") {
      url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "soundcloak-api/1.0", Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Upstream error: ${res.status} ${res.statusText}`);
  return res.json();
}

export function formatTrack(t, origin) {
  if (!t) return null;
  const audioFormat = PREFS.restreamAudio === "aac" ? "aac" : "mpeg";
  const userSlug = t.user?.permalink;
  const trackSlug = t.permalink;
  const originalStreamUrl = userSlug && trackSlug
    ? `${BASE}/_/api/restream/${userSlug}/${trackSlug}?audio=${audioFormat}`
    : null;

  return {
    id: t.id,
    permalink: trackSlug,
    title: t.title,
    description: t.description || null,
    artwork: proxyImage(t.artwork_url, origin),
    genre: t.genre || null,
    tags: t.tag_list || null,
    license: t.license || null,
    policy: t.policy || null,
    duration_ms: t.duration,
    plays: t.playback_count,
    likes: t.likes_count,
    reposts: t.reposts_count,
    comments: t.comment_count,
    created_at: t.created_at,
    last_modified: t.last_modified,
    soundcloud_url: scHref(userSlug, trackSlug),
    stream_url: proxyStream(originalStreamUrl, origin),
    user: t.user ? formatUser(t.user, true, origin) : null,
    publisher_metadata: t.publisher_metadata || null,
    isrc: t.publisher_metadata?.isrc || null,
    station_urn: t.station_urn || null,
  };
}

export function formatUser(u, minimal = false, origin) {
  if (!u) return null;
  const base = {
    id: u.id,
    permalink: u.permalink,
    username: u.username,
    full_name: u.full_name || null,
    avatar: proxyImage(u.avatar_url, origin),
    verified: u.verified || false,
    soundcloud_url: scUserHref(u.permalink),
  };
  if (minimal) return base;
  return {
    ...base,
    description: u.description || null,
    followers: u.followers_count,
    following: u.followings_count,
    likes: u.likes_count,
    tracks: u.track_count,
    playlists: u.playlist_count,
    created_at: u.created_at,
    last_modified: u.last_modified,
    links: (u.web_profiles || []).map((l) => ({ title: l.title, url: l.url })),
    station_urn: u.station_urn || null,
    rss_url: u.permalink ? `${BASE}/_/rss/${u.permalink}` : null,
  };
}

export function formatPlaylist(p, includeTracks = false, origin) {
  if (!p) return null;
  const result = {
    id: p.id,
    permalink: p.permalink,
    title: p.title,
    description: p.description || null,
    artwork: proxyImage(p.artwork_url, origin),
    kind: p.kind,
    is_album: p.is_album || false,
    track_count: p.track_count,
    likes: p.likes_count,
    tags: p.tag_list || null,
    created_at: p.created_at,
    last_modified: p.last_modified,
    soundcloud_url: scPlaylistHref(p.user?.permalink, p.permalink),
    user: p.user ? formatUser(p.user, true, origin) : null,
  };
  if (includeTracks && p.tracks) {
    result.tracks = p.tracks.map((t) => formatTrack(t, origin));
  }
  return result;
}

export function formatPaginated(data, formatter) {
  const collection = (data.collection || []).map(formatter);
  const result = {
    total: data.total_results ?? data.total ?? collection.length,
    count: collection.length,
    collection,
  };
  if (data.next_href) {
    try {
      const u = new URL(data.next_href);
      result.next_cursor = u.search.slice(1);
    } catch {
      result.next_cursor = null;
    }
  } else {
    result.next_cursor = null;
  }
  return result;
}

export function parsePagination(url) {
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") || config.pagination.defaultLimit, 10),
    config.pagination.maxLimit
  );
  const cursor = url.searchParams.get("cursor") || null;
  const offset = parseInt(url.searchParams.get("offset") || 0, 10);
  return { limit, cursor, offset };
}

export function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}