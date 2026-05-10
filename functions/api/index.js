import config from "../../config.json";
import { json, handleOptions } from "../_shared/utils.js";

export async function onRequestGet(ctx) {
  return json({
    name: "soundcloak-api",
    version: "1.0.0",
    description: "JSON REST API wrapper for soundcloak / SoundCloud",
    instance: config.instance,
    config: config.preferences,
    endpoints: {
      search: {
        "GET /api/search": "Search anything (tracks, users, playlists)",
        params: {
          q: "Search query (required)",
          type: "any | tracks | users | playlists (default: any)",
          limit: "Results per page (default: 20, max: 50)",
          cursor: "Pagination cursor from next_cursor field",
        },
      },
      tracks: {
        "GET /api/track/:user/:permalink": "Get track details + stream URL",
        "GET /api/track/:user/:permalink/related": "Related tracks",
        "GET /api/track/:user/:permalink/comments": "Track comments",
        "GET /api/track/:user/:permalink/albums": "Albums containing track",
        "GET /api/track/:user/:permalink/playlists": "Playlists containing track",
      },
      users: {
        "GET /api/user/:permalink": "Get user profile",
        "GET /api/user/:permalink/tracks": "User tracks",
        "GET /api/user/:permalink/popular-tracks": "User's popular tracks",
        "GET /api/user/:permalink/playlists": "User playlists",
        "GET /api/user/:permalink/albums": "User albums",
        "GET /api/user/:permalink/reposts": "User reposts",
        "GET /api/user/:permalink/likes": "User likes",
        "GET /api/user/:permalink/followers": "User followers",
        "GET /api/user/:permalink/following": "Users this person follows",
        "GET /api/user/:permalink/related": "Related/similar users",
      },
      playlists: {
        "GET /api/playlist/:user/:permalink": "Get playlist with tracks",
      },
      discover: {
        "GET /api/discover": "Discover featured playlists & selections",
      },
      tags: {
        "GET /api/tags/:tag": "Recent tracks for a tag",
        "GET /api/tags/:tag/popular": "Popular tracks for a tag",
        "GET /api/tags/:tag/playlists": "Playlists for a tag",
      },
    },
  });
}

export async function onRequestOptions() {
  return handleOptions();
}
