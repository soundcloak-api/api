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
    return json(formatUser(data, false, origin));
  } catch (err) {
    return error("User fetch failed", 502, err.message);
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
