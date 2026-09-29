// नन्हा स्कूल — settings you can change without touching the app code.
//
// Payments stay OFF (the whole app is free) while API_BASE or PUBLIC_KEY_JWK is empty.
// To turn on the 7-day free trial and subscription, follow docs/SUBSCRIPTION_SETUP.md.
window.NS_CONFIG = {
  // Address of your Cloudflare Worker, e.g. "https://nanha-school-api.yourname.workers.dev"
  // The app's Content-Security-Policy only lets it talk to *.workers.dev. If API_BASE is on any
  // other domain, add its origin (e.g. https://api.example.com) to connect-src in the CSP in
  // index.html and pay.html (and in _headers), or every payment request will be blocked.
  API_BASE: "",

  // Public key printed by `npm run genkeys` in server/ (safe to publish).
  PUBLIC_KEY_JWK: null,

  // Free trial length in days. Keep it the same as TRIAL_DAYS in server/wrangler.toml.
  TRIAL_DAYS: 7,

  // Shown on the payment screen. Keep it the same as your Razorpay plan.
  PRICE_TEXT: "₹99 / महीना",

  // Tiles that stay free forever after the trial (use the tile names).
  FREE: ["ABC", "अक्षर", "गिनती"],

  // How many rhymes stay free forever after the trial.
  FREE_RHYMES: 2,
};
