# Hanssen Workbench overview

Implemented locally on 25 October 2026. Uncommitted; no push or deployment.
Application checkout: `remediation-2026-10-19-shared-checkpoint/work`, branch
`codex/audit-checkpoint-2026-10-19`, base HEAD
`6d7d428d91e2dce5629ccea7b48c345faabaec59`. Existing unrelated changes were retained.

## Result

The owner overview now uses the [Hanssen reference](../../../design-references/2026-10-25-hanssen/README.md):
a large persistent preview on the left, a heading and broad composition rows on
the right, narrow gaps and rounded surfaces. The selected composition has a
title/introduction panel and compact saved-content/dimension metadata.

The top-left navigation shows the existing profile avatar/name, About and
Canvases. About uses the existing Reception action. Navigation remains visible
while scrolling. The editor retains its existing composition sidebar and tools;
its now-unused overview presentation branch was removed.

Hover or keyboard focus previews a row without writing or activating a draft.
Click, tap or Enter opens that Workbench. Details retain their explicit Open
Workbench action. New Workbench and Edit details keep the existing saved model,
limits, save failure recovery and focus restoration. Editing locks browsing and
navigation until save/cancel. Touch focus does not preview before a tap completes:
that could otherwise shrink the details and move the tapped row through scroll
anchoring. A regression test reproduces that case with a long introduction.

No composition geometry or storage format changed. The existing inert preview
renderer, collection store and editor scope lifecycle remain authoritative.
Identity uses the existing profile hook/cache, with development fixtures scoped
to development. Artwork is fitted whole, so wide compositions retain space above
and below inside the tall preview. Only the selected saved work is rendered.

## Verification

- [Final overview browser run](browser-touch-fix/results.json): **3 passed**.
  Covers real pointer hits through the application shell; hover and keyboard
  browsing with unchanged saved bytes; opening the chosen canvas; save/open
  failures; rename/introduction persistence; Escape/cancel and focus recovery;
  About navigation; sticky preview/navigation; narrow touch interaction; long
  names/introduction; no executable iframe or editable preview; mixed Image,
  Shape and linked Text content.
- [Sidebar regression run](browser-final/results.json): **9 passed**, alongside
  the earlier two passing overview checks. The final three overview checks above
  supersede that earlier overview run.
- [Focused model, named-action and collection tests](unit.log): **114 passed**.
- Strict Workbench contracts pass: 17 invalid calls and 3 production mutations
  rejected. Lint passes with the existing 92 recorded hook-dependency observations.
- Design-system inventory regenerated and checked; **10 design-system tests pass**.
- [Production build](build.log) and [build:check](build-check.log) pass with the
  existing budgets. Owner and standalone wallet code remain outside the initial
  entry. No budget increase or new dependency. Aggregate raw JS is close to its cap.
- `git diff --check` passes. Wide and narrow screenshots were inspected at 2560,
  1440, 1024 and 390 pixels; overflow assertions also cover 800, 700 and 320 pixels.
  Reduced motion and touch were exercised. Existing light surfaces and the live
  owner's dark surface were both inspected.

The first browser run timed out during cold fixture loading; the retry passed.
The first touch run caught the focus/scroll issue described above and is
superseded by the final passing evidence. Sandbox restrictions prevented some
esbuild launches; approved local runs completed the same build/test commands.

GitHub evidence rechecked for the base commit: Verify Inscape run 40045584067
was cancelled; the Netlify PR preview status was successful. Neither is evidence
for these uncommitted changes. No release checkpoint or full-suite release claim.

## Screenshots and boundaries

- [Before, live owner overview](before.jpg)
- [After, live owner overview with keyboard focus](after.jpg)
- [Narrow overview](browser-touch-fix/workbench-overview/overview-390.png)
- [Narrow long-title/details and sticky navigation](browser-touch-fix/workbench-overview/overview-touch-details.png)
- [Mixed saved-content preview](browser-touch-fix/workbench-overview/overview-mixed.png)

This slice covers the local owner overview. Reception's own redesign, an opened
work's presentation, Articles/Blog, Desktop and navigation across all destinations
remain subsequent work. Existing collection publication restrictions and preview
limits (first Image side, first Display Grid, interactive placeholders) remain.
There is no public collection overview, visitor switching, publishing, new
default landing, upload or wallet action in this change.
