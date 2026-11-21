# Responsive Bento interaction trial — 2026-11-11

Open <http://localhost:5173/prototypes/bento-grid-trial/> with the normal local
server running. This is an isolated comparison, not a production migration.
No production package, lockfile, renderer, Reception draft or publication format
was changed. The active contract records the founder's corrected responsive scope.

## Current behaviour

- Centre drop: two cell identities trade slots, including unequal-size slots.
- Cell-edge drop: insert above/below/left/right of that cell only. The source
  closes up, and the target divides its space. New splits begin at 50/50.
- Card-edge drop: put the source in a complete outer row/column. A 12px strip at
  the actual card boundary owns this target; an inner cell-edge target is local.
- During drag, a complete preview replaces the accepted layout visually. The
  green outline identifies the incoming cell. Release commits that exact tree.
  Escape, viewport/font changes and window blur cancel temporary placement.
- Shared divider handles resize both neighbours. Arrow keys change a focused
  divider by 5 percentage points. Content-aware minima can clamp the visible edge.
- Under 'Plaatsen zonder slepen', Tab to an action previews the same plan; Enter
  applies it and Escape cancels it. These controls use the same planner as drag.
- Text edits save on blur and keep their cell identity. Text remains 16px/24px
  line height. The actual browser text measurement reserves sufficient height.
- The 3-cell example contains an existing illustration layer. The 49-cell example
  starts as 7x7 when enough room is available. On smaller viewports horizontal
  groups stack, the page grows and type remains readable. Tree group boundaries
  can produce rows with differing cell counts: this is not uniform masonry.

## Responsibility boundaries and replacement

`partition.js` owns one binary subdivision tree, pure drop planning, shared
ratios, responsive projection and hit testing. Responsive projection derives
rectangles from that tree and current measured text; it never writes a second
viewport layout back into the document. Horizontal groups require 220px per leaf
along their shared axis. If they cannot fit, that group stacks vertically. Text
and image minima grow the containing page rather than shrink content.

React Grid Layout 2.3.0 supplies pointer drag mechanics and rectangle rendering.
Its ordinary push/vertical compaction and rectangle resizing are disabled here:
those do not implement the requested closed subdivisions. Our planner supplies
all final rectangles; no library-generated displacement is silently persisted.
This narrows the value provided by the 27.2KiB dependency and must be considered
when deciding whether to integrate RGL, use a tiling library, or keep a small
custom implementation. This trial does not establish that RGL is the best choice.

`model.js` owns the accepted tree/content, confirmed persistence, revisions and
completed-operation Undo/Redo. `main.js` owns presentation, measurement and
transient previews. Text edits are retained visibly if saving fails. Release is
bound to its originating revision. The v2 trial uses only
`inscape:prototype:bento-grid-trial:v2`; the earlier coordinate trial's v1 data is
left untouched. Production data is never read. Undo history is session-local;
the accepted document survives reload.

The old fixed 12x12 geometry store, overflow-rejection workflow, keyboard nudging,
free rectangle-resize path, scaled text styling and obsolete expectations have
been replaced, rather than retained under a second trial mode. Production's own
Bento implementation remains intentionally untouched for comparison.

## Verification

`node --test prototypes/bento-grid-trial/model.test.js` passes 11 cell-model tests, covering:

- Right-column reorder and cross-column unequal-slot swap with native identities.
- Local lower insertion versus full-width outer insertion; all four edges.
- Every source/target/edge combination for the three-cell tree at 2400, 1440,
  900 and 390px, checking complete area coverage, bounds and no overlaps.
- All 49 cells reflow, with seven across wide and one column on a phone;
  viewport projection performs no document write.
- Shared-divider sizing, content retention, one-step Undo/Redo and reload.
- Cancellation as a no-write preview, stale revision refusal, malformed storage,
  failed persistence/Undo and isolation from production/previous-trial keys.

Manual browser checks include centre swap across columns, local lower insertion,
outer lower insertion, Undo, keyboard placement preview, Escape, shared-divider
keyboard resize, text editing and reload. Observed 49-cell geometry:

| Browser viewport | Available card width | First row | Cell count | Text | Horizontal overflow | Clipped text |
| --- | ---: | ---: | ---: | --- | --- | --- |
| 2400px | 2340px | 7 | 49 | 16px | none | none |
| 900px | 840px | 3 | 49 | 16px | none | none |
| 390px | 354px | 1 | 49 | 16px | none | none |

Phone-sized layout is verified, not physical-phone touch authoring. There is no
continuous drag autoscroll across a very long document. Motion, native production artwork editing, publication and separate mobile scene overrides are not integrated. The optional layer study below reuses native geometry helpers, rather than the full module renderer.

## Size and build evidence

The UI measures the actual esm.sh RGL bundle with React/ReactDOM external and
compresses its bytes with `CompressionStream('gzip')`. It similarly measures the
vendor stylesheets: 78.8KiB minified JS / 26.0KiB gzip, plus 4.2KiB raw CSS /
1.2KiB gzip, approximately 27.2KiB gzip combined. CDN wrappers, React/ReactDOM
and this prototype's own code are excluded from that number. The CDN resolves
transitive dependency versions; this is not a locked production dependency tree.

Run `node prototypes/bento-grid-trial/measure-build.mjs` for a separate Vite/Terser
build of the prototype's own code, using the existing installed tools. It writes
only `.verification/bento-responsive-build`, does not empty existing directories,
and prints the current Rollup outputs. The measured own JS was 19,626 bytes raw /
8,116 bytes gzip before the optional layer study; rerun the measurement for the current prototype.
These numbers are separate from the external library; shared tokens would already
exist in the real app. They are not an incremental production Inscape comparison.

A real migration needs a reviewed locked installation, same-release before/after
production builds, inclusion of lazy code/CSS and removal of superseded code.
Existing production budgets must not be raised to accommodate the trial.

## Third-party software

The trial loads pinned top-level CDN distributions because shell access to the
npm registry was denied. It is online-only. React Grid Layout and React/ReactDOM
are MIT; keep upstream notices with any redistributed copies and review all
transitive notices in a future locked installation.

- <https://github.com/react-grid-layout/react-grid-layout/blob/master/LICENSE>
- <https://github.com/facebook/react/blob/main/LICENSE>


## Layer study and visible outer targets (2026-11-11)

Enable “Lagenproef in Artwork-cel” in the three-cell sample. Background, Nomad
and Abyssal Eye remain independent image placements. Nomad's black silhouette
and foreground share their original study SVG coordinates (204/110/1205/1860
and 209/-29/1863/1998) so transparent face/hand regions stay black. The copied
WebP files are prototype-only artwork under assets/, not production sources.

The study directly imports projectReceptionCellMembers, fitNativeMediaRectangle
and projectCroppedMediaRectangle. Relative member boxes scale independently in
x/y as the production helper does; image pixels keep aspect ratio inside those
boxes. Fixed anchors retain authored pixel size, allowing intentional cell-edge
clipping. Fit avoids image clipping within its own box; it cannot prevent an
oversized anchored box being clipped by the cell. Cover crops to the member box.
The fixed backdrop always covers the cell. Crop focus is centered.
Settings are session-only and do not enter the persisted cell document or Undo.
This is a rendering comparison, not an artwork editor or motion integration.
Two layers.test.js checks cover source aspect ratios, Fit/Cover, relative scaling
and retained-size anchors at square, narrow and wide dimensions.

During pointer drag, the four actual outer drop strips are now visible and
labelled Hele kolom links/rechts and Hele rij boven/onder. They remain 12px wide,
matching hit testing, and retain their accepted-card bounds while a layout is
previewed. An additional model regression verifies Artwork at the right outer
edge becomes a full right column while both text cells remain stacked left,
including persistence and one-step Undo.
