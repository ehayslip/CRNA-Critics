const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || "CRNA Critics <onboarding@resend.dev>";

async function sendEmail({ to, subject, html }) {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set — email NOT sent. Would have sent:");
    console.warn({ to, subject });
    console.warn(html);
    return { skipped: true };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("Resend error", res.status, text);
    throw new Error("Failed to send email via Resend");
  }
  return res.json();
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------- campaign templates ----------
//
// Bodies are written as plain text in the admin CMS. {{tokens}} are filled per
// recipient, then the text is escaped and wrapped in the site's email shell, so an
// admin can never paste markup that breaks the layout (or worse) into a broadcast.

const TOKENS = [
  { token: "{{first_name}}", what: "Just their first name — \"Keith\"" },
  { token: "{{name}}", what: "Their full name as they registered it" },
  { token: "{{email}}", what: "Their email address" },
  { token: "{{review_count}}", what: "\"3 reviews\" / \"no reviews yet\"" },
  { token: "{{site_url}}", what: "The site address, as a link" },
  { token: "{{cta}}", what: "A big green \"Open CRNA Critics\" button" },
];

function firstNameOf(name) {
  const clean = String(name || "").trim();
  if (clean.includes(",")) return clean.split(",").pop().trim().split(/\s+/)[0] || clean;
  return clean.split(/\s+/)[0] || "there";
}

function reviewCountLabel(n) {
  if (!n) return "no reviews yet";
  return `${n} review${n === 1 ? "" : "s"}`;
}

// Replaces the merge tokens in raw (still-unescaped) text.
function fillTokens(text, ctx) {
  return String(text == null ? "" : text)
    .replace(/\{\{\s*first_name\s*\}\}/gi, firstNameOf(ctx.name))
    .replace(/\{\{\s*name\s*\}\}/gi, ctx.name || "")
    .replace(/\{\{\s*email\s*\}\}/gi, ctx.email || "")
    .replace(/\{\{\s*review_count\s*\}\}/gi, reviewCountLabel(ctx.reviewCount || 0))
    .replace(/\{\{\s*site_url\s*\}\}/gi, ctx.baseUrl || "");
}

// Plain text -> HTML paragraphs. {{cta}} on its own becomes the button. Everything
// else is escaped; bare URLs become links.
function bodyToHtml(text, ctx) {
  const ctaHtml = `<p style="margin:22px 0;"><a href="${ctx.baseUrl}" style="background:#123C3A;color:#fff;padding:13px 22px;text-decoration:none;border-radius:4px;font-weight:bold;display:inline-block;">Open CRNA Critics</a></p>`;
  return fillTokens(text, ctx)
    .split(/\n{2,}/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (/^\{\{\s*cta\s*\}\}$/i.test(trimmed)) return ctaHtml;
      const html = escapeHtml(trimmed)
        .replace(/\{\{\s*cta\s*\}\}/gi, "")
        // Trailing sentence punctuation stays outside the link.
        .replace(/(https?:\/\/[^\s<]*[^\s<.,;:!?)\]])/g, '<a href="$1" style="color:#1F5C57;">$1</a>')
        .replace(/\n/g, "<br/>");
      return `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;">${html}</p>`;
    })
    .join("\n");
}

// The shell every campaign email goes out in. The unsubscribe line is always present
// and always points at the bulk-only opt-out — account email is never affected.
function campaignHtml({ body, ctx, unsubscribeUrl }) {
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#14231F;">
      <div style="border-bottom:3px solid #123C3A;padding-bottom:10px;margin-bottom:22px;">
        <span style="font-size:18px;font-weight:bold;color:#123C3A;letter-spacing:.5px;">CRNA CRITICS</span>
      </div>
      ${bodyToHtml(body, ctx)}
      <div style="border-top:1px solid #DDE3E0;margin-top:30px;padding-top:12px;color:#8A948E;font-size:11px;line-height:1.5;">
        <p style="margin:0 0 6px;">You're getting this because you're a verified member of CRNA Critics.</p>
        <p style="margin:0;"><a href="${unsubscribeUrl}" style="color:#8A948E;">Unsubscribe from member mailings</a> — you'll still get account email such as sign-in links and password resets.</p>
      </div>
    </div>`;
}

module.exports = { sendEmail, escapeHtml, campaignHtml, fillTokens, bodyToHtml, firstNameOf, reviewCountLabel, TOKENS };
