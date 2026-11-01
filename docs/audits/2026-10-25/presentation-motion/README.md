# Gallery motion and arrangement — 25 October 2026

Local, uncommitted changes in `codex/audit-checkpoint-2026-10-19`, based on
`6d7d428d91e2dce5629ccea7b48c345faabaec59`. Existing unrelated changes were
preserved. No commit, push, upload, wallet action or deployment was performed.

## Reference and result

The founder requested Aerra's animation treatment for the menu, information
reveals and canvas opening/closing, then thumbnail ordering and card size. The
follow-ups remove the menu scrollbar and require size to visibly resize cards.

The [published Aerra site](https://aerra-template.framer.website/?via=pawelgola)
and its `/work/volley` page serve readable compiled JavaScript. Inspected public
bundles under `framerusercontent.com/sites/4tCMlq92GLJIvbBV2k3nWF/` include:

- `script_main.CTChP9-1.mjs`: menu variants, a layout-animated header, and
  `{ bounce: 0, delay: 0, duration: 0.6, type: 'spring' }`.
- `zCaZzyyqx.DIEngszl.mjs` and project components: several open/close panels use
  zero-bounce 0.7-second springs; text effects combine opacity, blur and small
  translations. Some project entry effects use separate delayed 0.9-second
  springs, which are not the timing used for Inscape's inspection return.

These are served settings, not access to an editable Framer project. Downloaded
reference bundles remain in ignored temporary inspection storage and are not
application dependencies. Inscape uses CSS and native Web Animations with a
settling `cubic-bezier(.16,1,.3,1)` approximation, not an exact Framer spring
implementation. No new runtime dependency was added.

The bottom menu now expands as one glass shell over 600ms, including its
hamburger/close icon. Details use a 700ms clipped reveal with small movement and
text blur; tile labels reveal without moving or hiding the artwork. Closing
content is inert and excluded from accessibility navigation while its visual
exit completes. Menu scrolling remains available on short screens without a
visible scrollbar.

## Ownership and fixes

`useCanvasPresentationMotion` owns frame bounds, composition projection and
backdrop movement for entry, return and expansion. The previous path cancelled
an opening animation before sampling it, then restarted a return at the fully
open frame. It also animated the preview's initial fit at the same time. The
replacement samples live bounds before cancellation, keeps one fixed preview
measurement during travel, and releases that measurement at completion.
Closing wins over subsequent expansion. Resize cancels obsolete geometry;
unmount cancels owned animations. Existing camera-point projection remains
read-only, with its existing transition after the viewer settles.

Native modal behavior is retained, with explicit Tab wrapping after a touch
expansion exposed focus leaving the dialog. Reduced motion removes travel.
The overview scroll position and selected trigger are recovered on close.

Arrange mode temporarily uses one finite collection. Drag handles support mouse
and touch, with earlier/later controls and arrow keys as alternatives. Reorder
movement animates between actual tile positions. The stable gallery owns pointer
capture; a completed drop is applied after capture release. A non-passive native
touch listener claims only the drag handle's gesture. This resolves Chromium
swallowing the first tap after a custom drag, without replacing normal button
click behavior. Pointer cancellation and Escape discard the pending drag.

`systemWorkflowDraftStore.reorderWorkbenches` saves the existing array through
the validated collection write boundary. It rejects omissions, duplicates and
unknown IDs. It does not activate a canvas or alter content, camera or Undo.
Failed and stale writes retain accepted order. Root-only ordering authority is
not exposed to module scopes. There is no second order cache.

Card size is `galleryCardSize` in the existing profile-local preferences store.
Its error/retry behavior is reused. Small/Medium/Large alter columns and row
height. Removing count-based column expansion and flexible row stretching makes
the choice visible even with one canvas. Wrap uses bounded repetitions sized
for the viewport, exposes one accessible collection and mounts nearby previews.
This follow-up does not change authored geometry or saved thumbnail crops.

The final screenshot review exposed a visibility bug when a size change and
Wrap normalization queued multiple observer entries for a tile. Taking the
first entry kept some currently visible thumbnails unmounted. GridCard now
uses the newest entry. The browser suite waits for every visible tile's actual
preview projection after resizing, rather than accepting a blank loading frame.

## Verification

- Browser suite: **12/12 passed** in `browser-complete/results.json`, including
  normal-motion interrupted return with frame and artwork continuity within one
  pixel; expand/return; metadata, focus, touch, reduced motion; drag followed by
  a single ordinary tap; actual one-canvas sizing; short-screen menu scrolling;
  persistence/reload and failed order saves; cropping, wrapping and editor return.
  The additional visible-preview assertion in `browser-confirmed/` exposed the
  observer bug above; the final run includes its correction and inspected
  screenshot evidence. The large narrow thumbnail is populated after resize.
- Focused collection, preference and overview model tests: **121 passed**.
  Ordering roundtrips through reload and backup and preserves active content,
  activation and history; invalid, failed and externally stale writes are rejected.
- Lint passes for **480 files**, retaining the **92 existing observations**.
- Contract typecheck passes: **17 invalid calls and 3 mutations rejected**.
- Design inventory: **83 files, 598 definitions, 302 names**; **10 tests passed**.
- Native build and `build:check` pass. Production-budget tests including an
  alternate-output build: **19 passed**. Logs are alongside this file.

The final native build measures **826,107 raw / 239,921 gzip** initial JavaScript
and **2,570,375 raw / 829,627 gzip** aggregate non-wallet JavaScript. The latter
includes optional routes. Its ceiling changes to **2,572,000 / 830,500** for this
measured addition; initial, owner-static, wallet, CSS and public-asset ceilings
are unchanged. Standard existing large-chunk and Rollup annotation warnings
remain. No full release suite was claimed.

HEAD's remote status was rechecked: the Netlify deploy-preview status is success;
the `Verify Inscape` run **40045584067** is cancelled. Neither result covers these
dirty local changes. Local evidence above is the validation for this pass.

## Limits

Desktop, Reception redesign, public multi-canvas publishing and curated artwork
sequences remain deferred. Existing preview limits remain: first image sides,
first Display grid and placeholders for executable mini-apps. Touch evidence is
Chromium emulation, not a physical-device or Safari certification.
