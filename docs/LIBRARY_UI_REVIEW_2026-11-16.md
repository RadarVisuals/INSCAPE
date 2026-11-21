# Library UI review — 16 November 2026

Local working-tree change; not committed, pushed or deployed. Existing unrelated edits and authored compositions were preserved.

## Result

- Explicit, profile-local Icons / Names navigation in View; width changes do not select a different mode.
- In Icons, Folders opens thumbnail folder cards in the existing content area. Opening a folder shows its contents and parent breadcrumbs. The rejected full-height overlay is removed.
- During pointer-captured artwork dragging only, hovering Folders opens the named destination tree in a content-sized picker, capped at 300px and contained in the Library. Drop/cancellation closes it without changing the current browsing view.
- Fixed square artwork slots controlled by Size; resizing changes columns. Covers and expanded images share containment and geometry. Number-only NFT badges and original-media placement remain.
- Search, then New / Filters / Sort / View. New creates Folder or Section; sections are quiet headings with scoped add-folder controls. Compact-mode creation/rename stays in content, with focus recovery when its former trigger disappears.
- One shared window-options menu replaces the two docking arrows and duplicate floating Library dock icon. Grouped Library tab retains Detach.
- Removed custom hover-label overlays; native rail titles are suppressed during filing.

## Ownership and cleanup

The existing Library preference owner persists navigation style. Existing category commands and atomic storage own folder membership, section changes and image selections. Presenter owns only transient browsing/creation UI; the drag coordinator exposes an explicit hover/finish target for captured pointer drags. The shared tool shell owns window placement.

Removed the custom hover-label state/handlers/markup/styles, old Library create rows, redundant rail layouts, duplicate docking controls/styles, two unused Reception picker create-row rules, cover aspect-ratio bookkeeping and full-height flyout positioning. Lowered default sidebar-button specificity so component section headers own their borders. No compensating important rules or new dependency.

Names retains the tree because it is an explicitly requested alternative. The same tree renders as a temporary filing destination; the same section header renders in both tree and folder overview. Non-editor pickers retain their existing shared footer rail. No second folder store, metadata schema or placement pipeline was added.

Exact round delta against the captured pre-round files, excluding earlier working-tree changes:

| Area | Added lines | Removed lines |
| --- | ---: | ---: |
| Production | 288 | 218 |
| Tests | 229 | 42 |
| Active contract | 33 | 9 |

This report is additional documentation. Generated token inventory is separate: 699 definitions / 394 names across 102 files, down from 714 / 405. Growth adds the explicit preference, compact creation/browsing controls and captured-drag destination handling while reusing existing commands and persistence.

## Verification

- Full unit suite: 1,918/1,918 passed with test concurrency 1. An initial run alongside several browser/build jobs exhausted memory; a Windows process-identity timing check also failed then. The serial rerun passed without changing those tests or production logic.
- Library divider/compact tests: 4 passed in dark/light; fixed squares, named-width retention, narrow resize, non-overlapping folder browsing, bounded drag picker, filing, compact creation/rename, docking and preference reload. Final 2-case focus rerun passed.
- Library organization and progressive-media tests: 5 passed, including production-store filing/reload, per-image expansion/placement, full original resolution and retained authored geometry.
- Shared docking tests: 8 passed across left/right docks, wide/narrow desktop windows and hidden/restored columns.
- Focus/preferences/loading checks: 26 matching cases passed (runner reports 27 including a file with no matched cases). Cover newer-focus protection, storage-failure recovery, departure flush, controls reachable through View, search geometry, per-image filing/removal. Separate Library storage failure/retry/external-overwrite test passed.
- Lint passed: 587 source files; 46 existing recorded hook observations unchanged. Type contracts passed, including 40 invalid-call and 9 production-mutation checks.
- Production build and explicit build budget check passed; initial JavaScript 727,217 bytes. Existing dependency annotation/chunk-size notices remain; budgets were not raised.
- Reviewed dark/light screenshots from browser tests and refreshed the user's visible preview in compact Folders mode. Local preview: http://127.0.0.1:5173/browser-tests/library-images-fixture.html . No personal draft was reset.

## Remaining limits

Three older owner-library-resize browser cases still fail at retired entry points: one requests a standalone Library button, two search for Detach inside Library content rather than its shared window header. Their unchanged setup predates this round. Current shared docking/divider tests above pass; this is not a claim that the entire browser catalogue passes. Other historical aesthetic suites were not rerun or broadly rewritten.

Library membership in the review-image fixture is session-only; persistence evidence uses the production Library-store fixture. Personal saved-draft validation is outside this UI change. Following the server follow-up, the local Vite helper watches application source/public files and entry configuration while excluding the surrounding generated/workspace directories. The temporary no-watch override was removed. The server responds on port 5173, and the actual Reception toolbar opens the updated Library. The duplicate Library tab beside Layers remains a separate panel-integration issue. Source/output changes remain local.
