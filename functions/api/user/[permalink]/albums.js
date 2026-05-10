import {
  json, error, proxy, handleOptions, getOrigin,
  formatPlaylist, formatPaginated, parsePagination
} from "../../../_shared/utils.js";

export async function onRequestGet({ request, params }) {
  const url = new URL(request.url);
  const origin = getOrigin(request);
  const { permalink } = params;
  const { limit, cursor } = parsePagination(url);

  try {
    const user = await proxy("/_/api/v2/resolve", { url: `https://soundcloud.com/${permalink}` });
    if (!user?.id) return error("User not found", 404);

    const data = await proxy(`/_/api/v2/users/${user.id}/albums`, {
      limit,
      ...(cursor && { pagination: cursor }),
    });

    return json({
      user: { id: user.id, permalink: user.permalink, username: user.username },
      ...formatPaginated(data, (p) => formatPlaylist(p, false, origin)),
    });
  } catch (err) {
    return error("Failed to fetch albums", 502, err.message);
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
