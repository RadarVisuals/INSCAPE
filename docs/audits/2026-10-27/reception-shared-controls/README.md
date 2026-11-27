# Reception: shared operation and one rich-cell experiment

27 October 2026. Local working tree on `codex/static-reception-bento-2026-10-26`,
based on `4a02516`, with substantial earlier uncommitted work retained. Nothing
in this session was committed, pushed, deployed or published to a profile.
The existing PR #5 preview/CI references a different head (`3cfd6cf…`); it is
not evidence for this working tree. `source-hashes.json` identifies the inspected
final files; those hashes include earlier changes where the same file was shared.

## Delivered production slice

Reception remains a separate, bounded editor. Its tools now move and resize
through the same implementation as Workbench, including keyboard operation,
pointer capture, Escape cancellation and viewport clamping. The host rectangle
starts below the actual wrapping header. Window frames use the existing private
editor-preferences store and survive closure/reopening/reload without entering
authored content, publication or Undo.

Library covers this whole rectangle. Browsing hides the underlying selection
and disables editor interaction; selecting an asset alone does not place it.
The existing 6 px drag threshold and 90 ms fade expose the target cells. Hover
and release use explicit Reception receivers; the released cell, original draft
generation and source identity are retained while media dimensions resolve.
Cancellation, closure and intervening draft changes discard obsolete work.
Reception also permits a drop beneath the Library sidebar; Workbench keeps its
category receivers. A pointer-event specificity conflict at this edge was found
and fixed by the browser regression.

Escape retains the existing shared Library sequence: cancel the active drag,
then clear the Library selection, then close the Library and restore editor
focus. Successful placement opens framing for the receiving cell. Click/double
click and the explicit selected-image action retain the selected cell target.
Replacement retains unused Reception content; Undo restores the placement.

Image crop remains 0.1–4 times fill, with small axes centered and large axes
pannable. Crop and divider geometry stay owned by Reception. Done still saves
locally and returns to the local reader; visitors use the published projection.

## Actual reuse and replacement

| Responsibility | Implementation and disposition |
| --- | --- |
| Tool-window movement/resizing | Existing WorkbenchToolPanel implementation extracted into `src/ui/ToolPanel.jsx`; Workbench's wrapper supplies navigation bounds, Reception supplies its bounded host. The old Reception fixed-panel host was replaced. |
| Private arrangement | Existing `editorPreferencesStore` gains Reception frame records; a session-owned store is reused when available. The standalone editor owns its own flush/disposal lifecycle. |
| Library selection, drag threshold, fade, capture, cancellation | Existing `OwnerSystemWorkflowLibraryWorkspace` remains the single implementation. `ProfileLibraryPicker` is now a thin host, replacing its separate choosing implementation. |
| Reception drop destination and save | `ReceptionLibrary` captures explicit cell/generation receivers and delegates to the existing Reception save operation. It does not own a second pointer loop. |
| Crop/divider gesture lifecycle | `useReceptionGesture` adapts geometry to the existing `createWorkbenchGestures`; its former independent pointer lifecycle was removed. |
| Layer order buttons | Existing four Workbench actions extracted to `src/ui/ArtworkOrderControls.jsx`; Workbench and the experiment use the same component and domain reorder function. |

Shared code still lives partly in Workbench-named files and uses its CSS class
names. That naming/location coupling is recorded, not treated as a completed
whole-app separation. Library and window control reuse is real executable reuse;
Reception still owns its content commands. No new dependency or plugin framework
was introduced. Dock grouping/detaching was not added to Reception.

## Isolated rich-cell experiment

Open `/browser-tests/reception-rich-cell-fixture.html?session=review` on the local
development server. It is a development entry, with no production import/route.
Storage is confined to `inscape:fixture:rich-cell:<session>`.

One 800 × 600 cell contains an Image with its source asset, an article Text and a
Shape backdrop. The experiment uses existing selection functions, image/article
renderers, Text and Shape colour controls, pointer controller, resize geometry,
layer-order controls/domain function and history diff/apply functions. Browser
checks exercise colour and Undo, actual move/resize and cancellation for all
three objects, layer order, reopening and preservation of original image/text
records. It is not a visual mock that merely imitates these controls.

The prototype adds an explicit `placements` map keyed by object ID plus ordered
`artworkLayers`. Its small fixture store validates/persists the scene before
accepting a history entry. That is an **experimental host adapter**, not a
canonical Reception data model, production history integration or publication
implementation. The fixture's resize marks and object list are diagnostic UI.

At 390 px, scaling the composition to about 43% preserves the overlap but makes
16 px body text approximately 6.8 px. Readable flow keeps normal text size but
puts the Shape, Image and Text into separate rows, losing the backdrop overlap.
Neither option was selected as the product behavior. Mobile comparison is
temporary view state and never rewrites saved placements.

Before production multi-object cells, the remaining work is an explicit
Reception data/command adapter, canonical validation/history/recovery and public
projection, a decision about mobile overlap/layout, and production selection,
text-editing and resize affordances. Cross-canvas linking, nested Workbenches,
general image FX and full docking were not established by this experiment.

## Verification

- `browser-tests.log`: Reception editor/styling/boundaries; shared Library
  lifecycle; Workbench artwork layers/shared tools/docking; new bounded Reception
  tools/receivers; rich-cell experiment. **82/82 passed**. After the final
  Library action typography adjustment, the 9 Reception shared-control tests
  passed again (`shared-controls-final.log`).
- `focused-tests.log`: 44/44 focused checks passed for preferences, Reception
  presentation, shared gestures and geometry.
- `lint.log`, `typecheck.log`, `design-system-check.log`: passed. Lint retains
  the project's 91 recorded hook-dependency observations; no new finding.
- `build.log`, `build-check.log`, `production-startup.log`: passed on the final
  production sources. Initial JS is 831,250 raw bytes; owner/wallet runtimes
  remain outside the fresh entry and the owner graph reports no leaks.
- `unit-tests.log`: full `npm test` result is **1475/1476 passed**. The remaining
  `presentationBoardFoundation.test.js:79` assertion expects a noise token to
  appear directly in `ownerSystemWorkflow.css`. Earlier local work extracted it
  into imported `workflowTokens.css` (line 19). This session did not change
  those sources or weaken the test. The complete suite is therefore not green.
- `git diff --check`: passed, with existing CRLF conversion notices only.

Browser fixture media requests are served from the corresponding local assets,
with external requests blocked. These tests do not publish or touch a real
owner's profile. Production startup uses the generated local build. Screenshots
were inspected for full Library coverage, target feedback, bounded narrow tools,
visible artwork, tool clipping and both mobile alternatives.

## Visual evidence

Library during a drop into a cell beneath its sidebar:

![Library fades and targets Cell 1](library-drop-under-sidebar.png)

One cell with independent Image, Text and Shape, using the shared colour and
layer-order controls:

![Rich cell experiment on desktop](rich-cell-desktop.png)

Mobile alternatives, shown separately so the reading-size/overlap tradeoff is
explicit: [scaled composition](rich-cell-mobile-scale.png) and
[readable flow](rich-cell-mobile-flow.png).

Additional evidence: [Library browsing](library-browse.png),
[320 px bounded tools](bounded-tools-320.png).
