import {
  json, error, proxy, handleOptions, getOrigin,
  formatUser, formatPaginated, parsePagination
} from "../../../../_shared/utils.js";

function formatComment(c, origin) {
  return {
    id: c.id,
    body: c.body,
    timestamp_ms: c.timestamp,
    created_at: c.created_at,
    author: formatUser(c.user, true, origin),
  };
}

export async function onRequestGet({ request, params }) {
  const url = new URL(request.url);
  const origin = getOrigin(request);
  const { user, permalink } = params;
  const { limit, cursor } = parsePagination(url);

  try {
    const track = await proxy("/_/api/v2/resolve", { url: `https://soundcloud.com/${user}/${permalink}` });
    if (!track?.id) return error("Track not found", 404);

    const data = await proxy(`/_/api/v2/tracks/${track.id}/comments`, {
      limit, threaded: 1,
      ...(cursor && { pagination: cursor }),
    });

    return json({
      track: { id: track.id, permalink: track.permalink, title: track.title },
      ...formatPaginated(data, (c) => formatComment(c, origin)),
    });
  } catch (err) {
    return error("Failed to fetch comments", 502, err.message);
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
