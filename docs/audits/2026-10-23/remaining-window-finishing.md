# Remaining Workbench windows — 23 October 2026

## Scope and checkout

The founder authorized Publish and the remaining existing interface windows in
the approved design-system style, without stopping for each surface. Work is
local and uncommitted on `codex/audit-checkpoint-2026-10-19`, HEAD
`32d9418843d996afc2e5203afa4552a6cd2d459a`. The initial working tree had 360
modified/untracked entries from earlier rounds; those changes were preserved.
No push, live upload, wallet prompt, signature, transaction or deployment.

## Responsibilities and implementation

- `WorkbenchDestinationPanel` reuses the existing tool titlebar, flat material,
  9px shell and 5px control tokens for Publish, Docs, Profile, retained Grids and
  publication confirmation. Content scrolls separately from close controls;
  Publish's primary action stays outside its scroll area. Narrow/coarse targets
  are 44px. Pointer interaction has no extra focus box; keyboard focus remains.
- Publish now sits inside the existing Workbench host and inherits its measured
  sidebar clearance. Its snapshot builder, upload admission, verification,
  recovery journal and publication hook retain their ownership and all gates.
  The confirmed result passes the current menu theme as temporary UI metadata
  through the existing App confirmation record, never into the saved document.
- Docs has a titlebar, a scrollable chapter strip with keyboard reveal, and
  updated explanations of Image, Text, Shape, shared tools and local saving.
  The profile menu retains Identity, Reception and disconnect callbacks. Its
  trivial presentation no longer uses an unnecessary memoized copy.
- Grids keeps its existing controller and actions. Its narrow action row wraps,
  rename/deletion cancellation stays local, and the empty state refers to an
  existing Display, since creating Displays remains parked. Removed dead cover
  branches from the already-filtered regular-grid loop.
- Groups and Index retain `WorkbenchWindow`, their document/session controllers,
  positioning, camera anchoring and navigation. They opt into flat chrome and
  shared field styling. Index has invisible resize targets with keyboard focus.
  Their stacking order now keeps them above Navigator and the bottom controls.
- The existing window host accepts an explicit bottom boundary in preference to
  the toolbar clearance. Groups and Index use the screen boundary, leaving a
  usable scrolling body on short screens. Keeper's explicit smaller boundary
  remains valid and was checked. No second layout or camera owner was introduced.
- Removed superseded panel styles from the old workflow and sidebar stylesheets.
  The design-system registry/inventory records the actual production components.

Focus writing, authored Identity/Reception artwork, group-stack artwork and the
optional exploration world are outside this window-chrome round. Existing Index
open/pin behavior remains document-owned; this did not redesign persistence.

## Verification

63 unique targeted browser scenarios passed across the recorded runs:

| Boundary | Cases | Evidence log |
| --- | ---: | --- |
| Publish opening/preparation, upload admission, sidebar routing | 19 | existing-browser.log |
| Confirmed publication through refresh and recovery | 3 | followup-browser.log |
| Info/metadata source, selection, docking and reference parity | 7 | followup-browser.log |
| Destination windows and Grid actions, Carbon/Mist at 1440×900, 390×844, 844×390, 320×320 | 17 | final-geometry.log; icons-final.log repeats the 8 navigation-window views after the icon adjustment |
| Groups editing, undo, camera, movement, cancellation and reload; Visitor isolation | 2 | navigation-complete.log |
| Index Owner/Visitor zoom, movement, resize, pinning, failed saves, travel and cancellation | 11 | navigation-complete.log |
| Published group browsing and explicit publication visibility | 2 | final-geometry.log |
| Keeper screen position and Workbench switching | 2 | final-geometry.log |

Screenshots were inspected for wide, narrow and low layouts, scroll containment,
title/close/action reachability, matching material, field radii and resize marks.
Browsing destinations leaves the saved composition and camera unchanged. The
publication scenarios use controlled wallet, upload and chain responses only.

Also passed: 14 focused unit tests, 10 design-system tests, the generated
design-system inventory check, 5 LUKSO standards audits, production build and
`build:check`. Budget limits were not raised. The initial sandbox build failed
because esbuild could not read the project configuration's ancestor directory;
the approved local build outside that restriction passed. Standard existing
large-chunk and third-party annotation warnings remain.

Final build totals: initial JavaScript 822,520 raw / 239,285 gzip bytes;
core JavaScript 2,519,473 raw / 808,982 gzip bytes. The core raw budget has only
27 bytes of headroom; future JavaScript additions need a real size reduction or
an explicitly justified budget decision.

Earlier failures in the preserved logs are superseded by the successful runs:
the recovery browser test had a fixed old port; the confirmation fixture and
group fixture imported a second singleton on the warm HMR server; a group test
dispatched selection before focus activation settled; a group fixture's authored
stack sat behind the expanded sidebar. Fixtures now use their configured origin,
the loaded singleton, settled keyboard activation and the actual collapse action.
Two obsolete metadata pixel/source-string tests were removed; the seven existing
Info browser scenarios verify the current shared implementation instead.

The complete `npm test`, release verification, remote CI and production-browser
startup suite were not rerun for this local finishing round. The current CI
workflow was inspected, but no remote result is claimed for this dirty checkout.

Evidence is retained in [remaining-window-finishing-evidence](remaining-window-finishing-evidence/).
