# Reception Library selected-image correction

28 October 2026. Local application work on
`codex/static-reception-bento-2026-10-26`, HEAD
`4a0251647234c0757847078ec34f0865425f6857`, with existing uncommitted work
preserved. No commit, push, deployment or publication performed by this agent.

## Reproduced fault

The real Reception editor fixture now has an optional `?image-choices` dataset
containing two images for the same ABYSSAL STUDY NFT. The new
`browser-tests/reception-library-selection.browser.mjs` regression first dragged
Image 2 into the receiving cell, then clicked the same thumbnail and chose
**Use selected image**.

Before the production fix, drag correctly placed `skull_reaper/full.webp` but
the action button placed `abyssal_eye/full.webp`. The regression failed at the
exact-media assertion. See [before](before-selected-variant.png).

Root cause: expanded images intentionally share their NFT's stable asset ID
for category membership. Drag and double-click supplied the chosen
`selectedMedia`; ordinary selection retained only the NFT ID. The action button
then looked up the raw NFT record and placed its default image, losing the
chosen variant. Several images of the same NFT also appeared selected together.

## Correction

LibraryWorkspace now retains a temporary image choice separately from NFT
selection: stable asset ID, owner context and the chosen URL/dimensions. The
action uses the current workspace asset projection with that explicit media.
It validates the choice against the current source's image groups. A vanished
or differently scoped choice disables placement instead of silently falling
back to another image. Clicking the cover explicitly clears the image choice.

Only the selected image row is highlighted. NFT category membership still
uses the existing stable asset IDs. Existing drag, receiver capture, generation
checks and asynchronous cancellation paths are unchanged. No authored format,
private preference format or extra saved Library record was introduced.

Production files:

- `src/public/ownerSystemWorkflow/OwnerSystemWorkflowLibraryWorkspace.jsx`
- `src/public/ownerSystemWorkflow/OwnerSystemWorkflowLibraryImages.jsx`
- `src/public/ownerSystemWorkflow/OwnerSystemWorkflowLibraryPresenter.jsx`

Regression/fixture files:

- `browser-tests/reception-library-selection.browser.mjs`
- `browser-tests/reception-editor-fixture.jsx` (optional image-choice dataset)
- `browser-tests/library-images.browser.mjs` (current navigation-host and
  actual artboard locators; no changed behavioral assertions)
- `browser-tests/reception-shared-controls.browser.mjs` (current shared Settings
  and independent Color tools replace obsolete separate tool names)
- `scripts/browserSuites.json` (registers `reception-library-selection` in the
  release group with its Vite host and origin requirement)

## Verification

Commands ran from the application checkout against local Vite port 5197, using
the installed browser selected by `scripts/browserEnvironment.mjs`.

The initial reproduction failed before the production fix:

```powershell
$env:INSCAPE_TEST_ROOT='http://127.0.0.1:5197'
node --import ./scripts/browserEnvironment.mjs --test browser-tests/reception-library-selection.browser.mjs
```

After correction, the focused test and Reception Library suite passed:

```powershell
$env:INSCAPE_TEST_ROOT='http://127.0.0.1:5197'
node --import ./scripts/browserEnvironment.mjs --test browser-tests/reception-library-selection.browser.mjs browser-tests/reception-shared-controls.browser.mjs
```

**16/16 passed**, zero failures/skips/cancellations, duration 32,958 ms. This is
1 new selection case plus 15 existing shared-controls cases. The new test proves
drag/click media equality, preserved source NFT identity, selected-row accuracy
and explicit reset to the cover image. Existing tests cover actual tool-edge
resize, outside-modal tools, window activation, persistence, repeated drops,
crop, undo, no implicit receiving cell and delayed-media cancellation.

Shared Library checks:

```powershell
$env:INSCAPE_SYSTEM_WORKFLOW_ROOT='http://127.0.0.1:5197'
node --import ./scripts/browserEnvironment.mjs --test browser-tests/library-drop-lifecycle.browser.mjs browser-tests/owner-library-resize.browser.mjs browser-tests/library-images.browser.mjs browser-tests/library-svg-attachments.browser.mjs
```

The lifecycle (23), resize (1) and SVG attachment (1) cases passed: **25/25**.
The image suite initially failed on stale test geometry: it searched for
PORTFOLIO inside Library although navigation has a separate host, then used the
outer canvas instead of the actual Display artboard for the drop. Those test
locators were corrected, and a pointer update after the existing Library fade
makes the target assertion deterministic. No placement assertions were removed.

```powershell
$env:INSCAPE_SYSTEM_WORKFLOW_ROOT='http://127.0.0.1:5197'
node --import ./scripts/browserEnvironment.mjs --test browser-tests/library-images.browser.mjs
```

**1/1 passed**, duration 12,624 ms, exercising expanded images through category
filing, drag, double-click, keyboard placement, metadata refresh, reload and
public Preview at desktop and narrow widths.

Total: **42 distinct passing browser cases** across the six named files. The
focused reproducer's individual reruns are not counted twice. Scoped
`git diff --check` passed. Full build and repository-wide checks remain owned
by the lead agent.

The suite catalog check (`npm run test:browser:catalog`) passed with 241 suites,
including 104 release, 134 targeted and 3 performance suites. After the lead's
Settings/Color integration, a concurrent browser run timed out under load and
was cancelled. The new selection regression was then run separately with
`--test-concurrency=1 --test-reporter=tap`: **1/1 passed**, duration 2,372 ms.
The shared-controls rerun then identified obsolete Cell appearance and Grid
settings labels. Its tool locators were updated to the final Settings/Color
model; the existing movement, activation, bounds, persistence, placement and
cancellation assertions remain. The standalone Appearance window is now part
of Settings. The final sequential command passed **15/15**, duration 28,209 ms:

```powershell
$env:INSCAPE_TEST_ROOT='http://127.0.0.1:5197'
node --import ./scripts/browserEnvironment.mjs --test --test-concurrency=1 --test-reporter=tap browser-tests/reception-library-selection.browser.mjs
node --import ./scripts/browserEnvironment.mjs --test --test-concurrency=1 --test-reporter=tap browser-tests/reception-shared-controls.browser.mjs
```

These 16 rerun cases replace the earlier results in the 42-case total rather
than being added again. The after screenshot was refreshed on this final code.

[After correction, 1920 × 1080](after-selected-variant.png). Both before and
after captures use the actual Reception editor, Library and source-media path.
This is Chromium fixture evidence, not a claim of physical Safari verification,
deployment, signed publication or live wallet activity.
