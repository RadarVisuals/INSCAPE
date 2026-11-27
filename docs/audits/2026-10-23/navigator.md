# Navigator beside Keeper — local implementation, 23 October 2026

Follow-up: the [sidebar migration](sidebar.md) fixes the narrow Workbench
selector/inspection-close overlap recorded below and verifies the actual close
button in all eight inspection combinations. It also adapts utility clearance
to the new sidebar on short screens. The original evidence below is retained.

Status: implemented and checked in the application checkout on
`codex/audit-checkpoint-2026-10-19`, based on HEAD
`32d9418843d996afc2e5203afa4552a6cd2d459a`. These are local working-tree changes.
The checkout already contained extensive uncommitted implementation work; it was
preserved. No commit, push, publication or deployment was performed. Previous
remote CI and older audit results are not evidence for this dirty local tree.

## Result and ownership

Navigator starts immediately to Keeper's left, above the bottom controls. Both
use the established flat Carbon/Mist window, remain screen-bound, move
independently and retain their positions across local Workbenches within the
profile session. Reload resets the layout. Small widths share the available
space; low screens use internal scrolling. The existing short-screen toolbar
placement now uses the available bottom space even without selection-action
rows. Keeper settings open above or to the left of the two utilities.

The old bottom Home/zoom controls are replaced by Navigator's Home and 25–200%
slider. Back, Focus, Canvas and Groups remain. The reference and application
reuse `NavigatorContent` and its stylesheet; superseded reference map/zoom CSS
is removed. The original camera controller owns movement, zoom, history,
inspection locks and cancellation. A local module-input registry exposes live
read-only source references; it is not saved state or a second document model.
The miniature renderer uses existing crop/projection and read-only article
rendering. It never mounts TipTap, a mini-app iframe or interactive artwork
runtime. Unknown media keep a labelled frame. Keeper/tools are excluded.

The map includes the canvas, current view and visible outlying content. Its
mapping freezes for the duration of a gesture. Camera paint updates the scene
projection and viewport outline; media content is rebuilt only after source,
geometry or visibility changes. Transformed text is scaled from its logical
frame, rather than reflowed at the larger projected size.

Two concrete integration faults were fixed: the window host could overwrite a
new responsive frame while clamping its old frame in the same layout cycle;
and blur could stop camera projection before Navigator restored the starting
view. Controlled-frame adoption now precedes clamping. The camera controller
cancels the Navigator gesture before clearing motion on blur.

No document fields, migrations, dependency additions, sidebar work, camera index
or exploration-world feature work were introduced.

## Verification

- 45 focused Node tests pass: Navigator/navigation/scale/window geometry,
  production-budget checks (including an alternate output build) and design
  inventory. The inventory checks were repeated after the final CSS update.
- 10 Navigator browser tests pass. The eight layout cases cover Carbon/Mist at
  1440×900, 390×900, 320×568 and 844×390; narrow cases also use touch emulation.
  They cover live pan, no jump on grab, click-to-centre, Escape, capture loss,
  element/window focus loss, arrows, 25/200% limits, Ctrl+0, Home, saved-content
  invariance, hidden owner preview, Keeper settings, Workbench switching and
  layout reset on reload. Final low-screen placement has a separate two-case
  passing rerun in `short-layout-tests.log`.
- The content case additionally verifies changing text, colour, dimensions,
  moving a Shape, layer visibility/order, switching Image side and live/committed
  crop. Selection remains intact when navigating. Its last run is in
  `content-tests.log`.
- 15 camera/control and missed-release regressions pass, plus both free-camera,
  outlying-content and canvas-clipping cases. The nine camera layout cases were
  repeated after the final short-screen toolbar adjustment.
- Three shared design-reference tests pass, covering themes/layout and
  pointer/keyboard/cancellation behavior, including touch.
- Four Keeper panel/session-position cases pass. All three exploration Keeper
  cases passed across the recorded runs; the movement case timed out in a
  concurrent run and passed alone in 19.2 seconds. No exploration motion code
  was changed.
- Inspection locks passed for Image and Display, owner and Visitor, at 1600 and
  390 pixels (eight combinations). Navigator map/Home/slider stay disabled until
  return completes. The existing narrow Workbench switcher can cover the
  inspection close button; this test uses the existing Escape return path.
  That separate close-button overlap is recorded, not claimed fixed here.
- Design-system inventory check and production build plus independent build
  check pass. Build emits the existing dependency-annotation/large-chunk notices.
  No complete release suite or live deployment verification was performed.

Earlier failed runs are retained where they explain the fixes. In particular,
`boundary-tests.log` contains the initial exploration timeout and the old test's
wheel coordinate landing on Navigator. `final-navigator-tests.log` contains the
passing inspection matrix and a then-unfixed preview fixture assertion; the
later `navigator-tests.log`, `layout-tests.log` and `content-tests.log` supersede
those Navigator failures. The fixture now retains canonical publishable media
URLs instead of feeding relative development URLs to publication validation.

## Performance and production boundary

The isolated filled scene contains 16 Images, 12 Text modules and 24 Shapes plus
Display/mini-app fixtures. During 60 pointer samples its miniature media subtree
had **0 replacements**. Measured requestAnimationFrame p95 was
**13.9 ms**. This is a local static-media test, not a guarantee for
all animated artwork, browsers or devices. Its exact measurements are saved in
`filled-performance.json`.

Final production totals: initial JS **822,640 raw /
239,439 gzip bytes**; core JS
**2,505,380 raw / 803,850 gzip bytes**.
The previous Keeper report measured 2,485,601 / 795,792 core bytes. Navigator adds
19,779 raw / 7,865 gzip bytes. The first build exceeded the former core ceiling;
the explicitly bounded core allowance is now 2,515,000 raw / 807,000 gzip,
from 2,487,500 / 797,000. Initial-entry, owner-static, wallet, CSS and public-asset
ceilings are unchanged. No optional runtime was moved into initial loading.

## Visual evidence

[Wide Mist app](navigator-evidence/initial-mist-1440.png),
[wide Carbon app](navigator-evidence/initial-carbon-1440.png),
[narrow Mist](navigator-evidence/initial-mist-390.png),
[narrow Carbon](navigator-evidence/initial-carbon-320.png),
[low Mist](navigator-evidence/initial-mist-844.png),
[low Carbon](navigator-evidence/initial-carbon-844.png),
[reference Mist](navigator-evidence/reference-mist-1440.png),
[reference Carbon](navigator-evidence/reference-carbon-390.png).

Screenshots show disposable fixtures, not user-authored content. On the lowest
screens the zoom row remains reachable through the window's native scroll area.
The original miniature inputs and gesture contracts remain module/camera owned;
additional media-specific static preview formats can use that read-only input
boundary without starting a second runtime.
