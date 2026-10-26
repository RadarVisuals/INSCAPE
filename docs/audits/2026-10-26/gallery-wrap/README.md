# Gallery wrap flicker — 26 October 2026

The founder reported a blank flash in the upper half while scrolling down and
the lower half while scrolling up with Wrap enabled.

## Cause and change

Each repeated card independently mounted/unmounted its preview through an
IntersectionObserver. Scroll normalization immediately replaces the visible
cycle with an equivalent one; that destination copy could still be unmounted.
Its observer and preview measurement completed after a blank frame was painted.

WorkbenchOverviewGrid now owns one observer and derives visibility per canvas
across its repeated cards. All equivalent copies of a nearby composition are
prepared together. Distant compositions still unload. The previous per-card
observers and conflicting visibility state were removed. The same component
serves owner and published galleries; scroll math, publication and persistence
are unchanged. This is a scoped rendering fix, not a broader architecture audit.

## Frame evidence

Native wheel input ran down and up through repeated boundaries, with a DOM
sample on every animation frame and CDP screencast frames captured independently.
At 390 × 900, the baseline had 20 samples with missing visible content (10 in
each direction) across 10 wraps; the same run after the fix had zero across 10
wraps. At 1440 × 900 with only two canvases, both runs were already clean (22
wraps each). See [metrics](frame-summary.json).

- [Before, downward wrap](before-down.png): upper card blank.
- [Before, upward wrap](before-up.png): lower card blank.
- [After, touch input](after-touch.png): both cards painted.
- [After, eight canvases at 1440px](after-eight.png): populated rows.

Raw recordings and per-frame geometry remain in local `.verification/wrap-before`
and `.verification/wrap-after`; the regression suites save their frame traces in
`.browser-test-runtime/run-1793024205578`.

## Verification

- Workbench overview: 14 browser tests passed, including eight-canvas continuous
  scrolling at 1.25 device scale, resize, unloading distant content, card sizes,
  arrangement, hover, keyboard access, crop and opening/closing inspection.
- Published gallery: 4 browser tests passed, including continuous wheel and
  emulated touch swipes at 2× density, with zero missing-preview frames.
- Full unit suite: 1,462 passed; lint passed with existing recorded observations.
- Production build and bundle checks passed with a 40-character release ID.

Chromium automation and visual inspection reproduced the reported symptom.
Physical iOS/Safari and the founder's particular device were not measured.
No claim is made about frame rate for arbitrary artwork complexity or network
loading. The existing hosted workflow at the starting SHA was cancelled; the
Netlify preview at that SHA was successful.
