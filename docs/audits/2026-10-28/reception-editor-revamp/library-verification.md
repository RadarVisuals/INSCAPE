# Floating Reception Library verification — 28 October 2026

Local application verification, performed against the existing Vite server at
`http://127.0.0.1:5197`, using the installed Chromium selected by
`scripts/browserEnvironment.mjs`. No commit, push, deployment or profile
publication was performed by the Library implementation agent.

## Implementation and resolved integration findings

Reception now hosts the existing LibraryWorkspace in the shared ToolPanel:
modeless, movable, resizable on eight edges, with keyboard equivalents and
private frame persistence in `receptionFrames.library`. Its initial frame is
bounded within the Reception workspace. The shared Library still owns asset
browsing, drag threshold, cancellation and asynchronous destination capture.

Repeated drops retain the Library and select/crop the receiving cell. Undo and
cell selection also retain the window. The complete floating tool fades during
an artwork drag so cells underneath it remain reachable. This does not change
Workbench placement behavior or introduce another authored-content store.

The first browser run found that the editor's outside-click deselection
excluded only the inner Library. Clicking its new titlebar, resize handle or
close button cleared the selected cell. The editor now excludes shared tool
panels, preserving the target during these window interactions.

Subsequent review found that a modeless Library could receive the first cell
as a fallback after explicit deselection. The editor now passes the actual
selection. The selection action is disabled unless that cell exists, and the
shared click/double-click placement path returns before decoding when no
explicit receiver exists. Dragging still resolves a receiving cell at release.
The repeat-placement test verifies that double-clicking an asset without a
selected cell does not change the draft.

Responsive checks also found clipped category-creation labels. The floating
Library stacks its Category and Section actions, and narrow windows show their
icons without clipped text. These rules are scoped to the floating picker.

## Completed checks

Commands below ran from the application checkout. Results are recorded from
completed runs, not inferred from earlier logs. These are 36 distinct browser
cases; the final screenshot-only repeat is already included in that count.

```powershell
$env:INSCAPE_TEST_ROOT='http://127.0.0.1:5197'
node --import ./scripts/browserEnvironment.mjs --test browser-tests/reception-shared-controls.browser.mjs
```

**12 tests passed; 0 failed, skipped or cancelled.** Final complete run duration:
31,289 ms. Coverage: Grid settings window movement/resizing/reopening at 1440,
390 and 320 pixels; Library drop, cancellation and under-window destination;
floating window movement, keyboard resize, Escape rollback and persisted
reopening; repeated placements with automatic crop and no implicit selection;
delayed image acceptance versus close and draft-generation changes.

```powershell
$env:INSCAPE_SYSTEM_WORKFLOW_ROOT='http://127.0.0.1:5197'
node --import ./scripts/browserEnvironment.mjs --test browser-tests/library-drop-lifecycle.browser.mjs browser-tests/owner-library-resize.browser.mjs
```

**24 tests passed; 0 failed, skipped or cancelled.** Final complete run duration:
34,028 ms. Exact files: `library-drop-lifecycle.browser.mjs` (23 cases) and
`owner-library-resize.browser.mjs` (1 case). Coverage includes Workbench Library
projection, destination retention during decode, category drop cancellation,
blur/visibility/capture/navigation/unmount changes, delayed receiving-module
changes, ordinary click behavior and the existing Workbench resize flow.

After the final full run, the screenshot readiness step was tightened to await
the first two decoded thumbnails, since the first image's settled aspect ratio
can reveal the second image. The two affected cases were rerun:

```powershell
$env:INSCAPE_TEST_ROOT='http://127.0.0.1:5197'
node --import ./scripts/browserEnvironment.mjs --test --test-name-pattern='Library stays' browser-tests/reception-shared-controls.browser.mjs
```

**2 tests passed; 0 failed, skipped or cancelled**, duration 5,480 ms. No production
code changed for this screenshot readiness adjustment. Scoped `git diff --check`
also passed during implementation.

## Inspected screenshots

- [Desktop Library, 1920 × 1080](screenshots/library-1920x1080.png).
- [Narrow Library, 390 × 1000](screenshots/library-390x1000.png).

The screenshots show loaded artwork, the floating window with reachable title
and close controls, and the grid still visible behind it. Original captures and
additional drag/repeat-placement evidence are in
`.browser-test-runtime/reception-shared/`.

Limits: Chromium local fixtures were exercised. This is not evidence of physical
Safari testing, a production deployment or signed publication. Root verification
owns the complete build, lint, unit suite and other Reception boundaries.
