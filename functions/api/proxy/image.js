import { handleOptions } from "../../_shared/utils.js";

const ALLOWED_HOSTS = ["i1.sndcdn.com", "i2.sndcdn.com", "i3.sndcdn.com", "i4.sndcdn.com"];

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const target = url.searchParams.get("url");

  if (!target) {
    return new Response(JSON.stringify({ error: "Missing url param" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid url" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    return new Response(JSON.stringify({ error: "Host not allowed" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const res = await fetch(parsed.toString(), {
    headers: { "User-Agent": "soundcloak-api/1.0" },
  });

  if (!res.ok) {
    return new Response(JSON.stringify({ error: "Image fetch failed", status: res.status }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const contentType = res.headers.get("content-type") || "image/jpeg";

  return new Response(res.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400, immutable",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export async function onRequestOptions() {
  return handleOptions();
}
