# Tool-window edges and right docking — 1 November 2026

Local implementation on `codex/profile-work-index-2026-10-30`, starting at
`f3574c595798f7efd008159c29c2e61cc49d857f`. The checkout already contained
Editor menu/sidebar and other changes; further unrelated source changes appeared
during verification. Those changes were preserved. No commit, push or deployment
was performed for this task.

## Cause and replacement

The shared ToolPanel treated the measured bottom controls as a full-width movement
boundary and also imposed an eight-pixel margin. Navigator and Keeper used the
separate WorkbenchWindow shell, with resizing disabled. They now use the shared
screen tool shell. Editor tools can reach the screen edges below the fixed menu;
the measured bottom controls remain useful for initial placement, not movement limits.

One private side-dock controller owns attached window order, shared width, and
height allocation. Mounted window registrations are transient; the existing
profile editor-preferences store persists layout and utility dimensions. The
controller refreshes from that store and never writes composition data. Content
remains mounted in the existing tool/utility owners. The existing tab/pane model
still owns tool grouping; it is not duplicated by the side dock.

The dock accepts title drags, individual tool-tab drags, and header buttons.
Dragging out or Undock restores a floating window. Left edges adjust common
width; lower edges divide stacked windows. Keyboard resizing and Escape/blur
cancellation remain supported. Bottom controls account for the dock's width.

Removed: the shared shell's bottom-clearance and fit-from-top paths, fixed utility
size restrictions, the old utility-shell markup, and displaced Navigator/Keeper
shell styles. WorkbenchWindow remains for authored module windows and specialized
companions such as Keeper settings; its canvas-geometry responsibilities were not
rewritten. Keeper settings now paints above the active tool dock.

Production files that were clean at the start account for 247 added and 52 removed
lines at scope review (including 128 lines of new dock/controller/utility-host CSS
and JS). Small integration edits also touch the already-dirty runtime, view,
preferences and Library files. Two new tests add 137 lines; existing browser
expectations were adjusted for the current Editor sidebar/Home and full screen
tool bounds. Contract/audit documentation and generated token inventory are
separate from these production counts. Growth supplies the requested persistent
dock and behavioral coverage; it does not introduce a second content instance.

## Verification

- 24 focused unit checks passed: side dock, existing tab/pane state, preferences,
  invalid sizes, resize geometry and persistence failures.
- New right-dock scenarios passed at 1440×900 dark and 700×650 light: exact lower
  corner reach, docking Navigator/Keeper/tools/Text, individual tab drops, shared
  width, pane height, resize/move cancellation, undocking, live Navigator retention,
  reload restoration, Keeper settings, toolbar clearance and unchanged draft data.
- Existing tool-docking suite: 7/7 passed. Keeper screen/switching: 2/2 passed.
- Navigator suite: 10/10 passed, including 320 px and short landscape viewports,
  camera gestures, map lifecycle, selection and miniature updates. Its fixtures now
  dismiss the current sidebar and assert the current canvas-framing Home behavior.
- Editor preferences/Library suite: 23/23 passed. Text tools' fixed-width recovery
  and Display/Info recovery cases also passed.
- Production build and build:check passed; strict contract typecheck passed;
  generated design-token inventory check and diff whitespace check passed.
- Screenshots inspected: [dark desktop](right-tool-dock/dark-1440.png) and
  [light narrow desktop](right-tool-dock/light-700.png).

## Limits and broader failures

This is not a full release checkpoint; the complete npm test suite was not run.
Lint remains blocked by five stale review fingerprints in the pre-existing
`useWorkbenchNavigation.js` edits. No new lint diagnostics remain in this slice.
The old Keeper reference test reaches its design-system comparison and then waits
for the retired `Preview surface` selector. Two broader Text cases fail at article
action-strip geometry (1440) and lower-field hit testing (390). An isolated browser
comparison serving the previous ToolPanel, WorkbenchToolPanel and SharedTextTools
sources also fails: title-to-body focus at 1440 and the same lower-field assertion
at 390. That comparison does not establish that every Text behavior is sound.

The latest committed GitHub run, 41284691250, already had failed browser shards
and aggregate verification; source and production jobs passed. It does not
validate these uncommitted changes. Browser verification here used the installed
Chromium headless shell 1248 because both full Chromium executables failed to spawn.
