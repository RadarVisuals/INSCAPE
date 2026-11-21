# Library panel integration — 16 November 2026

Library now belongs to the shared Layers / Library / Inspector docking layout. Detaching removes its source tab. The toolbar and editor commands open and focus the retained Library in its saved location, reveal a collapsed sidebar, and select its tab without moving or closing it. Library can join either peer, stack above or below it, or float independently.

## Ownership and removals

The previous Library had separate overlay presence, detached-window preferences, an injected Layers tab, and a separate window wrapper. These duplicated placement/visibility responsibilities. WorkbenchToolDocks now owns its host and stable portal container; the existing Library workspace continues to own browsing and asset interactions.

Removed WorkbenchLibraryWindow.jsx, its special CSS hosts, ghost tab/action plumbing, libraryWindow preference writes, Library overlay presence, toggle-based entry points and the separate presentation variant. Retained target-specific image pickers reuse the same finished Library presentation and keep their explicit selection action; they are scoped receivers, not another persistent editor Library.

The founder's currently saved two-panel layout plus independent Library frame is consumed once into the shared layout, preserving current placement and side-dock order. New saves have one owner. The speculative older seven-tool conversion was removed. No new dependencies or authored-content migrations were added.

Browsing selection, search, image expansion and scroll survive host movement and closing. Scroll snapshots are captured only on actual host removal, movement or hiding, not every render. Explicit repeated-open requests retain keyboard focus behavior; transient focus requests are not persisted. Hidden or closed Library content still invalidates obsolete placement requests.

## Verification

- Full unit suite, run serially: 1,918 passed, 0 failed.
- Library host/group/dock/reload checks: 2 passed, dark 1440px and light 800px.
- Window resize, scroll retention, detach, cancel and completed canvas drop: 3 passed.
- Library divider and compact folder navigation: 4 passed.
- NFT image expansion, filing, placement and preview-to-original geometry: 2 passed.
- Filter keyboard/focus recovery: 2 passed.
- Side docking: 8 passed; shared tool docking: all 7 passed across the initial run and focused rerun after updating an obsolete layer-toolbar position assertion.
- Image replacement picker: 2 passed, including failed-save recovery, Undo and cancellation of delayed replacement. Updated the test to close Library explicitly; the toolbar now focuses instead of toggling closed.
- Lint and strict contract/type checks passed. Design inventory regenerated and checked through the unit suite.
- Production build and build:check passed. Initial JavaScript: 727,217 bytes; existing budgets were not changed. Vite still reports its existing large-chunk advisory.
- Visually inspected stacked Library in wide dark and narrow light layouts. Also checked the user's actual Reception editor: toolbar opens the approved Library at its saved position, Layers has no ghost Library tab, and repeated toolbar activation focuses the same panel.

## Remaining test limitation

The separate library-drop-lifecycle suite has 15 passing and 8 failing cases. All eight failures were reproduced while serving the exact pre-change LibraryWorkspace source from a temporary isolated baseline server (2 general delayed-dimension cases, then 6 delayed-drop cases). Its fixture injects resolveAssetDimensions as an artificial placement delay, but the existing implementation uses it to preload originals and independently decodes placement dimensions; the fixture therefore does not hold the asynchronous boundary it claims to test. The module/shortcut fixture also calls immediately under the existing receiver contract. This task does not change that media/receiver implementation or weaken those assertions. Their async fixture needs a separate correction. A complete release-browser run was not performed.

## Scope and status

Task-only differences, measured against snapshots taken before this edit (not against the repository's many unrelated local changes): production +164 / -246 lines; tests, fixtures and catalog +375 / -334; generated token inventory +2 / -3. Active-contract decision: +28 / -5 lines. This report is an additional documentation file.

The changes are saved locally on codex/profile-work-index-2026-10-30. Nothing was committed, pushed or deployed. Existing unrelated edits and authored compositions were preserved. Inscape was restarted and verified at http://127.0.0.1:5173/; only the temporary baseline server was stopped after comparison.
