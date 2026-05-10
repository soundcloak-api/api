import {
  json, error, proxy, handleOptions, getOrigin,
  formatTrack, formatPlaylist, formatPaginated, parsePagination
} from "../../../_shared/utils.js";

export async function onRequestGet({ request, params }) {
  const url = new URL(request.url);
  const origin = getOrigin(request);
  const { permalink } = params;
  const { limit, cursor } = parsePagination(url);

  try {
    const user = await proxy("/_/api/v2/resolve", { url: `https://soundcloud.com/${permalink}` });
    if (!user?.id) return error("User not found", 404);

    const data = await proxy(`/_/api/v2/stream/users/${user.id}/reposts`, {
      limit,
      ...(cursor && { pagination: cursor }),
    });

    return json({
      user: { id: user.id, permalink: user.permalink, username: user.username },
      ...formatPaginated(data, (r) => {
        if (r.type === "track-repost" && r.track) return { kind: "track", ...formatTrack(r.track, origin) };
        if (r.type === "playlist-repost" && r.playlist) return { kind: "playlist", ...formatPlaylist(r.playlist, false, origin) };
        return { kind: r.type, raw: r };
      }),
    });
  } catch (err) {
    return error("Failed to fetch reposts", 502, err.message);
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
