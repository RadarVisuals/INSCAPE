# Investigation of the eight earlier browser failures

Date: 2026-10-21. Local review; no production edits, commit, push or deployment.
Branch: `codex/audit-checkpoint-2026-10-19`; HEAD:
`32d9418843d996afc2e5203afa4552a6cd2d459a`.
The checkout is dirty and the separate UI chat continued FX work during this
investigation. This is not a CI result or a frozen release checkpoint.

## Result

None of the eight **recorded failure points** establishes a current application
bug. Four use removed UI selectors, two omit the required editor lease, one
expects viewport fitting that the accepted Image geometry explicitly forbids,
and one sampled points covered by the previous panel layout. Those last two
points are exposed in the current dock arrangement.

This does **not** mean the eight complete test cases now pass. Their original
scripts were inspected, not executed through a separate Playwright runner.
The failing boundaries and selected subsequent behavior were independently
reproduced through the browser UI. Several scripts have further stale
expectations after their original stopping point.

Original evidence: [module-migration.log](shared-transform-color/module-migration.log).
This report supplements, rather than rewrites, the historical
[shared-tools report](shared-transform-color.md#brede-browsercontrole-resterende-beperkingen).

## Classification of all eight cases

| Logged case | Original stopping point | Finding and required test update |
| --- | --- | --- |
| Independent Image module | `image-module.browser.mjs:40`: waits for a button named exactly `Library` | Stale selector. The current creation bar exposes `Artwork library`; it opens the Library and supports drops. The script also later assumes Rotate/Mirror live in Transform, ordinary click opens Inspect, and old Image settings locations. Update the complete flow, not only the initial wait. |
| Library drop, 1440 px | `workbench-image-drop.browser.mjs:48` | Same stale `Library` wait, before any drop is attempted. A current UI drop created a third Image and saved its side; one Undo returned to two. |
| Library drop, 700 px | Same setup wait | Same stale selector. At a measured 700 × 1000 viewport, dragging to (530,680) created a 360 × 360 Image at (350,500), with a public side and centered fill crop. Undo restored two Images. The Library occupying the screen does not itself block the drop: it yields during the drag. |
| Layers/Metadata/Text-tool resizing | `text-tools-resize.browser.mjs:162`: waits for `Tools` | Stale menu path, **not evidence of a multi-Text failure**. The current UI uses Actions and direct Layers/Artwork info controls. Its later selectors also target the former Display-scoped windows and separator roles. Preserve the distinction between Display Layers and Workbench Layers when updating this test; do not replace one with the other just to pass. |
| Text transfer, 100% | `text-transfer.browser.mjs:46`: disabled Text background control | Invalid production-style fixture. It mounts Runtime directly with actual `localStorage`, bypassing `ProfileEditingBoundary`. Runtime requests a guarded store without an acquired editor lease. Text cannot save; Color correctly refuses further composition edits. |
| Text transfer, 50% | Same Color control | Same missing lease. Both test variants reach this failure **before** the branch that changes zoom. This is not evidence of a 50% transfer or Color bug. |
| Image resize, 390 px | `image-resize.browser.mjs:71`: every resize handle must be within viewport width | Obsolete assumption. The fixture authors a 720 × 240 Image at x=8 and opens at 100%. Its right handles are at x=714…742 on a 390 px viewport. Camera focus changes the visible rectangle to x=32, width=326 at about 45%; all eight 28 px targets then fit. Saved dimensions stay 720 × 240. Focus/pan before testing reachable controls; do not shrink authored artwork to satisfy the assertion. |
| Image resize, 1440 px | `image-resize.browser.mjs:91`: two sample points on the second Image are covered | Previous test-layout interference, no longer reproduced at this point. The retained old screenshot shows Layers covering the Image center. Current probes at (1060,310) and (1060,235) both hit `Focus SKULL REAPER`. Avoid fixed exposed-point assumptions when movable tool windows are open. |

## Why the Text result is conclusive at its failure boundary

`OwnerSystemWorkflowRuntime.jsx` creates its store with `requireEditor: true`.
`profileEditorLease.js` only permits writes through actual browser Storage when
the page holds the matching editor token. Injected storage wrappers are separate
fixture repositories; this explains why other older Runtime-only fixtures can
still write while the Text-transfer fixture cannot.

The diagnostic fixture preserves that difference. With real `localStorage` and
direct Runtime, typing produces “This tab no longer has editing access” and
Text background is disabled. Through the normal reconciliation boundary,
typing the same title/body, making the body bold, switching Read/Write and
choosing a colored background succeeds, with no alerts. The diagnostic output
confirms the saved title, body, bold mark and background. No authorization guard
was relaxed or bypassed to get this result.

The three `profileEditorLease.test.js` unit tests were independently run and
passed, including stale-store revocation and immediate dispose/remount.

## Evidence and limits

Diagnostic-only source:

- `browser-tests/regression-review-2026-10-21.html`
- `browser-tests/regression-review-2026-10-21.jsx`

These use separate synthetic profile addresses, the existing application server
on port 24970 and original review artwork. They do not read or change the user's
profile. New tabs initially opened at the browser default size; actual viewport
dimensions were checked before the measurements. The 390 px observation is of
the first 720 px Image; the second Image's initial placement was not part of
that assertion. The fixture's `narrow` seed now explicitly uses the original
second-Image position (32,470), independent of a tab's initial viewport.

Captured results under `output/eight-browser-failures/`:

- `text-comparison.json`, `text-direct-no-lease.png`, `text-with-lease.png`
- `image-wide-probes.json`, `image-wide-current.png`
- `image-narrow-before.json`, `image-narrow-focused.json` and matching PNGs
- `library-wide-drop.json`, `library-wide-drop.png`
- `library-700-drop.json`, `library-700-result.png`

The initial diagnostic attempt substituted localhost HTTP media URLs; the asset
validator rejected them. That fixture setup error was corrected by using the
original accepted HTTPS review sources. It is not counted as an app regression.

No claim is made here about the remaining crop, flip, Visitor parity, simulated
save conflict, Display attach/detach, cancellation or full resize sequences in
those eight scripts. They require maintained fixtures/selectors and a complete
rerun before the original regression gap can be called closed. In particular,
keep the real editor-lease boundary in Text tests; changing production write
guards or merely extending timeouts would hide the problem in the test setup.

No full build was run: application production code was unchanged. The existing
tests and FX files were left intact. Own test tabs were closed and temporary
viewport overrides reset; neither application server was stopped.
