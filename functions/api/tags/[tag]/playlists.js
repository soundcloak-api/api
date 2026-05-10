import {
  json, error, proxy, handleOptions, getOrigin,
  formatPlaylist, formatPaginated, parsePagination
} from "../../../_shared/utils.js";

export async function onRequestGet({ request, params }) {
  const url = new URL(request.url);
  const origin = getOrigin(request);
  const { tag } = params;
  const { limit, cursor } = parsePagination(url);

  try {
    const data = await proxy("/_/api/v2/search/playlists", {
      q: "*",
      tags: decodeURIComponent(tag),
      limit,
      ...(cursor && { pagination: cursor }),
    });

    return json({
      tag,
      type: "playlists",
      ...formatPaginated(data, (p) => formatPlaylist(p, false, origin)),
    });
  } catch (err) {
    return error("Failed to fetch tagged playlists", 502, err.message);
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
