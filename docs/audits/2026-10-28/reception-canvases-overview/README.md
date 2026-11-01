# Separate Canvases overview restored — 28 October 2026

The founder requested undoing the gallery appended below Reception. Canvases and Enter Inscape now use the existing navigation callback. The public canvas route renders the existing read-only WorkbenchOverview again, with its viewer and About return. Reception no longer adds a gallery or scrolls to an embedded section.

Explicitly authored linked cells still resolve their saved sources, swipe the real Display, and open their named canvas/camera destination. Their canonical data and publication boundaries are unchanged. The owner review fixture now opens the overview from Canvases and returns to Reception editing through About; its session storage and current draft are retained.

## Verification

- [Navigation run](navigation.log): 9/9 passed. Local/public linked content and overview transitions at 1920px and 390px; public gallery inspection, metadata, About and browser-back; review fixture navigation and draft preservation.
- [Final owner/public run](owner-public-final.log): 3/3 passed. Real Workbench entry returns through Canvases; public fixtures omit owner editing at both widths. These runs cover 10 unique cases.
- [Browser catalog](catalog.log): the new reception-overview-navigation suite is registered as a release suite and catalog validation passes.
- Visually inspected [desktop overview](local-1920-gallery.png), [mobile Reception](public-390-reception.png), and review captures at both widths. No inline gallery remains; viewer closure returns to the overview and restores focus/scroll.

## Remaining boundary

OwnerReceptionCollection still loads preview artwork for all snapshot entries. The linked-cell viewer still uses presentation previews, so this existing asset-prefetch coupling was deliberately left unchanged in the scoped navigation restoration. No loading refactor, authored-data migration, commit, push or deployment was performed by this change.

## Production verification

The final production build and `build:check` passed. Lint passed with the same
88 recorded hook observations; design-system inventory and whitespace checks
passed. Logs are in `../reception-overview-restored/`.

Restoring WorkbenchOverview as a shared owner/public route changes Rollup's
partitioning: seven additional shared chunks/import facades appear, including
the overview, article reader and preview helpers. The aggregate measures
2,685,621 raw / 881,633 gzip bytes; initial JavaScript is 831,095 bytes
(31 bytes below the preceding grip-only build). The aggregate raw and gzip
limits each grew by 3,000 bytes, to 2,686,000 / 882,000. All startup, owner,
wallet, CSS and asset limits remain unchanged. This records the measured
transfer increase from the restored route without broadening module loading
or rewriting the existing gallery to make the previous ceiling pass.

The first full run exposed an unregistered browser suite and this measured
build overage. The next run exposed the old mirrored budget expectation;
both registrations/expectations were corrected. Retain the intermediate logs
as failed evidence; the final run is `unit-verified.log`: **1,493/1,493 passed**,
including the alternate-output production build and browser-suite catalog.

The companion grip contrast correction is documented in
`../reception-bottom-toolbar/README.md`: all six white/black/midgrey captures
in both interface themes were inspected, and the four existing keyboard,
pointer, touch and narrow-toolbar browser cases passed again.
