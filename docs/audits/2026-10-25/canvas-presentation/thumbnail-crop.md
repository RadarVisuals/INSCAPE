# Automatic and manual thumbnail framing

25 October 2026 follow-up. Local, uncommitted on
`codex/audit-checkpoint-2026-10-19`, base
`6d7d428d91e2dce5629ccea7b48c345faabaec59`. No deployment or wallet action.

The founder found the first glass pass too opaque, then asked for thumbnail
cropping: automatic fill first, with manual control too.

Grid now projects each saved canvas as a centred cover crop without padding or
a reserved caption footer. Title/open and info controls float over the image.
The shared overview/viewer glass uses 24% face tint (previously 58%), a subtle
highlight gradient and rim, and 18px blur. Information popovers retain their
more opaque reading surface. Reduced transparency still uses an opaque surface.

Open a tile's info button, then **Adjust thumbnail**. The crop form previews the
current tile aspect ratio, supports pointer/touch dragging and arrow keys,
offers 1–4× zoom, and saves only on **Save crop**. **Auto fill** prepares the
default centred crop; save applies it. Cancel or Escape discards the temporary
framing and restores focus to Adjust thumbnail. Failed storage keeps the form
and proposed crop available to retry.

The optional `thumbnailCrop: { x, y, zoom } | null` is local collection-entry
metadata. It reuses the existing atomic details writer and collection validation;
it is not module content, a second preview document, a bitmap, or an editor
camera update. Omitted/null means automatic cover. Existing name/introduction
edits preserve framing. Backups and reload preserve each canvas's crop.
Thumbnail positions are normalized so resized tiles keep the intended focal
point, clamped to prevent exposing outside the canvas.

Geometry projection and pointer pan gestures reuse the existing crop functions.
The manual form is lazy-loaded. The overview remains responsible for selection;
the collection store remains the only persistence owner. List and the opened
viewer still fit the full canvas. No publication schema or source metadata
changes were made. This is a local owner gallery feature; the prior renderer
limits (Image first side, Display first Grid, executable mini-app placeholders)
still apply.

## Evidence

- [Browser results](browser-thumbnail-crop/results.json): 8/8 passed, including
  automatic coverage at 2560, 1440, 800, 390 and 320 pixels; real touch drag;
  manual zoom/keyboard framing; failed-save retry; cancel; reload; Auto fill;
  unchanged composition geometry; and complete-canvas opening after cropping.
- [Desktop crop form](browser-thumbnail-crop/workbench-overview/thumbnail-crop-desktop.png)
- [Touch crop form](browser-thumbnail-crop/workbench-overview/thumbnail-crop-touch.png)
- [Filled gallery](browser-thumbnail-crop/workbench-overview/grid-1440.png)
- [Narrow gallery](browser-thumbnail-crop/workbench-overview/grid-390.png)
- [Saved crop and glass controls](browser-thumbnail-crop/workbench-overview/cropped-gallery-desktop.png)
- [Model/store checks](crop-model-tests.log): 112 passed, including invalid
  serialized crop rejection, atomic failures, inactive canvas isolation,
  backup/reload, and existing crop geometry checks.
- Typecheck passed; design inventory and its 10 tests passed. Lint passed with
  the same 92 recorded hook observations. Full release `npm test` was not run.

The first production build measured 2,559,595 raw / 825,870 gzip core JavaScript,
exceeding the prior viewer-only allowance. The aggregate optional-feature budget
is now 2,561,000 / 826,500; all other ceilings are unchanged. Initial JavaScript
remains 825,614 raw bytes. Production and alternate-output verification are
recorded in [build](build-crop-final.log), [budget check](build-crop-check.log),
and [production tests](build-crop-tests.log).
