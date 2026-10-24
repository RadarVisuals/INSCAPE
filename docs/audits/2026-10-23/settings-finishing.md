# Settings finishing and keyboard selection — 23 October 2026

Local work in `remediation-2026-10-19-shared-checkpoint/work`, branch
`codex/audit-checkpoint-2026-10-19`, HEAD
`32d9418843d996afc2e5203afa4552a6cd2d459a`. The checkout already contained
substantial uncommitted work. This round is saved locally, not committed,
pushed or deployed. Current workflow configuration was inspected; no remote CI
result is claimed for this dirty checkout.

## Changes and ownership

Settings now uses the existing flat Carbon/Mist panel, titlebar and close control.
Its body scrolls separately, so close remains reachable at 320×568 and 844×390.
Activity, Workbench, Interface and backup retain their existing order and actions.
Native checkboxes have visible keyboard focus without a pointer-only outline.
Old Settings chrome and duplicate spacing-preview rules were removed.

Library and Settings share the same flat portalled selector styling. Selectors
use available space above/below the trigger, bound their height, and dismiss on
origin scroll or viewport resize. Visual inspection caught the inherited older
popup colour and heavy trigger marker; the final material rules replace both.

No new preference store, authored field or migration was introduced. Signal
preferences remain owned by the signal store; local Workbench preferences by
their existing owner; interface theme by authored appearance; backup validation
and recovery by the existing backup controls. This is a presentation migration,
not a claim that those distinct persistence mechanisms were unified or audited
for every failure. Settings remains a sidebar destination. Focus writing was
not changed.

The earlier owner group-selection failure was caused by focus activating a
single artwork, followed by Shift+Enter toggling it out. Focusing the next
candidate also replaced the selection. The fix reuses the existing distinction
between module outline activation and explicit group selection. First Shift+Enter
keeps the activated artwork; subsequent presses toggle membership, and focus
can visit another candidate without replacing the group. Ordinary activation
still works. No second selection owner was added.

Inspection regression testing also exposed deferred dock-close focus stealing.
Closing Info now respects a newer target, as the independent Visitor window
already did. Old inspection assertions were updated for the accepted docked Info
host. Drag tests now hit exposed surfaces rather than the sidebar covering part
of a large selection. The storage-failure fixture holds writes unavailable until
the actual retry click, avoiding an incidental automatic save racing the test.

## Verification

- **46 distinct browser tests passed** across this round. `acceptance.log` has
  34 passing checks for Settings, Library, editor preferences, inspection and
  docking. `regressions.log` additionally contains passing activation, owner/
  Visitor layout reload and nine sidebar cases; its three intermediate failures
  are explained above and pass in acceptance. `visual-final.log` reruns all 15
  cases affected by the final selector CSS. `settings-final.log` also verifies
  an actual signal preference change survives reload.
- **34 unit/build-boundary tests passed** via `node --test` for
  `editorPreferencesStore`, `workbenchToolDockState`, `workbenchPreferences`
  and `scripts/productionBuild.test.js`.
- **10 design-system tests passed**; inventory regeneration/check passed.
- Production build and `build:check` passed without changing any budget.
  Initial JS: **823,024 raw / 239,469 gzip bytes**. Core JS:
  **2,518,767 raw / 808,692 gzip bytes**. Standard Vite large-chunk advice remains.
- Screenshots inspected in Carbon/Mist at wide, narrow and low sizes. Tests
  hit-test controls, close and backup access; check pointer/keyboard focus,
  popup bounds/material, preference reload, invalid backup rejection and
  unchanged authored content for local preference operations.
- Owner mixed-module moves, zoomed moves, group preview cancellation, resizing,
  failed layout writes and retry survive reload. Visitor movement remains
  temporary. Explicit keyboard membership addition/removal is covered.

Evidence is in [settings-finishing-evidence](settings-finishing-evidence/).
Full `npm test`, release-checkpoint verification and production-browser startup
were not run. This is focused local verification, not a release approval.
