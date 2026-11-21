# Bento local editing — first implementation slice

## Result

The selected cell's **+ Cell** menu now offers four local sides before the four
whole-Bento additions. Local insertion grows the Bento, preserves the selected
cell's size, translates subsequent cells, and extends trailing cells in adjacent
regions to maintain a complete rectangular partition. Hover/keyboard focus shows
the result without saving; Escape cancels and returns focus to the trigger.

For the founder's header / three left cells / large right cell example, adding
below the right cell leaves the header, intro, portrait, right cell and existing
text frames exactly where they were. The bottom-left cell extends downward.

Moving the previously appended bottom strip into the right column now carries
free text's vertical inset and height with its owner. Numeric Width/Height keeps
the selected cell's top-left fixed and changes the Bento dimensions. Shared-edge
dragging remains the explicit redistribution/cropping operation.

## Ownership and replacement

- Native authored rectangles remain the only saved geometry. The existing
  temporary slicing tree now provides one growth plan for local insertion and
  numeric sizing. No new dependency or saved layout model was added.
- `receptionCellSizing.js` replaces the trailing-divider/leading-divider fallback.
  Its meaning no longer changes when a bottom strip is added.
- The shared member projector receives structural-move intent from commands and
  previews instead of guessing that every change in height is stationary clipping.
- Bento frame previews now use the existing `WorkbenchAreaProvider` preview,
  including its draft-scoped invalidation. The separate local frame-area state
  and unused drag-area copy were removed. Contents and outer clip preview together.
- The unused responsive-reflow branch of `receptionTiling.js` was removed after
  checking consumers. Public responsiveness already uses its separate progressive
  layout. The authored allocation and its size validation remain.
- Existing whole-Bento additions are retained because they still serve a distinct,
  explicitly labelled operation. Existing drag insertion retains redistribution
  of the current bounds. Both still pass through the native atomic save/history
  boundary.

Against the pre-edit checkpoint, production changes are **162 added / 65 removed
lines** across eight files. Tests/catalog changes are **265 added / 8 removed**;
active-contract changes are **20 added / 3 removed**. This report and generated
verification output are counted separately. Necessary production growth covers
the local allocation command, preview lifecycle, and explicit placement intent.
No CSS declarations were added.

## Verification

- **192 Reception unit tests + 5 browser-catalog tests passed**. New behavioral
  cases reproduce the screenshot topology and cover all four local additions,
  preview/commit text parity, numeric height before/after outer addition, exact
  Undo/Redo/reload, public projection, stale generations, storage failure,
  capacity, repeated growth to the existing 16-cell limit, and non-slicing layouts.
- Focused ESLint on the changed editor components and allocation modules passed;
  changed modules/browser suite passed syntax checks; scoped diff whitespace check
  passed. The browser suite is registered in the existing release catalog.
- Connected-browser checks used an isolated fixture with real artwork and text,
  at the default wide desktop size and 900×1000. Menu and keyboard previews,
  Escape/focus recovery, insertion, Undo/Redo, reload, numeric height, and frame
  expansion were inspected. DOM measurements confirmed preview/commit equality
  and exact Undo/Redo restoration; increasing height left the selected text frame
  and cell top unchanged. Reload refits the camera, so raw screen coordinates
  across reload are not an authored-geometry equality test. Unit tests verify
  exact persisted geometry. The temporary viewport override was reset.
- Automated browser suites could not execute in this restricted session: the
  bundled Chromium failed to spawn; installed Chrome reached the launcher's
  Windows process-ownership check, where `Get-CimInstance` was denied. The guard
  was not bypassed. Existing affected suites and the new two-viewport regression
  suite still need an unrestricted runner. No automated-browser pass is claimed.
- `npm run build -- --configLoader native` and `npm run build:check` passed.
  Native configuration loading avoids this session's esbuild parent-directory
  access restriction. The ordinary production config/plugins and budgets apply.
- Before/after builds used identical release metadata
  `08b4a7b871084780bafc89ad08404ca901e61f17`. Baseline source came from the
  pre-edit checkpoint through a Vite load override; live source was never reverted.
  Aggregate core JS: **2,751,420 → 2,755,765 raw bytes** and
  **905,040 → 906,703 gzip bytes** (+4,345 raw / +1,663 gzip). Initial JS raw size
  stays **726,497 bytes**. Existing ceilings are unchanged and pass.

## Limits and delivery

Local growth requires a slicing partition. Interlocking/non-divisible layouts
show an explicit reason and retain outer additions/shared dividers. This does
not silently flatten them. Anchored-content shrink/grow ratcheting remains a
separate issue; this slice does not change the authored anchor sizing model.
Free text retains its vertical inset/height; horizontal changes still use the
existing width projection, and Fit-box-to-text/explicit anchors retain their
own placement rules. Dragging an existing cell can still redistribute other
cell dimensions; local creation removes the need for that detour.

Work is local and uncommitted on `codex/profile-work-index-2026-10-30` at the
HEAD above. Existing user changes were preserved. The user's composition was
not edited; verification used separate synthetic documents. No deployment,
publication, wallet action or release checkpoint was performed. This is not a
claim that the whole Bento architecture has been rewritten or fully audited anew.

Evidence: `.verification/bento-local-improvements-2026-11-15/` contains the scoped
before copies, patch, counts, unit/build logs and before/after bundle report.
