// Review guard: checks the written parts of a review against the Online Review
// Instructions & Guidelines and returns "flags" — things that could get the CRNA (or
// the site) in trouble. Rule-based, so it runs with no outside service. Each flag
// carries a plain-English issue and a suggested rewrite direction.
//
// Severity: high = likely legal/HIPAA exposure, email the member right away;
// medium = worth a second look, email the member; low = style only, alert Eric only.

const RULES = [
  {
    key: "patient_info",
    severity: "high",
    label: "Possible patient information",
    // Patient details: age/sex/diagnosis/outcome wording near "patient"/"case".
    test: (t) => /\b(patient|pt\.?|case)\b[^.]{0,80}\b(\d{1,3}\s*(year|yr|y\/?o)|male|female|yo\b|died|death|coded|arrest|complication|MRN|diagnos|aspirat|malignant hyperthermia|intubat)/i.test(t)
      || /\b(\d{1,3})[- ](year|yr)[- ]old\b/i.test(t)
      || /\bMRN\b|\bmedical record\b|\bdate of service\b/i.test(t),
    issue: "This reads like it describes a specific patient or case (age, sex, outcome, or clinical detail). Anything that could identify a patient is a HIPAA problem and is the one absolute rule on the site.",
    suggestion: "Remove the case detail entirely. Say what it meant for you instead — e.g. \"support in emergencies was slow\" or \"acuity is higher than advertised\" — without any age, date, outcome, or diagnosis.",
  },
  {
    key: "crime_accusation",
    severity: "high",
    label: "Accusation of a crime or fraud",
    test: (t) => /\b(fraud(ulent)?|stole|stealing|theft|thief|thieves|embezzl\w*|illegal(ly)?|criminal|crooks?|felony|kickback|bribe|launder\w*|drug diversion|diverting|impaired at work|showed up drunk|drunk at work|assault(ed)?|sexually harass\w*)\b/i.test(t),
    issue: "Accusing a company or a person of a crime (fraud, theft, illegal billing, diversion, assault) is a statement of fact you would have to prove. It is the most common basis for a defamation demand letter.",
    suggestion: "Describe what actually happened and let readers draw the conclusion: \"The invoice showed hours I did not work and it took three emails to get it corrected\" says more than \"they commit fraud\" and is defensible.",
  },
  {
    key: "liar",
    severity: "medium",
    label: "\"Lied\" stated as fact",
    test: (t) => /\b(lied|liar|lying|lies|dishonest|deceit\w*|deceptive|scam(mer|my)?|con artist|misrepresented)\b/i.test(t),
    issue: "\"Lied\" or \"scam\" is an accusation of fact about someone's intent. If it can't be proven, it can be treated as defamation even when the frustration is justified.",
    suggestion: "State the two things that didn't match: \"I was told $X on the phone; the contract said $Y\" or \"I was promised no call; the schedule had call.\" That is what you can prove, and it is more useful to the next CRNA.",
  },
  {
    key: "named_individual",
    severity: "medium",
    label: "Names an individual who isn't being rated",
    test: (t) => /\b(Dr\.?|Doctor|Nurse|CRNA|surgeon)\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)?\b/.test(t) || /\bchief\s+(is|was)\s+[A-Z][a-z]+\b/.test(t),
    issue: "The guidelines ask members to rate only the hospital, group, agency, or recruiter — not to name surgeons, chiefs, co-workers, or other CRNAs.",
    suggestion: "Refer to the role instead of the person: \"one of the surgeons,\" \"the chief,\" \"the scheduler.\" The point lands without putting a private individual's name on a public page.",
  },
  {
    key: "personal_attack",
    severity: "medium",
    label: "Personal attack or slur",
    test: (t) => /\b(idiot|moron|stupid|incompetent|worthless|ugly|fat|lazy|bitch|asshole|bastard|jerk|clown|psycho|crazy|retard\w*|racist|sexist|old hag|dumb)\b/i.test(t),
    issue: "Personal insults about someone's character, looks, or ability aren't protected as opinion in the way a description of conduct is, and they get reviews discounted by readers.",
    suggestion: "Swap the label for the behavior: instead of \"incompetent,\" say \"took four days to answer a credentialing question\" or \"sent the wrong contract twice.\"",
  },
  {
    key: "private_details",
    severity: "medium",
    label: "Phone number, email, or address",
    test: (t) => /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/.test(t) || /[\w.+-]+@[\w-]+\.[\w.]+/.test(t) || /\b\d{2,5}\s+[A-Z][a-z]+\s+(St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Blvd|Lane|Ln|Ct|Court)\b/.test(t),
    issue: "A phone number, email address, or street address in a review can be someone's private contact information, which the guidelines ask members to leave out.",
    suggestion: "Remove the contact details. If the point is that they were hard to reach, say that: \"calls went to voicemail for a week.\"",
  },
  {
    key: "protected_traits",
    severity: "medium",
    label: "Comment on age, sex, race, religion, or health",
    test: (t) => /\b(too old|too young|because (he|she)('s| is| was) (a )?(woman|man|black|white|asian|hispanic|indian|foreign|muslim|christian|jewish|gay)|accent|pregnant|disabled|mental(ly)? (ill|unstable)|bipolar|alcoholic|addict)\b/i.test(t),
    issue: "Comments about someone's age, sex, race, religion, accent, or health fall under the \"no attacks on private individuals\" rule and can be read as discriminatory.",
    suggestion: "Keep it to professional conduct — communication, honesty, follow-through — and leave personal characteristics out.",
  },
  {
    key: "financial_guess",
    severity: "low",
    label: "Guess about a company's finances or legality",
    test: (t) => /\b(going under|going bankrupt|bankrupt|can'?t make payroll|about to fold|insolvent|breaking the law|violat\w+ (labor|federal|state) law|illegal(ly)? billing)\b/i.test(t),
    issue: "Guessing at a company's finances or legality (\"going under,\" \"violating labor law\") states something as fact that the member usually can't know.",
    suggestion: "Report the experience only: \"my last two checks were late\" or \"pay arrived 30+ days after the invoice.\"",
  },
  {
    key: "all_caps",
    severity: "low",
    label: "Mostly ALL CAPS",
    test: (t) => {
      const letters = t.replace(/[^A-Za-z]/g, "");
      if (letters.length < 40) return false;
      const upper = letters.replace(/[^A-Z]/g, "").length;
      return upper / letters.length > 0.6;
    },
    issue: "The guidelines note that ALL CAPS and \"worst ever\" language gets a review discounted by readers and read as malice by lawyers.",
    suggestion: "Normal sentence case, same facts. It reads as more credible and carries more weight with the next CRNA.",
  },
  {
    key: "profanity",
    severity: "low",
    label: "Profanity",
    test: (t) => /\b(fuck\w*|shit\w*|damn|hell of|bullshit|crap|pissed)\b/i.test(t),
    issue: "Profanity is called out in the guidelines as something that gets a review discounted.",
    suggestion: "Same point, cleaner words — the frustration comes through fine without them.",
  },
];

function safeJson(v) {
  try { const o = JSON.parse(v || "{}"); return o && typeof o === "object" ? o : {}; } catch { return {}; }
}

// Every written field of a review, labelled so a flag can say where it was.
function reviewTexts(row) {
  const out = [];
  const add = (where, text) => { if (text && String(text).trim()) out.push({ where, text: String(text) }); };
  add("hospital comment", row.hospital_comment);
  add("anesthesia group comment", row.group_comment);
  add("agency comment", row.agency_agent_comment);
  add("recruiter comment", row.agent_comment);
  const notes = [["hospital", row.hospital_notes], ["group", row.group_notes], ["agency", row.agency_agent_notes], ["recruiter", row.agent_notes]];
  notes.forEach(([kind, json]) => {
    Object.entries(safeJson(json)).forEach(([key, text]) => add(`${kind} note (${key})`, text));
  });
  return out;
}

// The sentence around the first match, for the alert card and the email.
function excerptFor(rule, text) {
  const sentences = text.split(/(?<!\b(?:Dr|Mr|Mrs|Ms|St|vs|etc)\.)(?<=[.!?])\s+/);
  const hit = sentences.find((s) => rule.test(s)) || text;
  return hit.length > 240 ? hit.slice(0, 237) + "…" : hit;
}

function scanReview(row) {
  const flags = [];
  const seen = new Set();
  reviewTexts(row).forEach(({ where, text }) => {
    RULES.forEach((rule) => {
      if (seen.has(rule.key)) return; // one flag per rule per review
      let hit = false;
      try { hit = rule.test(text); } catch { hit = false; }
      if (!hit) return;
      seen.add(rule.key);
      flags.push({ rule: rule.key, severity: rule.severity, label: rule.label, where, excerpt: excerptFor(rule, text), issue: rule.issue, suggestion: rule.suggestion });
    });
  });
  return flags;
}

const SEVERITY_RANK = { high: 3, medium: 2, low: 1 };

module.exports = { RULES, scanReview, reviewTexts, SEVERITY_RANK };
