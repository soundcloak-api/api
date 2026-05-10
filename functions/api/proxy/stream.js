import { handleOptions } from "../../_shared/utils.js";

const ALLOWED_HOSTS = ["sc1.maid.zone"];

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
    return new Response(JSON.stringify({ error: "Stream fetch failed", status: res.status }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const contentType = res.headers.get("content-type") || "audio/mpeg";

  return new Response(res.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export async function onRequestOptions() {
  return handleOptions();
}
