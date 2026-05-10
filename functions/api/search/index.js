import {
  json, error, proxy, handleOptions, getOrigin,
  formatTrack, formatUser, formatPlaylist, formatPaginated, parsePagination,
} from "../../_shared/utils.js";

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const origin = getOrigin(request);
  const q = url.searchParams.get("q");
  if (!q) return error("Missing required param: q");

  const type = url.searchParams.get("type") || "any";
  const { limit, cursor } = parsePagination(url);

  const validTypes = ["any", "tracks", "users", "playlists"];
  if (!validTypes.includes(type)) return error(`Invalid type. Must be one of: ${validTypes.join(", ")}`);

  try {
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

    return json({ query: q, type, ...formatted });
  } catch (err) {
    return error("Search failed", 502, err.message);
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
