const { emailHeaderHtml } = require("./brand");

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || "CRNA Critics <onboarding@resend.dev>";
// Where replies land. Mail that people should be able to answer (campaigns, the
// welcome email) passes replyTo: REPLY_TO; sign-in and password-reset mail
// deliberately does not, so nobody replies to a robot with their password.
const REPLY_TO = process.env.REPLY_TO_EMAIL || "eric@crnacritics.com";

async function sendEmail({ to, subject, html, replyTo }) {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set — email NOT sent. Would have sent:");
    console.warn({ to, subject, replyTo });
    console.warn(html);
    return { skipped: true };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
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
  { token: "{{feedback_link}}", what: "This member's personal link to the site's feedback form (no login needed). On its own line it becomes a \"Give feedback\" button." },
  { token: "{{review_subject}}", what: "Review-notice emails only: what the review was about, e.g. \"Mercy General / Envision\"" },
  { token: "{{flags}}", what: "Review-notice emails only: the flagged passage(s) with why it matters and a better way to say it" },
  { token: "{{student_name}}", what: "SRNA emails only: the student's full name" },
  { token: "{{school}}", what: "SRNA emails only: the student's school" },
  { token: "{{program}}", what: "SRNA emails only: the student's program" },
  { token: "{{grad_year}}", what: "SRNA emails only: expected graduation year" },
  { token: "{{grad_month_year}}", what: "SRNA emails only: the month and year their student access runs through, e.g. \"May 2028\"" },
  { token: "{{instructor_name}}", what: "SRNA emails only: the program contact's name" },
  { token: "{{verify_link}}", what: "Instructor email only: on its own line it becomes a green \"Yes, verify this student\" button" },
  { token: "{{cant_verify_link}}", what: "Instructor email only: on its own line it becomes an \"I can't verify this student\" button" },
  { token: "{{login_link}}", what: "SRNA welcome only: one-time link to sign in and create a password (button on its own line)" },
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
    .replace(/\{\{\s*site_url\s*\}\}/gi, ctx.baseUrl || "")
    .replace(/\{\{\s*feedback_link\s*\}\}/gi, ctx.feedbackUrl || `${ctx.baseUrl || ""}/feedback`)
    .replace(/\{\{\s*review_subject\s*\}\}/gi, ctx.reviewSubject || "your review")
    .replace(/\{\{\s*student_name\s*\}\}/gi, ctx.studentName || "")
    .replace(/\{\{\s*school\s*\}\}/gi, ctx.school || "")
    .replace(/\{\{\s*program\s*\}\}/gi, ctx.program || "")
    .replace(/\{\{\s*grad_month_year\s*\}\}/gi, ctx.gradMonthYear || ctx.gradYear || "")
    .replace(/\{\{\s*grad_year\s*\}\}/gi, ctx.gradYear || "")
    .replace(/\{\{\s*instructor_name\s*\}\}/gi, ctx.instructorName || "")
    .replace(/\{\{\s*verify_link\s*\}\}/gi, ctx.verifyUrl || "")
    .replace(/\{\{\s*cant_verify_link\s*\}\}/gi, ctx.cantVerifyUrl || "")
    .replace(/\{\{\s*login_link\s*\}\}/gi, ctx.loginUrl || "");
}

// Plain text -> HTML paragraphs. {{cta}} on its own becomes the button. Everything
// else is escaped; bare URLs become links.
function bodyToHtml(text, ctx) {
  const ctaHtml = `<p style="margin:22px 0;"><a href="${ctx.baseUrl}" style="background:#0B1526;color:#fff;padding:13px 22px;text-decoration:none;border-radius:4px;font-weight:bold;display:inline-block;">Open CRNA Critics</a></p>`;
  const feedbackUrl = ctx.feedbackUrl || `${ctx.baseUrl}/feedback`;
  const feedbackHtml = `<p style="margin:22px 0;"><a href="${feedbackUrl}" style="background:#13A15A;color:#fff;padding:13px 22px;text-decoration:none;border-radius:4px;font-weight:bold;display:inline-block;">Give feedback</a></p>`;
  // The button is handled above; a {{feedback_link}} inside a sentence is filled in as a URL
  // by fillTokens and linkified below like any other address.
  // A {{feedback_link}} that is a paragraph of its own is marked before the tokens are
  // filled, so it can become the button instead of a bare URL.
  const marked = String(text == null ? "" : text)
    .replace(/(^|\n{2,})[ \t]*\{\{\s*feedback_link\s*\}\}[ \t]*(?=\n{2,}|$)/gi, "$1{{feedback_button}}")
    .replace(/(^|\n{2,})[ \t]*\{\{\s*verify_link\s*\}\}[ \t]*(?=\n{2,}|$)/gi, "$1{{verify_button}}")
    .replace(/(^|\n{2,})[ \t]*\{\{\s*cant_verify_link\s*\}\}[ \t]*(?=\n{2,}|$)/gi, "$1{{cant_button}}")
    .replace(/(^|\n{2,})[ \t]*\{\{\s*login_link\s*\}\}[ \t]*(?=\n{2,}|$)/gi, "$1{{login_button}}");
  const btn = (url, bg, label) => `<p style="margin:14px 0;"><a href="${url}" style="background:${bg};color:#fff;padding:13px 22px;text-decoration:none;border-radius:4px;font-weight:bold;display:inline-block;">${label}</a></p>`;
  return fillTokens(marked, ctx)
    .split(/\n{2,}/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (/^\{\{\s*cta\s*\}\}$/i.test(trimmed)) return ctaHtml;
      if (/^\{\{\s*feedback_button\s*\}\}$/i.test(trimmed)) return feedbackHtml;
      if (/^\{\{\s*flags\s*\}\}$/i.test(trimmed)) return ctx.flagsHtml || "";
      if (/^\{\{\s*verify_button\s*\}\}$/i.test(trimmed)) return btn(ctx.verifyUrl, "#13A15A", "Yes, I can verify this student");
      if (/^\{\{\s*cant_button\s*\}\}$/i.test(trimmed)) return btn(ctx.cantVerifyUrl, "#8C3A32", "I can't verify this student");
      if (/^\{\{\s*login_button\s*\}\}$/i.test(trimmed)) return btn(ctx.loginUrl, "#123C3A", "Sign in &amp; create your password");
      const html = escapeHtml(trimmed)
        .replace(/\{\{\s*cta\s*\}\}/gi, "")
        // Trailing sentence punctuation stays outside the link.
        .replace(/(https?:\/\/[^\s<]*[^\s<.,;:!?)\]])/g, '<a href="$1" style="color:#13A15A;">$1</a>')
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
      ${emailHeaderHtml(ctx.baseUrl, 560)}
      ${bodyToHtml(body, ctx)}
      <div style="border-top:1px solid #DDE3E0;margin-top:30px;padding-top:12px;color:#8A948E;font-size:11px;line-height:1.5;">
        <p style="margin:0 0 6px;">You're getting this because you're a verified member of CRNA Critics.</p>
        <p style="margin:0;"><a href="${unsubscribeUrl}" style="color:#8A948E;">Unsubscribe from member mailings</a> — you'll still get account email such as sign-in links and password resets.</p>
      </div>
    </div>`;
}

// Shell for one-off SRNA / program-contact mail: same header, no member-mailing unsubscribe line.
function plainMailHtml({ body, ctx }) {
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#14231F;">
      ${emailHeaderHtml(ctx.baseUrl, 560)}
      ${bodyToHtml(body, ctx)}
    </div>`;
}

module.exports = { plainMailHtml, sendEmail, REPLY_TO, escapeHtml, campaignHtml, fillTokens, bodyToHtml, firstNameOf, reviewCountLabel, TOKENS };
