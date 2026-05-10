import {
  json, error, proxy, handleOptions, getOrigin,
  formatTrack, BASE, PREFS
} from "../../../_shared/utils.js";

export async function onRequestGet({ request, params }) {
  const { user, permalink } = params;
  if (!user || !permalink) return error("Missing user or permalink");
  const origin = getOrigin(request);

  try {
    const data = await proxy("/_/api/v2/resolve", {
      url: `https://soundcloud.com/${user}/${permalink}`,
    });
    if (!data || data.kind !== "track") return error("Track not found", 404);

    const track = formatTrack(data, origin);
    const audioFormat = PREFS.restreamAudio === "aac" ? "aac" : "mpeg";
    track.stream_url = `${BASE}/_/api/restream/${user}/${permalink}?audio=${audioFormat}`;
    track.download_url = `${BASE}/_/download/${user}/${permalink}`;

    return json(track);
  } catch (err) {
    return error("Track fetch failed", 502, err.message);
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
