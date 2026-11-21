// Rating categories, copied from public/app.js so the iPhone app can score and rate offline.
// Keep keys, labels and weights in sync with the website.
const AGENCY_CATEGORIES = [
  { key: "payBilling", label: "Pay & Billing Accuracy", weight: 0.2, hint: "5 = paid exactly as quoted, on time · 1 = rate cut, late or unexplained deductions" },
  { key: "contractTerms", label: "Contract Terms", weight: 0.15, hint: "5 = fair notice, guaranteed hours honored · 1 = punitive terms, hours not honored" },
  { key: "credentialing", label: "Credentialing Support", weight: 0.15, hint: "5 = fast and proactive · 1 = slow, nearly fell through" },
  { key: "communication", label: "Communication / Responsiveness", weight: 0.2, hint: "5 = responsive and upfront · 1 = hard to reach, misrepresented the job" },
  { key: "travelLogistics", label: "Travel & Logistics", weight: 0.1, hint: "5 = housing/per diem smooth · 1 = mishandled or never reimbursed" },
  { key: "assignmentMatch", label: "Assignment Quality Match", weight: 0.2, hint: "5 = matched the description exactly · 1 = little resemblance" },
];
const HOSPITAL_CATEGORIES = [
  { key: "caseMix", label: "Case Mix & Acuity", weight: 0.1, hint: "5 = strong variety, kept you sharp · 1 = monotonous or mismatched" },
  { key: "staffing", label: "Staffing & Support", weight: 0.1, hint: "5 = fully staffed, backup available · 1 = chronically short" },
  { key: "equipment", label: "Equipment & Resources", weight: 0.05, hint: "5 = modern, supplies on hand · 1 = broken equipment, shortages" },
  { key: "culture", label: "Culture & Collegiality", weight: 0.1, hint: "5 = part of the team from day one · 1 = unwelcoming to locums" },
  { key: "chief", label: "Chief & Leadership Treatment", weight: 0.15, hint: "5 = fair share of schedule and cases · 1 = treated as disposable" },
  { key: "orientation", label: "Orientation / Onboarding", weight: 0.05, hint: "5 = productive from day one · 1 = disorganized onboarding" },
  { key: "schedule", label: "Schedule Reliability", weight: 0.1, hint: "5 = ran as promised · 1 = frequent last-minute changes" },
  { key: "lunchesBreaks", label: "Lunches & Breaks", weight: 0.1, hint: "5 = lunch every day, most breaks · 1 = lunch often missed" },
  { key: "meals", label: "Free Meals", weight: 0.05, hint: "5 = meals and snacks provided · 3 = weekly/monthly · 1 = none" },
  { key: "locationLogistics", label: "Location / Logistics", weight: 0.05, hint: "5 = easy commute and parking · 1 = difficult commute, poor parking" },
  { key: "supervision", label: "Practice Autonomy", weight: 0.15, hint: "5 = independent · 3 = loosely directed · 1 = medically directed" },
];
const GROUP_CATEGORIES = [
  { key: "compensation", label: "Compensation & Benefits", weight: 0.2, hint: "5 = at or above market, strong benefits · 1 = below market" },
  { key: "leadership", label: "Chief & Leadership", weight: 0.2, hint: "5 = transparent, advocates for CRNAs · 1 = opaque or punitive" },
  { key: "scheduleCall", label: "Scheduling & Call Burden", weight: 0.15, hint: "5 = predictable, fair call · 1 = unsustainable call" },
  { key: "staffingWorkload", label: "Staffing & Workload", weight: 0.15, hint: "5 = fully staffed, relief available · 1 = chronically short" },
  { key: "culture", label: "Culture & Respect for CRNAs", weight: 0.15, hint: "5 = full members of the team · 1 = marginalized" },
  { key: "autonomy", label: "Practice Autonomy", weight: 0.15, hint: "5 = independent · 3 = loosely directed · 1 = medically directed" },
];
const AGENT_CATEGORIES = [
  { key: "trust", label: "Trustworthiness", weight: 0.3, hint: "5 = everything they said happened · 1 = said whatever it took" },
  { key: "communication", label: "Communication & Responsiveness", weight: 0.25, hint: "5 = answers within hours · 1 = days to hear back" },
  { key: "advocacy", label: "Advocacy & Negotiation", weight: 0.2, hint: "5 = pushed for your rate and terms · 1 = worked the facility's side" },
  { key: "followThrough", label: "Follow-through on Assignment", weight: 0.15, hint: "5 = fixed problems fast · 1 = went quiet once you signed" },
  { key: "pressure", label: "Respect for Your Decision", weight: 0.1, hint: "5 = no pressure · 1 = fake deadlines" },
];
const PAY_RANGES = ["Under $180", "$181–200", "$201–220", "$221–240", "$241–260", "$261–280", "$281+"];
const US_STATES = "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" ");
