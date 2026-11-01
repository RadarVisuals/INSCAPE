# Library window and movable Workbench selector

Local implementation on `codex/profile-work-index-2026-10-30`, based on
`d181c5496dcb53786cf9f2d10038e1e7e7eda3e2`. Existing unrelated working-tree
changes were preserved. No commit, push, publication or deployment was made.
No CI runs or commit statuses were returned for that HEAD when inspected.

## Behavior and ownership

- Library starts in its existing sidebar position. Detach opens a movable tool
  window with edge/corner resizing; Dock restores the sidebar position. Its
  category navigation travels with it. The portal container stays mounted, so
  search, selection and browsing state survive the host change.
- The Workbench selector uses the grip at its left. Pointer and arrow-key movement
  share ToolPanel's cancellation and viewport bounds. New, Rename and Workbench
  switching retain their existing actions. A floating selector no longer reserves
  its vertical position as a top boundary for other tools.
- The existing profile-local editor-preferences store owns Library docked state,
  floating geometry and selector position. No artwork, Undo, camera or publication
  fields were added. Bounds adapt to the available viewport.
- Library closure now invalidates pending media drops from the authoritative open
  state, before its exit animation finishes. The existing drop lifecycle tests
  exercise that boundary.

## Replacement and retained consumers

ToolPanel owns movement, resizing and cancellation. Its shared move handle can now
be used inside a naturally sized bar; measured content bounds keep naming forms
reachable. LibraryWindow only owns the host switch and its layout preferences.
LibraryWorkspace still owns browsing and module/category placement.

Removed the selector's fixed CSS placement and separate form stacking override;
ToolPanel supplies those values. Removed Reception-only embedded Library geometry
and compact-sidebar rules in favor of the shared embedded Library variant. Removed
obsolete wide footer grid definitions and their no-close-button compensation.
The docked width handle remains because docked Library, Keeper and the design
reference still consume it. Reception retains its distinct drop-through behavior.

Application source in this slice adds 158 lines and removes 63, including the new
51-line Library host. Tests, documentation, generated inventory and the measured
build allowance are separate. Growth supplies the persistent host switch and
natural-size measurement; there is no second window drag engine.

## Verification

- 48 browser checks passed: Library resizing/detachment/docking (3), plus local
  Workbenches, shared tool docking, Library filters/storage/drop lifecycle,
  Reception selection and Workbench image drops (45).
- 45 focused Node tests passed across editor preferences, window geometry, dock
  state, Library/Workbench independence and production-build boundaries.
- Build, build:check, lint, strict contract type checking and design-system
  inventory checks passed. Lint reports the existing 87 reviewed observations.
- Screenshots were inspected at 1440px and 390px, including material opacity,
  navigation, clipping, footer controls, selection, movement and viewport bounds.
- Production measures 801,171 initial JavaScript bytes and 2,701,193 raw / 890,900
  gzip aggregate core bytes. The aggregate raw ceiling increases from 2,700,000
  to 2,702,000 for the measured feature; compression and loading budgets remain
  unchanged. Production budget tests verify the updated ceiling.

Evidence is under `output/library-window-2026-10-31/`: `library-recheck.log`,
`combined-browser.log`, `unit-final.log`, `build-final.log`, `final-review/` and
`selector/`. Earlier failed logs remain as diagnostic evidence: one drag test
needed to await the Library's restored hit target after cancellation, and a run
during server restart/build timed out navigating. The final stable-server run
passed all three Library tests.

This is a local scoped verification, not a full release checkpoint. The standard
browser runner is blocked by pre-existing unregistered Reception suites; the
listed suites ran directly using the shared browser environment and an isolated
development server. The complete npm test/release matrix was not run.
