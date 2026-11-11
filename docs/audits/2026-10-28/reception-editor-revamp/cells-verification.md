# Cell editor verification

Local implementation, 28 October 2026. No commit, push or deployment performed by this subagent.

- Removed the cell dots menu, profile/links/introduction/details choices, Saved content, Join cells and Move or swap content. Removed the unused move/merge and unused-record authoring commands.
- Added one Delete cell action for every content type. It removes the complete cell and orphaned local Reception records; shared Library assets and canvas sources remain untouched. Header logo references are retained. Deleting the last cell returns one blank full-width cell. The existing store owns undo, redo, persistence, quota failure and scope checks.
- Cell movement uses the existing shared pointer controller, a dedicated handle and arrow-key equivalents. Preview shifts full cell identities/content/appearance through existing rectangular positions; desktop slot geometry remains a complete partition. Mobile movement changes only its own order. No duplicate layout or history model was added.
- A newly found pointer issue was fixed: DOM relocation during reorder released capture from the moving handle. Cell dragging now captures the stable workspace via an optional captureHost input to useReceptionGesture. The dedicated handle also overrides the shared tactile touch-action so touch dragging does not become browser scrolling.
- Initial selection is empty, pointer selection is subtle, keyboard focus stays visible and clicking outside a cell deselects. Undo that removes the selected cell safely clears tools and selection.
- Library remains mounted and the grid stays interactive. Placement starts crop automatically; explicit selection is passed to Library so a deselected grid does not implicitly replace its first cell.
- Grid settings/header/theme components supplied by the parent are integrated. Mobile cell width/height and publication inclusion remain in Cell appearance; backup/recovery has a separate header action. Existing linked content and Edit link are retained without expanding their authoring flow.

## Checks

- `node --test src/profileDocument/domain/receptionPresentation.test.js`: 12 passed. Covers replacement cleanup, logo references, delete/reorder, undo/redo, failed storage, canonical/public round trips and source preservation.
- `INSCAPE_TEST_ROOT=http://127.0.0.1:5197 node --import ./scripts/browserEnvironment.mjs --test browser-tests/reception-editor.browser.mjs`: 22 passed, zero failed/skipped. See editor-browser.log.
- Browser checks include actual mouse reorder preview/Escape/commit/reload, CDP touch reorder and pointer cancellation, keyboard move, cell deletion/undo, Library placement, Text storage recovery, cropping, public viewports 2560/1440/800/640/390/320 and bounded preview geometry.
- Scoped `git diff --check` passed. Git emitted only its existing LF/CRLF conversion notices.

## Practical limits

- Movement retains the grid's rectangular positions: the moving cell takes the destination rectangle while intervening cells shift. Thus a cell can take a different width/height, while its identity, content, crop, padding, surface and alignment move with it.
- Deleting normal split-created layouts collapses the containing partition and expands siblings. A valid non-slicing imported partition first tries a full adjacent strip; if no rectangular absorption exists, survivors are repacked in reading order to keep a complete grid.
- At 320px the auto-open crop tool can overlap Library; closing crop exposes Library again. Both remain independently movable/resizable.
- Touch evidence is Chromium CDP, not a physical iPhone/Safari run. Production build, full unit suite and combined screenshots belong to the parent's final verification.
