// YouTube settings, read from Railway variables so the channel link and the featured video
// can be switched on (or changed) without a code push.
//   YOUTUBE_URL       e.g. https://www.youtube.com/@CRNACritics
//   YOUTUBE_VIDEO_ID  the 11-character id from a watch?v=... link
// Anything that doesn't look right is treated as blank.

function youtubeChannelUrl() {
  const raw = (process.env.YOUTUBE_URL || "").trim();
  if (!raw) return "";
  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase();
    const ok = u.protocol === "https:" && (host === "youtube.com" || host === "www.youtube.com" || host === "m.youtube.com" || host === "youtu.be");
    return ok ? u.toString() : "";
  } catch (e) {
    return "";
  }
}

function youtubeVideoId() {
  const raw = (process.env.YOUTUBE_VIDEO_ID || "").trim();
  return /^[A-Za-z0-9_-]{11}$/.test(raw) ? raw : "";
}

module.exports = { youtubeChannelUrl, youtubeVideoId };
