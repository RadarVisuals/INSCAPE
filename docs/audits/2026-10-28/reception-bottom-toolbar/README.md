# Reception bottom toolbar

28 October 2026. Local changes on `codex/static-reception-bento-2026-10-26`,
base `4a0251647234c0757847078ec34f0865425f6857`. No commit, push or deployment.

The selected cell's actions now live in one fixed toolbar centred at the bottom
of the editor viewport. The toolbar is outside the content scroll host and
cell clipping, so a narrow Image cannot hide Crop, Color, Add or Delete behind
a horizontal scrollbar. On very narrow screens the actions wrap. Preview and
public reading do not display authoring tools. Without selection, Add cell stays
at the same bottom-centre location.

Only the Move cell handle remains inside the selected cell, at its top-left
corner, as requested. It retains pointer/touch dragging, arrow-key movement,
preview/cancellation and one undoable save. Its touch-action override must beat
the shared tactile button's manipulation rule, otherwise the browser cancels a
drag to start native panning. The final selector preserves that precedence.

ReceptionEditor still owns selection and commands. ReceptionCanvas renders only
the handle and split preview within a selected cell. No authored schema, saved
geometry, media crop, window preference or publication behavior changed.

Verification: **26/26 browser cases passed**, lint passed (88 previously recorded
hook observations), and the final production build/build check passed.
Visual evidence:

- `browser-final.log`: existing Reception editor interactions plus a regression
  at 1920×1080, 390px and 320px with an Image cell narrower than 190px. It checks
  every bottom action's reachability, viewport centring, independence from
  content scrolling, selected target, the separate top-left handle and Preview.
- Existing cases cover keyboard, mouse and real touch reorder/cancel, deletion,
  crop, undo/redo, Text, Library, saving, reload and public reading.
- `narrow-image-toolbar-1920.png`, `narrow-image-toolbar-390.png` and
  `narrow-image-toolbar-320.png` show the final placement; inspected visually.
- `lint.log`, `build.log` and `build-check.log` record production checks.
  The existing JS budgets remain unchanged for this correction.

The first added regression fixture accidentally contained an unsupported
`dividers` field and was corrected to the actual Reception schema. The first
top-left-handle run exposed the touch-action precedence issue above; the final
browser log supersedes those intermediate runs.

The founder then requested a quieter handle. It shows a 14px grip without the
button background, border or shadow; hover, keyboard focus
and dragging restore full opacity. The existing 32px desktop / 44px touch hit
target and visible keyboard focus remain. The four existing narrow-toolbar,
keyboard, pointer and touch regressions pass again in `quiet-grip/browser.log`;
desktop/mobile captures there were inspected. The production build and budget
check pass with unchanged allowances (`quiet-grip-build.log`).

The subsequent contrast correction removes its dependency on interface-theme
ink. Each dot has a light core and a thin dark contour, at 85% idle opacity.
The new `grip-contrast/capture.mjs` captures the actual handle over white, black
and middlegrey bitmap images in both Carbon and Mist. All six resulting PNGs
were inspected: the handle remains visible in either theme without a button
surface. Only scoped handle CSS changed; dimensions, hit area and gestures remain.
