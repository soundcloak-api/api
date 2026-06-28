import { json, error, handleOptions, getOrigin, formatTrack, formatPlaylist, formatPaginated, parsePagination } from "../../../_shared/utils.js";

async function getClientId() {
  const page = await fetch('https://soundcloud.com', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
  });
  const html = await page.text();
  const scripts = [...html.matchAll(/<script[^>]+src="(https:\/\/a-v2\.sndcdn\.com\/assets\/[^"]+\.js)"/g)].map(m => m[1]);
  for (const src of scripts.slice(-5)) {
    const js = await fetch(src, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const text = await js.text();
    const match = text.match(/client_id\s*:\s*"([a-zA-Z0-9]{32})"/);
    if (match) return match[1];
  }
  throw new Error('Could not extract client_id');
}

export async function onRequestGet({ request, params }) {
  const url = new URL(request.url);
  const origin = getOrigin(request);
  const { permalink } = params;
  const { limit, cursor } = parsePagination(url);

  try {
    const clientId = await getClientId();
    const scParams = new URLSearchParams({ limit, client_id: clientId });
    if (cursor) scParams.set('pagination', cursor);

    const res = await fetch(`https://api-v2.soundcloud.com/stream/users/${permalink}/reposts?${scParams}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
    });

    if (!res.ok) return error(`Upstream error: ${res.status}`, 502);

    const data = await res.json();
    return json(formatPaginated(data, (r) => {
      if (r.type === "track-repost" && r.track) return { kind: "track", ...formatTrack(r.track, origin) };
      if (r.type === "playlist-repost" && r.playlist) return { kind: "playlist", ...formatPlaylist(r.playlist, false, origin) };
      return { kind: r.type || "unknown", raw: r };
    }));
  } catch (err) {
    return error("Failed to fetch reposts", 502, err.message);
  }
}

export async function onRequestOptions() {
  return handleOptions();
}