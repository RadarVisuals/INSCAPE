# Keeper follows the profile, outside the canvas

Founder follow-up to the Keeper visual migration: Keeper must not belong to the
canvas, should begin at lower right, and the minimap will eventually share that
corner. The existing shared Keeper identity was verified before changing its
placement. This corrects the placement retained in `keeper-dock-style.md`.

## Result

Keeper's dock now lives on the screen, outside the canvas-content container and
its registration, selection, snapping and camera transforms. It starts at lower
right above the existing bottom controls, retains the design-system appearance,
and remains movable. Zoom and pan do not change its position or size. Keeper is
excluded from canvas group membership and camera-index composition bounds.

The existing Workbench collection already owns one shared set of profile Keeper
records. Artwork, name and configuration are therefore the same when switching
between Workbenches. A small position cache in the existing profile editor
session retains the dock's screen position through those switches. It resets on
reload/profile-session replacement; deleted Keeper IDs are pruned. No saved
window preference, new schema, migration or duplicate character store was added.
Switching still remounts the scene's temporary motion/dialogue runtime: this is
not a claim of uninterrupted flight or conversation across scenes.

Keeper creation no longer adds authored canvas geometry. Runtime capture, local
canvas-layout restoration, publication projection and reconciliation stop
producing or restoring Keeper canvas positions. The existing optional document
validation field remains accepted, but it no longer positions the rendered dock
or gets projected into a new publication. The existing shared Keeper data and
publication inclusion rules remain authoritative.

The existing window host owns movement and fitting. Settings open above or
beside Keeper; a tighter optional screen boundary keeps their scroller clear of
the dock, including after viewport resize. The exploration host's top edge also
keeps settings below its navigation. The prior navigation-width reservation for
an upper-left Keeper was removed. Minimap design/implementation is deferred.

## Verification

- 45 state tests pass across Keeper, Workbench collections, groups, index,
  presentation capture and local layout storage. These include shared edits,
  failed/stale saves, Undo, publication and the exclusion of Keeper positions
  from canvas capture.
- 13 unique browser cases pass across focused runs: three Keeper lifecycle
  cases, three dialogue cases, three exploration/shared-record cases, two
  reference/style checks and two new screen-position cases.
- The new cases exercise actual canvas zoom and pan, keyboard dock movement,
  unchanged authored content, creation/switching of two Workbenches, retention
  of screen position, and a name edit visible in both Workbenches with the same
  Keeper ID. They run at 1440px and 390px.
- Initial runs exposed inherited pointer suppression from the canvas container,
  settings covering Return after viewport changes, and exploration navigation
  covering its close control. These were fixed and the affected cases rerun.
  Earlier geometry assertions in the Keeper lifecycle test were updated to the
  requested screen-corner/reload behavior, preserving its drop, recovery,
  publication, reduced-motion and Undo assertions.
- Production build, separate build check, regenerated design inventory/check
  and scoped whitespace checks pass. Existing bundle limits were not increased.
  The final report is retained alongside the logs.

Inspected actual wide/narrow corner screenshots and settings scrolling above the
dock. All browser work used disposable fixtures on the running local preview;
no user composition was edited. These are focused local checks, not a complete
release suite or remote-CI result. The separate Display assertion failure noted
in the preceding report was not part of this task.

Work remains local and uncommitted on `codex/audit-checkpoint-2026-10-19`, HEAD
`32d9418843d996afc2e5203afa4552a6cd2d459a`, alongside the pre-existing dirty work.
Nothing was pushed or deployed.

## Evidence

- [Default corner, wide Mist](keeper-screen-position/corner-1440.png)
- [Default corner, narrow Carbon](keeper-screen-position/corner-390.png)
- [Settings above Keeper](keeper-screen-position/settings-carbon-390.png)
- [Same dock after Workbench switching](keeper-screen-position/screen-1440.png)

The adjacent directory contains the test logs, build/check output and final
bundle report. The local preview remains at `http://127.0.0.1:24970/`.
