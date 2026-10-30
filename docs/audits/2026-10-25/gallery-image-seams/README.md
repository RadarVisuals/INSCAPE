# Mirrored Image joins in the overview

25 October 2026. Local, uncommitted change on
`codex/audit-checkpoint-2026-10-19`, HEAD
`6d7d428d91e2dce5629ccea7b48c345faabaec59`. Existing work retained. No
publication, wallet operation, commit, push or deployment.

## Reproduction and correction

Four touching Image modules at fractional authored positions, mirrored across
both axes, reproduce the reported line in the overview. At 1440 CSS pixels and
device density 1, the shared boundary was at x=352.53125. The frames touched,
but separately scaled SVG/image clips antialiased against the canvas background.
The initial pixel regression found 19 mismatches among 75 samples around the
horizontal join, vertical join and intersection: a representative line pixel
was RGB 88,142,173 instead of the source's 52,124,168.

The editor already owns a shared physical-edge rounding rule in
`workbenchPaintGeometry`. Overview now uses that rule for Image clips inside one
fitted surface laid out in physical pixels. The surface maps to CSS pixels once.
Simple edge rounding under the previous scaled parent was insufficient at 125%
display density; separate image compositor layers were insufficient as well.
The shared surface avoids those second sampling passes without overlapping
images, extending source pixels or rewriting any saved geometry.

`WorkbenchOverviewPreview` owns preview projection. `WorkbenchMiniature` accepts
optional Image paint bounds while retaining the authored SVG viewBox/crop fit;
Navigator's existing path keeps its previous behavior. The collection remains
the only content authority. Source URLs, transforms, crops and layout are not
saved by presentation browsing.

The motion hook now interprets the surface's fitted physical dimensions when
mapping its opening/closing keyframes. Index changes use this same interruptible
motion owner, replacing the former separate CSS camera transition. Text and
interactive placeholders retain their authored content dimensions, and highlights
use the same fitted projection. This is scoped renderer/motion coordination,
not a broader redesign or public multi-canvas publication.

## Evidence and checks

The new regression covers opaque PNG and translucent SVG artwork, three viewport/
density combinations (1440@1, 1439@1.25, 390@2), and List, Grid, modal and expanded
presentation: 24 screenshot conditions, 75 join samples each. JSON files beside
this report record exact bounds, expected pixels and mismatches. SVG cutouts
remain transparent, and half-opacity joins do not darken from overlap.

- [125% list](mirrored-png-1439-1.25-list.png)
- [Translucent SVG modal](mirrored-svg-1439-1.25-modal.png)
- [Narrow expanded SVG](mirrored-svg-390-2-expanded.png)

Gallery behavioral checks cover crop, ordering, card sizes, touch, save failures,
metadata, camera destinations, opening/closing and return. Normal motion samples
the camera transition at its start, middle and end and the complete close in 20
steps. The extended test explicitly reveals idle-hidden controls before each
camera selection; its initial timeout on the hidden Complete canvas control was
a fixture issue. All 13 gallery cases passed across the suite and final targeted
motion rerun. The suite log retains that intermediate fixture timeout; the
targeted motion log supersedes it.

Navigator: 10 browser tests passed. Focused composition/presentation/Image
geometry: 11 unit tests passed. Lint passes (481 source files, 91 existing
observations); typecheck passes (17 invalid calls and 3 mutations rejected).
Production build and build:check pass with unchanged budgets: initial JavaScript
826,107 raw / 239,927 gzip; core JavaScript 2,571,987 raw / 830,475 gzip.
Early build attempts exceeded the existing budget; sharing projection calculations
and constant styling removed the duplication without increasing the limits.

Current HEAD's remote Netlify preview status is success, and Verify Inscape run
40045584067 is cancelled. Those remote results do not cover these local changes.
The local 5173 server serves the updated preview. The reproduction uses isolated
fixtures, not a modification of the founder's current saved composition. Existing
read-only preview content limits remain; no full release-suite claim is made.
