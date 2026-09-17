// Review guard: checks the written parts of a review against the Online Review
// Instructions & Guidelines and returns "flags" — things that could get the CRNA (or
// the site) in trouble. Rule-based, so it runs with no outside service. Each flag
// carries a plain-English issue and a suggested rewrite direction.
//
// Deliberately narrow: only defamation, harassment, HIPAA and privacy — the things that
// can actually get a CRNA in trouble. Style (caps, profanity) is not flagged.
// Nothing here emails a member on its own; Eric decides from the Alerts tab.

const RULES = [
  {
    key: "patient_info",
    severity: "high",
    label: "Possible patient information (HIPAA)",
    // A specific patient or case: age + sex, outcome, diagnosis, record numbers, dates of service.
    test: (t) => /\b(patient|pt\.?|case)\b[^.]{0,80}\b(\d{1,3}\s*(year|yr|y\/?o)|died|death|coded|arrest(ed)?|MRN|diagnos\w*|malignant hyperthermia)/i.test(t)
      || /\b(\d{1,3})[- ](year|yr)[- ]old\b/i.test(t)
      || /\bMRN\b|\bmedical record\b|\bdate of service\b/i.test(t),
    issue: "This reads like it describes a specific patient or case (age, sex, outcome, or clinical detail). Anything that could identify a patient is a HIPAA problem and is the one absolute rule on the site.",
    suggestion: "Remove the case detail entirely. Say what it meant for you instead — e.g. \"support in emergencies was slow\" or \"acuity is higher than advertised\" — without any age, date, outcome, or diagnosis.",
  },
  {
    key: "crime_accusation",
    severity: "high",
    label: "Accusation of a crime or fraud (defamation risk)",
    test: (t) => /\b(fraud(ulent)?|stole|stealing|theft|thief|thieves|embezzl\w*|illegal(ly)?|criminal|crooks?|felony|kickbacks?|bribe[sd]?|launder\w*|drug diversion|diverting (drugs|narcotics)|impaired at work|showed up drunk|drunk at work|assault(ed)?|sexually harass\w*|molest\w*)\b/i.test(t),
    issue: "Accusing a company or a person of a crime (fraud, theft, illegal billing, diversion, assault) is a statement of fact you would have to prove. It is the most common basis for a defamation demand letter.",
    suggestion: "Describe what actually happened and let readers draw the conclusion: \"The invoice showed hours I did not work and it took three emails to get it corrected\" says more than \"they commit fraud\" and is defensible.",
  },
  {
    key: "liar",
    severity: "high",
    label: "\"Lied\" or \"scam\" stated as fact (defamation risk)",
    test: (t) => /\b(lied|liar|lying|scam(mer|my|s)?|con artist|swindl\w*)\b/i.test(t)
      || /\b(is|are|was|were)\s+(a\s+)?(dishonest|deceitful|deceptive)\b/i.test(t),
    issue: "\"Lied\" or \"scam\" is an accusation of fact about someone's intent. If it can't be proven, it can be treated as defamation even when the frustration is justified.",
    suggestion: "State the two things that didn't match: \"I was told $X on the phone; the contract said $Y\" or \"I was promised no call; the schedule had call.\" That is what you can prove, and it is more useful to the next CRNA.",
  },
  {
    key: "threat_harassment",
    severity: "high",
    label: "Threat or harassment",
    test: (t) => /\b(i('ll| will) (make sure|see to it) (you|she|he|they) never work|ruin (him|her|them|you)|destroy (him|her|them|you)|(you|he|she|they) (will|'ll) (pay|regret)|watch your back|i know where (you|he|she) live|going to (hurt|kill)|deserve[sd]? to (die|be hurt))\b/i.test(t),
    issue: "This reads as a threat or an attempt to intimidate. Threats and harassment are outside the Terms and can carry legal consequences of their own, separate from anything defamatory.",
    suggestion: "Keep the review to what happened and how it affected your assignment. If you feel someone needs to be reported, do that through the proper channel, not in a review.",
  },
  {
    key: "slur_or_discrimination",
    severity: "high",
    label: "Slur or discriminatory remark",
    // Slurs and traits used as the criticism. Everyday phrases ("drove me crazy") and
    // positive mentions ("they accommodate pregnant CRNAs") are not flagged.
    test: (t) => /\b(retard\w*|tranny|fag\w*|wetback|towelhead|chink|spic|kike|n[i1]gg\w*)\b/i.test(t)
      || /\b(too old|too young|past (his|her) prime|because (he|she)('s| is| was) (a |an )?(woman|man|female|male|black|white|asian|hispanic|indian|foreign\w*|muslim|christian|jewish|gay|old|young))\b/i.test(t)
      || /\b(thick|heavy|terrible|bad)\s+accent\b/i.test(t)
      || /\b(he|she|they)\s+(is|was|are|were)\s+(probably\s+|clearly\s+|obviously\s+)?(mentally (ill|unstable)|bipolar|an? alcoholic|an? addict|on drugs|senile)\b/i.test(t),
    issue: "A slur, or criticism based on someone's age, sex, race, religion, accent, or health, can be read as discriminatory harassment and is outside the Terms.",
    suggestion: "Keep it to professional conduct — communication, honesty, follow-through — and leave personal characteristics out.",
  },
  {
    key: "private_details",
    severity: "medium",
    label: "Phone number, email, or home address",
    test: (t) => /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/.test(t) || /[\w.+-]+@[\w-]+\.[\w.]+/.test(t) || /\b\d{2,5}\s+[A-Z][a-z]+\s+(St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Blvd|Lane|Ln|Ct|Court)\b/.test(t),
    issue: "A phone number, email address, or street address in a review can be someone's private contact information, which the guidelines ask members to leave out.",
    suggestion: "Remove the contact details. If the point is that they were hard to reach, say that: \"calls went to voicemail for a week.\"",
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
