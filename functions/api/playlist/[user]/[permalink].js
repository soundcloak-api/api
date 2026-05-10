import {
  json, error, proxy, handleOptions, getOrigin,
  formatPlaylist, BASE, PREFS
} from "../../../_shared/utils.js";

export async function onRequestGet({ request, params }) {
  const url = new URL(request.url);
  const origin = getOrigin(request);
  const { user, permalink } = params;
  const includeTracks = url.searchParams.get("tracks") !== "false";

  try {
    const data = await proxy("/_/api/v2/resolve", {
      url: `https://soundcloud.com/${user}/sets/${permalink}`,
    });

    if (!data || (data.kind !== "playlist" && data.kind !== "album")) return error("Playlist not found", 404);

    const playlist = formatPlaylist(data, includeTracks, origin);

    if (includeTracks && playlist.tracks) {
      const fmt = PREFS.restreamAudio === "aac" ? "aac" : "mpeg";
      playlist.tracks = playlist.tracks.map((t) => {
        if (t?.user?.permalink && t?.permalink) {
          t.stream_url = `${BASE}/_/api/restream/${t.user.permalink}/${t.permalink}?audio=${fmt}`;
        }
        return t;
      });
    }

    return json(playlist);
  } catch (err) {
    return error("Playlist fetch failed", 502, err.message);
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
