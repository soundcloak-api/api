import {
  json, error, proxy, handleOptions, getOrigin,
  formatTrack
} from "../../../_shared/utils.js";

export async function onRequestGet({ request, params }) {
  const origin = getOrigin(request);
  const { permalink } = params;

  try {
    const user = await proxy("/_/api/v2/resolve", { url: `https://soundcloud.com/${permalink}` });
    if (!user?.id) return error("User not found", 404);

    const data = await proxy(`/_/api/v2/users/${user.id}/toptracks`, { limit: 20 });
    const tracks = (data.collection || []).map((t) => formatTrack(t, origin));

    return json({
      user: { id: user.id, permalink: user.permalink, username: user.username },
      count: tracks.length,
      collection: tracks,
    });
  } catch (err) {
    return error("Failed to fetch popular tracks", 502, err.message);
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
