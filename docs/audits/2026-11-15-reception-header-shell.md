# Reception header / Editor shell — local implementation, 2026-11-15

The founder approved incremental implementation of the enclosed Reception Editor,
starting with the header and shared shell, and requested cleanup plus easy personal
color controls. This is a local working-tree change on
`codex/profile-work-index-2026-10-30`; no commit, push, upload or deployment was made.
The checkout already contained substantial unrelated work, which was preserved.

## Replacement and responsibilities

- One Inscape wordmark cascade replaces the horizontal menu and owner navigation
  sidebar. Existing session/document actions still own saving, history, departure
  guards, camera controls and destination panels.
- The 40px header retains a visible profile name, theme toggle, Preview and Publish.
  Publish has not been relabelled Save; changing that workflow is a later slice.
- The continuous rounded canvas contour uses existing left/right dock widths.
  With no edge dock it leaves exactly 2px of shell plus a 1px line on each side and
  at the bottom. Authored canvas coordinates are unchanged.
- Existing device appearance owns per-mode personal panel/header, workspace and
  accent colors, including hex entry, color picker, reset, persistence errors and
  retry. These are not draft or publication fields. Text contrast for a custom
  panel or filled accent is derived from its luminance.
- Removed five obsolete product files: OwnerSystemWorkflowSidebar,
  WorkspaceNavigation and its stylesheet, workbenchSidebar.css, WorkspaceMenuLabel.
  Destination-window geometry from the removed CSS moved to the current shell
  stylesheet. Removed the navigation visibility preference/context command and
  the obsolete Library-navigation portal props and conditional rendering.
- Retained DesktopMenu/RackMenu for keyboard and cascade behavior, workspace
  switching in Preview/other hosts, bilateral docking, and existing Library,
  Inspector, Navigator, session and panel controllers. The old navigation artwork
  still has a consumer in the historical design-system workspace: its component
  and CSS were relocated into design-system/referenceWorkspaceNavigation.* and
  explicitly labelled reference-only. Production no longer imports them. Side-dock hide/restore
  buttons, Layers/Library refinements, profile card and inline Preview remain
  subsequent work.

## Size of the replacement

Comparison against the task's pre-edit snapshots of 14 production files, plus
its new EditorAppearanceControls component: **218 added / 548 removed lines**.
This is a measured subset, not a claim about the whole dirty checkout. Additional
small edits connect shared tokens, Settings, canvas repaint and remove the Library
portal chain. Tests, this note, contract updates and generated verification output
are excluded from these production counts. No dependency was added.

## Verification

- 42 focused unit tests passed: device appearance, private preferences, public
  boundaries, dock geometry and guarded named-canvas/departure operations.
- Source lint passed (the existing 46 recorded hook-dependency observations remain).
- Strict contract checks passed: 40 invalid calls and 9 invalid production mutations
  rejected by the existing checker.
- Production build and build:check passed. The build used Vite's native config
  loader because the default bundler could not enumerate a parent directory in
  this environment. Initial production JS: 727,230 bytes; budgets unchanged.
- 320 browser test modules parse. The menu/navigation fixture helpers and affected
  direct selectors were updated; this is not evidence that every browser suite ran.
- Actual built Reception fixture reviewed in the in-app browser at 1280x720 and
  760x900: populated image/text canvas, shared header/panel material, keyboard
  submenu and Escape focus, closing/reopening panels, the 2/1px empty-edge geometry,
  custom colors via both inputs, reload persistence, separate Dark/Light values,
  and reset. No browser console errors appeared in that review.
- Automated browser-suite launch was blocked before test assertions by this
  environment (Windows process inventory access denied / browser spawn UNKNOWN).
  No passing automated-browser claim is made; a normal workstation/CI rerun is
  still needed. The standard dev fixture request also stalled here, so visual
  verification used a separately built fixture of the same source.

The full unit suite, production startup suite, wallet/publication flows and a live
CI/deployment were not verified in this local UI slice.
