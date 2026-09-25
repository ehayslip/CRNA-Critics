// Private, anonymous messages between members — "Ask this reviewer".
//
// Rules Eric chose (Sep 25, 2026):
//  - Private 1-to-1 only, and a conversation can only start from a review ("Ask this reviewer").
//  - Both sides appear as "Anonymous CRNA". No email address or name is ever sent to the browser.
//  - The admin sees a conversation only when a member reports it or the guard flags a message
//    that the sender chose to send anyway.
//
// Everything is registered on the Express app passed in, so index.js stays the single entry point.

const crypto = require("crypto");

const MAX_BODY = 2000;
const MAX_NEW_CONVERSATIONS_PER_DAY = 15;
const MAX_MESSAGES_PER_HOUR = 40;

// Guard rules that make sense in a private message. Contact details are included on purpose —
// swapping a phone number is allowed, but the sender is told it ends their anonymity first.
const MESSAGE_RULE_KEYS = ["patient_info", "threat_harassment", "slur_or_discrimination", "private_details", "crime_accusation"];
const MESSAGE_WARNINGS = {
  patient_info: "This looks like it may describe a patient or a case. Patient information is never allowed on CRNA Critics — including in private messages.",
  threat_harassment: "This reads like a threat or harassment. Messages are private, but they are stored and can be reported.",
  slur_or_discrimination: "This contains a slur or a remark about someone's age, sex, race, religion, accent or health.",
  private_details: "This includes a phone number, email or street address. Sharing contact details ends your anonymity with this CRNA — only send it if you mean to.",
  crime_accusation: "This accuses someone of a crime. Private messages can still be forwarded or subpoenaed — stick to what happened.",
};

module.exports = function registerMessages(app, deps) {
  const { db, requireSession, requireAdmin, sendEmail, escapeHtml, emailHeaderHtml, BASE_URL, REPLY_TO, RULES, reviewSubjectLine } = deps;
  const rules = RULES.filter((r) => MESSAGE_RULE_KEYS.includes(r.key));
  const now = () => new Date().toISOString();

  function scanMessage(text) {
    const hits = [];
    rules.forEach((r) => {
      let hit = false;
      try { hit = r.test(text); } catch { hit = false; }
      if (hit) hits.push({ rule: r.key, label: r.label, warning: MESSAGE_WARNINGS[r.key] || r.issue });
    });
    return hits;
  }

  function roleOf(conv, email) {
    if (conv.asker_email === email) return "asker";
    if (conv.reviewer_email === email) return "reviewer";
    return null;
  }
  function otherEmail(conv, role) { return role === "asker" ? conv.reviewer_email : conv.asker_email; }
  function readCol(role) { return role === "asker" ? "asker_read_at" : "reviewer_read_at"; }

  function unreadFor(conv, role) {
    const readAt = conv[readCol(role)] || "";
    return db.prepare("SELECT COUNT(*) AS n FROM messages WHERE conversation_id = ? AND sender_email != ? AND created_at > ? AND removed_by_admin = 0")
      .get(conv.id, role === "asker" ? conv.asker_email : conv.reviewer_email, readAt).n;
  }

  function closedReason(conv, role) {
    if (conv.closed_by_admin) return "closed by the site";
    if (conv.blocked_by === role) return "you blocked this conversation";
    if (conv.blocked_by) return "the other CRNA closed this conversation";
    return "";
  }

  // What the browser gets for a conversation — no emails, no names.
  function convSummary(conv, email) {
    const role = roleOf(conv, email);
    const last = db.prepare("SELECT body, sender_email, removed_by_admin FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1").get(conv.id);
    const reviewExists = !!db.prepare("SELECT 1 FROM reviews WHERE id = ?").get(conv.review_id);
    return {
      id: conv.id,
      reviewId: conv.review_id,
      reviewExists,
      subject: conv.subject,
      role,                                       // asker = I asked; reviewer = someone asked about my review
      createdAt: conv.created_at,
      lastMessageAt: conv.last_message_at,
      preview: last ? (last.removed_by_admin ? "(message removed)" : last.body.slice(0, 120)) : "",
      lastFromMe: last ? last.sender_email === email : false,
      unread: unreadFor(conv, role),
      closed: closedReason(conv, role),
      blockedByMe: conv.blocked_by === role,
    };
  }

  function myConversations(email) {
    return db.prepare("SELECT * FROM conversations WHERE asker_email = ? OR reviewer_email = ? ORDER BY last_message_at DESC").all(email, email);
  }

  function memberRow(email) { return db.prepare("SELECT * FROM access_requests WHERE email = ?").get(email); }

  // The alert email. The message itself is never in it, and the anonymity reminder always is.
  // kind: "question" (new question to a reviewer) | "reply" | "reminder" (still unanswered after a few days)
  function messageAlertEmail(conv, recipientRole, kind) {
    const recipientEmail = recipientRole === "asker" ? conv.asker_email : conv.reviewer_email;
    const toReviewer = recipientRole === "reviewer";
    const link = `${BASE_URL}/?messages=1`;
    const subjectLine = escapeHtml(conv.subject);
    const copy = {
      question: {
        subject: "A CRNA has a question about your review",
        headline: "A CRNA has a question about your review",
        intro: `Another verified CRNA read your review of <strong>${subjectLine}</strong> and sent you a private question.`,
        button: "Read the question",
      },
      reply: {
        subject: toReviewer ? "New message about your review" : "You have a new reply to your question",
        headline: toReviewer ? "New message about your review" : "You have a new reply to your question",
        intro: toReviewer
          ? `The CRNA who asked about your review of <strong>${subjectLine}</strong> sent you another message.`
          : `The CRNA who wrote the review of <strong>${subjectLine}</strong> replied to your question.`,
        button: "Read the message",
      },
      reminder: {
        subject: toReviewer ? "Reminder: a CRNA is waiting on your answer" : "Reminder: you have an unanswered message",
        headline: toReviewer ? "A CRNA is still waiting on your answer" : "You have an unanswered message",
        intro: toReviewer
          ? `A few days ago another verified CRNA asked you a question about your review of <strong>${subjectLine}</strong>. It hasn't been answered yet.`
          : `A few days ago you received a message about the review of <strong>${subjectLine}</strong>. It hasn't been answered yet.`,
        button: "Read and reply",
      },
    }[kind];
    const privacy = toReviewer
      ? `<strong>Your name and information stay anonymous.</strong> The CRNA asking does not have your name, email, or phone number. They see you only as "Anonymous CRNA," and they can reach you only through CRNA Critics. You can answer or ignore the question — either way, nothing about you is shared.`
      : `<strong>Your name and information stay anonymous.</strong> The reviewer does not have your name, email, or phone number. They see you only as "Anonymous CRNA," and they can reach you only through CRNA Critics.`;
    const footer = kind === "reminder"
      ? `This is the only reminder we'll send about this message. Turn message emails off anytime under Messages → Settings.`
      : `Turn these emails off anytime under Messages → Settings.`;
    return sendEmail({
      to: recipientEmail,
      replyTo: REPLY_TO,
      subject: copy.subject,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;font-size:15px;line-height:1.5;color:#14231F;">
          ${emailHeaderHtml(BASE_URL, 480)}
          <h2 style="color:#123C3A;">${copy.headline}</h2>
          <p>${copy.intro}</p>
          <div style="background:#EEF4F1;border-left:4px solid #123C3A;padding:10px 12px;margin:14px 0;">&#128274; ${privacy}</div>
          <p>For your privacy, the message isn't in this email. Sign in to read it and reply.</p>
          <p><a href="${link}" style="background:#123C3A;color:#fff;padding:12px 20px;text-decoration:none;border-radius:4px;font-weight:bold;display:inline-block;">${copy.button}</a></p>
          <p style="color:#6B756F;font-size:13px;"><strong>Please don't reply to this email.</strong> Replies here don't reach the other CRNA — only answers sent on the site do.</p>
          <p style="color:#888;font-size:12px;">${footer}</p>
        </div>`,
    });
  }

  // One email per burst: only when this message is the first one the recipient hasn't read yet.
  function maybeEmailRecipient(conv, recipientRole, isNew) {
    const recipientEmail = recipientRole === "asker" ? conv.asker_email : conv.reviewer_email;
    const member = memberRow(recipientEmail);
    if (!member || member.status !== "approved" || member.message_emails === 0) return;
    if (unreadFor(conv, recipientRole) !== 1) return;
    messageAlertEmail(conv, recipientRole, isNew ? "question" : "reply")
      .catch((e) => console.error("Message alert email failed:", e.message));
  }

  // One reminder per unanswered message: the last message came from the other side more than
  // REMINDER_AFTER_DAYS ago, the recipient hasn't answered, and no reminder went out since it arrived.
  // Called from the server's hourly daytime tick.
  const REMINDER_AFTER_DAYS = Number(process.env.MESSAGE_REMINDER_DAYS || 3);
  async function runMessageReminders() {
    if (!(REMINDER_AFTER_DAYS > 0)) return { sent: 0 };
    const cutoff = new Date(Date.now() - REMINDER_AFTER_DAYS * 86400e3).toISOString();
    const convs = db.prepare("SELECT * FROM conversations WHERE blocked_by = '' AND closed_by_admin = 0 AND last_message_at < ?").all(cutoff);
    let sent = 0;
    for (const conv of convs) {
      const last = db.prepare("SELECT sender_email, created_at FROM messages WHERE conversation_id = ? AND removed_by_admin = 0 ORDER BY created_at DESC LIMIT 1").get(conv.id);
      if (!last) continue;
      const recipientRole = last.sender_email === conv.asker_email ? "reviewer" : "asker";
      const remindedCol = recipientRole === "asker" ? "asker_reminded_at" : "reviewer_reminded_at";
      if (conv[remindedCol] && conv[remindedCol] >= last.created_at) continue; // already reminded about this one
      const member = memberRow(recipientRole === "asker" ? conv.asker_email : conv.reviewer_email);
      const sender = memberRow(last.sender_email);
      if (!member || member.status !== "approved" || member.message_emails === 0) continue;
      if (!sender || sender.status !== "approved") continue; // nobody left to answer
      db.prepare(`UPDATE conversations SET ${remindedCol} = ? WHERE id = ?`).run(now(), conv.id); // stamp first: never twice
      try { await messageAlertEmail(conv, recipientRole, "reminder"); sent += 1; }
      catch (e) { console.error("Message reminder failed:", e.message); }
    }
    if (sent) console.log(`Message reminders: ${sent} sent.`);
    return { sent };
  }

  function alertAdmin(subjectLine, detailHtml) {
    if (!process.env.ADMIN_EMAIL) return;
    sendEmail({
      to: process.env.ADMIN_EMAIL,
      subject: subjectLine,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;font-size:14px;line-height:1.5;">${emailHeaderHtml(BASE_URL, 560)}${detailHtml}<p>Open <strong>Site admin → Alerts</strong> to read the conversation and decide.</p></div>`,
    }).catch((e) => console.error("Admin message alert failed:", e.message));
  }

  function recordGuardFlags(conv, msgId, hits, body) {
    const t = now();
    const ins = db.prepare("INSERT INTO message_flags (id, conversation_id, message_id, source, reason, label, excerpt, created_at) VALUES (?,?,?,?,?,?,?,?)");
    hits.forEach((h) => ins.run(crypto.randomUUID(), conv.id, msgId, "guard", h.rule, h.label, body.slice(0, 240), t));
    alertAdmin(`CRNA Critics — a message was sent past a guideline warning`,
      `<p>A member saw a warning (${hits.map((h) => escapeHtml(h.label)).join(", ")}) and sent the message anyway, in a conversation about <strong>${escapeHtml(conv.subject)}</strong>.</p><blockquote style="border-left:3px solid #8C3A32;margin:8px 0;padding:4px 10px;color:#444;">${escapeHtml(body.slice(0, 240))}</blockquote>`);
  }

  // Validate + guard a message body. Returns { body } or sends the error response and returns null.
  function checkBody(req, res) {
    const body = String(req.body?.body || "").trim();
    if (!body) { res.status(400).json({ error: "empty_message" }); return null; }
    if (body.length > MAX_BODY) { res.status(400).json({ error: "too_long", max: MAX_BODY }); return null; }
    const sentLastHour = db.prepare("SELECT COUNT(*) AS n FROM messages WHERE sender_email = ? AND created_at > ?")
      .get(req.user.email, new Date(Date.now() - 3600e3).toISOString()).n;
    if (sentLastHour >= MAX_MESSAGES_PER_HOUR) { res.status(429).json({ error: "slow_down" }); return null; }
    const hits = scanMessage(body);
    if (hits.length && !req.body?.sendAnyway) {
      res.status(409).json({ error: "guard_warning", warnings: hits.map((h) => ({ label: h.label, warning: h.warning })) });
      return null;
    }
    return { body, hits };
  }

  function addMessage(conv, senderEmail, body) {
    const id = crypto.randomUUID();
    const t = now();
    db.prepare("INSERT INTO messages (id, conversation_id, sender_email, body, created_at) VALUES (?,?,?,?,?)").run(id, conv.id, senderEmail, body, t);
    const role = roleOf(conv, senderEmail);
    db.prepare(`UPDATE conversations SET last_message_at = ?, ${readCol(role)} = ? WHERE id = ?`).run(t, t, conv.id);
    return id;
  }

  // ----- member routes -----

  app.get("/api/messages", requireSession, (req, res) => {
    const list = myConversations(req.user.email).map((c) => convSummary(c, req.user.email));
    const me = memberRow(req.user.email);
    res.json({
      conversations: list,
      unread: list.reduce((n, c) => n + c.unread, 0),
      settings: { acceptQuestions: me.accept_questions !== 0, messageEmails: me.message_emails !== 0 },
    });
  });

  app.get("/api/messages/unread", requireSession, (req, res) => {
    const unread = myConversations(req.user.email).reduce((n, c) => n + unreadFor(c, roleOf(c, req.user.email)), 0);
    res.json({ unread });
  });

  app.post("/api/messages/settings", requireSession, (req, res) => {
    const b = req.body || {};
    if (typeof b.acceptQuestions === "boolean") db.prepare("UPDATE access_requests SET accept_questions = ? WHERE email = ?").run(b.acceptQuestions ? 1 : 0, req.user.email);
    if (typeof b.messageEmails === "boolean") db.prepare("UPDATE access_requests SET message_emails = ? WHERE email = ?").run(b.messageEmails ? 1 : 0, req.user.email);
    const me = memberRow(req.user.email);
    res.json({ settings: { acceptQuestions: me.accept_questions !== 0, messageEmails: me.message_emails !== 0 } });
  });

  app.get("/api/messages/:id", requireSession, (req, res) => {
    const conv = db.prepare("SELECT * FROM conversations WHERE id = ?").get(req.params.id);
    const role = conv && roleOf(conv, req.user.email);
    if (!role) return res.status(404).json({ error: "not_found" });
    db.prepare(`UPDATE conversations SET ${readCol(role)} = ? WHERE id = ?`).run(now(), conv.id);
    const fresh = db.prepare("SELECT * FROM conversations WHERE id = ?").get(conv.id);
    const messages = db.prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC").all(conv.id).map((m) => ({
      id: m.id,
      mine: m.sender_email === req.user.email,
      body: m.removed_by_admin ? "" : m.body,
      removed: !!m.removed_by_admin,
      createdAt: m.created_at,
    }));
    const reported = !!db.prepare("SELECT 1 FROM message_flags WHERE conversation_id = ? AND source = 'report' AND reporter_email = ? AND status = 'open'").get(conv.id, req.user.email);
    res.json({ conversation: { ...convSummary(fresh, req.user.email), reportedByMe: reported }, messages });
  });

  // Start (or continue) a conversation from a review.
  app.post("/api/messages", requireSession, (req, res) => {
    const review = db.prepare("SELECT * FROM reviews WHERE id = ?").get(String(req.body?.reviewId || ""));
    if (!review) return res.status(404).json({ error: "review_not_found" });
    if (review.reviewer_email === req.user.email) return res.status(400).json({ error: "own_review" });
    const author = memberRow(review.reviewer_email);
    if (!author || author.status !== "approved") return res.status(410).json({ error: "reviewer_unavailable" });
    let conv = db.prepare("SELECT * FROM conversations WHERE review_id = ? AND asker_email = ?").get(review.id, req.user.email);
    if (!conv && author.accept_questions === 0) return res.status(403).json({ error: "not_accepting" });
    if (conv && (conv.blocked_by || conv.closed_by_admin)) return res.status(403).json({ error: "closed" });
    if (!conv) {
      const today = db.prepare("SELECT COUNT(*) AS n FROM conversations WHERE asker_email = ? AND created_at > ?")
        .get(req.user.email, new Date(Date.now() - 86400e3).toISOString()).n;
      if (today >= MAX_NEW_CONVERSATIONS_PER_DAY) return res.status(429).json({ error: "too_many_today" });
    }
    const checked = checkBody(req, res);
    if (!checked) return;
    const isNew = !conv;
    if (!conv) {
      const t = now();
      const id = crypto.randomUUID();
      db.prepare("INSERT INTO conversations (id, review_id, subject, asker_email, reviewer_email, created_at, last_message_at) VALUES (?,?,?,?,?,?,?)")
        .run(id, review.id, reviewSubjectLine(review), req.user.email, review.reviewer_email, t, t);
      conv = db.prepare("SELECT * FROM conversations WHERE id = ?").get(id);
    }
    const msgId = addMessage(conv, req.user.email, checked.body);
    if (checked.hits.length) recordGuardFlags(conv, msgId, checked.hits, checked.body);
    maybeEmailRecipient(conv, "reviewer", isNew);
    res.json({ ok: true, conversationId: conv.id });
  });

  app.post("/api/messages/:id/reply", requireSession, (req, res) => {
    const conv = db.prepare("SELECT * FROM conversations WHERE id = ?").get(req.params.id);
    const role = conv && roleOf(conv, req.user.email);
    if (!role) return res.status(404).json({ error: "not_found" });
    if (conv.blocked_by || conv.closed_by_admin) return res.status(403).json({ error: "closed" });
    const other = memberRow(otherEmail(conv, role));
    if (!other || other.status !== "approved") return res.status(410).json({ error: "member_gone" });
    const checked = checkBody(req, res);
    if (!checked) return;
    const msgId = addMessage(conv, req.user.email, checked.body);
    if (checked.hits.length) recordGuardFlags(conv, msgId, checked.hits, checked.body);
    maybeEmailRecipient(conv, role === "asker" ? "reviewer" : "asker", false);
    res.json({ ok: true });
  });

  // Either side can close a conversation for good; only the one who blocked can reopen it.
  app.post("/api/messages/:id/block", requireSession, (req, res) => {
    const conv = db.prepare("SELECT * FROM conversations WHERE id = ?").get(req.params.id);
    const role = conv && roleOf(conv, req.user.email);
    if (!role) return res.status(404).json({ error: "not_found" });
    const block = req.body?.block !== false;
    if (block && conv.blocked_by && conv.blocked_by !== role) return res.json({ ok: true }); // already closed by the other side
    if (!block && conv.blocked_by !== role) return res.status(403).json({ error: "not_yours_to_reopen" });
    db.prepare("UPDATE conversations SET blocked_by = ? WHERE id = ?").run(block ? role : "", conv.id);
    res.json({ ok: true });
  });

  app.post("/api/messages/:id/report", requireSession, (req, res) => {
    const conv = db.prepare("SELECT * FROM conversations WHERE id = ?").get(req.params.id);
    const role = conv && roleOf(conv, req.user.email);
    if (!role) return res.status(404).json({ error: "not_found" });
    const reason = String(req.body?.reason || "").trim().slice(0, 1000);
    if (!reason) return res.status(400).json({ error: "reason_required" });
    const already = db.prepare("SELECT 1 FROM message_flags WHERE conversation_id = ? AND source = 'report' AND reporter_email = ? AND status = 'open'").get(conv.id, req.user.email);
    if (!already) {
      db.prepare("INSERT INTO message_flags (id, conversation_id, source, reporter_email, reason, label, created_at) VALUES (?,?,?,?,?,?,?)")
        .run(crypto.randomUUID(), conv.id, "report", req.user.email, reason, "Reported by a member", now());
      alertAdmin(`CRNA Critics — a member reported a message`,
        `<p>${escapeHtml(req.user.name)} reported a private conversation about <strong>${escapeHtml(conv.subject)}</strong>.</p><blockquote style="border-left:3px solid #8C3A32;margin:8px 0;padding:4px 10px;color:#444;">${escapeHtml(reason)}</blockquote>`);
    }
    if (req.body?.block) db.prepare("UPDATE conversations SET blocked_by = ? WHERE id = ? AND blocked_by = ''").run(role, conv.id);
    res.json({ ok: true });
  });

  // ----- admin: only conversations that were reported or flagged -----

  function adminConv(conv) {
    const name = (email) => { const m = memberRow(email); return m ? m.name : "(deleted account)"; };
    const id = (email) => { const m = memberRow(email); return m ? m.id : null; };
    return {
      id: conv.id,
      subject: conv.subject,
      createdAt: conv.created_at,
      asker: { name: name(conv.asker_email), email: conv.asker_email, id: id(conv.asker_email) },
      reviewer: { name: name(conv.reviewer_email), email: conv.reviewer_email, id: id(conv.reviewer_email) },
      blockedBy: conv.blocked_by,
      closedByAdmin: !!conv.closed_by_admin,
      messages: db.prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC").all(conv.id).map((m) => ({
        id: m.id, from: m.sender_email === conv.asker_email ? "asker" : "reviewer", body: m.body, createdAt: m.created_at, removed: !!m.removed_by_admin,
      })),
    };
  }

  app.get("/api/admin/message-flags", requireAdmin, (req, res) => {
    const flags = db.prepare("SELECT * FROM message_flags ORDER BY CASE status WHEN 'open' THEN 0 ELSE 1 END, created_at DESC LIMIT 300").all();
    const convIds = [...new Set(flags.map((f) => f.conversation_id))];
    const conversations = convIds.map((cid) => db.prepare("SELECT * FROM conversations WHERE id = ?").get(cid)).filter(Boolean).map(adminConv);
    const reporterName = (email) => { const m = email && memberRow(email); return m ? m.name : ""; };
    res.json({
      flags: flags.map((f) => ({ ...f, reporter_name: reporterName(f.reporter_email) })),
      conversations,
    });
  });

  app.post("/api/admin/message-flags/:id", requireAdmin, (req, res) => {
    const status = ["open", "dismissed", "resolved"].includes(req.body?.status) ? req.body.status : null;
    if (!status) return res.status(400).json({ error: "bad_status" });
    const f = db.prepare("SELECT * FROM message_flags WHERE id = ?").get(req.params.id);
    if (!f) return res.status(404).json({ error: "not_found" });
    // Dismissing one card clears every open flag on that conversation.
    if (req.body?.allInConversation) {
      db.prepare("UPDATE message_flags SET status = ?, resolved_at = ? WHERE conversation_id = ? AND status = 'open'").run(status, status === "open" ? null : now(), f.conversation_id);
    } else {
      db.prepare("UPDATE message_flags SET status = ?, resolved_at = ? WHERE id = ?").run(status, status === "open" ? null : now(), f.id);
    }
    res.json({ ok: true });
  });

  app.post("/api/admin/conversations/:id/close", requireAdmin, (req, res) => {
    const close = req.body?.close !== false;
    const changed = db.prepare("UPDATE conversations SET closed_by_admin = ? WHERE id = ?").run(close ? 1 : 0, req.params.id).changes;
    if (!changed) return res.status(404).json({ error: "not_found" });
    if (close) db.prepare("UPDATE message_flags SET status = 'resolved', resolved_at = ? WHERE conversation_id = ? AND status = 'open'").run(now(), req.params.id);
    res.json({ ok: true });
  });

  app.post("/api/admin/messages/:id/remove", requireAdmin, (req, res) => {
    const changed = db.prepare("UPDATE messages SET removed_by_admin = ? WHERE id = ?").run(req.body?.remove === false ? 0 : 1, req.params.id).changes;
    if (!changed) return res.status(404).json({ error: "not_found" });
    res.json({ ok: true });
  });

  // Used by /api/reviews so the "Ask this reviewer" button can be hidden without revealing who opted out.
  function optedOutEmails() {
    return new Set(db.prepare("SELECT email FROM access_requests WHERE accept_questions = 0 OR status != 'approved'").all().map((r) => r.email));
  }
  function openMessageFlagCount() {
    return db.prepare("SELECT COUNT(DISTINCT conversation_id) AS n FROM message_flags WHERE status = 'open'").get().n;
  }

  return { optedOutEmails, openMessageFlagCount, scanMessage, runMessageReminders };
};
