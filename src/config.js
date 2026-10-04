// ─── Site configuration ──────────────────────────────────────────────────────
// The only file you need to edit after registering with Google AdSense and a
// visitor-map provider. Leave a value empty ("") and the page shows a neutral
// placeholder in its spot instead.

export const CONFIG = {
  // Google AdSense publisher ID, e.g. "ca-pub-1234567890123456".
  // Get it at https://adsense.google.com after your site is approved.
  // ads.txt is NOT in this repo: Google reads it only from the domain root, so
  // it lives in oursharedcode.github.io and already carries this ID.
  // Both this and adsenseSlot must be set before any ad renders.
  adsenseClient: "",

  // AdSense ad-unit slot ID for the vertical ad, e.g. "1234567890".
  // Create a "Display ad" unit (vertical) in AdSense → Ads → By ad unit.
  adsenseSlot: "",

  // Base URL of the visitor-counter Worker (no trailing slash). It tallies
  // visitors by country and feeds the world map in the right rail. The Worker
  // is the one Prompt Engineering Studio uses; its source is in that repo, at
  // deploy/visitor-stats-worker.js. Both studios feed the same tally.
  visitorStatsUrl: "https://promengi-visitor-stats.oursharedcode.workers.dev",
};
