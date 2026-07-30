# INSCAPE Alpha Execution Roadmap

## Purpose

This is the operational source of truth for moving INSCAPE from the frozen lattice prototype to the production Alpha.

It answers four questions without requiring earlier chat context:

1. Where are we now?
2. What is the next approved unit of work?
3. What must be verified before continuing?
4. Which decisions and runtime boundaries may not be changed accidentally?

Detailed product and implementation contracts remain in the canonical documents linked below. This roadmap tracks execution; it does not replace those specifications.

## Safe repository

- Work only in `E:\VSCODE\INSCAPE`.
- Active branch: `ui/creations-browser`.
- Do not work from or repair the former F: checkout as part of product development.
- Never introduce invented identity, NFT, profile, or marketplace data into production behavior.

## Canonical sources, in order

1. `docs/INSCAPE_VISION_AND_ART_DIRECTION.md` — product identity, experience, visual language, Alpha scope.
2. `docs/INSCAPE_CANVAS_LATTICE.md` — permanent 3 × 3 table topology and movement/presentation contract.
3. `docs/art-direction/INSCAPE_FINAL_UI_MIGRATION_HANDOFF.md` — detailed final UI and migration specification.
4. `docs/art-direction/INSCAPE_UI_NOTES.md` — active visual nitpicks and acceptance notes.
5. This roadmap — current status, gates, next action, and checkpoint history.

If these sources appear to conflict, stop and report the exact conflict before changing code.

Approved production-integration inventory:

- `docs/art-direction/INSCAPE_PRODUCTION_INTEGRATION_INVENTORY.md` — audited production boundaries, exact legacy mapping, canonical authority rules, cutover, rollback, and manual-test plan.

## Status legend

- `[x]` complete, verified, committed, and pushed
- `[~]` implemented or partially verified, but not yet accepted as production-complete
- `[ ]` not started
- `[!]` blocked or requires an explicit decision

## Current checkpoint

Last verified sequence at the time this roadmap was created:

- `350995f` — frozen lattice UI prototype
- `d4bfdbb` — canonical nine-table Alpha direction
- `17790fd` — retired standalone scramble prototype
- `ed67634` — decomposed the frozen lattice prototype
- `ff64ccd` — resolved transparent artwork inspection
- `c034935` — prevented transparent Keeper canvas haze
- `0787912` — added the Alpha execution roadmap

The working tree was clean when this roadmap was created.

## Where we are now

### Product/design track

- [x] Permanent 3 × 3 lattice direction locked.
- [x] Center table is the session entry point; there is no persisted active-table position.
- [x] Owner/visitor boundaries defined.
- [x] Workspace Rail, toolbar, Browser, palette, identity dossier, Keeper dock, table controls, frame/mat behavior, and NFT focus-viewer direction prototyped and visually accepted.
- [x] Prototype design through canonical Phase 6 frozen.
- [x] Browser combines INDEX and CATEGORIES in one isolated workspace.
- [x] Frozen lattice prototype decomposed into focused modules without changing its behavior.

### Production track

- [x] Phase 4 owner navigation and fixed chrome are integrated and visually accepted behind the verified owner gate.
- [ ] The frozen lattice UI is not yet the published visitor renderer.
- [x] Version 8 defines the canonical nine-table profile-document model; publication remains disabled and version 7 remains the default.
- [x] Production INDEX/CATEGORIES stores are wired read-only to the isolated Browser; canonical authoring remains separately bounded by the current Phase 5B capability.
- [x] Phase 4 fixed chrome is integrated and visually accepted; the production NFT viewer and identity dossier remain later-phase work.
- [ ] Legacy Home/Gallery/Upper/five-table behavior remains compatibility data, not the Alpha destination.

Phase 1 and Phase 2A–2C are complete and approved. The Phase 3 renderer-only checkpoint is accepted and remains `[~]` until later cross-surface integration. Phase 4 is implemented, verified, and visually accepted as `[x]`; Phase 5 is `[~]` after accepted Phase 5A, Phase 5B.1, Phase 5B.2, Phase 5B.3, and Phase 5B.4, with Phase 5B.5 implemented and automatically verified as `[~]` pending visual acceptance while Phase 5B.6 onward remains unstarted.

### Locked production-integration constraints

- The 32 × 18 lattice is the authored coordinate plane, not the browser or iframe viewport. Cells remain square.
- Arbitrary viewports uniformly scale the complete authored composition without stretching, cropping the authored plane, reflowing, or changing cell geometry or its derived normalized placement data.
- Additional visible grid is seamless atmosphere; the authored boundary is normally invisible.
- Version 8 has exactly one canonical lattice source of truth. Retained version-7-shaped fields are compatibility fallback only and never overwrite, merge into, or silently regenerate canonical lattice data.
- Once canonical lattice persistence is enabled, it is authoritative for lattice state. Legacy state remains readable only for compatibility, rollback, and later owner-guided import.
- Private projection preserves all nine permanent table slots while redacting private titles, subtitles, label configuration, placements, and inactive private identity overlay values.
- Owner Preview uses the exact same public projection as visitor rendering.
- Categories remain organizational/publication structures and are not tables.
- Missing identity, NFT, activity, marketplace, count, link, and presence data remains honestly unresolved. Alpha uses `LAST PUBLISHED`, never `LAST ONLINE`.
- Gallery and five-table import is a later explicit owner-guided workflow. There is no automatic coordinate conversion.

## Mandatory execution protocol for every slice

### Before coding

The implementing Codex window must state:

- the exact visual and behavioral outcome;
- files and runtime boundaries likely to change;
- data/schema/storage/publication implications;
- what explicitly remains untouched;
- the manual visual test the user will perform;
- whether the slice is reversible or requires migration compatibility.

Do not begin until the user approves that boundary.

### During coding

- Keep the implementation smaller than the behavior it replaces.
- Reuse the decomposed lattice modules; do not add new feature logic back into `LatticeEnginePrototype.jsx`.
- If repeated iterations are making the code disproportionately complex, stop and report it.
- Always consider and explain the simpler architecture before adding another workaround.
- Preserve owner/visitor isolation, profile scoping, autosave, publication, IPFS, wallet, and iframe behavior.
- Do not alter storage keys or published schemas silently.

### After coding

The implementing window must report:

- files changed;
- behavior changed and deliberately retained;
- whether the user can test it now;
- an exact short visual test;
- automated checks run and their results;
- migration or compatibility risks;
- whether anything remains uncommitted.

The user performs the visual acceptance test. Commit and push only after approval unless the user explicitly authorizes otherwise.

## Execution phases

## Phase 0 — freeze, canonicalization, and audit

Status: `[x]`

Completed:

- canonical direction documents;
- frozen visual prototype;
- obsolete standalone scramble study removed;
- lattice prototype decomposed in four behavior-preserving passes;
- clean E: recovery checkout established.

Exit criterion: frozen reference is reproducible, documented, decomposed enough for integration, and safely pushed. Met.

## Phase 1 — production integration inventory and boundary

Status: `[x]`

Goal: produce the exact adapter and migration map before production behavior changes.

Required inventory:

- canonical lattice domain modules and renderer modules;
- current owner workspace entry points;
- current published visitor entry points;
- profile-document owner draft, public projection, validation, and versioning;
- workspace autosave and profile-scoped local storage;
- wallet publication and IPFS publication flow;
- INDEX/CATEGORIES stores and asset identity rules;
- NFT focus viewer data contract;
- identity metadata and INSCAPE overlay contract;
- legacy Home/Gallery/Upper/five-table compatibility data;
- iframe/direct-visit behavior.

Required output:

- a slice-by-slice production integration plan;
- exact old-to-new schema mapping;
- explicit feature-flag or parallel-runtime cutover boundary;
- rollback path;
- no visual or runtime mutation yet unless separately approved.

Completed:

- audited owner and published visitor entry points;
- audited owner/visitor isolation, profile scoping, autosave, storage, reconciliation, wallet, IPFS, direct-visit, and iframe behavior;
- audited canonical lattice modules and prototype-only state boundaries;
- recorded the exact legacy-to-canonical mapping, owner-draft/public-projection split, parallel cutover, rollback rules, and eventual manual tests in `INSCAPE_PRODUCTION_INTEGRATION_INVENTORY.md`;
- confirmed that the first safe production slice is a pure domain adapter with no runtime, schema-version, storage-version, publication-version, or feature-flag mutation.

User visual test: none. This phase is an architecture/document review.

Exit criterion: the user can read one plan and understand precisely what gets wired first, what remains live, and how old documents stay readable. Met and approved.

## Phase 2 — canonical production lattice schema

Status: `[x]` — **complete; Phase 2A–2C are accepted**

Goal: introduce the nine-table production domain without replacing the current UI yet.

Required behavior:

- permanent row-major 3 × 3 topology;
- center session entry;
- table visibility, labels, geometry, placements, layers, navigation order, crop, mat/frame, transparency, and identity presentation validated strictly;
- owner draft retains private authoring data;
- public projection redacts private tables and inactive overlay values;
- no persisted active table;
- deterministic owner and visitor projection.

Compatibility:

- current documents remain readable;
- legacy five-table/Home/Gallery/Upper data is preserved through an explicit compatibility adapter or migration;
- publication version changes only with tests and a documented rollout.

User visual test: none until a dev-only projection harness is deliberately exposed.

Exit criterion: schema, projection, validation, migration, and storage tests pass without changing the visible production workspace.

### Phase 2A — pure canonical schemas and public-projection adapter

Status: `[x]` — **approved and production-complete**

Exact boundary:

- [x] add isolated production owner-draft and published-lattice domain modules plus tests;
- [x] expected modules are `src/lattice/domain/latticeProductionDraft.js`, `src/lattice/domain/latticeProductionPublication.js`, and `src/lattice/domain/latticeProductionAdapter.js`, with colocated tests;
- [x] define the permanent row-major 3 × 3 topology and fixed 32 × 18 square-cell authored plane;
- [x] persist placement geometry conceptually as integer `column`, `row`, `columnSpan`, and `rowSpan` values;
- [x] define deterministic layers, navigation order, crop, frame/mat/backing, transparency, visibility, label, appearance, and identity-overlay validation;
- [x] project real production stable asset records into validated public asset references;
- [x] preserve nine-table topology while redacting private table and placement content and inactive private identity values;
- [x] make the projection pure so Owner Preview and visitor rendering can later consume the exact same value.

Completion checkpoint (2026-07-29): owner-approved; focused Phase 2A tests pass (10/10), the full regression suite passes (656/656), and the production build and budgets pass. No runtime imports or visible behavior changed.

Explicitly excluded:

- runtime imports or visible UI;
- `LatticeEnginePrototype.jsx` behavior changes;
- production store or autosave wiring;
- storage keys or workspace versions;
- profile-document or publication versions;
- wallet, IPFS, route, iframe, or feature-flag changes;
- automatic Gallery or five-table conversion.

Rollback: remove the new unreferenced domain modules and tests. No stored or published data exists.

User visual test: none. This is a pure domain and automated-verification slice.

Exit criterion: the user approves the exact schemas and projection behavior, targeted and full relevant tests pass, the production build passes, and no runtime behavior changes.

### Phase 2B — profile-scoped canonical lattice persistence

Status: `[x]` — **approved and production-complete**

Exact boundary:

- [x] add one isolated injected-storage canonical lattice draft store plus colocated focused tests;
- [x] use `inscape.lattice-production-draft.v1:<canonical-lowercase-profile-address>` without reading or writing Library workspace v8 or any legacy source;
- [x] use the approved Phase 2A owner-draft schema and validator, persisting only complete validated canonical drafts;
- [x] autosave immediately only through explicitly committed completed authoring operations, never pointer-move previews or transient interaction state;
- [x] validate and serialize the candidate, complete the storage write, and only then replace the last accepted in-memory draft;
- [x] enforce canonical profile-address scoping, reject late cross-profile commits, and keep profile drafts deterministically isolated;
- [x] recover absent, corrupt, unsupported-version, and wrong-profile records to an unwritten empty canonical draft without legacy migration;
- [x] return deeply immutable detached snapshots so caller-held references cannot mutate accepted state;
- [x] keep the store outside React, Zustand, owner runtime, visitor runtime, publication, reconciliation, routes, feature flags, and the production import graph.

Completion checkpoint (2026-07-29): owner-approved; focused Phase 2B and Phase 2A draft-validation tests pass (11/11), the full regression suite passes (663/663), and the production build and budgets pass. No runtime imports or visible behavior changed.

Explicitly excluded:

- runtime integration, React hooks, Zustand state, debounce timers, or a development harness;
- Library workspace v8, legacy Home/Gallery/Upper/canvas-object/five-table reads, writes, reinterpretation, import, or coordinate conversion;
- profile-document or publication versions, public projection, reconciliation, wallet, IPFS, routes, iframes, feature flags, owner/visitor UI, or the frozen prototype;
- Phase 2C, Phase 3, or later work.

Rollback: stop reading or instantiating the isolated key. Legacy records remain intact and no canonical lattice store module is currently imported by a production runtime.

User visual test: none. This slice has no runtime consumer or approved development harness.

Exit criterion: the user approves the storage key, authority, validation, transactional completed-operation persistence, corruption recovery, immutable snapshots, profile isolation, and verification results. Met and approved.

### Phase 2C — version 8 reader, builder, validation, and reconciliation

Status: `[x]` — **approved and production-complete**

Exact boundary:

- [x] add version 8 profile-document reading, building, validation, fingerprinting, and owner reconciliation while version 7 remains the publication default;
- [x] make the validated version 8 `lattice` field the sole canonical lattice source whenever lattice rendering is selected;
- [x] keep any retained version-7-shaped presentation, spaces, and canvas-object fields as compatibility fallback only, never lattice inputs or a second writable authority;
- [x] keep versions 1 through 7 readable as legacy documents without automatic migration into nine-table documents;
- [x] provide the exact pure public lattice projection shared by future Owner Preview and visitor rendering without cutting over either renderer in this phase;
- [x] extend owner reconciliation through profile-scoped validated writes plus reverse-order compensation, with the required baseline save after the canonical lattice commit;
- [x] classify the pre-reconciliation lattice record as absent, valid, or corrupt; block corrupt records before writes and restore only an issued absence marker or validated prior canonical draft;
- [x] retain accepted published placement IDs and deterministically remap colliding preserved private IDs across all nine tables with a bounded suffix search;
- [x] reject version 8 before every production writer boundary, including client upload, server-side Pinata upload, publication artifact creation, wallet publication, and local publication snapshots;
- [x] keep version 8 publication disabled and preserve the existing version 7 wallet, IPFS, canonical verification, and read-back sequence unchanged.

Explicitly excluded:

- enabling version 8 publication or changing the version 7 publication default;
- automatic Home, Gallery, Upper, canvas-object, or five-table import, reinterpretation, merging, or coordinate conversion;
- production owner or visitor renderer cutover, routes, iframes, feature flags, wallet behavior, IPFS behavior, or the frozen prototype;
- Phase 3 or later work.

Rollback: keep the version 8 reader but return snapshot building to version 7. Version 8 publication remains disabled.

User visual test: none unless a deliberately approved development harness is added.

Verification: focused version 8 reader, builder, validation, projection, reconciliation, compatibility, and rollback tests; the full relevant regression suite; the production build and budgets; and confirmation that visitor isolation and the runtime import graph remain unchanged.

Acceptance checkpoint (2026-07-29): owner-approved; the full suite passes 690 tests with 0 failures, and the production build, revised approved budgets, owner/runtime isolation, and `git diff --check` pass. Final measured totals are initial JavaScript 1,238,725 raw / 361,534 gzip; owner JavaScript 210,053 raw / 68,281 gzip; standalone wallet JavaScript 3,943,723 raw / 1,042,223 gzip; initial CSS 113,254 raw / 19,913 gzip; owner CSS 16,887 raw / 4,790 gzip; core JavaScript 1,829,400 raw / 544,982 gzip; public assets 14,821,539 raw; and largest public asset 2,574,306 raw. No visual test applies because this phase does not cut over a renderer or add a development harness.

Exit criterion: the user approves the exact version 8 read/build/validation/reconciliation boundary, focused and regression tests pass, the production build and budgets pass, versions 1 through 7 remain readable, version 7 remains the publication default, and no visible production runtime changes. Met and approved.

## Phase 3 — shared production table renderer

Status: `[~]` — **renderer-only sub-slice accepted; production cutover remains incomplete**

Goal: render one canonical table identically for owner preview, visitor view, direct visits, and iframes.

Required behavior:

- one fixed 32 × 18 authored coordinate plane projected uniformly and independently of viewport size;
- square authored cells without allowing browser or iframe aspect ratios to dictate the product model;
- continuous surrounding grid atmosphere;
- deterministic projection on resize;
- no stretching, reflow, or mutation of authored placement data;
- a normally invisible authored boundary inside a seamless surrounding grid;
- native/cropped media ratios and transparency remain correct;
- no owner controls in visitor runtime.

Renderer-only sub-slice checklist:

- [x] add one presentation-only renderer that accepts a validated canonical public lattice and table ID;
- [x] project the fixed 32 × 18 plane, placements, navigation order, crop, mat, backing, transparency, labels, and resize behavior without mutating authored data;
- [x] preserve `frameId` semantically while rendering only contract-supported geometry, with no invented frame metadata or richer content relationship;
- [x] add a fail-closed production media adapter for validated public HTTPS/IPFS references and honest unavailable/unsupported states;
- [x] keep the renderer's transitive import graph free of owner stores, persistence, reconciliation, wallets/providers, publication writers, authoring callbacks, and prototype fixtures;
- [x] keep one removable browser-test-only comparison fixture that mounts the exact same canonical public-table value directly and in 640 × 360 and 390 × 600 iframes;
- [ ] connect the renderer to Owner Preview, visitor deployment, direct visits, or production iframe surfaces only in a later separately approved slice.

User visual test:

1. Run `npm run visual:phase3` from the repository root.
2. Review `http://127.0.0.1:4173/browser-tests/lattice-production-table-fixture.html` in the visible browser window, including the direct surface and both differently sized iframes.
3. Press `Ctrl+C` in the launching terminal to stop the browser and local fixture server. The automated contract comparison remains `npm run test:browser:phase3`.

Implementation checkpoint (2026-07-29, renderer-only sub-slice accepted): the focused renderer/media/projection/fixture/import-isolation set passes 11 tests; the dedicated browser comparison passes 1 test, including ready/loading/failure states, native and cropped media geometry, mat/backing/transparency behavior, a bounded deterministic alpha sample, labels, order, grid alignment, immutability, and storage isolation; the full regression suite passes 701 tests with 0 failures; the production build, production budgets (1,238,725 initial JavaScript bytes), owner-runtime isolation (4 tests), and `git diff --check` pass. The optional visible browser-test-only review uses the same canonical value and mocked media at a fixed loopback URL. The pre-existing published-visitor browser suite remains blocked before its assertions by the checkpoint's stale `.published-home-world__header` selector, which is absent from the production source; the Phase 3 slice does not modify that suite. No production route or renderer consumer was added, and version 7 publication remains the default while version 8 publication remains disabled.

Exit criterion: the same public table renders deterministically across owner preview, visitor, direct, and iframe surfaces.

## Phase 4 — owner lattice navigation and fixed chrome

Status: `[x]` — **implemented, verified, and visually accepted**

Goal: make the nine-table lattice the production owner workspace behind a controlled cutover.

Includes:

- [x] table swipe/drag/chevron navigation with snap-to-position arrival;
- [x] Profile Rail and workspace toolbar;
- [x] lattice minimap and directional controls;
- [x] Keeper dock behavior;
- [x] palette/menu-surface coordination;
- [x] table identity and INSCAPE signature;
- [x] no camera-motion illusion when the table should move.

User visual test:

1. Enter the verified owner route and confirm the session starts at center `table-05`.
2. Navigate all nine tables using drag, wheel/trackpad, keyboard arrows, chevrons, and direct minimap-cell activation.
3. Confirm drag, wheel/trackpad, arrows, and chevrons move no more than one neighboring coordinate, while one minimap activation snaps directly to its exact selected table without intermediate arrivals.
4. Confirm a small click does not navigate and an invalid edge gesture resists and returns to the same table.
5. Confirm every successful arrival locks to the same deterministic position.
6. Confirm Profile Rail, toolbar, minimap, directional controls, Keeper, Theme/menu surfaces, current table identity, and INSCAPE signature remain fixed while the lattice moves beneath them.
7. Change the session Theme, reload, and confirm Theme and active-table state reset to carbon and `table-05`.
8. Change the normalized owner/viewed profile under the existing authority inputs and confirm the new profile starts at carbon `table-05` with no open menu or retained drag/settling state.
9. Confirm disabled future controls are identified as unavailable and perform no action.
10. To test rollback, change `src/public/ownerRuntimeSelected.js` from `LATTICE` / `./OwnerLatticeShell.jsx` to `LEGACY` / `./ModuleGridShell.jsx`, rebuild, and repeat the owner authority/profile checks in a separate rebuilt session; there is no user-facing runtime switch.

Accepted checkpoint (2026-07-29): interactive visual review accepted. The expected Startveil/application entry followed by My INSCAPE remains the current checkpoint behavior; default-application cutover is later work and is not a Phase 4 defect. The selected `LATTICE` runtime is a separate lazy owner chunk behind the unchanged verified authority decision. A hook-free validating shell gates the hooked runtime, and a normalized profile key remounts that subtree on same-authority profile changes, resetting active table, drag, settling, menus, and session Theme. The runtime constructs a detached empty value through the Phase 2A draft/projection/full-publication validator path and performs no Phase 2B storage, reconciliation, publication, visitor-route, wallet, IPFS, schema, or migration operation. The strengthened real-App browser check covers direct minimap navigation, activated and sub-commit pointer drags, resisted invalid-edge movement, accumulated wheel input and cooldown suppression, fixed chrome during and after movement, profile/reload reset, disabled controls, and storage isolation. The full regression suite passes 709 tests with 0 failures; the final focused LATTICE suite passes 40 tests; the Phase 3 and Phase 4 browser suites each pass 1 test; production build, budgets, owner import-graph isolation, and `git diff --check` pass. The exact temporary two-line `LEGACY` rollback passes 17 focused tests and production budgets; its rebuilt graph contains lazy `ModuleGridShell` outside the initial entry, no `OwnerLatticeShell`, and zero leaks. The final restored LATTICE totals are initial JavaScript 1,227,357 raw / 358,509 gzip; selected owner JavaScript 58,146 raw / 18,446 gzip; initial CSS 113,254 raw / 19,913 gzip; selected owner CSS 22,730 raw / 4,014 gzip; core JavaScript 1,744,717 raw / 518,210 gzip. Version 7 remains the publication default and version 8 publication remains disabled. `App.jsx`, the accepted Phase 3 renderer, authentication UI, ModuleGridShell, and all persistence/publication contracts remain unchanged.

Exit criterion: owner navigation is intuitive, deterministic, responsive, and does not regress profile/session behavior.

## Phase 5 — production Browser and authoring geometry

Status: `[~]` — **Phase 5A, Phase 5B.1, Phase 5B.2, Phase 5B.3, and Phase 5B.4 accepted; Phase 5B.5 implemented and automatically verified pending visual acceptance; Phase 5B.6 onward remains unstarted**

Goal: wire the isolated Browser to real INDEX/CATEGORIES data and enable table authoring.

Includes:

- one Browser window with INDEX and CATEGORIES tabs;
- real profile-scoped asset records only;
- add/place, move, resize from all corners, crop, mat/frame, layer, transparency, replace, remove, public/private, lock/unlock;
- context menus use the shared visual system;
- explicit selection and focus restoration;
- deterministic autosave without cross-profile leakage;
- no automatic arrangement on load.

### Phase 5A — read-only real Browser integration

Status: `[x]` — implemented, verified, and visually accepted.

The selected lazy owner graph exposes the Browser toolbar control and loads a nested Browser chunk only after first use. INDEX, Favorites, and Categories are derived from the validated active-profile Library workspace and asset cache. Organization is read-only, PLACE is natively disabled, and no canonical draft store or authoring callback is imported or invoked. Existing Library loading, cache refresh, profile transition, and legacy-workspace normalization behavior remains owned solely by the pre-existing Library lifecycle.

Accepted checkpoint (2026-07-29): visual acceptance confirmed. The production owner Browser remains read-only and profile-scoped; Favorite and Category mutation commands are absent, PLACE is disabled without a callback, ordinary interaction leaves Library organization and canonical-authoring storage untouched, and stale asset batches remain generation-inert. The Browser stays inside the selected lazy owner graph, with no fixture harness or fixture data in production and no change to `App.jsx`, top-level routing, authentication, Startveil, publication, wallets, IPFS, visitor or iframe behavior. Version 7 remains the publication default and version 8 publication remains disabled.

Owner/viewed-profile routing correction checkpoint (2026-07-29): implemented, verified, and visually accepted as a separate correction after Phase 5A, without beginning Phase 5B. App routing now retains only explicit `view=` intent and derives implicit owner, development `profile=` fallback, pending, and settled signed-out targets from the current generation. Wallet lifecycle `pending`/`complete` is observational only; verified ownership and matching normalized addresses remain the sole authoring gate. Implicit pending authority resolves no publication, owner chunk, or owner storage, while explicit visitor targets remain available and RETURN removes only genuine explicit intent. Generation-gated recovery settles before optional LSP3 metadata, and superseded provider, permission, recovery, and metadata work cannot select or settle a later profile. Phase 3 remains `[~]`, Phase 4 `[x]`, Phase 5A `[x]`, overall Phase 5 `[~]`, and Phase 5B onward `[ ]`; version 7 remains the publication default and version 8 publication remains disabled.

### Phase 5B.1 — one public placement transaction

Status: `[x]` — implemented, automatically verified, and visually accepted.

- [x] One explicitly public, eligible real Browser asset can be placed into an empty active public canonical table.
- [x] Completed PLACE operations revalidate profile, asset identity, media, and native dimensions, then persist transactionally through the unchanged Phase 2B store.
- [x] Placement identity is globally deterministic and bounded; initial geometry uses the provisional 12 × 10 integer-cell envelope with the approved ratio, rounding, and centering rules.
- [x] First-unused table-local layer and navigation order plus the approved crop, frame, mat, backing, transparency, visibility, and lock defaults are canonicalized without renderer changes.
- [x] The one-placement-per-table restriction exists only in the Phase 5B.1 UI and completed-operation session capability gates; direct or stale repeat callbacks cannot persist a second placement, while valid existing multi-placement drafts load without mutation.
- [x] Private tables and placements remain untouched canonically and redacted through the accepted Phase 2A public projection.
- [x] Absent-profile mount and ordinary load perform no canonical write; unavailable or throwing default storage acquisition and corrupt storage fail closed without a runtime crash or byte mutation; failed transactions retain the exact prior displayed, accepted, and persisted draft.
- [x] Profile switching and stale selection are generation-safe, and disabled PLACE states remain honest for private/nonempty tables, missing dimensions, unavailable media, stale selection, and corrupt storage.
- [x] Focused identity, geometry, eligibility, transaction, corruption, storage-acquisition, immutability, reload, multi-placement-load, private-redaction, and cross-profile coverage passes 27 tests; the full regression suite passes 741 tests with 0 failures.
- [x] The real-App Phase 5B.1 Browser test passes a full document reload with exact canonical bytes, deep-equal draft recovery, identical rendered geometry, and the restored nonempty-table gate; existing Phase 3, Phase 4, Phase 5A, and routing browser tests pass; production build, the 1,228,709-byte initial-JavaScript budget, owner/visitor/initial-entry isolation, and `git diff --check` pass.
- [x] Interactive visual acceptance confirms real Library placement, native-ratio rendering, full-reload recovery, and cross-profile isolation.

Implementation checkpoint (2026-07-29): visual acceptance confirmed against real profile-scoped Library records. The Phase 2B key remains `inscape.lattice-production-draft.v1:<normalized-profile-address>` and its accepted store remains the sole writable canonical authority. The Phase 3 renderer is reused unchanged. The shared Phase 2A projection received one narrow production-record compatibility correction: normalized Library image records without a separate `mediaType` are projected as images, while explicit unsupported types remain fail-closed. No store, validator, renderer, reconciliation, publication-writer, routing, wallet-lifecycle, `ModuleGridShell`, version-7 publication, or version-8 publication contract changed. The known legacy published-visitor suite still stops in setup after fixture mount and published readiness because its stale `.published-home-world__header` selector is absent and is passed to `getComputedStyle`; its 12 child tests are consequently cancelled before assertions.

### Phase 5B.2 — deterministic public placement movement

Status: `[x]` — implemented, automatically verified, and visually accepted.

- [x] Existing public placements on the active public table move through one owner-only interaction layer derived from the accepted Phase 3 projection utilities; the shared renderer remains unchanged.
- [x] Pointer ownership is deterministic from placement-originated pointer down, retains safe capture before the 10-pixel dead zone is crossed, preserves the fractional grab offset, previews integer-cell snapping, and never initializes table navigation.
- [x] Completed movement changes only integer `column` and `row`, preserves span and every presentation field, clamps the complete placement to the 32 × 18 plane, and treats same-cell destinations as zero-write no-ops.
- [x] Arrow keys provide one-cell completed movement in canonical navigation order while locked placements expose an honest accessible non-movable state.
- [x] Completion re-reads the latest accepted Phase 2B draft and revalidates normalized profile authority, Library profile and asset identity, table, placement, starting geometry, public visibility, lock state, and the complete candidate before exactly one store commit.
- [x] Preview, selection, focus, pointer capture, cancellation, and errors remain detached runtime-only state; cancellation, Escape, stale generations, authority loss, validation failure, and persistence failure retain the exact accepted display and bytes.
- [x] Existing valid multi-placement drafts remain readable and unchanged, deliberate overlap remains legal, hit testing follows visible public projection plus canonical layer, and the Phase 5B.1 one-placement PLACE gate remains in force.
- [x] The owner authoring viewport fits all 32 square columns to the available width; any resulting vertical overflow is centered and exposed through bounded, runtime-only, per-table Space-drag camera state without changing canonical placement geometry or normal table navigation.
- [x] The owner runtime uses one continuous grid presentation across the complete topology, avoiding the previous doubled table grid and dimmer outer-topology strips; the accepted shared renderer and visitor behavior remain unchanged.
- [x] Placement pointer coordinates are localized through the live projected table rectangle so movement remains exact after width-fit camera translation and responsive resizing.
- [x] Focused movement, projection, dead-zone, grab-offset, bounds, keyboard, viewport-camera, stale/locked/private/unavailable, exact rollback, corruption, immutability, and transaction coverage passes 32 tests; the full regression suite passes 758 tests with 0 failures.
- [x] The original reused real-App Phase 5B lifecycle passes PLACE/reload/profile assertions plus preview-without-write, leaving artwork before activation, exactly one MOVE write, Escape rollback, same-cell no-op, empty-space navigation, reload recovery, and profile isolation in 459.8 seconds with graceful cleanup. The responsive-camera amendment reached its new camera check after all preceding assertions, then timed out because the new assertion treated valid numeric zero as falsy; that assertion is corrected and was deliberately not rerun solely for the test bug.
- [x] Existing Phase 3, Phase 4, Phase 5A, and owner/profile routing browser suites pass; the final production build and budgets, owner/visitor/initial-entry isolation, and `git diff --check` pass.

Accepted checkpoint (2026-07-29): interactive review confirms placement selection, pointer and keyboard movement, snapping, clamping, cancellation, persistence, reload recovery, profile isolation, normal empty-space table navigation, full-width non-fullscreen geometry, consistent outer-topology grid intensity, bounded Space-drag, per-table camera memory, and exact post-camera artwork movement. During review the owner viewport's contained-plane side gutters were rejected because an adjacent table could occupy screen space unavailable to the active table and the table/atmosphere grid stacking produced dimmer strips beyond the outer topology. The accepted owner-only correction fits the canonical 32 columns to width, keeps cells square, centers and bounds vertical overflow, and gives each table an independent runtime-only Space-drag vertical camera. This is host presentation state only: the Phase 2B store, canonical geometry and key remain unchanged and sole-writable. The accepted shared renderer, visitor behavior, public projection/redaction contract, Library workspace v8, publication, reconciliation, routing, wallet, IPFS, `ModuleGridShell`, version-7 publication default, and disabled version-8 publication remain unchanged.

### Phase 5B.3 — core composition loop

Status: `[x]` — **implemented, automatically verified, and visually accepted**

- [x] The temporary one-placement-per-table gates are removed. Repeated eligible public assets can be placed on the active public table, including the same asset more than once, while private-table and profile-readiness gates remain unchanged.
- [x] New placement identity uses `placement-<crypto.randomUUID()>`, generated only inside an explicit completed PLACE request. Existing IDs remain untouched; candidate syntax and global draft collisions are checked for at most 32 secure attempts, with an injected generator for deterministic tests and controlled zero-write failure for unavailable randomness, invalid output, collision exhaustion, validation failure, or persistence failure.
- [x] New `layer` and `navigationOrder` values are independently assigned as table-local maximum plus one, making the placement topmost and last in keyboard traversal. Safe-integer exhaustion fails before mutation; REMOVE never renumbers survivors.
- [x] Selected public unlocked placements resize from all four corners on the canonical integer grid. The opposite corner stays anchored, each span has a one-cell minimum, complete geometry remains within the 32 × 18 plane, overlap stays legal, pointer preview uses the accepted ten-pixel dead zone and nearest-cell snapping, arrow keys resize by one cell, and Escape/capture loss restores exact accepted geometry without a write.
- [x] Completed RESIZE re-reads the accepted draft; revalidates profile authority, active public table, complete expected placement snapshot, starting geometry, visibility, lock state, matching live placeable Library asset, anchored bounds, and the complete candidate; and performs exactly one completed-operation store commit. Same-geometry completion is a zero-write no-op.
- [x] REMOVE is available only through an explicit accessible button. It compares the complete expected placement snapshot, requires the exact current public unlocked placement, does not require a live Library asset, removes only that record through one completed-operation commit, preserves survivor order/layer/navigation values, and restores focus to the next navigation entry, then the previous entry, or the owner viewport when empty.
- [x] MOVE, empty-space table navigation, wheel behavior, and bounded per-table Space-drag vertical camera behavior retain their Phase 5B.2 contracts. Placement bodies own MOVE, corner handles own RESIZE, the REMOVE button owns only activation, and Space capture retains camera priority everywhere except the removal action.
- [x] Focused placement, movement, resize, removal, transaction, owner-session, shell, accessibility, and gesture-source coverage passes 48 tests with 0 failures. The single full regression run passes 772 tests with 0 failures. The production build, budgets, owner-runtime isolation, and `git diff --check` pass; the long combined Phase 5B browser lifecycle was neither changed nor run, and no replacement browser suite was added.

Implementation checkpoint (2026-07-30): Phase 5B.3 supplies the usable public composition loop `PLACE → MOVE → RESIZE → REMOVE` without changing the canonical draft schema, version-1 storage key, Phase 2B store, shared Phase 3 renderer, public projection/redaction, reconciliation, publication, routing, wallet, IPFS, visitor runtime, or version defaults. Runtime previews, selection, focus, and pointer capture remain detached from canonical persistence. Final production totals are initial JavaScript 1,228,709 raw / 358,855 gzip; selected owner JavaScript 132,369 raw / 41,264 gzip; initial CSS 113,254 raw / 19,913 gzip; selected owner CSS 27,480 raw / 4,690 gzip; and core JavaScript 1,800,533 raw / 534,544 gzip. Crop, smart guides, explicit layer editing, frame/mat/backing, transparency, replace, visibility mutation, lock mutation, Owner Preview, publication cutover, Phase 6, and later work remain excluded.

Boundary-control review correction (2026-07-30): placements touching an authored edge now mark their exact top/right/bottom/left boundary state. Only the clipped axis of each resize handle insets into the placement. At the top edge, REMOVE docks into available table-local space beside the placement, choosing the roomier side; a table-wide placement uses a width-bounded inside fallback. The movement layer retains table-local overflow clipping so controls cannot enter adjacent tables or fixed chrome. The affected focused set passes 12 tests with 0 failures across every edge and one-cell geometry; the rebuilt production budgets and owner-runtime isolation pass. Phase 5B.3 is visually accepted as `[x]`.

Allocator rollback constraint: after any deployed REMOVE has created a historical placement-ID gap, the UUID allocator must remain in place even if the rest of Phase 5B.3 is rolled back. A rollback may remove RESIZE/REMOVE UI while retaining the allocator, or temporarily disable PLACE; restoring the former first-unused `placement-N` allocator could reuse an identity still present in a publication baseline or reconciliation state. Existing UUID-bearing drafts need no schema migration and remain readable by the accepted validator and renderer.

### Phase 5B.4 — crop authoring

Status: `[x]` — **implemented, automatically verified, and visually accepted**

- [x] Selected public unlocked placements expose an explicit accessible CROP mode. `crop: null` previews and DONE commits the canonical centered minimum-cover crop `{ x: 0.5, y: 0.5, zoom: 1 }`; existing crops retain their exact stored value until edited, while NATIVE FIT explicitly restores `null` without changing placement geometry.
- [x] The existing canonical `null | { x, y, zoom }` representation remains unchanged. Pointer drag and one-percent/five-percent keyboard nudges pan the source beneath the fixed existing mat opening; the explicit range control clamps cover-relative zoom from one through four, and all focus values remain within aspect-dependent image-coverage bounds for portrait, landscape, square, transparent, and previously cropped media.
- [x] Crop activation, pointer/keyboard/zoom preview, cancellation, Escape, and capture loss remain runtime-only. DONE and NATIVE FIT re-read the latest accepted draft; compare the complete expected placement snapshot; revalidate owner/profile authority, public table and placement identity, starting crop, geometry, visibility, lock, exact live Library asset identity and native dimensions, current mat opening, coverage bounds, and the complete candidate; and use exactly one completed-operation store commit only for a changed valid crop.
- [x] Preview, cancellation, unchanged completion, stale state, invalid values, authority loss, unavailable or changed media, and storage failure write nothing and return to the accepted rendering. Successful, cancelled, no-op, and rejected sessions retain selection and restore CROP focus when available, otherwise owner-viewport focus; reload and profile switching remain deterministic and isolated.
- [x] Active CROP exclusively owns its pan and zoom controls and suppresses MOVE, RESIZE, REMOVE, pointer/wheel/directional/minimap table navigation until explicit DONE or CANCEL. Space-drag retains vertical-camera capture priority. Outside CROP, the accepted PLACE → MOVE → RESIZE → REMOVE loop, anchored grid-native resize, explicit-button-only removal, overlap, focus, navigation, wheel, and camera contracts remain unchanged.
- [x] Focused pure crop and owner/session/gesture/accessibility coverage passes 43 tests with 0 failures. The single completed full regression run passes 786 tests with 0 failures. `npm run build:check` passes once; a subsequent fresh production build compiles and independently passes the same production budgets and owner-runtime isolation with zero leaks. `git diff --check` passes. No long combined browser lifecycle or new browser suite was run.

Accepted checkpoint (2026-07-30): interactive visual review accepted Phase 5B.4 after implementation and automated verification. Phase 5B.4 adds only schema-free crop authoring in the lazy owner runtime. The canonical draft/publication validators, version-1 storage key and store contract, shared production renderer contract, public projection/redaction, reconciliation, publication, visitor runtime, routing, wallet, IPFS, version defaults, and rollback readers remain unchanged. Final production totals are initial JavaScript 1,228,709 raw / 358,844 gzip; selected owner JavaScript 143,931 raw / 43,881 gzip; initial CSS 113,254 raw / 19,913 gzip; selected owner CSS 29,864 raw / 4,944 gzip; and core JavaScript 1,812,095 raw / 537,136 gzip. Explicit layer editing, smart guides, frame/mat/backing editing, transparency editing, replace, visibility or lock mutation, Owner Preview, publication or visitor cutover, Phase 6, and later work remain excluded.

Crop rollback constraint: a code rollback may remove the Phase 5B.4 controls without migrating, deleting, or rewriting crop records. The accepted version-1 schema, public projection, renderer, publication, and reconciliation paths already read both `null` and canonical crop records deterministically. Storage failure retains the exact previous accepted draft and bytes; application rollback does not authorize republishing. The independent Phase 5B.3 UUID allocator rollback constraint remains in force.

### Phase 5B.5 — explicit layer authoring

Status: `[~]` — **implemented and automatically verified; interactive visual acceptance pending**

- [~] Selected public unlocked placements expose explicit accessible FORWARD, BACKWARD, FRONT, and BACK buttons. Boundary controls remain focusable with `aria-disabled`; native button activation is the only layer command and no keyboard shortcut is added.
- [~] FORWARD and BACKWARD exchange existing sparse layer values with the immediately adjacent visible placement. FRONT and BACK stably rotate only the existing visible layer values, preserve every crossed placement's relative order, and never allocate, increment, decrement, normalize, compact, or renumber a canonical layer.
- [~] Locked visible placements are hard barriers. FRONT and BACK perform a complete no-op rather than a partial move when a barrier is present. Private placements are excluded from visible adjacency and retain their exact complete records and layers.
- [~] Every completion re-reads and validates the latest accepted draft, compares the complete selected placement and active-table placement topology, revalidates owner/profile authority, public table and placement identity, visibility, lock state, live public assets, current layer topology, and the complete candidate, then performs exactly one completed-operation store commit. Boundary, barrier, stale, authority, media, validation, duplicate/invalid layer, and persistence failures retain the exact accepted draft and perform zero successful writes.
- [~] Layer operations preserve placement-array order and every `navigationOrder`. The public projection and publication continue sorting keyboard navigation independently while carrying canonical layers unchanged. Production rendering and the owner overlay share a public-safe dense runtime rank derived from canonical `(layer, placementId)` order; ranks are never persisted, projected, published, or used for navigation.
- [~] Selection and layer-button focus survive success, no-op, and controlled rejection. Layer buttons cannot start MOVE, RESIZE, REMOVE, CROP, table-drag, or Space-camera gestures; active CROP hides them. Existing PLACE, MOVE, RESIZE, REMOVE, CROP, overlap, table navigation, wheel, minimap, and Space-drag behavior remains unchanged.
- [~] Focused ordering, barrier, rank, transaction, stale-state, profile, accessibility, focus, gesture, and import-isolation coverage passes 66 tests with 0 failures. The single full regression run passes 797 tests with 0 failures. One fresh production build and one `npm run build:check` pass; `git diff --check` passes. No long combined browser lifecycle or new browser suite was run.

Pending visual checkpoint (2026-07-30): Phase 5B.5 changes only layer values already accepted by the version-1 draft and publication schemas. It adds no schema, storage-key/store, adapter implementation, reconciliation, publication, routing, wallet, IPFS, or version-default change. Production totals after the unified contextual-toolbar correction are initial JavaScript 1,228,709 raw / 358,842 gzip; selected owner JavaScript 152,526 raw / 45,574 gzip; initial CSS 113,254 raw / 19,913 gzip; selected owner CSS 30,997 raw / 5,137 gzip; and core JavaScript 1,820,690 raw / 538,839 gzip. The owner runtime remains outside the initial entry with zero graph leaks. Owner CSS passes its 31,000-byte raw budget with 3 bytes of remaining headroom and must not grow without a deliberate budget review.

Contextual-toolbar correction pending renewed visual acceptance (2026-07-30): CROP, BACK, BACKWARD, FORWARD, FRONT, and REMOVE now share one ordered icon-only toolbar and one deterministic table-local dock. It prefers centered-below placement, moves above when required, clamps horizontally to the authored field, and uses a deterministic inside fallback when neither outside edge fits, including every corner, 1 × 1, full-width, and top-plus-bottom placements. The toolbar, buttons, and tooltip labels have no boxed panels; enabled icons glow on hover, keyboard focus glows every icon, and tooltip text uses only a readability halo. Active CROP replaces the contextual toolbar with the existing crop editor; REMOVE and all four resize handles remain operable. The affected focused set passes 19 tests with 0 failures. A fresh passing production build and the single completed `npm run build:check` pass, with owner import isolation retaining zero leaks; `git diff --check` passes. The full suite and browser lifecycle were not rerun. Phase 5B.5 and its checklist remain `[~]` pending renewed interactive visual acceptance.

The current layer controls are temporary and must later be replaced by a dedicated right-click/context-menu system once the complete action inventory is known; that replacement is not part of Phase 5B.5.

Layer rollback constraint: a code rollback may remove the Phase 5B.5 controls and runtime rank helper without migrating, deleting, normalizing, or rewriting stored layer values. Existing version-1 draft, public projection, renderer, publication, and reconciliation readers remain compatible because Phase 5B.5 only permutes already-valid canonical values. Storage failure retains the exact previous accepted draft and bytes; application rollback does not authorize republishing. The Phase 5B.3 UUID allocator and Phase 5B.4 crop rollback constraints remain independently in force.

Phase 5B.6 onward status: `[ ]` — unstarted. Mat/frame/backing editing, transparency, replace, visibility editing, lock editing, Owner Preview, publication or visitor cutover, Phase 6, and later work remain excluded.

User visual test:

1. Place square, portrait, landscape, and transparent assets.
2. Move, resize, crop, layer, mat, lock, reload, and switch profiles.
3. Confirm owner changes persist only for the correct profile.
4. Confirm private assets never appear in visitor preview.

Exit criterion: a user can build a table from real owned assets and recover the exact authored composition after reload.

## Phase 6 — production NFT focus viewer

Status: `[x]` — implemented, owner-visually accepted, and verified

Goal: wire the accepted focus-viewer interaction to real NFT facts.

Includes:

- table card expands smoothly from its actual placement;
- artwork remains visually primary;
- one compact metadata rack with Narrative, Attribute, and Technical modules in a permanent order;
- one expanded module at a time, expanding in place while adjacent faceplates slide without reordering;
- internal scrolling for long narrative and technical content while the selected module persists during browsing;
- honest unresolved states, never invented metadata;
- browse next/previous while panel configuration remains stable;
- real creator and contract facts plus a derived official explorer link only when resolved;
- Escape and close restore focus correctly.

Phase 6 also introduces the single session-only global `ARRANGE` owner mode. It defaults OFF, gates PLACE and the existing authoring layer, preserves Space-drag ownership, and makes decoded placements activate the viewer by primary click or Enter while OFF. The viewer uses native NFT media only after expansion; authored crop, mat, backing, and authored transparency remain confined to the opening/closing placement presentation. The production metadata rack inherits only active owner-menu tokens across all six supported themes, uses no NFT-derived color, and defaults the production surface and menu surface to Mist. Desktop artwork is balanced against the rack height; narrow viewports stack the rack below native-ratio artwork.

Accepted checkpoint (2026-07-30): baseline `12bc03a9a98dc9a0a8e11bc7a5ec83acd3b051b3`. Phase 6 changes no canonical draft/publication schema, version-1 storage key, publication writer, routing, wallet, IPFS, visitor cutover, or version default. Official LSP4/LSP7/LSP8/LSP5 facts retain token-versus-contract scope and source provenance; RPC token metadata preserves arbitrary bytes32 token IDs and reads authoritative LSP4 token type and creator-array addresses. Edition, supply, balance-as-edition, dates, collection semantics, marketplace/collection URLs, and transparency claims remain hidden. Owner visual review accepted ARRANGE, native-media handoff, exact source/return, the compact ordered rack, Mist defaults, responsive behavior, tonal hierarchy, 92% viewer veil, and stable rack motion. Focused Phase 6 checks pass 51 tests; corrected prototype-compatibility checks pass 26 tests; the dedicated real-owner-route browser check passes 1 test with graceful cleanup. The single full regression run completed 811 tests with 807 passes and exposed four checkpoint gates: three stale prototype assertions and the pre-Phase-6 bundle limits. The three assertions pass after correction, and the fourth is resolved by the separately passing production build and deliberately recalibrated Phase 6 budgets. Final post-polish totals are initial JavaScript 1,228,755 raw / 358,871 gzip; selected owner JavaScript 188,517 raw / 56,316 gzip; standalone wallet JavaScript 3,943,731 raw / 1,042,234 gzip; initial CSS 113,254 raw / 19,913 gzip; selected owner CSS 51,942 raw / 8,081 gzip; core JavaScript 1,856,228 raw / 549,553 gzip; public assets 14,821,539 raw; and largest public asset 2,574,306 raw. Owner-runtime graph isolation has zero leaks and `git diff --check` passes.

Post-checkpoint metadata completeness correction (2026-07-30): UniversalEverything/Envio exposed an authored numeric `Rank` attribute that the primary Chillwhales response omitted for HALO tokens. The Library now non-destructively enriches owned LSP8 token attributes from the official LUKSO Envio token relation while retaining Chillwhales discovery and direct RPC fallback. RPC base-URI resolution now reads `LSP8TokenIdFormat`, resolves mixed per-token formats, and decodes Number, String, Address, Bytes, or Hash token IDs before URI concatenation. Contract-level attributes remain a fallback only when token-specific attributes are absent. An owner lattice containing placements now performs one live load from idle even when its local media cache already contains every referenced asset, preventing stale cached metadata from bypassing enrichment. The rack renderer is unchanged and continues rendering every normalized trait. The focused repository, normalization, merge, store, viewer-model, trigger, and authoring regression set passes 47 tests; no full regression suite was rerun for this correction.

Final owner-polish correction (2026-07-30): Browser Index and Categories now inherit the same active owner-menu surface, ink, line, and selection tokens as their header rather than retaining a separate dark body palette. Categories shows only the selected category and its assigned assets; the duplicated all-index membership list is removed without changing category data. Metadata racks, Browser surfaces, Theme, and future owner windows share one centralized typography role set for module headers, labels, section titles, titles, body copy, and values. Viewer wheel events remain internal to the viewer at empty and exhausted dossier scroll boundaries. Multi-asset button and wheel browsing now normalize native `DOMRect` geometry before constructing the outgoing artwork layer, preventing inherited `left` and `top` properties from disappearing during transition layout. The focused Browser, viewer geometry, owner shell, scroll-boundary, and theme-contrast set passes 32 tests. Story Mode, spatial folders, and the proposed `RÄCK` product name remain future concepts and are not part of the Phase 6 implementation checkpoint.

User visual test:

1. Open square, portrait, landscape, transparent, sparse-metadata, and rich-metadata NFTs.
2. Expand Narrative, Attribute, and Technical in turn; confirm each remains in its original position and long content scrolls internally.
3. Toggle the complete rack open and closed from the artwork.
4. Browse several NFTs by click, keyboard, wheel, and swipe while the selected module remains stable.
5. Close and confirm the card returns to its original table position without leftovers.

Exit criterion: the viewer respects artwork ratios, real metadata, motion, focus, and responsive constraints.

## Phase 7 — production identity dossier

Status: `[ ]`

Goal: replace the small Profile Rail identity representation with the full accepted public identity dossier.

Official immutable facts:

- Universal Profile name/handle;
- stable resident suffix derived from the first three canonical address characters;
- full shortened address shown separately;
- official address and verified identity facts remain immutable.

Editable INSCAPE overlay:

- `also known as` alias;
- official or internal avatar source;
- official, custom, or hidden bio source;
- additional public tags;
- shareable workspace URL;
- actual network and `LAST PUBLISHED` when available; never `LAST ONLINE`.

User visual test:

1. Compare owner and visitor projection.
2. Change only allowed overlay fields.
3. Reload and publish.
4. Confirm official identity remains unchanged and private/inactive values do not leak.

Exit criterion: the dossier is visually faithful to the frozen paper design and has a strict, honest data contract.

## Phase 7.5 — production Keeper resident movement

Status: `[ ]`

Goal: connect the existing full X/Y Keeper movement engine to the production lattice before publication and visitor cutover.

Includes:

- ARRANGE OFF empty-table activation moves the released Keeper to the activated lattice position;
- ARRANGE ON empty-table activation retains authoring deselection and never causes incidental Keeper movement;
- placement activation, authoring gestures, table drag/swipe navigation, bounded Space-drag camera movement, and Keeper movement have deterministic ownership;
- screen, active-table, and camera coordinates resolve to stable Keeper targets without jumps during table arrival or responsive resizing;
- dock/release containment, reduced motion, profile switching, Keeper visibility, and existing engine movement bounds remain intact;
- owner and visitor runtimes share the same production movement bridge so Phase 8 publishes behavior rather than inventing it during cutover.

User visual test:

1. With ARRANGE OFF, release the Keeper and activate several empty positions across the active table.
2. Confirm the Keeper flies smoothly to each two-dimensional target while artwork activation and table navigation remain unchanged.
3. Turn ARRANGE ON and confirm empty activation deselects only, without moving the Keeper.
4. Navigate and Space-drag between tables, resize the viewport, dock/release, and switch profiles; confirm movement remains bounded, stable, and conflict-free.
5. Enable reduced motion and confirm target placement and dock transitions remain usable without unintended animation.

Exit criterion: the production lattice has deterministic full two-dimensional resident Keeper movement that is ready to be reused unchanged by the published visitor runtime.

Excluded: autonomous roaming, AI or personality behavior, dialogue authoring, event-reaction authoring, sound, scenes, and the later side-scrolling/free-roam world.

## Phase 8 — publication and visitor integration

Status: `[ ]`

Goal: publish and resolve the canonical nine-table workspace through the existing wallet/IPFS flow.

Includes:

- deterministic public-document projection;
- Pinata credentials remain server-side;
- wallet signs only the correct profile publication;
- directory resolution points to the latest valid publication;
- owner draft and public projection remain distinct;
- direct visit, logged-in iframe, logged-out iframe, and visitor search resolve the same publication;
- visitor navigation works without owner authoring controls.

User visual test:

1. Publish from profile A.
2. Visit from profile B, logged out, direct URL, and iframe.
3. Compare all nine tables, public categories, identity, viewer data, and Keeper navigation.
4. Publish a second revision and confirm all visitor paths resolve the latest valid document.

Exit criterion: publication, directory discovery, and visitor rendering are deterministic across accounts and embedding contexts.

## Phase 9 — parallel cutover and Alpha hardening

Status: `[ ]`

Goal: make the new workspace the Alpha runtime without deleting the fallback prematurely.

Includes:

- feature-flagged or explicitly reversible cutover;
- production error/loading/empty states;
- keyboard, focus, reduced-motion, and responsive checks;
- owner/visitor isolation audit;
- storage/publication migration audit;
- CSS/JS budget and build checks;
- live Netlify/domain smoke test;
- no Gallery room, Upper room, social room, marketplace execution, mobile authoring, or Keeper dialogue system in Alpha unless separately approved.

User visual test: complete Alpha acceptance checklist on localhost, deploy preview, `enterinscape.com`, direct visit, and Universal Profile iframe.

Exit criterion: the user approves the complete live Alpha experience and rollback remains available.

## Phase 10 — legacy cleanup

Status: `[ ]`

Goal: remove only code proven unreachable after the cutover.

Rules:

- inventory before deletion;
- delete in small reviewable commits;
- retain document compatibility as long as published legacy documents exist;
- remove old styling only after confirming the new semantic tokens own every active surface;
- never remove user artwork or source assets as part of code cleanup;
- verify routes, build, owner/visitor isolation, publications, and live deployment after every cleanup slice.

User visual test: regression smoke test of the final Alpha, not a design review.

Exit criterion: no active legacy UI/runtime remains, no publication becomes unreadable, and production behavior is unchanged.

## Explicit Alpha exclusions

Do not silently pull these into the migration:

- Gallery room;
- Upper room;
- outside-world transition;
- social/HUP room;
- marketplace transaction execution;
- multiple public rooms beyond the nine-table lattice;
- full mobile authoring workspace;
- generative emblem/layering studio;
- Keeper personality/dialogue/reaction authoring;
- automatic arrangement presets unless a real need is proven after Alpha use.

These remain future work, even if prototypes or legacy code exist.

## Checkpoint discipline

For every accepted slice:

1. User completes the stated visual test.
2. Automated tests and production build pass in proportion to risk.
3. `git diff --check` passes.
4. Working tree contents are reported explicitly.
5. Commit message describes one coherent slice.
6. Push to `ui/creations-browser` only after approval.
7. Add the commit hash and status update to this roadmap in the same or immediately following documentation checkpoint.

Do not mark a phase complete because code exists. A phase is complete only when its exit criterion is met and the user has accepted the visible behavior where a visual test exists.

## Instructions for every new Codex window

Start with:

> Work only in `E:\VSCODE\INSCAPE`. Read `docs/art-direction/INSCAPE_ALPHA_EXECUTION_ROADMAP.md` first, followed by every canonical source it lists. Report the current checkpoint, current phase, next approved slice, and working-tree status before making changes. Do not start a later phase, alter production storage/publication contracts, or add feature logic to the frozen prototype without explicit approval. After each implementation, tell me whether it is visually testable and give me the exact short test. Keep this roadmap current after an accepted checkpoint.

## Immediate next action

Phase 4 is complete and visually accepted. Phase 3 remains `[~]`; Phase 5 is `[~]` after accepted Phase 5A, and Phase 5B onward requires its own boundary review and explicit approval before implementation. Version 7 remains the publication default, and version 8 publication remains disabled.
