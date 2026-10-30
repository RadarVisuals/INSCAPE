# Local canvas inspection and glass overview controls

25 October 2026. Local, uncommitted changes in
`remediation-2026-10-19-shared-checkpoint/work`, branch
`codex/audit-checkpoint-2026-10-19`, based on
`6d7d428d91e2dce5629ccea7b48c345faabaec59`.
Existing unrelated changes were preserved. No commit, push, deployment,
publication upload or wallet action was performed.

## Accepted behavior

Canvases and Editor replace the ambiguous two Workbench navigation labels.
A list row or gallery tile lifts into a bounded modal containing the complete
composition fitted to its available space. Expand uses the same viewer and
camera point across the app viewport. Close retains the gallery's view and scroll
position. A smaller Edit action explicitly activates the chosen saved Workbench;
failed activation keeps the viewer open with the error.

Viewer controls start hidden, reveal on mouse movement, keyboard navigation or
tap, and fade after inactivity unless their interaction needs them. Glass
controls, metadata popovers and the optional Index overlay the artwork. Metadata
panels support hover, keyboard and tap; only one is open at a time. The overview
uses the same material for its small List/Grid/Wrap icon toggle, with the old
bottom reservation removed. Touch targets, focus recovery, reduced motion,
reduced transparency and high-contrast selection states are retained.

The saved Index resolver supplies named and follow-group camera framing.
Composition title/introduction remain distinct from each source artwork's
creator, description, attributes and provenance. Choosing a source highlights
its placements while its information panel is visible; repeated placements
share a source entry. Artwork metadata is never combined into composition traits.

## Responsibility boundaries

- The existing collection store is still the only persistence authority.
  Browsing, modal size, camera choice, source choice and controls are session UI.
- The overview adapter owns saved-entry selection and explicit editor activation.
  Opening a presentation no longer activates the persisted Workbench.
- The existing read-only renderer is shared by overview and presentation, with
  a fitted region input. Its pure fit calculation has no editor minimum zoom.
  The 5,000 × 5,000 browser fixture fits even at narrow viewports without changing
  authored bounds, geometry or saved camera data.
- Existing destination resolution and artwork metadata content/dossier builders
  are reused. There is no new content store, publication schema or raster export.
  Viewer and grid remain lazy-loaded.
- Shared glass variables belong to the overview/presentation scope. No unrelated
  editor surface is restyled. A separate backdrop layer behind the viewer's
  information buttons lets the popover blur the artwork independently.

This is a focused separation of inspection from activation, not a claim of
whole-app architectural cleanup. Source discovery remains coupled to the current
read-only projection: Image uses its first side; retained Display uses its first
Grid; executable mini-apps are named placeholders. Public visitor presentation,
multi-canvas publication, curated artwork sequences, Reception and Desktop are
outside this implementation.

## Verification

Final UI suite: [browser-settled/results.json](browser-settled/results.json),
seven passing tests. It checks opening/closing, failed saves, unchanged persisted
bytes and active Workbench, two separate metadata sources with three placements,
camera selection, expand/return, repeated wrap tiles, keyboard focus recovery,
touch, early closure during lift, narrow viewport containment, and the gallery
extending behind its floating controls. Images are actual local WebP fixtures;
no external network availability is assumed.

Representative inspected screenshots:

- [Gallery, 1440 wide](browser-settled/workbench-overview/grid-1440.png)
- [Gallery, 390 wide](browser-settled/workbench-overview/grid-390.png)
- [Unobstructed opening](browser-settled/workbench-overview/canvas-clean-opening.png)
- [Modal controls](browser-settled/workbench-overview/canvas-modal-1440.png)
- [Artwork metadata](browser-settled/workbench-overview/canvas-artwork-info.png)
- [Touch metadata](browser-settled/workbench-overview/canvas-touch-metadata.png)
- [Expanded Index](browser-settled/workbench-overview/canvas-expanded-index.png)

Earlier checks in this task: 117 focused model/collection/action tests passed;
typecheck passed; sidebar 9/9 and design-system Library 4/4 passed before the
final overlay refinements. The sidebar result is retained in
[browser-second/results.json](browser-second/results.json). Those earlier checks
are not claimed as fresh verification of the final CSS.

Final design inventory, its 10 tests and lint passed; lint retains 92 previously
recorded hook-dependency observations. Production build and budget verification
passed: [build-final.log](build-final.log), [build-check.log](build-check.log).
Production build tests passed 19/19 earlier in this task, including an alternate
output directory: [build-tests.log](build-tests.log). Full release `npm test`
was not run.

The lazy viewer required a measured aggregate core-JavaScript budget adjustment:
from 2,541,000 raw / 819,500 gzip to 2,554,000 / 824,000. Final measurement:
2,553,581 raw / 823,415 gzip. Initial JavaScript remains 825,614 raw / 239,861 gzip.
Initial, owner, wallet, CSS and asset ceilings were not raised.

Remote evidence refreshed during this task covers only the base commit:
Netlify's [PR 5 preview](https://deploy-preview-5--enterinscape.netlify.app)
reported success, while Verify Inscape run 40045584067 was cancelled.
Neither is evidence that these local changes have been deployed.
