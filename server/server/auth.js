const crypto = require("crypto");

const SECRET = process.env.APP_SECRET;
if (!SECRET || SECRET === "change-me") {
  console.warn(
    "WARNING: APP_SECRET is not set to a real value. Sessions and email links are not secure until you set one in .env."
  );
}

function sign(payload, expiresInSeconds) {
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + expiresInSeconds };
  const encoded = Buffer.from(JSON.stringify(body)).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET || "insecure-dev-secret").update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

function verify(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [encoded, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", SECRET || "insecure-dev-secret").update(encoded).digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;
  return payload;
}

module.exports = { sign, verify };
