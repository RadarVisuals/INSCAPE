# Canvas close and original SVG investigation

25 October 2026. Local, uncommitted changes in the designated application
checkout, branch `codex/audit-checkpoint-2026-10-19`, HEAD
`6d7d428d91e2dce5629ccea7b48c345faabaec59`. Existing changes are retained.
No wallet request, authored-data rewrite, commit, push, upload or deployment.

## Findings and correction

The viewer's motion hook owns frame bounds and the composition projection.
Its target viewport also sized the stage element, so closing clipped the
painting to the destination thumbnail before the outer frame arrived there.
The first captured frame had a 941×815 surface but only a 464×580 painting
stage. The stage now follows the moving frame, while the preview's projection
still receives the fixed target measurement. A later chrome-visible selector
also overrode closing opacity. Closing now wins that rule and makes the
controls inert immediately. This keeps the existing single motion owner;
it does not add another animation or content store.

Captured and inspected **20 frames at 35ms intervals per sequence**:
[before contact sheet](before/contact-sheet.jpg),
[after contact sheet](after/contact-sheet.jpg),
[before geometry](before/frames.json), [after geometry](after/frames.json).
The after sequence has no exposed stage gap and has zero chrome opacity at
every sampled frame. The normal-motion regression now checks all 20 samples,
in addition to interrupted opening, expansion, details and saved-content parity.

Public token metadata was read using the existing LSP8 resolver for the
[founder's supplied token](https://universaleverything.io/asset/0x611d3df50a3d930fba0a1f951e9d44bd9d3aea21/tokenId/0x0000000000000000000000000000000000000000000000000000000000000001).
The two original female SVG attachments were downloaded for isolated tests:

| Source | Bytes | Vector paths | Embedded raster images | ViewBox |
| --- | ---: | ---: | ---: | --- |
| female 1 blue.svg | 1,109,260 | 244 | 21 PNG/JPEG | 3000 × 2500 |
| female 2 pale.svg | 611,635 | 215 | 3 PNG | 3000 × 2500 |

[Image dimensions and formats](source-summary.json) retain the individual
raster sizes. The pale file contains images of 105×115, 317×357 and 364×368.
Both files have the standard SVG 1.1 external DOCTYPE, which the previous loader
rejected wholesale. The bounded shared SVG reader now strips only that exact
standard declaration before parsing. It still rejects custom DTDs, internal
subsets/entities, malformed XML, wrong roots and oversized input. No DTD fetch
or artwork network-permission change is introduced.

Both exports also use percentage width/height. Chromium's Image decoder reports
180×150 for them. Rendering a live document at those dimensions and enlarging
its foreignObject visibly softened the vector paths in inspection. The SVG
document loader now reports the responsive source viewBox to its existing
projection owner. The projection uses that larger native layout, capped at
4096 per side, rather than enlarging the image-decoder default. Fixed-size and
viewBox-free documents keep the existing layout. Source changes invalidate the
derived viewport; neither source URLs nor authored placement/crop change.
The existing geometry subscription's dependency is now explicit, removing its
old lint exception.

Both originals were checked in Workbench, 200% zoom and enlarged inspection,
including the actual 180×150 decoder dimensions. All paths remain present and
inspection retains the original embedded image data. See
[native-size reference](actual-svg/results.json),
[decoder-size rendering after correction](actual-svg-intrinsic/results.json),
[pale inspection](actual-svg-intrinsic/pale-inspection.png),
[blue inspection](actual-svg-intrinsic/blue-inspection.png).
The corrected decoder-size inspection and native-size reference differ by
less than 0.036 of 255 per channel averaged over the entire screenshot
([comparison](actual-svg-intrinsic/comparison.json)).

## Export and framing limits

The user's Affinity settings allow unsupported properties to rasterize; the
supplied files confirm mixed vector and bitmap content. Increasing raster DPI
on a future export can improve newly rasterized effects but cannot restore
detail missing from an already embedded bitmap. Exporting Nothing can omit
unsupported effects, so it is not a blanket replacement recommendation.
[Affinity's export documentation](https://s3-eu-west-1.amazonaws.com/affinity-docs/help/photo/en-US.lproj/pages/ExportPersona/exportOptionsPanel.html)
describes these controls.

The original SVGs include a full 3000×2500 background with the character offset
toward the lower right. Gallery inspection also intentionally fits the complete
authored composition, separately from its thumbnail crop. No automatic crop of
the SVG or authored composition was made. The current in-app tab displayed a
different WebP placement when inspected, so the exact saved placement geometry
behind the founder's second screenshot was not independently available. The
original sources and both rendering routes were reproduced in isolated fixtures.

## Verification

- Gallery: **12/12** including 20 return samples, interrupted lift, narrow/touch,
  reduced motion, resizing, reorder, crop, menu and persistence
  ([results](browser-first/results.json)).
- SVG declaration/isolation: **2/2**; custom declarations remain rejected and
  the nested runtime uses 3000×2500 with 180×150 saved media dimensions.
  Retained Image/owner/Visitor SVG Lift: **1/1**, wide and narrow
  ([results](browser-final/results.json), individual suite logs).
- SVG pixel quality, Focus/Return, zoom and group travel: **4/4**
  ([results](browser-quality/results.json)).
- SVG lifecycle, visibility, failed host, late message and retry: **7/7**
  ([results](browser-verified/results.json), `svg-lifecycle.log`).
- Focused viewport, retention, document-host and presentation-model tests:
  **14 passed**. LUKSO standards: **5 passed**.
- Lint: **481 source files**, **91 existing observations**. Contract typecheck:
  **17 invalid calls and 3 production mutations rejected**.
- Production build and build:check pass without a budget increase. Initial JS:
  **826,107 raw / 239,927 gzip**; non-wallet core JS:
  **2,571,327 raw / 830,139 gzip**. See [measurements](build-measurements.json)
  and [build log](build.log). Existing chunk-size/annotation warnings remain.

Intermediate quality runs failed on old test assumptions: synchronous synthetic
focus plus Shift+Enter, pointer access to a group under the compact sidebar,
testing a portalled loading indicator inside the canvas, and expecting immediate
offscreen disposal. Native separate keyboard events, explicit SVG-document
readiness and the current retention contract correct the fixture. Pixel and
retention tests remain separate. Final per-suite results above supersede those
intermediate failures; this is not a full release-suite certification.

HEAD's remote evidence was rechecked: Netlify preview status success, Verify
Inscape run 40045584067 cancelled. Neither covers these local changes. The live
5173 server serves the new viewport callback. No deployment is claimed.
