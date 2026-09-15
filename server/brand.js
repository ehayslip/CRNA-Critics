// Brand assets for outbound email.
//
// The logo has to be a hosted image — Gmail and most clients strip inline SVG and
// data: URIs — but a cloud session can't commit a binary file through the GitHub
// web editor. So the PNG lives here as base64 text and server/index.js serves the
// decoded bytes at GET /email-logo.png (cached a year, immutable).
//
// The art is the white-on-ink horizontal lockup on an ink band with the green rule:
// 1200x300, displayed at 600 wide. Regenerate from crnacritics-logo-horizontal-dark.svg.

const EMAIL_LOGO_PNG_BASE64 = [
  "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"
].join("");

// One header block for every email we send — campaigns, welcome, resets, admin
// alerts. Table-based and bgcolor'd so it holds up in Outlook and in dark mode,
// with alt text that still reads as the brand if images are blocked.
function emailHeaderHtml(baseUrl, maxWidth = 560) {
  const src = `${baseUrl}/email-logo.png`;
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:${maxWidth}px;margin:0 auto 22px;background:#0B1526;">
      <tr><td align="center" bgcolor="#0B1526" style="padding:0;line-height:0;">
        <a href="${baseUrl}" style="text-decoration:none;">
          <img src="${src}" width="${maxWidth}" alt="CRNA Critics — Know before you sign"
               style="display:block;width:100%;max-width:${maxWidth}px;height:auto;border:0;outline:none;text-decoration:none;" />
        </a>
      </td></tr>
    </table>`;
}

module.exports = { EMAIL_LOGO_PNG_BASE64, emailHeaderHtml };
