// Switches capacitor.config.json to the bundled iPhone app before `cap sync ios`.
//
// Android keeps loading crnacritics.com (Google approved that build). The iPhone build ships its own
// screens from mobile/app/ and talks to the site's JSON API, because Apple's guideline 4.2 rejects apps
// that only show a website. Run in CI only; the committed config stays the Android one.
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "capacitor.config.json");
const cfg = JSON.parse(fs.readFileSync(file, "utf8"));
delete cfg.server;
cfg.webDir = "app";
cfg.plugins = {
  ...cfg.plugins,
  // Native networking: requests go through URLSession, so no browser CORS or third-party-cookie limits.
  CapacitorHttp: { enabled: true },
  SplashScreen: { ...(cfg.plugins && cfg.plugins.SplashScreen), launchAutoHide: false },
  StatusBar: { ...(cfg.plugins && cfg.plugins.StatusBar), overlaysWebView: true, style: "DEFAULT" },
};
cfg.ios = { ...cfg.ios, contentInset: "never" };
fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + "\n");
console.log("capacitor.config.json now points the iPhone build at the bundled app (webDir: app).");
