import {
  json, error, proxy, handleOptions, getOrigin,
  formatUser
} from "../../../_shared/utils.js";

export async function onRequestGet({ request, params }) {
  const origin = getOrigin(request);
  const { permalink } = params;

  try {
    const user = await proxy("/_/api/v2/resolve", { url: `https://soundcloud.com/${permalink}` });
    if (!user?.id) return error("User not found", 404);

    const data = await proxy(`/_/api/v2/users/${user.id}/relatedartists`);
    const users = (data.collection || []).map((u) => formatUser(u, false, origin));

    return json({
      user: { id: user.id, permalink: user.permalink, username: user.username },
      count: users.length,
      collection: users,
    });
  } catch (err) {
    return error("Failed to fetch related users", 502, err.message);
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
