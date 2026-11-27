# Artwork info and navigation filter — 23 October 2026

Local, uncommitted implementation in `remediation-2026-10-19-shared-checkpoint/work`,
branch `codex/audit-checkpoint-2026-10-19`, based on HEAD
`32d9418843d996afc2e5203afa4552a6cd2d459a`. The checkout already contained the
preceding shared-window, Navigator and sidebar work. Those changes are retained.
No commit, push, upload, wallet action or deployment occurred. The current
verification workflow was inspected; these checks are local evidence, not a
claim about remote CI or a deployed build.

## Request and result

The founder removed Filter navigation and reported inaccessible metadata. They
requested an Info tab alongside the existing tools, detachable from the dock.

- The short navigation list no longer has a filter in either the application
  or reference. Library retains its separate artwork search and browsing state.
- Info joins the shared owner tool dock. The toolbar's Artwork info action and
  existing Display Metadata command open the same tab. Existing detach, stack,
  rejoin, resize, close and reopen behavior applies.
- Standalone Images now supply source information for their visible side. The
  previous registration path covered Display only, leaving the Image info button
  disabled. Switching sides updates the read-only facts. Empty, Shape and
  multiple selections do not retain the previous Image's facts.
- One shared presentation supplies the reference, owner and Visitor content:
  title and collection, description, creators, attributes and Source details.
  It uses existing Carbon/Mist materials, fonts and spacing. Technical identifiers
  wrap and the host owns scrolling. Visitor retains its independent window.

## Ownership and cleanup

The existing module registry still supplies metadata and explicitly targets its
module. The owner dock is now the sole owner of Info visibility and geometry;
the old owner metadata window is excluded. Visitor continues to use its existing
window state. Source dossier extraction was separated from image-loading success
and reused by Image and the published Focus view. No alternative asset model,
metadata copy, saved field, migration or new dependency was introduced.
Creator source/scope and existing provenance remain unchanged.

Superseded metadata-content styling and the reference's auxiliary info note
were removed. The shared window host and Display controller remain existing
couplings; this is not a whole-app window-manager replacement. On short screens
the active dock must rise above Navigator, but an untouched startup dock must
not cover it. Initial dock focus is therefore empty; explicit open/activation
raises that dock. Tool command popups rise above the sidebar so reopening tools
remains clickable. Closing a short-screen dock exposes Keeper again.

## Verification

Final evidence is in [artwork-info-evidence](artwork-info-evidence/).

- `acceptance.log`: 20 passing browser cases covering Image side changes,
  correct source/description, detach/rejoin, reopen, multiple/unsupported
  selection, Workbench replacement, unchanged draft and Undo, owner Display
  routing, keyboard/pointer focus, scrolling, existing docking and sidebar
  routes. Carbon and Mist cover 1440×900 and 390×568 for Info, plus sidebar
  layouts at 390×900, 320×568 and 844×390.
- `regression.log`: 17 passing cases for reference workspace/Library behavior
  and Visitor/owner Display metadata cues. Visitor reads do not write storage
  or activate artwork inspection. The Info suite is included in the browser
  runner's default suites and honors its evidence directory.
- `units.log`: 22 passing dock, registration, source-dossier and standards
  checks. `design-tests.log`: 10 passing reference/inventory tests.
- Inventory check: 79 CSS files, 564 definitions, 290 names. Scoped diff
  whitespace checks pass. Screenshots of application/reference Carbon/Mist and
  Visitor were visually inspected for hierarchy, clipping and wrapping.
- Production build and independent build check pass. Initial JavaScript is
  823,070 raw / 239,485 gzip bytes; core JavaScript is 2,511,618 raw / 806,397
  gzip bytes. Existing budget ceilings were not changed. The core budget remains
  tight; dependency annotation and large-chunk notices remain in the build log.

Earlier exploratory runs found two real stacking problems: Navigator could
cover a newly opened dock, and the first correction let the untouched startup
dock cover Navigator on a low screen. A command popup also fell behind the
sidebar. The final acceptance run supersedes those failures. Two original dock
unit expectations were updated to include Info; existing three-tool interaction
fixtures explicitly close the additional tab before exercising that layout.

The full release suite, production-browser startup suite and remote CI were not
run. Long metadata is reachable by scrolling on short phone screens, whose
existing toolbars leave little vertical reading space. This round does not
redesign those toolbars, publication, sidebar destinations or mobile authoring.
