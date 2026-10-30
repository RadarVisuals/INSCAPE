# Reception / canvas / Display — preparation implemented

Date: 28 October 2026. Scope: the founder approved implementing the preparatory
separation proposed in the [dependency audit](../reception-canvas-display-boundaries/README.md).
This checkout remains local and uncommitted. No upload, wallet operation,
profile publication, deployment, commit or push was performed for this change.

## Responsibilities after the change

- `src/presentation/sceneSelection.js` owns one temporary selection by Grid ID,
  its available order and explicit select/next/previous/reset actions. It has no
  React, DOM, media, storage or wallet dependency.
- `sceneSession.js` scopes those controllers to one profile, canvas and snapshot.
  Different canvases can reuse `display:primary` without sharing selection.
  Reordering retains the selected ID; removal reconciles selection. Removing a
  module invalidates its old control callbacks, including after re-creation.
- Existing `systemWorkflowAuthoringSession` uses the same selection primitive.
  The authoring session still owns content commands and transaction/history rules.
  The owner React controller receives the presentation controller instead of
  keeping a second selection. Initial Grid entry is applied after commit; an
  unchanged entry target does not reset a returning Display view.
- `PublishedDisplayModule` no longer owns `activeIndex` as React state. It derives
  that index from the scoped selection. Its existing playback, media preparation,
  gestures, focus and inspection remain view responsibilities.
- `SceneNavigation` supplies logical selection and separately leases motion
  reports. An unmounted/hidden Display releases motion, not selected content.
  Only the current motion adapter can report; obsolete adapters cannot erase a
  newer report. Linked Text keeps its existing shared rendering and motion path.

The old `useReportScene` path and component-owned public selection are replaced,
not retained as alternative modes. The existing `sections` link still intentionally
follows Grid order. New experimental mappings use explicit IDs; this change does
not silently redefine authored section semantics.

## Sources, snapshots and presentation

`presentationSources.js` separates source resolution from opening a destination.
Source addresses include profile, canvas and module, with explicit Grid/side IDs
where appropriate. Camera-point IDs belong to destination resolution. A scene
binding maps stable scene IDs to source references. It carries no copied artwork
or prose and requires a matching profile/canvas/publication session.

`publishedPresentationSnapshot` is used by the existing public gallery. It receives
already-verified public bytes and has no local-store dependency. Resolution tests
build real scoped publications: a non-selected canvas retains its previous public
text; a private canvas is absent; another profile, missing Grid or missing camera
point is unavailable. No local fallback or automatic publication is introduced.

`profileDraftReader` now exposes all validated canvases as immutable entries in
addition to its existing active draft. It does not activate a canvas, acquire an
editor lease or expose mutation methods. A failed read retains explicitly stale
last-good entries; removal clears them. Local revision IDs identify both reader
instance and accepted refresh, so unrelated reads cannot accidentally match an
older session with a reused revision counter.

`workbenchOverviewModel` accepts explicit scene choices. The default thumbnail
still uses its cheap initial projection. A caller can project current Display and
linked Text content without mounting an editor. Existing static images/text stay
unchanged; invalid explicit Display scenes render an unavailable source.

## Gallery content and the bounded experiment

The existing card renderer is extracted into `WorkbenchOverviewCard`. Both the
existing wrapping/arrange gallery and `CanvasGallerySection` use it. The finite
section has no fixed page, own scroll container, wrapping normalization, editor
or page navigation. It observes visibility relative to the supplied parent scroll
root (or viewport). Existing wrapping, arrangement and page controls remain in
their own host.

`browser-tests/scene-boundaries-fixture.html` is a development-only entry:

- Two independent canvas sessions deliberately reuse the same Display ID.
- One scene drives an image side and the existing scene-linked Text renderer;
  the third cell is static. Shared Reception/Image and Article renderers paint it.
- Actual public Display controls and an independent controller can both select.
- Hiding/unmounting/remounting Display preserves selection and linked content.
- Missing sources show unavailable and recover when the reference returns.
- A finite gallery follows the cells in one document scroll, using the existing
  canvas modal and restoring trigger focus and scroll on close.
- React StrictMode is enabled. The fixture does not use canonical storage,
  an owner lease, live profile accounts, upload or wallet APIs.

This fixture is a boundary study, not the proposed final visual design. Its
controller diagnostics and narrow Display strip are test controls. Production
Reception still has its own authored layout and the existing public schema.

## Verification and small issues exposed

The evidence files beside this report record the final checks. The complete Node
suite passed 1,484 tests before final documentation; focused browser checks cover
existing owner/visitor linked Text, playback, overview, Reception reader boundaries
and the new desktop/narrow study. Final counts and source hashes are recorded in
`verification.json` after all checks finish. Screenshots are in `screenshots/`.

The broad checks found three maintenance issues: the new browser suite needed
catalog registration, a source-spelling assertion expected the removed local
`activeIndex` state, and the generated style inventory was stale. These are updated;
the state-spelling assertion is replaced by actual behavioral session/browser tests.
An older Stage-token assertion now reads the shared `workflowTokens.css` which
the production stylesheet already imports. No production token was changed for it.

The broad Reception test also exposed 36px About/navigation targets on a wide
touchscreen. The header now uses the existing 44px touch token for coarse pointers,
while retaining its bounded geometry and narrow layout.

Changed-file ESLint findings were compared with the existing reviewed ledger.
Three obsolete exceptions (entry effect and old scene reporting) are removed.
Eight existing observations in the owner controller/canvas and public Display are
re-reviewed with their current locations and source fingerprints. No new lint
exception is introduced. The retained playback facade methods read current refs;
depending on the new facade object per render would change cancellation lifetimes.
Owner entry hints are captured per authority; selection-scope dependencies
deliberately invalidate placement callbacks. See `lint.log` for the full gate.

## Limits and next product slice

This work prepares reuse; it does not ship a merged Reception/gallery page,
remove List, restore ordinary Display authoring, or introduce persistent links.
Canonical binding editing, schema/publication validation, undo/recovery and
deletion policy must be implemented together before links are saved or published.
Current Reception validation continues rejecting unsupported linked records.
The resolver tests cover the content available in assembled publications, not a
claim that the current publication schema already accepts Reception bindings.

No general module/plugin framework, new dependency, new animation engine or
performance claim was added. The populated fixture checks behavior, not production
memory/network throughput. Actual wallet signing and public read-back were not run.

Git evidence: local branch `codex/static-reception-bento-2026-10-26`, base HEAD
`4a0251647234c0757847078ec34f0865425f6857`, with pre-existing changes preserved.
PR #5 remains draft/open at `3cfd6cf5da12218938d7706268ebd10bed890966` on a different
branch. Its Netlify preview status is success; the returned PR-triggered Actions
run 40338966078 is cancelled. Neither is verification or deployment of this local
work. The API lists only the first page of PR-triggered runs.
