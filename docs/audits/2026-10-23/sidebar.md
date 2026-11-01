# Workspace sidebar — local implementation, 23 October 2026

Status: implemented in the application checkout on
`codex/audit-checkpoint-2026-10-19`, based on HEAD
`32d9418843d996afc2e5203afa4552a6cd2d459a`. Changes are local and uncommitted.
The extensive pre-existing working-tree changes were preserved. No commit,
push, publication or deployment was performed. The checked-in CI workflow was
inspected; neither previous CI nor an older build proves this local tree.

## Result and ownership

The owner workspace now shares the reference sidebar presentation, materials,
navigation filter and fold control. Existing Workbench, Grids, Library,
Discover, Activity, Preview, Publish, Profile, Docs and Settings actions are
wired through the host. The reference keeps account/sharing actions unavailable.
No account, wallet, publication or authored-content authority moved into the
presentation component.

The old bottom application bar, its source and obsolete styling are removed.
Creation and camera controls retain their existing responsibilities. Library
uses its existing portal slot to put its category tree in the expanded desktop
sidebar. Folding or a narrow viewport returns the same tree to Library; there
is no duplicate browsing state. Collapse is session state above the keyed
Workbench. The existing hide/show preference is reused without a migration.

Transient navigation insets are supplied through the existing Workbench view
context. Floating tools respect that space without rewriting authored geometry
or camera state. Narrow layouts use a scrollable icon strip; 320×568 uses one
reopen button beside the Workbench selector, preserving usable Keeper settings.
Explicit destination panels stack above editing utilities while navigation
remains accessible. The sidebar remains fixed when the camera pans or zooms.

The existing camera inspection lock now hides the Workbench selector as well
as the sidebar. This fixes the earlier narrow close-button overlap. Inspection
continues to use its existing camera/return lifecycle.

## Verification

- 32 focused Node tests pass: owner shell/public boundary, navigation, window
  geometry and design inventory (`unit-final.log`).
- All nine sidebar cases pass in `acceptance.log`: Carbon/Mist at 1440×900,
  390×900, 320×568 and 844×390, plus session switching/preview/hide/reopen.
  They check filtering, keyboard focus, pointer focus, destination opening and
  focus recovery, one Library tree, panel placement and unchanged saved content.
- The inspection case in `acceptance.log` passes for owner/Visitor, Image/Display
  and 1600/390px. It uses the real close button, not the previous Escape workaround.
- All ten Navigator cases pass in `ui-final.log`, including the small-screen
  Keeper-name field, camera gestures/cancellation/zoom, content changes,
  visibility/order, Workbench switching and filled-composition media retention.
- Both pan regressions pass in `drop-pan-verified.log`. They cover owner/Visitor,
  native/zoomed views, controls, blur and Workbench replacement.
- Both Library drop cases pass in `drop-final.log` at 1440 and 700px: placement
  geometry, undo/redo, append to Image, Display placement/lock, cancellation,
  failed storage, stale async completion after closure and reload geometry.
- Fourteen reference workspace/Library browser cases pass in
  `reference-tests.log`. Shared component appearance was inspected alongside the
  application screenshots in both themes and wide/narrow/low layouts.
- Token inventory generation/check passes: 78 files, 564 definitions, 290 names.
  Production build and independent build check pass. Initial JS is 823,030 raw /
  239,458 gzip bytes; core JS is 2,509,973 raw / 805,110 gzip bytes. This round
  changes no budget ceiling. The build still emits dependency-annotation and
  large-chunk notices. Scoped diff whitespace checks pass.

The retained grouped logs include superseded failures. `ui-final.log` found the
low-screen Docs close overlap, fixed by destination stacking and passed in
`acceptance.log`. That acceptance run still had a Library fixture miss; the
later `drop-final.log` supersedes it. The Library fixture now starts on an
actually exposed card, uses free canvas targets and dismisses the failed-save
notification before another drag. These changes preserve its behavioral checks.
The old pan fixture's single-click inspection and blur-commit assumptions were
updated to the current explicit inspection action and cancellation behavior.

## Scope and limits

The full release suite, production-browser suite and remote deployment were
not run. This is local focused evidence, not a release certification. Existing
destination-window and Library-browser styling remains outside this migration;
the sidebar and their placement were updated. Camera index, new composition
navigation models and exploration-world behavior remain outside scope.

The runtime still owns destination lifetimes and passes its actions through an
adapter. This removes the duplicate visual navigation path, not every runtime
coupling in the application. No dependency, saved document field or migration
was introduced.

Evidence is in [sidebar-evidence](sidebar-evidence/). Screenshots show the
disposable populated test composition, not the user's saved work.
