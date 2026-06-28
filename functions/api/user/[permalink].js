import {
  json, error, proxy, handleOptions, getOrigin,
  formatUser
} from "../../_shared/utils.js";

export async function onRequestGet({ request, params }) {
  const origin = getOrigin(request);
  const { permalink } = params;
  if (!permalink) return error("Missing permalink");

  try {
    const data = await proxy("/_/api/v2/resolve", { url: `https://soundcloud.com/${permalink}` });
    if (!data || data.kind !== "user") return error("User not found", 404);

    const user = formatUser(data, false, origin);

    user.station_urn = data.station_urn || (data.id ? `soundcloud:system-playlists:artist-stations:${data.id}` : null);
    user.links = {
      tracks: `${origin}/api/user/${permalink}/tracks`,
      popular_tracks: `${origin}/api/user/${permalink}/popular-tracks`,
      playlists: `${origin}/api/user/${permalink}/playlists`,
      sets: `${origin}/api/user/${permalink}/playlists`,
      albums: `${origin}/api/user/${permalink}/albums`,
      reposts: `${origin}/api/user/${permalink}/reposts`,
      likes: `${origin}/api/user/${permalink}/likes`,
      followers: `${origin}/api/user/${permalink}/followers`,
      following: `${origin}/api/user/${permalink}/following`,
      related: `${origin}/api/user/${permalink}/related`,
      station: data.station_urn ? `${origin}/api/station/${encodeURIComponent(data.station_urn || `soundcloud:system-playlists:artist-stations:${data.id}`)}` : null,
      rss_feed: `${BASE}/_/rss/${permalink}`,
    };

    return json(user);
  } catch (err) {
    return error("User fetch failed", 502, err.message);
  }
}

export async function onRequestOptions() {
  return handleOptions();
}