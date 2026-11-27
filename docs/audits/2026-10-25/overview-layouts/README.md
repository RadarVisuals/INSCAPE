# Workbench overview: List and Grid

Implemented locally on 25 October 2026; uncommitted, not pushed or deployed.
Checkout: `remediation-2026-10-19-shared-checkpoint/work`; branch
`codex/audit-checkpoint-2026-10-19`; base HEAD
`6d7d428d91e2dce5629ccea7b48c345faabaec59`. Unrelated local changes are retained.

## Result and ownership

The bottom List / Grid control switches between the existing Hanssen preview/list
and an Aerra-inspired gallery. Both show the same saved Workbenches. Grid fits
each complete composition inside its tile and adapts from four columns on wide
screens to one on phones. Clicking a tile opens its Workbench. Its details button
opens the existing title, introduction, content counts and canvas dimensions;
Edit details keeps the existing validated save/failure flow.

Wrap is on by default for multiple Workbenches and can be turned off. Scrolling
continues vertically in either direction through three bounded visual cycles.
There is one accessible collection: repeated tiles are excluded from assistive
navigation and the tab order. Keyboard browsing remains finite, without scroll
normalization moving a focused target. There is no automatic scrolling or smooth
transition requirement. Single-Workbench galleries disable Wrap.

`OwnerWorkbenchSession` owns the temporary view/Wrap choice, so it survives
opening and returning from an editor, but resets with the profile session/reload.
The existing collection store remains the only persistence owner. Previewing,
view changes and wrapping do not activate or write a Workbench. The adapter
projects all saved entries only for Grid and invalidates its memoized snapshot
on the store generation. Each visual cycle shares those projections. Only nearby
cards mount the existing read-only preview renderer through IntersectionObserver.
No new dependency, storage schema, parallel content cache or editor is introduced.

The existing ownership boundary was adequate; no architecture cleanup was needed.
The optional Grid renderer is lazy-loaded. Existing Image first-side, Display
first-grid and interactive-placeholder preview limits still apply. Authored
geometry, source identity, the single-editor lease and publication gate are
unchanged. This does not implement Reception's redesign, a visitor collection,
opened-work presentation, Articles/Blog, Desktop or global navigation rollout.

## Verification

- [Final overview browser run](browser-verified/results.json): **5 passed**.
  Covers eight compositions; wrapping both ways; unchanged saved bytes while
  browsing; one keyboard collection; opening a visible repeated tile; remembered
  view/Wrap after returning from the editor; finite and single-item galleries;
  metadata editing and failed-save recovery; touch creation/details/opening;
  unchanged authored content; existing list hover, keyboard, touch and navigation;
  mixed Image, Shape and linked Text previews without executable iframes.
- [Editor navigation regression](browser-final/results.json): **9 sidebar tests
  passed**. Its five overview tests also passed, before the final caption-clearance
  adjustment and settled screenshot capture in the run above.
- [Focused model, collection and named-action tests](unit.log): **114 passed**.
- Strict Workbench type contracts pass (17 invalid calls and 3 production
  mutations rejected). [Lint](lint.log) passes with the existing 92 recorded
  observations and no additional suppression or observation.
- Design-system inventory regenerated and checked; **10 design-system tests pass**.
- [Production build](build-final.log), build:check, and [19 build tests](build-tests.log)
  pass, including the alternate-output build and owner/wallet loading boundaries.
- Scoped `git diff --check` passes. Settled screenshots were inspected at 2560,
  1440 and 390 pixels; overflow checks include 800 and 320 pixels. The live owner's
  dark gallery was inspected before they continued editing in their tab.

The [final build totals](build-totals.json) are 2,539,978 raw / 818,674 gzip bytes
for aggregate non-wallet JavaScript, including optional routes. The prior overview
build was 2,531,979 / 815,783. Only that aggregate budget was increased, to
2,541,000 / 819,500, to cover this measured addition. Initial-load, owner-static,
wallet, CSS and public-asset ceilings remain unchanged. Initial JS is 823,942 raw
bytes. No broad performance claim is made from these bounded fixtures.

The first cold fixture navigation timed out. Touch verification then caught a
real wrap/focus bug: centering the first canonical tile could normalize it into
a repeated cycle before the tap. Normalizing around the viewport centre fixes
that while keeping the visible sequence continuous. Subsequent runs pass. The
earlier repeated-tile test was also corrected to hit an actually visible copy
under the new threshold. Initial exact-budget assertions were updated alongside
the measured aggregate budget; the final build test run passes all 19 tests.

GitHub evidence for the base commit was rechecked: Verify Inscape run 40045584067
was cancelled; the Netlify PR preview status succeeded. Neither covers these
uncommitted changes. This was not a full release-checkpoint run.

## Visual evidence

These automated captures use isolated test compositions, not the owner's artwork:

- [List, 1440 px](browser-verified/workbench-overview/overview-1440.png)
- [Grid, 2560 px](browser-verified/workbench-overview/grid-2560.png)
- [Grid, 1440 px](browser-verified/workbench-overview/grid-1440.png)
- [Grid, 390 px](browser-verified/workbench-overview/grid-390.png)
- [Touch details](browser-verified/workbench-overview/grid-touch-details.png)

The [reference packet](../../../design-references/2026-10-25-hanssen/README.md)
now records Hanssen as the primary navigation/list direction and Aerra as the
alternative gallery/wrap reference, including an unedited live reference capture.
