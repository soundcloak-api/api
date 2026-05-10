import {
  json, error, proxy, handleOptions, getOrigin,
  formatPlaylist, formatPaginated, parsePagination
} from "../../../../_shared/utils.js";

export async function onRequestGet({ request, params }) {
  const url = new URL(request.url);
  const origin = getOrigin(request);
  const { user, permalink } = params;
  const { limit, cursor } = parsePagination(url);

  try {
    const track = await proxy("/_/api/v2/resolve", { url: `https://soundcloud.com/${user}/${permalink}` });
    if (!track?.id) return error("Track not found", 404);

    const data = await proxy(`/_/api/v2/tracks/${track.id}/playlists_without_albums`, {
      limit,
      ...(cursor && { pagination: cursor }),
    });

    return json({
      track: { id: track.id, permalink: track.permalink, title: track.title },
      ...formatPaginated(data, (p) => formatPlaylist(p, false, origin)),
    });
  } catch (err) {
    return error("Failed to fetch playlists", 502, err.message);
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
