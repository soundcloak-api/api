import {
  json, error, proxy, handleOptions, getOrigin,
  formatTrack, formatPlaylist, formatUser, proxyImage
} from "../../_shared/utils.js";

export async function onRequestGet({ request }) {
  const origin = getOrigin(request);

  try {
    const data = await proxy("/_/api/v2/mixed-selections", { variant_ids: "promoted_tracks" });

    const selections = (data.collection || [])
      .filter((s) => s.items?.collection?.length > 0)
      .map((sel) => ({
        id: sel.id,
        title: sel.title,
        description: sel.description || null,
        kind: sel.kind,
        items: (sel.items?.collection || []).map((item) => {
          if (item.kind === "track") return { kind: "track", ...formatTrack(item, origin) };
          if (item.kind === "playlist" || item.kind === "album") return { kind: item.kind, ...formatPlaylist(item, false, origin) };
          if (item.kind === "user") return { kind: "user", ...formatUser(item, false, origin) };
          return {
            kind: item.kind,
            id: item.id,
            permalink: item.permalink,
            title: item.title || item.username,
            artwork: proxyImage(item.artwork_url || item.avatar_url, origin),
            href: item.permalink ? `${origin}/${item.permalink}` : null,
          };
        }),
      }));

    return json({ count: selections.length, collection: selections });
  } catch (err) {
    return error("Failed to fetch discover feed", 502, err.message);
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
