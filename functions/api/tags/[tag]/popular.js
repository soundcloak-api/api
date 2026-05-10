import {
  json, error, proxy, handleOptions, getOrigin,
  formatTrack, formatPaginated, parsePagination
} from "../../../_shared/utils.js";

export async function onRequestGet({ request, params }) {
  const url = new URL(request.url);
  const origin = getOrigin(request);
  const { tag } = params;
  const { limit, cursor } = parsePagination(url);

  try {
    const data = await proxy("/_/api/v2/search/tracks", {
      q: "*",
      filter: "public",
      tags: decodeURIComponent(tag),
      limit,
      ...(cursor && { pagination: cursor }),
    });

    return json({
      tag,
      type: "popular",
      ...formatPaginated(data, (t) => formatTrack(t, origin)),
    });
  } catch (err) {
    return error("Failed to fetch popular tagged tracks", 502, err.message);
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
