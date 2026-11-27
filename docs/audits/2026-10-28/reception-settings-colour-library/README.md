# Reception Settings, Color and Library

Local application changes, 28 October 2026, on
`codex/static-reception-bento-2026-10-26` at base
`4a0251647234c0757847078ec34f0865425f6857`. Existing uncommitted work is preserved.
This work is not committed, pushed, deployed or published.

## Result

- The header has one Settings entry. Grid holds corners, gaps, the grid colour
  entry and appearance choices. Text holds spacing and alignment only; it is
  discoverable without a selection and explains why those controls are disabled.
- New Text, Edit text and direct editing reveal the separate Text tool. Full
  formatting and article controls are not embedded in Settings. Existing Text
  editing, recovery and article-colour logic remain shared with Workbench.
- The header sun/moon toggles the current view immediately. Settings shows
  Your current view and Default for visitors side by side. Only the visitor
  default writes authored state.
- The palette opens a separate modeless Color window. It remains open during
  selection, Text editing, Settings, Library and crop interactions, can move
  outside the grid and resize, and identifies its current cell or grid target.
  Text foreground and cell background remain distinct colour targets.
- A compact pipette icon beside the wheel invokes the browser's screen sampler;
  unsupported browsers retain a native colour-chooser icon, wheel and hex input.
- Use selected image now preserves the selected Library image variant. It no
  longer substitutes that NFT's cover image. Drag and click use the same media.

## Ownership and interaction corrections

The Reception host owns tool visibility, stacking, current cell and private
window frames. Its existing draft store owns all saves, undo and recovery.
Text keeps its existing editing session; it portals controls into the active
tool without creating another article state owner. Native capture on the actual
Reception tool window activates it even for nested React portals. Closing a
retargeted tool falls back to the currently selected cell if its original
toolbar trigger has unmounted.

The shared colour component captures the sampling target, generation and callback.
Changed scope, invalidated generation, closure and unmount cancel or ignore a
pending result. Color previews do not create history until committed.

Library keeps the chosen media URL/dimensions as temporary workspace selection,
separate from the stable NFT ID used for category membership. It validates the
choice against current source media and context. The existing placement receiver
and generation guard continue to own the destination; no authored schema changed.

## Evidence

- [Library reproduction, repair and 42 distinct browser checks](library/README.md).
- [Colour lifecycle tests and native-picker limitation](colour/README.md).
- Settings/editor/geometry/public styling: **40/40 passed**, final corrected
  implementation in [browser-tests-final.log](settings/browser-tests-final.log).
  New/Edit Text opens Text, Settings has no formatting toolbar, the two theme
  groups align side by side, and portal activation/retargeted focus work.
- Colour lifecycle and compact geometry: **4/4 passed**. Together with Library,
  this is **86 distinct focused browser cases**. Wide/narrow visual checks include
  [Text and compact Color at 1920×1080](settings/text-tools-and-text-color-1920.png)
  and [side-by-side theme controls at 390px](settings/settings-grid-theme-390.png).
- Complete unit suite: **1493/1493 passed**, [unit-final.log](unit-final.log).
- Lint passes across 520 source files; 88 existing hook-dependency observations
  remain recorded. Type contracts pass (17 invalid calls and 3 production
  mutations rejected). Generated design-system inventory passes.
- Final production build and build check pass, including runtime isolation and
  output hygiene; see [build-final.log](build-final.log) and
  [build-check.log](build-check.log). No publication was performed.

## Measured build allowance

The preceding local editor build measured 2,675,987 raw / 876,368 gzip core JS
bytes. The final requested tools and Library correction measure 2,682,359 raw /
878,394 gzip: +6,372 raw / +2,026 gzip. The aggregate raw allowance is explicitly
raised from 2,676,000 to 2,683,000 bytes. Its 879,000 gzip limit and all startup,
owner-runtime, wallet, CSS and asset ceilings remain unchanged. Initial JS is
831,126 raw / 240,972 gzip (416 raw bytes above the preceding build); the owner
editor remains outside the initial entry. The build test retains exact budget
assertions and still rejects overages rather than disabling the gate.

Earlier integration logs and captures are historical evidence of this local
iteration. `settings-and-text-color-1920.png` predates the standalone Text-tool
correction and is superseded by `text-tools-and-text-color-1920.png`.

The native operating-system sampling surface itself has not been automated.
Tests exercise its application bridge with a stub, including success, cancellation,
failure and obsolete results, and separately exercise the unsupported fallback.
No browser sampled the user's desktop automatically.
