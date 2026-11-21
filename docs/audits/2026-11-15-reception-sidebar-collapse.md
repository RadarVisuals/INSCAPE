# Reception sidebar collapse — 2026-11-15

Bounded follow-up to the accepted header shell. Local implementation on
`codex/profile-work-index-2026-10-30`; no commit, push, deployment, publication or
wallet action. Existing unrelated working-tree changes were preserved.

## Implementation

- The existing side-dock preference record owns independent left/right collapse.
  No second visibility store or new panel instances were introduced. Registered
  tools stay mounted while hidden; order, widths, split heights, selected tabs
  and the Library search survive reopening. The normal hidden ToolPanel rule now
  suppresses the flex shell as well as its focusable descendants.
- A chevron in a docked panel's header collapses its entire side, including
  stacked utilities such as Navigator. X retains the existing panel-only action.
  Undocking and dragging remain available as separate layout operations.
- A 24 × 28px edge control reopens each side. Enter/Space work; focus moves from
  the collapsing header to that control and back to a restored header. Chevron
  and X share their existing 28px target, 16px icon and 2px icon stroke.
- Hidden sides reserve zero dock width. The existing single workspace contour
  therefore uses 2px shell space plus a 1px hairline at left/right and bottom,
  with the existing 12px corners. The frame is not duplicated per panel.
  Reopen controls use the same Editor panel, line, ink, field and accent tokens,
  including personal colors and separate Dark/Light values.
- Docking a window onto a collapsed side reveals that side. Cancelling the dock
  operation restores its previous collapse state. Preview hides Editor chrome
  and returns to the previous independent side states.

## Verification

- 15 focused unit tests passed: side-dock geometry/collapse and private Editor
  preferences, including persistence, malformed values, independent profiles,
  retained registrations and drop/cancellation behavior.
- Source lint and strict contract typechecks passed; 46 existing recorded hook
  dependency observations remain. Production build (native config loader) and
  build:check passed, with unchanged budgets: 727,230 initial JavaScript bytes.
  The generated design-system token inventory was refreshed and its check passed.
- The existing side-dock browser suite gained Dark/wide and Light/narrow cases
  for mounted tools, frame dimensions, focus, Library search, reload, Preview
  and X semantics. Syntax checked. Automated execution was blocked before
  assertions by Windows process-ownership inspection (`Get-CimInstance: Access
  denied`). This is not a passing automated browser run; CI/workstation rerun
  remains necessary.
- Actual built Reception fixture uses current production Editor components and
  a populated test composition. Inspected in the browser at 1440×900 and 760×900,
  in Dark and Light: left-only and bilateral collapse, Enter/Space reopening,
  focus transfer, reload persistence, retained Library query, panel-only X,
  Preview hide/restore, reachable controls and no horizontal page overflow.
  No browser console errors. The existing minimum 25% canvas zoom can still clip
  a large composition between both panels in a narrow computer window; collapsing
  the panels exposes it. No new camera or authored-geometry behavior was added.
- DOM measurement with both sides collapsed: 2px at left/right/bottom, 1px
  border, 12px radius. No appearance-only approximation or Figcraft mockup was
  used for these screenshots.

Screenshots: `.browser-test-runtime/sidebar-step/screenshots/` contains
`dark-open.png`, `dark-left-collapsed.png`, `dark-both-collapsed.png`,
`light-open.png`, `light-left-collapsed.png`, `light-both-collapsed.png`,
`light-narrow-open.png` and `light-narrow-collapsed.png`.
The requested persistent screenshot delivery failed because the upload service
could not be reached. Original PNGs remain available at those local paths for
the explicitly requested cross-thread image report.
Copies with simple paths are also in `C:/workspace/inscape-sidebar-20261115/`.
The requested `send_message_to_thread` report to
`01a1df89-2645-7a71-bded-540f2807c136` (host `local`) was attempted, but returned
`user rejected MCP tool call`. No successful delivery was claimed and no
alternate messaging route was used. After the user's renewed explicit request,
a second send was attempted; both that send and a read of the destination thread
failed with `Codex app tool request failed`. Delivery remains unconfirmed.

## Still outside the initial collapse slice

Layers thumbnails/action-row placement, Library labels/size/filter cleanup,
profile card/identity module, Save/publication semantics and the new inline
Preview experience. No full unit/release suite or live CI/deployment was verified.

## Screenshot follow-up: panel chrome and controls

Applied in the same local checkout on 2026-11-15 after the founder's annotated
Canvas Editor screenshots and request for subtly differentiated panel headings.
This section supersedes the initial slice's pending action-row/labels placement.

- Removed the Inspector-only docked content-height exception and its CSS.
  Every docked window now uses the existing side-dock frame height, including an
  empty Inspector. Floating windows retain their original content fitting.
- Replaced independent frame/button borders with one SVG workspace contour,
  including mirrored 24 x 28px reopen lips. The existing dock store still owns
  widths, visibility, persistence and focus. Collapsed left/right and bottom
  strips remain 2px with a 1px hairline; ordinary corners remain 12px.
- Removed docked window outer borders, including the unwanted horizontal line
  above the sidebars. Header baselines and the canvas outline have separate,
  deliberate owners. The active tab underline occupies the header baseline.
- Panel header color is `editor-ink` mixed 4% into `editor-panel`: subtly lighter
  in Dark and darker in Light, also derived from personal Editor color choices.
  Active tabs use the existing Editor accent. No new appearance store or fixed
  palette was introduced.
- Removed docked Undock icons from the header. Undock remains available from
  title/tab context menus, including Shift+F10. Floating windows retain docking
  controls. Collapse and X retain their separate whole-side/panel-only meanings.
- Library has one Detach button in the shared pane header; its former extra row
  is removed. The same Library portal remains mounted during docking changes.
- Moved Layers actions and Library Labels/Size to the top. Removed the redundant
  All assets/count heading. The navigation divider is visible at narrow widths.
  Existing filter/sort functionality is retained.
- Grouped the wordmark menu into Workspace, Editor and More. Flyouts now use the
  actual trigger position, so section labels do not offset their alignment.

### Follow-up verification

- 15 side-dock/private-preference unit tests passed; lint passed with the same
  46 previously recorded hook observations; strict contract typechecks passed.
- Production build with the native config loader passed. The first concurrent
  build-check attempt read an incomplete build; rerunning after build completion
  passed with 727,044 initial JavaScript bytes. Budgets were not changed.
- Refreshed the generated token inventory; its consistency check passed.
- Updated all affected browser setups to undock via the title's keyboard menu.
  Added checks for full-height empty Inspector, derived header tone, no top
  border, top Library controls, one Detach control and the visible divider.
  Outline assertions now inspect its 1px SVG stroke, rather than a removed CSS
  border. Existing persistence, draft invariance, Preview and focus checks remain.
- Automated `workbench-side-dock`, `editor-menu-bar` and `editor-preferences`
  execution is blocked before assertions by Windows process ownership inspection
  (`Get-CimInstance: Access denied`). No bypass or passing browser-suite claim.
- Manually inspected current built production components with isolated Canvas
  Editor and populated Reception fixture data. Verified 1440x900 and 760x900,
  Dark/Light, both sides independently and together, empty Inspector, keyboard
  reopening, Undock/Dock, Library Detach/Dock, retained Library query, reload,
  Preview hide/return and flyout alignment. No console errors or page/header
  overflow. Browser viewport override was reset after verification.
- Screenshots saved in `C:/workspace/inscape-sidebar-refinement-20261115/`:
  `dark-open.png`, `dark-library.png`, `dark-left-collapsed.png`,
  `dark-collapsed.png`, `light-open.png`, `light-collapsed.png`,
  `light-narrow-open.png`, `light-narrow-collapsed.png`, `dark-menu.png`, plus
  `dark-header-detail.png`, `dark-inspector-detail.png`, `dark-lip-detail.png`.
  These show real Editor components with disposable test content, not mockups.

Remaining: layer thumbnails; a possible further filter/sort simplification;
profile/identity module; Save/publication and new inline Preview semantics;
automated browser rerun in an environment with working process inspection.
All changes are local, uncommitted and unpushed. No deployment was performed.

Follow-up delivery: the screenshot upload failed at service discovery with a
network error; no persistent-upload success is claimed. A fresh completion
report with the exact screenshot paths was sent to the explicitly requested
thread `01a1df89-2645-7a71-bded-540f2807c136` on host `local`, but again returned
`Codex app tool request failed`. Cross-thread delivery is unconfirmed. Local
screenshots are linked directly in the user-facing reply instead.

## Circular contour correction

The founder supplied a three-circle construction for the reopen lip and asked
to correct the bottom corners too. Replaced the quadratic bends and straight
ledges with three tangent 12px quarter-circle arcs per lip, mirrored on the
right. The ordinary frame corners now use exact circular arcs as well. Reopen
controls are centered on the middle circle with a matching circular hit/hover
shape. This changes only the shared contour and its control geometry; docking,
focus, persistence, colors and authored canvas coordinates keep their owners.

Verified the real Reception components at 1280x720 in Dark and 760x720 in Light,
including close-up top/bottom corners and Enter/Space reopening on both sides.
Measured 2px left/right/bottom shell strips and a 1px stroke. No console errors.
Lint, native-loader production build and build:check passed (727,044 initial JS
bytes). Existing browser assertions remain applicable; the previously blocked
automated browser suite was not rerun for this geometry-only correction.
The founder then supplied the nested-radius formula. Exposed bottom corners
now target a 12px outer shell with a 3px content inset: 9px inner radius and
9.5px stroke-center radius (2px shell strip plus half the 1px hairline). Bottom
corners adjacent to expanded docks retain their independent 12px radius.
Repeated wide Dark/narrow Light inspection and build checks after this change.
Final screenshot: `C:/workspace/inscape-circular-corners-20261115/circular-frame.jpg`.
Earlier clipped screenshots from this pass are not delivery evidence: the
browser capture service resized its rendering surface during clipped capture.
The final whole-viewport image was recaptured after restoring the viewport.
Local changes only; no commit, push or deployment.
