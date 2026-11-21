# Native Bento integration — 2026-11-11

Status: local working-tree implementation. Not committed, pushed or deployed.

## Behaviour and ownership

Reception's native rectangles remain canonical. A transient slicing topology is
inferred from their shared boundaries. It is never saved. Centre drops exchange
cell frames, inner edges divide their specific destination and outer card edges
form a complete row/column. Vacated sibling space collapses. The editor previews
the planned native frames and commits the same destination through the existing
Reception scope, generation guards, confirmed persistence and one-operation Undo.
Native members retain their IDs, articles, image sources/crops, layer order and
anchors. Independent phone order/placement remains authored separately.

Creation and deletion now share the same subdivision allocator. The former
row-band insertion target/distance planner, row reservation allocator and local
hole-absorption implementation were removed. Generated layouts and T junctions
remain covered. Non-slicing closed deletion bands retain a small deterministic
repacking fallback; free layouts with intentional gaps remain unchanged. Insert
moves on non-divisible layouts are refused explicitly; centre swaps remain valid.
No production dependency or package/lockfile change was made. The CDN/RGL trial
is still separate; production imports none of its code or artwork fixtures.

The native reader reconstructs the same subdivision, stacking horizontal groups
when readable widths no longer fit before the existing phone breakpoint. Native
phone overrides remain available. Ordinary native text retains its typography;
actual rendered article heights can grow the responsive cell/page without saving
viewport geometry. Measurement ownership is scoped to document and viewport.
Rotated/multi-column/framed text retains its authored clipping behaviour.
Images use the existing measured-box native Fit/Crop renderer.

## Validation

- Full npm-test-equivalent source suite: 1,803 passed, zero failed.
- Production Vite build and build:check passed with unchanged limits/metadata.
- Strict Workbench contract check passed; 40 invalid calls and 9 production
  mutations rejected. Lint passed (existing recorded hook observations retained).
- New native browser regression is registered in the release catalog. Its
  execution here was blocked at Chromium startup with spawn UNKNOWN; no browser
  assertions ran in that automated attempt. It is not counted among 1,803 tests.
- Connected-browser checks over the actual native editor: whole right-column
  insertion, local lower insertion retaining the left cell, unequal centre swap,
  Undo and responsive previews. Tablet 768px and Phone 390px retained 16px text.
  Native editor inspected at its normal wide viewport and 900px in Light; no
  horizontal document overflow or alert. Dark/default viewport restored.
- Long-article Phone preview: page grew to 2,855px; rendered text frame 787px,
  natural content 786.6875px, font 16px. This tests actual content, not empty cells.
- Model regressions cover save failure, stale/released scopes, reload, exact
  content identity, independent canvases, all local/outer edges, layout closure,
  member constraints, generated partitions and pre-phone responsive reflow.
- Obsolete production insertion symbols were searched after replacement: none.

## Same-checkout delivery size

All delivered JS files, including lazy chunks, summed separately from CSS:

| Resource | Before raw | After raw | Before gzip | After gzip |
| --- | ---: | ---: | ---: | ---: |
| JavaScript | 5,889,054 | 5,888,289 | 1,777,940 | 1,777,716 |
| CSS | 412,749 | 414,307 | 89,967 | 90,240 |

The final build is 765 raw JS bytes / 224 gzip bytes smaller. CSS adds 1,558 raw /
273 gzip bytes for the explicit drop affordances. Initial JS remains 726,052
bytes. No budget ceiling was raised and no code was reclassified outside its
existing budget. Bounding-box arithmetic was reused from workbenchSelectionBounds
by cell anchoring, subdivision and Navigator rather than copied a fourth time.

Compared with files at the start of this integration turn, production source/CSS
adds 343 lines and deletes 294 (net +49). Tests, fixtures, generated inventory and
documentation are counted separately. The repository already contained substantial
unrelated local edits; those were retained. Comparison snapshots exist under
.verification/reception-tiling-2026-11-11 for this slice.

## Scope and remaining limits

Native module/cell capacities are unchanged; the 49-cell trial is not evidence
that production supports 49 cells yet. No motion editor, new scene system,
independent mobile-motion authoring, capacity expansion or touch-authoring claim
is included. Native content-size limits can reject an editor move when its
contents cannot fit the current authored frame. Responsive reading may grow.

Test with disposable native content at:
http://localhost:5173/browser-tests/reception-native-editor-fixture.html?tiling=1&session=tiling-review-1111
Add longText=1 and a fresh session to exercise long text. Fixture data uses its
own storage prefix and never reads the owner's saved Reception.
