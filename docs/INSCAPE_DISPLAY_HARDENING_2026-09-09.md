# Display hardening review — 2026-09-09

This is an implementation review, not new product authority. The active contract and creative intent remain authoritative. Scope: the shared owner/Visitor Display, inspection and lift, transparent picking, Grid gestures, resizing/immersive presentation, and saved/published inspection choices introduced during this conversation. Remaining corner-resize pixel jitter is deliberately deferred.

## Findings and repairs

- **Inspection navigation could target artwork without a rendered source.** The shared session now requires a usable source rectangle and entry, refreshes the destination rectangle when browsing, and closes when its active source disappears. A completed preparation request must still have an entry before it can open. Existing scope/request cancellation remains in charge of obsolete asynchronous work.
- **Lift could restore keyboard focus too early.** A microtask could run before React revealed the original artwork. Restoration now waits until the next animation frame and checks that the source still exists and is not in another inspection session. A real animated browser regression reproduced this failure before the fix.
- **Canceled owner swipes could leave temporary state behind.** Pointer cancellation, window blur, profile/Grid changes, and disabling interaction now clear the relevant gesture and swipe state; scope/disable/blur paths also cancel settlement timers. Browser checks exercise pointer cancellation, blur and Grid changes.
- **Immersive ownership needed lifecycle and keyboard containment.** A focused `useDisplayImmersive` hook now owns top-layer entry/exit, listeners and focus restoration. It exits when the Display window becomes unavailable and keeps Tab within the immersive Display. Resizing and fullscreen presentation remain temporary; immersive geometry does not reach the saved-window callback.
- **Older presentation-edit calls could create a false change after a placement gained an inspection choice.** Candidate construction now preserves an existing optional inspection mode when an older caller omits it. A no-op stays a no-op; changing a frame retains the choice. Explicit invalid choices and stale placement snapshots remain rejected.

## Architecture assessment

The shared inspection session and viewer are the right boundary: owner and Visitor adapters supply their different data and actions to one interaction implementation. The placement owns the authored inspection choice; temporary inspection, lift, swipe and immersive state are separate from the publication document. Optional inspection fields preserve existing documents without rewriting their bytes just to add a default. Compatibility checks cover serialization, parsing, recovery, unchanged old data, and invalid new values.

Transparent picking uses derived, bounded masks rather than reading image pixels on every click. The existing cache limits and disposal rules are appropriate. In the synthetic five-layer warmed browser fixture, 100 picks had approximately 0.1 ms median and 0.2 ms p95, with no canvas readback during clicks. This measures the fixture, not cold decoding or every real scene/device.

The actual structural simplification in this pass is extracting immersive lifecycle ownership from the window component. The gesture repairs and inspection guards are correctness fixes, not an architectural rewrite. No new dependency or renderer was added.

## Remaining maintenance work and limits

- `PresentationBoardDefinitive` still combines substantial window sizing, wheel handling, Stage layout and control rendering. Further extraction should follow a concrete change or bug, not split files for its own sake.
- Owner and Visitor retain different gesture adapters; fixes at those boundaries still need both modes checked. The shared viewer/session avoids duplicating the core inspection behavior, but does not make the entire application a single implementation.
- Several older tests assert source strings. Obsolete expectations were corrected, and one superseded owner-viewer wiring test was replaced by behavioral browser coverage. The remaining source assertions are limited evidence of correctness.
- Some legacy session return fields remain for adapter compatibility. They should be removed with their consumers when that boundary next changes.
- Failed/CORS-blocked mask access still falls back to rectangular picking. Lift decoding failure keeps the original visible, but does not have a dedicated failure message. This pass checks late decode cancellation, not every media failure or codec.
- Browser verification uses headless Edge on Windows. Wide/narrow immersive screenshots were inspected; real-device touch behavior and other browser engines remain unproven. The immersive fixture uses simple artwork, while owner/Visitor picking checks use their actual Display surfaces.
- Corner-resize subpixel jitter remains unresolved and intentionally unchanged. Passing geometry tests does not establish pixel stability.

## Verification

- Complete `npm test` suite.
- 25 focused browser checks across `display-hardening.browser.mjs`, `display-inspection-session.browser.mjs`, and `artwork-picking.browser.mjs`.
- `npm run build` and `npm run build:check`.

Browser checks cover both inspection modes, return focus, closing before decode, hidden navigation targets, asynchronous scope changes/disposal, transparent/rotated/cropped picking, owner and Visitor integration, canceled swipes, wheel sizing, immersive interruption, keyboard containment and preservation of window geometry. Final execution results and Git/deployment state are reported in the accompanying handoff.
