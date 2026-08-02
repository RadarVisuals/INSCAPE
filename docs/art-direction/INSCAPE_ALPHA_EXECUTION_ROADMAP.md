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

Accepted development-only visual and interaction authority awaiting staged production implementation:

- `docs/art-direction/INSCAPE_MODUL8R_ROADMAP_AND_BOUNDARY.md` — accepted MODUL-8R naming, geometry, Library/Activity/People/Layers accordion, Settings/Theme ownership, staged Alpha cutover, rollback, and the explicitly post-Alpha Atelier, control-cell, embedded-mode, and MEDI-8R boundaries.

## Status legend

- `[x]` complete, verified, committed, and pushed
- `[~]` implemented or partially verified, but not yet accepted as production-complete
- `[ ]` not started
- `[!]` blocked or requires an explicit decision

## Current checkpoint

Latest accepted production checkpoint:

- `bb17f9c` — universal owner RÄCK, Unified Browser, multi-select authoring, and grouped composition tools

Latest accepted MODUL-8R design-authority checkpoint:

- `0f1136d` — isolated development prototype, accepted visual and interaction authority; not yet imported into production

Latest accepted MODUL-8R production-integration architecture checkpoint:

- `3e2ba91` — headless controller extraction, development-only parity shell, and atomic production cutover plan

Latest accepted MODUL-8R implementation checkpoint:

- `61b8775` — Task 5 honest OWNED/CREATED Library union in the development-only live-owner shell

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
- [x] Development-only MODUL-8R prototype visually and interactionally accepted at `/prototype/modul-8r`.
- [x] MODUL-8R prototype stylesheet consolidated to one exact-selector authority; compact mode and decorative status concepts rejected.

### Production track

- [x] Phase 4 owner navigation and fixed chrome are integrated and visually accepted behind the verified owner gate.
- [x] The version-8 lattice Visitor runtime, Owner Preview, NFT viewer, Identity RÄCK, and Keeper parity are integrated and interactively accepted.
- [~] Version 8 defines the canonical nine-table profile-document model and now shares the production publication pipeline with version 7; surface and real-publication acceptance remain open.
- [x] Production INDEX/CATEGORIES stores are wired read-only to the isolated Browser; canonical authoring remains separately bounded by the current Phase 5B capability.
- [x] Phase 4 fixed chrome, the Phase 6 production NFT viewer, and the Phase 7 production identity RÄCK are integrated and visually accepted.
- [ ] Legacy Home/Gallery/Upper/five-table behavior remains compatibility data, not the Alpha destination.

Phase 1 and Phase 2A–2C are complete and approved. The Phase 3 renderer-only checkpoint is accepted and remains `[~]` until Phase 8 cross-surface integration. Phases 4–7.5 are implemented, verified, and interactively accepted as `[x]`. Phase 5 is `[x]`: the Alpha authoring loop is complete, and the Phase 5B.6 boundary review deliberately defers nonessential presentation editors rather than keeping Phase 5 artificially open.

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

Status: `[x]` — **the Alpha Browser, organization, placement, composition, and universal owner RÄCK workflow is implemented, verified, and interactively accepted**

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

Status: `[x]` — **implemented, automatically verified, and interactively accepted**

- [x] Selected public unlocked placements expose explicit accessible FORWARD, BACKWARD, FRONT, and BACK buttons. Boundary controls remain focusable with `aria-disabled`; native button activation is the only layer command and no keyboard shortcut is added.
- [x] FORWARD and BACKWARD exchange existing sparse layer values with the immediately adjacent visible placement. FRONT and BACK stably rotate only the existing visible layer values, preserve every crossed placement's relative order, and never allocate, increment, decrement, normalize, compact, or renumber a canonical layer.
- [x] Locked visible placements are hard barriers. FRONT and BACK perform a complete no-op rather than a partial move when a barrier is present. Private placements are excluded from visible adjacency and retain their exact complete records and layers.
- [x] Every completion re-reads and validates the latest accepted draft, compares the complete selected placement and active-table placement topology, revalidates owner/profile authority, public table and placement identity, visibility, lock state, live public assets, current layer topology, and the complete candidate, then performs exactly one completed-operation store commit. Boundary, barrier, stale, authority, media, validation, duplicate/invalid layer, and persistence failures retain the exact accepted draft and perform zero successful writes.
- [x] Layer operations preserve placement-array order and every `navigationOrder`. The public projection and publication continue sorting keyboard navigation independently while carrying canonical layers unchanged. Production rendering and the owner overlay share a public-safe dense runtime rank derived from canonical `(layer, placementId)` order; ranks are never persisted, projected, published, or used for navigation.
- [x] Selection and layer-button focus survive success, no-op, and controlled rejection. Layer buttons cannot start MOVE, RESIZE, REMOVE, CROP, table-drag, or Space-camera gestures; active CROP hides them. Existing PLACE, MOVE, RESIZE, REMOVE, CROP, overlap, table navigation, wheel, minimap, and Space-drag behavior remains unchanged.
- [x] Focused ordering, barrier, rank, transaction, stale-state, profile, accessibility, focus, gesture, and import-isolation coverage passes 66 tests with 0 failures. The single full regression run passes 797 tests with 0 failures. One fresh production build and one `npm run build:check` pass; `git diff --check` passes. No long combined browser lifecycle or new browser suite was run.

Implementation checkpoint (2026-07-30): Phase 5B.5 changes only layer values already accepted by the version-1 draft and publication schemas. It adds no schema, storage-key/store, adapter implementation, reconciliation, publication, routing, wallet, IPFS, or version-default change. Production totals after the unified contextual-toolbar correction are initial JavaScript 1,228,709 raw / 358,842 gzip; selected owner JavaScript 152,526 raw / 45,574 gzip; initial CSS 113,254 raw / 19,913 gzip; selected owner CSS 30,997 raw / 5,137 gzip; and core JavaScript 1,820,690 raw / 538,839 gzip. The owner runtime remains outside the initial entry with zero graph leaks. Owner CSS passes its 31,000-byte raw budget with 3 bytes of remaining headroom and must not grow without a deliberate budget review.

Superseded contextual-toolbar checkpoint (2026-07-30): the short-lived icon-only placement toolbar and its table-local docking projection were removed by the production context-menu replacement below. It is retained here only as checkpoint history and is not current interaction or visual authority.

Production context-menu replacement accepted (2026-07-31): the temporary six-button toolbar is removed. Right-clicking any part of a public unlocked placement now opens one viewport-anchored production menu containing CROP, BACK, BACKWARD, FORWARD, FRONT, and REMOVE in the accepted order. The same menu opens from the focused placement with the Context Menu key or `Shift+F10`; Escape and completed commands restore placement focus through the shared menu boundary. It is portalled outside the transformed stage but remains inside the owner shell, so all six active owner-menu themes provide the exact same panel, ink, line, selection, and typography tokens. Disabled layer boundaries remain visible and unavailable. Active CROP, locked/private placements, and active pointer gestures suppress native and production context menus without cancelling their current owner. MOVE, RESIZE, crop editing, empty-table deselection, ARRANGE, navigation, minimap, and Space-drag ownership are unchanged.

The obsolete toolbar icon, tooltip, docking projection, CSS, and docking-only tests were removed with the replacement. No draft/publication schema, storage key/store, adapter, reconciliation, publication, routing, wallet, IPFS, visitor, or version-default contract changed. The focused crop/layer/removal/context set passes 23 tests with 0 failures, the production build and budgets pass, and `git diff --check` passes. The full suite and browser lifecycle were not rerun for this replacement. Interactive review accepted the reachable placement right-click commands, command execution, disabled boundaries, and shared RÄCK presentation; Phase 5B.5 is closed as `[x]`.

Shared RÄCK-menu consolidation accepted for production-reachable callers (2026-07-31): placement commands use one `RackMenu` visual primitive over the unchanged `DesktopMenu` interaction engine. Keeper options use the same shared opaque surface and faceplate primitives while retaining their dedicated dock positioning and segmented speed control. Every faceplate is contiguous, uses the resting three-pixel module marker and active three-pixel rail, and inherits the existing active interface/theme tokens; no metadata-derived or context-specific colour system exists. Cascades retain their existing focus, keyboard, preview, clamping, outside-click, and Escape ownership. Frozen prototype and legacy reference implementations remain untouched. Local placement and Keeper visual copies are removed. Interactive review accepted the reachable right-click surfaces. Category mutation menus still present in the legacy `AssetIndex` and `ProfileNavigationDock` code are not reachable through the current owner Browser, were not part of this acceptance, and do not authorize category authoring. This consolidation changes no command model, transaction, schema, persistence, publication, wallet, route, or asset projection behavior.

Layer rollback constraint: a code rollback may remove the Phase 5B.5 controls and runtime rank helper without migrating, deleting, normalizing, or rewriting stored layer values. Existing version-1 draft, public projection, renderer, publication, and reconciliation readers remain compatible because Phase 5B.5 only permutes already-valid canonical values. Storage failure retains the exact previous accepted draft and bytes; application rollback does not authorize republishing. The Phase 5B.3 UUID allocator and Phase 5B.4 crop rollback constraints remain independently in force.

### Production category authoring — implemented and interactively accepted

Status: `[x]` — implemented, automatically verified, and interactively accepted on 2026-07-31.

The current production owner `BrowserWorkspace` now exposes a visible `+ NEW CATEGORY` faceplate, compact create/rename/delete dialogs, category `RackMenu` commands for rename, private/public state, and deletion, plus NFT membership menus in both INDEX and CATEGORIES. Browser menus are portalled to the owner shell so their viewport coordinates are not offset by the centered/transformed Browser window. NFT membership uses compact `ADD TO > category` and `REMOVE FROM > category` cascades instead of category names in oversized root rows. Pointer context menus and the Context Menu key / `Shift+F10` preserve normal left-click selection and PLACE behavior; Escape, outside click, and completed commands close the shared viewport-clamped menu and restore the exact trigger when it remains available. Creation trims and rejects empty names, defaults private, and selects the new category. Deletion confirms explicitly and removes only the Library folder and membership list. Membership uses the unchanged stable asset ID, is idempotent, and immediately removes an asset from the currently viewed category.

Authority and persistence remain in the existing `inscape.library-workspace.v8:<normalized-profile-address>` Library workspace. `useOwnerLatticeBrowser.js` is the narrow owner-only integration boundary; its captured command object supplies the normalized expected profile to one guarded Library commit. `useLibraryStore.js` revalidates the live store profile, workspace profile, and exact workspace snapshot before setting state or scheduling the unchanged 180 ms debounced save. Invalid, cancelled, no-op, missing-category, and stale-profile calls schedule no persistence. The deep-frozen Browser projection is read-only input and is never mutated. Category public/private changes only the existing folder flag and invokes no publication, wallet, IPFS, or profile-document operation.

Implementation files: `src/lattice/browser/BrowserWorkspace.jsx`, `BrowserCategoriesPanel.jsx`, `BrowserIndexPanel.jsx`, `BrowserAssetResults.jsx`, `BrowserCategoryDialog.jsx`, `browserWorkspace.css`, `latticeProductionBrowserAdapter.js`, `src/public/useOwnerLatticeBrowser.js`, `src/public/OwnerLatticeShell.jsx`, `src/library/state/useLibraryStore.js`, and `src/library/domain/libraryWorkspace.js`. Focused verification files: `src/library/state/useLibraryStore.categoryAuthoring.test.js`, the existing Browser/adapter/domain/store/owner/menu tests, and `browser-tests/owner-lattice-browser.browser.mjs`. `scripts/productionBuild.js` records the measured core-JavaScript budget for this lazy owner feature while preserving the initial-entry and owner chunk budgets.

Automated verification: the focused category/domain/store/Browser/owner/menu set passes 46/46; the dedicated owner/visitor/initial-entry isolation set passes 31/31. After the portal/cascade UI correction, its focused Browser/menu/store/isolation set passes 34/34. The production build compiles and passes budgets at 1,235,958 initial JS bytes, 209,496 owner JS bytes, and 1,889,146 core JS bytes; `npm run build:check` passes. The updated real-App browser lifecycle was attempted, but its command wrapper timed out during setup after 124 seconds without producing TAP output; its verified temporary Node/Edge process tree was stopped, so that check is not reported as passed and the sequence remains part of manual acceptance. The full suite was not run.

Production rail activation correction (2026-07-31, awaiting interactive acceptance): CATEGORIES is no longer a disabled Phase-4 placeholder in the current `LatticeProfileRail`. Activating it opens the same lazy production `BrowserWorkspace` directly on its CATEGORIES tab; it does not mount the legacy `CategoryAssetBrowser` or `AssetIndex`. A request identity distinguishes an explicit rail destination from ordinary Browser reopening, so the toolbar retains the Browser's last active tab while every rail activation deterministically selects CATEGORIES. The rail reflects the active category destination, Browser close and Escape restore focus to the exact connected rail or toolbar trigger, and all state remains session-only. The focused Browser/owner integration set passes 19/19 and the production build and budgets pass. No full suite or browser lifecycle was run for this correction.

Unified Browser and drag-to-place implementation checkpoint (2026-07-31, awaiting interactive acceptance): the INDEX/CATEGORIES tab split is removed in favor of one persistent INDEX / CATEGORIES navigation column, one raised search/collection/sort/view toolbar, one shared result surface, and one functional footer. Favorites remain byte-for-byte compatible in workspace-v8 but are deliberately unexposed. Unsorted is derived from category stable-ID membership; Used on Canvas is derived at runtime from placements across all nine accepted canonical draft tables. Search is view-local, the collection filter exposes only values present in accepted records, sorting is deterministic, grid/list mode is session-only, broken media fails to a controlled placeholder, and progressive batches never become implicitly selected.

Selection is a Browser-session ordered stable-ID set with ordinary replacement, Ctrl/Cmd toggle, Shift visible-range selection, result-focused Ctrl/Cmd+A, menu/dialog-first Escape, and right-click snapshot semantics. The footer reports the exact selection count and disables PLACE with `PLACE ONE ASSET AT A TIME` for multiple assets. Category membership uses one mixed-capable shared RÄCK menu from both cards and the footer. A bulk command revalidates the expected/live profile, workspace snapshot, category, canonical accepted asset set, and selected IDs, then applies the entire add/remove set through one Library workspace replacement and one existing debounced save. Idempotent, stale, missing, or invalid requests retain reference identity and write nothing. Favorites, asset records, canonical lattice draft, publication, wallet, and IPFS data are not mutated.

Pointer drag-to-place is ARRANGE-gated and uses pointer capture plus a movement threshold, never native HTML5 drag-and-drop. Its portal ghost and table-local preview are runtime-only. Only the active public canonical table is eligible; Browser/interface chrome, adjacent/inactive/private tables, invalid media/dimensions, profile or authority changes, Escape, pointer cancellation, Browser close, and ARRANGE disable cancel without persistence. Preview geometry uses the existing native fitted placement span, centers around the pointer, snaps and clamps to the canonical 32×18 plane. A valid release performs exactly one extended PLACE transaction containing final drop geometry; it never persists center-then-move, and the Browser stays open. Centered footer PLACE remains unchanged.

Focused verification passes 71/71 across the Browser model/source boundary, real adapter, Library domain and guarded category store, owner Browser hook, placement geometry/session, owner shell, and profile rail. The production compile completes. After the renderable-result policy, measured totals are initial JavaScript 1,236,097 raw / 361,046 gzip; owner JavaScript 215,791 raw / 64,523 gzip; owner CSS 64,328 raw / 9,520 gzip; and core JavaScript 1,904,626 raw / 564,281 gzip. The aggregate core ceiling remains 1,905,000 raw / 565,000 gzip for this bounded feature while existing initial, owner, CSS, wallet, and asset ceilings remain unchanged. The earlier single allowed real-App Browser lifecycle timed out after 124 seconds without TAP output and is not claimed as passed; no second lifecycle or full suite was run. Visual acceptance remains open.

Post-review correction (2026-07-31): category counts were accurate while a retained cross-view search could filter every assigned card, presenting `0 ASSETS` as though membership had disappeared. Filtered views now report `visible OF membership / FILTERED`, explain the active search/filter in the empty state, and provide an explicit clear action. Shared menu checked/mixed state no longer strips the first two characters from labels that do not carry the legacy `✓ ` prefix. The focused Browser/menu/persistence correction set passes 23/23 and production budgets pass.

Organization usability correction (2026-07-31): an asset context menu opened inside a category now exposes a direct `REMOVE FROM <CATEGORY>` command before the complete mixed-capable membership list. A multi-selection can be pointer-dragged onto a category row; the threshold/capture ghost and target highlight are session-only, release performs the same one-command atomic bulk add, and categories remain non-exclusive memberships. Category creation is pinned in the CATEGORIES heading while only category rows scroll. Browser-internal implementation labels are removed. Sidebar rows now reuse the profile-rail faceplate, left-edge active rail, separator, token, and hover grammar. The focused correction set passes 24/24 and production budgets pass.

Media-navigation deferral (2026-07-31): the user-facing MEDIA section, generic audio/video/3D icon vocabulary, media view state, and TYPE toolbar filter are removed until the Library can consistently discover and normalize those formats. The adapter retains its internal `mediaType` validation solely to classify accepted records and fail unsupported placement honestly; it is not exposed as an organization promise.

Renderable-result policy checkpoint (2026-07-31, awaiting interactive acceptance): accepted stable-ID records remain presentation-inert until one supported normalized preview candidate decodes. The Browser tries thumbnail, display image, then safe original in established order without rendering attempts; the first decoded candidate reveals one card, while complete failure or unsupported media contributes only to the compact `N UNAVAILABLE` count. Decoded records paint progressively and repaired records retry when their accepted Library record or candidate set changes. Result filtering never mutates the asset cache, Favorites compatibility, category membership, canonical placements, or publication. Categories report visible and unresolved membership separately. A later media failure removes the card and selection, cancels Browser-category and canvas placement drags, and live-revalidates PLACE and category commands before permitting a write. Existing persisted placements remain governed by the lattice runtime and retain `ASSET RESOLVING`. The focused fallback/Browser/adapter/persistence/placement/owner set passes 70/70; the final live-revalidation set passes 29/29; production build and budgets pass.

Universal owner RÄCK implementation checkpoint (2026-07-31, interactively accepted): the freely positioned Browser is the fill module inside `THE RACK`. The final faceplate order is TOOLS, BROWSER, LAYERS; preview, publish, and theme commands live directly on the master faceplate instead of a separate SYSTEM module. Master collapse preserves every module's own expanded state, horizontal rack resize is independent from Browser height resize, and the master options menu can hide or restore available modules without persistence. Reversible COMPACT MODE retains Browser data, selection, filters, module state, and window geometry while reducing the navigation column to its icon grammar and compressing nonessential Browser chrome. Narrow viewports remain bounded inside the viewport; reduced motion removes rack content animation.

ARRANGE empty-plane marquee selection supports replace, Shift-add, and Ctrl/Cmd-toggle while Space-drag retains camera ownership. Multi-selected public placements MOVE, RESIZE, ROTATE, MIRROR, DUPLICATE, REMOVE, and layer-reorder as atomic canonical transactions; a stale, locked, private, invalid, or failed-persistence member rejects the complete group with zero partial writes. CROP remains intentionally primary-placement-only. The final changed/new focused set passes 172/172; `git diff --check` passes. The production build and budgets pass at initial JavaScript 1,236,097 raw / 361,053 gzip, owner JavaScript 253,857 raw / 72,661 gzip, owner CSS 65,750 raw / 9,715 gzip, and core JavaScript 1,956,247 raw / 575,924 gzip. Interactive review accepted free movement, horizontal and vertical resizing, compact layout, master/module collapse, faceplate ownership, THE RACK styling, Browser progressive results, multi-selection, grouped transforms, and direct layer movement. No PWA/service-worker or extension-auth change is included because standalone wallet compatibility requires a separate product and integration decision.

Compact Browser correction (2026-07-31, interactively accepted): Browser width drives one named-container layout instead of competing viewport/mobile variants. At 520px and below the navigation is the accessible icon rail; labels remain available through titles and accessible names. The redundant results heading, fixed Browser footer, and empty vertical gutters are removed. Thumbnail size, Search, and the hover-described unavailable count live on the Browser faceplate and remain available while its content is collapsed. TOOLS is a command faceplate; BROWSER and LAYERS retain genuine expandable content. Module numbers and visible `+ / −` glyphs are absent; aligned grips and labels own module expansion, while the complete master faceplate owns master collapse without interfering with drag. The master exposes bold `THE RACK`, system commands, options, and the flush close control, with no profile address. Three Browser-RÄCK-scoped signal rails distinguish Browser, Tools, and Layers without entering the shared shell or any NFT/identity/metadata colour authority.

Final Phase 5 checkpoint note (2026-07-31): interactive acceptance covers category authoring, rail activation, Unified Browser, renderable-result fallback, drag-to-category, drag-to-canvas, multi-select authoring, and the universal owner RÄCK. This final checkpoint supersedes acceptance-open wording retained in the chronological implementation notes above.

Explicit exclusions: PORTALS or lattice launchers, AI categorization, category artwork, favorites editing, legacy `AssetIndex` routing or cleanup, category publication/visitor navigation, wallet or IPFS writes, canonical schema/publication/viewer changes, and Phase 5B.6 presentation tools.

Rollback: remove the injected `categoryCommands` prop and production Browser menus/dialog invocation; remove the guarded `commitCategoryForProfile` action; restore the adapter/footer read-only wording and previous no-op behavior. Existing Library workspace records remain valid and require no migration or rewrite. Do not delete categories created during manual review; they remain ordinary Library organization and can be managed after re-enabling the feature.

Manual acceptance checklist:

1. Activate CATEGORIES from the profile rail and confirm the production Browser opens directly on CATEGORIES, marks the rail destination active, and returns focus to the rail trigger on close and Escape. Reopen from the BROWSER toolbar and confirm its last manually selected Browser tab is retained.
2. Open BROWSER → CATEGORIES in each of Carbon, Graphite, Slate, Ash, Mist, and Paper; confirm inherited RÄCK tokens, opaque menus, contiguous faceplates, resting marker, active rail, and visible focus.
3. Create a trimmed category; cancel a second creation and submit whitespace in another; confirm only the valid category exists, is PRIVATE, and becomes selected.
4. Right-click the category, then repeat with the Context Menu key and `Shift+F10`; rename it, make it public, make it private, and verify Escape/outside-click return focus to that category.
5. In INDEX, select an NFT and confirm PLACE remains unchanged. Right-click it, add it to the category, repeat the add, then open CATEGORIES and remove it; confirm the result disappears immediately without selection loss, placement changes, or asset deletion.
6. With no categories, confirm the NFT menu contains only disabled `NO CATEGORIES YET`. Recreate a category, add an NFT, choose DELETE, cancel once, then confirm deletion; verify the NFT and every lattice placement remain.
7. Open a category dialog or menu on profile A, then switch to profile B. Confirm the old surface disappears and cannot be completed. Reload both profiles and confirm no cross-profile category appears. The lower-level “stale callback” security case is automated coverage, not a manual action a user must somehow invoke.
8. Reload and verify successful category changes persist. Confirm no wallet prompt, IPFS request, publication update, visitor control, or category launcher appears.

### Phase 5B.6 — lean Alpha boundary decision

Status: `[x]` — **boundary resolved; no additional Phase 5 implementation is required for Alpha**

The accepted schema and renderer already preserve frame, mat, backing, transparency, visibility, and lock values, but schema support is not authority to expose incomplete editors. Alpha deliberately defers frame/mat/backing editing, manual transparency modes, replace-in-place, placement visibility editing, and lock editing. REMOVE plus PLACE is the safe Alpha substitute for replace. `AUTO` remains the authoring default for transparency; authored placement settings must never be inferred from NFT metadata, and NFT transparency must never be inferred from placement state. Imported or reconciled valid canonical values remain readable and render deterministically.

Owner Preview moves to Phase 8A. It must be the first owner-facing consumer of the actual version-8 visitor runtime and exact pure public projection, not a second preview imitation inside the owner authoring shell. Preview must exclude private draft content, session Theme overrides, authoring chrome, callbacks, selections, open windows, and incomplete gestures. This keeps one runtime contract for Owner Preview, direct visits, logged-in and logged-out iframes, and visitor search.

Categories remain profile-scoped owner organization for Alpha. Category publication, visitor category navigation, PORTALS, favorites editing, AI categorization, category artwork, and legacy Browser cleanup remain later product work.

User visual test:

1. Place square, portrait, landscape, and transparent assets.
2. Move, resize, crop, layer, rotate, mirror, duplicate, remove, reload, and switch profiles.
3. Confirm owner changes persist only for the correct profile.
4. Confirm no owner-only category, selection, window, or authoring state enters the canonical public projection.

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

## Phase 7 — production identity RÄCK

Status: `[x]` — **implemented, interactively accepted, and verified**

Goal: retain the compact Profile Rail identity state and expand that same card directly into one centered, read-only owner identity RÄCK. The avatar belongs inside PROFILE MODULE; there is no detached profile image, banner, or split composition.

Authoritative official facts:

- canonical Universal Profile address;
- full LSP3 name, paragraph-preserving description, profile/background image candidates, tags, and authored links;
- direct-RPC active chain, LSP0 classification, and exact LSP5/LSP12 register lengths with independent statuses;
- metadata content-integrity status remains distinct from identity or social verification.

Editable INSCAPE overlay:

- `also known as` alias;
- official or internal avatar source;
- official, custom, or hidden bio source;
- additional public tags;
- canonical INSCAPE profile URL;
- verified LUKSO chain 42 and verified publication `exportedAt` when available; never the runtime epoch placeholder and never `LAST ONLINE`.

User visual test:

1. Open from the owner Profile Rail at 1280×720, 900px, 640px, and 390×844.
2. Change only allowed overlay fields.
3. Confirm Browser and Theme close, ARRANGE persists, viewer/gesture/CROP precedence holds, and Escape restores exact trigger focus.
4. Confirm official identity remains unchanged, long descriptions scroll naturally, and private/inactive values do not leak.

Exit criterion: the contained identity RÄCK is visually accepted across six menu themes and responsive boundaries and has a strict, honest direct-data contract.

Accepted checkpoint (2026-07-30): interactive review accepted the direct compact-card-to-RÄCK transition, the PROFILE / LINK / TECHNICAL module hierarchy and switching, long-form profile content, exact close/return behavior, real LSP3 media, landscape NFT rendering, progressive asset painting, responsive layouts, and the shared six-theme token system. The native-dialog implementation is replaced by a body portal with reversible inert ownership, explicit close fallbacks, exact post-close trigger focus, and the Phase 6 source-to-viewer transition grammar. Runtime projection isolates unresolved asset references as placement-local placeholders so valid indexer batches paint before enrichment completes. Shared LSP3 normalization and independently lazy profile contract facts remain separate in responsibility. The final focused Phase 7 set passes 72 tests. The production build and existing-build check pass at owner CSS 64,311 raw / 9,483 gzip and core JavaScript 1,881,375 raw / 556,604 gzip. The full suite and dedicated browser lifecycle were not rerun for this closing checkpoint; the earlier dedicated Edge route reached the owner and identity RÄCK and exposed the now-corrected focus timing issue, while its final post-fix run exceeded the local 150-second harness deadline without a reported application assertion. No canonical draft/publication schema, storage, writer, wallet, visitor, prototype identity viewer, Keeper movement, or category/PORTALS behavior changes are part of Phase 7.

### Future identity boundary — PERSONA / ALTER PERSONA (documentation only)

The future public-facing presentations are named exactly **PERSONA** and **ALTER PERSONA**. Do not call them “Persona Mode” or “Incognito”.

- **PERSONA** is the standard light/Mist presentation, based on the official Universal Profile and LSP3-authored profile data. Provenance: `SOURCE / UNIVERSAL PROFILE`.
- **ALTER PERSONA** is the alternate dark/Carbon presentation, optionally layering INSCAPE-authored identity over the official profile. Provenance: `SOURCE / INSCAPE`.

Alter Persona is a presentation layer, not technical anonymity, privacy, verification, or a second on-chain account. Editing or activating it never mutates the Universal Profile or changes external LUKSO/application profiles. Required explanatory copy: “Your Alter Persona changes only how you appear inside INSCAPE. Your Universal Profile and external profiles remain unchanged.”

Future fields may include display name, resident code or call sign, alternate profile and background images, one-line tagline, long bio, metadata tags, optional location, optional external handles, links, per-field visibility, and per-field inheritance. Untouched fields inherit from PERSONA; overrides are explicitly INSCAPE-authored, may be selective, and never require duplicating the full profile. External handles are optional because they may connect the presentations. Location is never inferred and is hidden by default. No checkmark implies verification.

The future compact-card interaction may use the approved square-grid mask icon, the current light/Mist surface for PERSONA, existing Carbon tokens for ALTER PERSONA, a lattice-cell image dissolve, and the same reversible compact-card-to-image-plus-RÄCK transition. Carbon must reuse existing tokens and contrast rules. No editor, schema, persistence, publication, inheritance, provenance, rollback logic, toggle, or production interaction is approved by this boundary.

## Phase 7.5 — production Keeper resident movement

Status: `[x]` — **cursor follow and follow-disabled click-to-move implemented, verified, and interactively accepted**

Goal: connect the existing full X/Y Keeper movement engine to the production lattice before publication and visitor cutover.

Includes:

- pointer-follow is the primary mouse/pen direction, enabled by default and coalesced to the latest target once per animation frame;
- right-clicking the dock exposes session-only `FOLLOW CURSOR` and `SLOW / NORMAL / FAST` controls; left-click remains exclusively dock/release;
- continuous follow retains engine easing but uses a 0.55px finishing cadence instead of the ordinary click-to-move 3px floor;
- touch remains excluded; when `FOLLOW CURSOR` is off, primary activation on eligible empty canvas requests one click-to-move target without enabling continuous follow;
- ARRANGE ON empty-table activation retains authoring deselection and never causes incidental Keeper movement;
- placement activation, authoring gestures, table drag/swipe navigation, bounded Space-drag camera movement, and Keeper movement have deterministic ownership;
- screen, active-table, and camera coordinates resolve to stable Keeper targets without jumps during table arrival or responsive resizing;
- dock/release containment, reduced motion, profile switching, Keeper visibility, and existing engine movement bounds remain intact;
- the owner controller delegates to the existing shared resident engine; Phase 8 visitor wiring must reuse the accepted controller and engine contract rather than invent movement during cutover.

User visual test:

1. With ARRANGE OFF, release the Keeper and exercise the approved pointer-follow behavior across the active table.
2. Confirm the Keeper follows smoothly within the approved resting and sampling rules while artwork activation and table navigation remain unchanged.
3. Turn ARRANGE ON and confirm empty activation deselects only, without moving the Keeper.
4. Navigate and Space-drag between tables, resize the viewport, dock/release, and switch profiles; confirm movement remains bounded, stable, and conflict-free.
5. Enable reduced motion and confirm target placement and dock transitions remain usable without unintended animation.

Exit criterion: the production lattice has deterministic full two-dimensional resident Keeper movement that is ready to be reused unchanged by the published visitor runtime.

Excluded: autonomous roaming, AI or personality behavior, dialogue authoring, event-reaction authoring, sound, scenes, and the later side-scrolling/free-roam world.

Accepted checkpoint (2026-07-31): interactive review accepted cursor follow, the session-only follow toggle and speed controls, follow-disabled empty-canvas click-to-move, and deterministic interaction ownership. A production placement activation initially leaked into click-to-move because the production renderer used `data-placement-id` rather than the older placement-layer marker; the accepted correction now rejects placements and controls at both pointer-down and pointer-up. The focused owner/follow/engine set passes 33 tests with 0 failures; the production build, budgets, and `git diff --check` pass. Phase 8 visitor reuse must preserve this controller contract.

Accepted checkpoint (2026-07-30): interactive review accepted smooth released-Keeper cursor follow, the refined continuous arrival, session-only follow toggle and three speed presets, dock/release, ARRANGE and Space-drag ownership, and the absence of click-to-move. Pointer input is latest-target-only per animation frame; touch is ignored. Browser, Theme, NFT viewer, identity RÄCK, ARRANGE, CROP, placement gestures, table navigation, Space-camera movement, docking, and active transitions cancel or suppress follow deterministically. Reduced motion places targets without a flight. The focused closing set passes 47 tests. The production build and direct existing-build budget check pass at initial JavaScript 1,235,727 raw / 360,878 gzip, owner JavaScript 210,675 raw / 62,714 gzip, owner CSS 66,171 raw / 9,667 gzip, and core JavaScript 1,885,126 raw / 557,885 gzip. The owner-only CSS budget is deliberately recalibrated to 67,000 raw / 10,000 gzip for the shared-theme dock controls; every other budget remains unchanged. The full suite and browser lifecycle were not rerun. No schema, persistence, publication, wallet, visitor, category/PORTALS, Keeper personality, or sound behavior changes.

Click-to-move correction checkpoint (2026-07-31, awaiting interactive acceptance): cursor follow, its session toggle, and its speed controls remain unchanged. When follow is disabled and the Keeper is released, a sub-threshold primary activation on otherwise unowned empty canvas requests one bounded, non-continuous target through the existing resident engine. ARRANGE, placements, NFT/identity inspection, Browser/Theme/RÄCK, CROP, composition gestures, table navigation, Space-camera ownership, touch, and the Keeper dock retain priority. Movement speed and reduced-motion behavior reuse the accepted engine options. The focused owner/follow/engine set passes 32/32.

## Phase 8 — publication and visitor integration

Status: `[x]`

Goal: publish and resolve the canonical nine-table workspace through the existing wallet/IPFS flow.

Includes:

- Phase 8A first deploys one visitor-safe version-8 runtime and uses it for Owner Preview before publication is enabled;
- Owner Preview receives the exact pure public projection and provides no authoring controls or writes;
- deterministic public-document projection;
- Pinata credentials remain server-side;
- wallet signs only the correct profile publication;
- directory resolution points to the latest valid publication;
- owner draft and public projection remain distinct;
- direct visit, logged-in iframe, logged-out iframe, and visitor search resolve the same publication;
- visitor navigation works without owner authoring controls.
- owner-only categories remain excluded from publication and visitor navigation.

### Phase 8A.1 — shared version-8 visitor runtime and Owner Preview

Status: `[x]` — implemented, automatically verified, and interactively accepted on 2026-08-01.

Current seam: `PublishedProfileBoundary` already resolves and validates version 7 and version 8 documents, and version 8 already carries a validated canonical `lattice`. `PublishedProfileDocumentPreview` nevertheless sends every resolved document into the legacy `PublishedHomeWorld`; owner `ProfileDocumentPreview` bypasses even that selector and calls the same legacy world directly. The accepted `LatticeProductionTableRenderer`, lattice navigation controller, production media adapter, and public projection are already presentation-only and visitor-safe.

Implement one version-aware preview boundary. Versions 1–7 continue to render through the unchanged legacy world. Version 8 renders through one new visitor-safe lattice world used by resolved public visits and Owner Preview. The lattice world starts at the deterministic center table, supports the accepted nine-table pointer, wheel, keyboard, chevron, and minimap navigation, retains bounded responsive camera behavior, and persists no active table or camera state. It consumes only `document.lattice`; canonical appearance comes from that projection and must not inherit the owner's session-only Theme override.

Owner Preview builds a validated version-8 document from the accepted canonical draft and current accepted production asset records, then passes that document through the same version-aware published-preview boundary. Entry must fail closed while any required public placement cannot produce a valid public asset reference. Entering Preview cancels incomplete gestures and closes authoring surfaces with zero persistence; preview exposes one explicit exit plus Escape and restores exact trigger focus. It performs no publication, wallet, IPFS, directory, baseline, reconciliation, Library, canonical-draft, or profile-metadata write.

The first slice includes shared lattice navigation and rendering only. NFT viewer, public identity module, and the accepted Keeper movement controller remain required Phase 8A follow-up slices before the visitor runtime is accepted. Category publication/navigation, PORTALS, presentation editors, mobile authoring, and version-8 publication remain excluded.

Implementation checkpoint (2026-07-31): the published preview boundary now selects the lattice world only for a readable version-8 document with a canonical lattice; versions 1–7 retain `PublishedHomeWorld`. Owner PREVIEW constructs and validates a public-only version-8 projection from the canonical draft and accepted asset records, fails closed for unresolved referenced assets, cancels incomplete owner sessions with zero persistence, and restores the Preview trigger on exit. The shared visitor-safe world renders all nine tables and supports pointer, wheel, keyboard, chevrons, minimap, responsive width-fit, bounded per-table Space-drag camera state, and reduced motion. No publication writer, wallet, IPFS, directory, owner store, or schema default changed. Focused tests pass 45/45 and the production build/budgets pass. Interactive inspection remains required before this slice is accepted.

Acceptance correction (2026-08-01): interactive Owner Preview review exposed and accepted corrections for a stale camera-cancel callback, eager loading on the transformed active table, same-frame snap activation, and pointer/focus ownership above the inert owner interface. Pointer drag, wheel, arrows, chevrons, minimap, Space-camera movement, Escape, and the explicit mouse exit are now accepted for the shared version-8 lattice world.

Rollback: select `PublishedHomeWorld` for all documents and disable the owner PREVIEW command. Version-8 validation, reading, canonical drafts, and retained compatibility fields remain valid; no data migration or rewrite is authorized.

First-slice implementation set: `PublishedProfileDocumentPreview.jsx`, `ProfileDocumentPreview.jsx`, one new visitor-safe lattice world plus focused styles/tests, `OwnerLatticeShell.jsx`, and only the narrow preview-document builder/integration helpers required to produce a validated version-8 document. `PublishedProfileBoundary`, publication repositories/writers, wallet/IPFS code, version defaults, owner storage, schemas, adapters, reconciliation, and the frozen prototype remain unchanged unless the audit exposes a correctness defect requiring a separately recorded correction.

### Phase 8A.2 — production NFT viewer in Visitor

Status: `[x]` — implemented, automatically verified, and interactively accepted on 2026-08-01.

Decoded placements on the active Visitor table now activate the accepted Phase 6 `LatticeFocusViewer` and `LatticeProductionFocusArtwork`. Opening freezes the real published placement rectangle, hides only that source while the modal owns it, decodes the native media before handoff, and closes to the current exact source with focus restoration. Previous/next wraps over ready placements on the same table and retains the accepted pointer, wheel, swipe, arrow-key, focus-trap, inert-background, Escape, reduced-motion, responsive RÄCK, and 92% veil behavior.

The Visitor adapter consumes only the already validated public asset projection. An explicit published-metadata trust boundary exposes its safe name, description, attributes, creators, media, contract, token ID, standard, network, dimensions, and derived explorer route without importing Library state or Chillwhales, Envio, RPC, wallet, persistence, authoring, or publication writers. The RÄCK inherits the publication's active `menuSurfaceId` and existing menu tokens; NFT metadata never controls its colours. The owner viewer's stricter normalized/provenance behavior remains unchanged.

Focused Phase 8 rendering, media, visitor isolation, preview, and owner regression tests pass 51/51. The production build and budgets pass at initial JavaScript 1,236,878 raw / 361,366 gzip, owner JavaScript 257,179 raw / 75,502 gzip, owner CSS 65,236 raw / 10,857 gzip, and core JavaScript 1,971,037 raw / 583,606 gzip. The measured Phase 8A.2 visitor-parity growth receives a bounded core budget adjustment while initial and owner-JavaScript ceilings remain unchanged. No schema, storage, version default, publication, wallet, IPFS, category, identity, Keeper, or legacy-runtime behavior changes.

Rollback: remove Visitor's optional renderer activation/media callbacks and viewer portal, and disable the published-metadata viewmodel option. The accepted Phase 8A.1 lattice world, owner viewer, canonical publication, and versions 1–7 fallback remain readable and unchanged.

Short visual test: in Owner PREVIEW, click or press Enter on a decoded NFT; confirm it expands from that exact placement, switches from authored crop to native artwork without a flash, uses the active theme RÄCK, browses with buttons/arrows/wheel/swipe, blocks the background, and closes by X/veil/Escape to the exact current NFT with focus restored. Repeat with square/transparent, landscape, portrait, a long description, one-item and multi-item tables, narrow viewport, and reduced motion.

Post-implementation input-ownership correction (2026-08-01): interactive review found that NFT activation could also prime the underlying Visitor table drag gesture, leaving movement apparently held after closing inspection. Placements are now explicit non-navigation pointer targets, and viewer close releases any retained table/camera pointer capture and resets transient drag, wheel, Space, and gesture state before returning control. This changes no viewer, publication, or owner interaction contract.

Preview asset-readiness correction (2026-08-01): interactive review found two consecutive mount/profile/cache timing paths that made artwork appear to depend on first opening Browser. The owner runtime now starts the existing profile-scoped Library load whenever the accepted profile is ready and the store is idle; Browser open/closed state is presentation-only. Because entering Preview unmounts the owner runtime and can interrupt its in-flight image elements, the validated version-8 entry table's unique exact published media URLs are also decoded before that handoff, with an eight-second maximum wait. This readiness gate does not substitute thumbnails, alter the public projection, mutate metadata, persist state, or preload non-entry tables. The existing generation guards, progressive cached paint, duplicate-load suppression, authoring projection, repositories, and zero-write Preview boundary remain unchanged.

Preview media-settlement correction (2026-08-01): repeated interactive Host/Visitor switching proved that a small subset of exact media requests could stall until a later request populated the browser cache. The shared production renderer now gives only eager active-table media up to three bounded attempts, recreating the image request after each four-second stall. Lazy offscreen tables receive no retry traffic. Every active placement therefore settles as decoded artwork or an honest unavailable state instead of retaining `LOADING ARTWORK` indefinitely; URLs, public data, repositories, and publication remain unchanged.

Interactive acceptance (2026-08-01): Owner Preview navigation, production NFT activation/viewer return, input release, Browser-independent cold entry, and bounded media settlement are accepted. Cold remote artwork can still require a few seconds of honest network/decode time; repeated Host/Visitor switching is no longer required and no placement remains indefinitely in `LOADING ARTWORK`.

### Phase 8A.3 — public identity RÄCK in Visitor

Status: `[x]` — implemented, automatically verified, and interactively accepted on 2026-08-01.

Visitor now exposes one compact, fixed public identity card that expands directly into the accepted PROFILE, LINK, and TECHNICAL MODULE RÄCK. The adapter reads the validated version-8 `profile.cachedIdentity` and `lattice.identityPresentation`, including the embedded public avatar asset, published alias/bio/tags/visibility, and canonical menu surface. Live official LSP3 identity remains a public read and enriches the safe cached first paint; direct contract facts are enabled only while the identity RÄCK is opening or open.

The RÄCK retains the accepted body portal, 92% veil, source-to-rack transition, one-open-module ownership, focus trap, Escape/veil/X close, exact source return, responsive layout, reduced motion, and shared theme-token contrast. NFT inspection and identity inspection remain mutually exclusive. No owner draft, Persona/Alter Persona editor, private field, Library record/store, category, wallet, persistence, publication writer, schema, or version default enters Visitor.

Post-implementation input-ownership correction (2026-08-01): interactive review found that closing the Identity RÄCK by pointer could leave the underlying Visitor table behaving as though its primary pointer remained held. Identity close now releases table and camera pointer capture and clears drag, wheel, Space, and gesture state when closing starts, then repeats the release at the completed return handoff. The NFT viewer uses the same Visitor-owned release boundary. Focused Visitor and Identity RÄCK contracts pass 13/13; publication and Owner behavior are unchanged.

Interactive acceptance (2026-08-01): the compact public profile card, direct Identity RÄCK activation, module interaction, exact return, and corrected pointer release are accepted in Owner Preview. Closing identity no longer leaves the Visitor table grabbed.

Focused identity, Visitor, renderer, rail, theme-contrast, and isolation tests pass 26/26. The production build and bounded budgets pass at measured core JavaScript 1,977,561 raw / 587,257 gzip, owner JavaScript 77,259 gzip, and owner CSS 11,642 gzip. The small Phase 8A.3 allowance records the shared public identity adapter and existing RÄCK/theme compression boundary; initial entry and raw owner ceilings remain unchanged.

Rollback: remove the compact Visitor `LatticeProfileRail`, published identity adapter, and lazy identity RÄCK activation. Version-8 validation, public identity fields, Owner Identity RÄCK, Visitor lattice/viewer, and versions 1–7 remain readable and unchanged.

Short visual test: enter Owner PREVIEW without opening Browser; activate the compact profile image at the upper left. Confirm one direct card-to-RÄCK transition, PROFILE/LINK/TECHNICAL switching, authored and system links, active theme colours, background inertness, long-description scrolling, and close by X/veil/Escape to the exact compact card with focus restored. Repeat at 390×844 and with reduced motion; confirm clicking an NFT and opening identity never own the interface simultaneously.

User visual test:

1. Preview profile A before publication and confirm it matches the later visitor runtime exactly.
2. Publish from profile A.
3. Visit from profile B, logged out, direct URL, and iframe.
4. Compare all nine tables, public identity, viewer data, and Keeper navigation; confirm owner categories and authoring state are absent.
5. Publish a second revision and confirm all visitor paths resolve the latest valid document.

Exit criterion: publication, directory discovery, and visitor rendering are deterministic across accounts and embedding contexts.

### Phase 8A.4 — Keeper parity in Visitor

Status: `[x]` — implemented, automatically verified, and interactively accepted on 2026-08-01.

The version-8 Visitor now reuses the accepted Phase 7.5 resident movement controller and shared `KeeperDock`. Mouse and pen cursor-follow remain enabled by default and coalesce to the latest target once per animation frame. The dock retains session-only `FOLLOW CURSOR` and `SLOW / NORMAL / FAST` controls; when follow is disabled, one sub-threshold primary activation on eligible empty table space requests click-to-move through the same resident engine.

The public component graph receives only explicit movement and dock capabilities. It never receives the owner `residentHandoff` object, owner stores, authoring state, persistence, wallet, or publication writers. NFT placements, identity/profile controls, fixed chrome, active viewer or Identity RÄCK, table drag/swipe, Space-camera movement, docking, and table settling retain priority and cancel or suppress pending follow work. Touch remains excluded. Dock/release and reduced-motion options use the existing engine contract; no second movement implementation exists.

Focused Visitor, legacy-public, preview, dock, pointer-controller, and isolation tests pass 37/37. The production build passes, and the independent production budget checker passes at 1,237,517 initial JavaScript bytes. `git diff --check` passes. An ordinary unactivated Visitor click now also bypasses redundant same-table snapping, matching the accepted Owner gesture boundary. No schema, canonical projection, storage, publication version, wallet/IPFS, category, Keeper personality, reaction, dialogue, or sound behavior changes.

Rollback: remove the version-8 Visitor `KeeperDock`, pointer scheduler, and explicit dock-capability props. The shared resident engine, accepted Owner Keeper controller, Visitor lattice/viewer/identity runtime, and versions 1–7 legacy callbacks remain unchanged and readable.

Short visual test: enter Owner PREVIEW with the Keeper released. Confirm it follows idle mouse movement smoothly, does not move while hovering or activating an NFT/profile/chrome control, and remains suppressed during table drag, Space-camera movement, snapping, NFT inspection, and Identity RÄCK inspection. Right-click the dock, disable `FOLLOW CURSOR`, click empty table space once, and confirm one bounded move; confirm dragging the table does not move it. Exercise SLOW/NORMAL/FAST, dock/release, reduced motion, and a 390×844 viewport.

Phase 8A completion audit (2026-08-01): the version-aware boundary routes readable version 8 through one shared Visitor lattice used by Owner Preview and resolved visits, while versions 1–7 retain the legacy renderer. The v8 Preview builder remains a pure validated public projection; renderer, viewer, identity, and Keeper import graphs exclude owner stores, persistence, reconciliation, wallet, publication writers, categories, and prototype fixtures. The combined Phase 8A/runtime/rollback/publication-guard set passes 79/79. Production build, budgets, and `git diff --check` pass. Interactive review accepted Keeper cursor-follow, follow-disabled click-to-move, dock/release, speeds, suppression boundaries, and reduced-motion behavior; Phase 8A is complete.

## Phase 8B — version 8 publication

Status: `[x]` — implementation, automatic verification, publication-surface inspection, and the real revision-one/revision-two publication cycle were interactively accepted on 2026-08-01.

Goal: publish one frozen, canonical version-8 owner lattice snapshot through the unchanged public-IPFS, wallet, ERC725Y-pointer, and exact read-back sequence. The already deployed version-aware resolver remains the reader authority, and versions 1–7 remain readable through the legacy renderer.

Authoritative implementation boundary:

- build the production snapshot with the existing pure `buildProfileDocumentV8`; do not publish the Preview document unchanged, because its fixed revision and epoch timestamps exist only for deterministic session Preview;
- derive the v8 compatibility envelope and public lattice from the same canonical owner draft, exact profile authority, and accepted asset-record generation used by Preview;
- fail closed before snapshot installation when any public placement reference is unresolved, mismatched, unsupported, or belongs to another profile;
- set `exportedAt` once per snapshot, preserve the first valid `createdAt`, increment the last installed/published revision, and require `lattice.lastPublished === exportedAt` through ordinary v8 validation;
- freeze/install that exact validated snapshot before CID work; later draft, asset, wallet, profile, or CID changes must make it stale and require a rebuild/re-verification;
- reuse `uploadProfileDocument`, `createProfileDocumentPublisher`, canonical hashing, verifiable-URI encoding, wallet freshness binding, transaction confirmation, and repository read-back without creating a lattice-specific writer;
- pass explicit owner publication capabilities through the existing App boundary. Do not pass wallet clients/providers into Visitor or the canonical renderer;
- keep `OwnerLatticeShell.jsx` free of direct local-storage, IPFS, canonical-publication, wallet, provider, or repository imports. Its PUBLISH control may lazy-load a bounded production publication surface which receives only the exact snapshot inputs and explicit publication capabilities it needs;
- keep session Theme overrides, Browser categories, private tables/placements, selection, ARRANGE/CROP state, RÄCK geometry, Keeper dock/follow settings, camera position, viewer state, and all other owner/session state out of the publication;
- retain the version-7 builder, reader, renderer, import/restore compatibility, and existing on-chain documents. Do not silently rewrite or republish a version-7 pointer.

Safest wiring order:

1. Add production snapshot-builder tests covering real timestamps/revisions, exact authority, public-only projection, unresolved-asset failure, stable canonical bytes, and `lastPublished` equality.
2. Extend the publication-version policy coherently across canonical artifact creation, client upload, Netlify upload validation, CID verification, wallet submission, read-back, and the bounded snapshot state used by the lattice publisher. No boundary may accept v8 in isolation.
3. Add the lazy owner publication surface and connect PUBLISH only after its imports remain outside the initial and Visitor graphs.
4. Bind the frozen snapshot to the live profile/draft/asset/wallet generations and preserve the existing stale-context rejection immediately before the irreversible provider write.
5. Verify the exact pinned bytes through the already deployed v8 reader before enabling wallet publication, then require the post-transaction resolution to match the frozen artifact hash.
6. Run focused guards, production build/budgets, owner/Visitor import-isolation checks, and the manual cross-account/direct/iframe matrix before marking Phase 8B accepted.

Expected implementation files:

- `src/profileDocument/domain/constants.js` and publication-version-policy tests;
- `src/profileDocument/domain/profileDocumentBuilder.js` plus focused v8 snapshot-builder tests;
- `src/profileDocument/domain/profileDocumentPublication.js` and its tests;
- `src/profileDocument/storage/profileDocumentUploadClient.js`, `src/profileDocument/storage/profileDocumentPublisher.js`, and focused tests;
- `netlify/functions/pin-profile-document.mjs` and its function tests;
- one new lazy lattice publication surface/controller under `src/public/`, with focused tests and only the minimum shared RÄCK/theme CSS;
- `src/public/OwnerLatticeShell.jsx`, `src/App.jsx`, and their isolation/integration tests for explicit capability wiring;
- this roadmap and `INSCAPE_PRODUCTION_INTEGRATION_INVENTORY.md`.

Snapshot persistence decision: do not overload the legacy `os-underneath.profile-snapshot.v1:` record or broaden `profileDocumentStorage.js` merely to make the new UI convenient. The first Phase 8B slice keeps the frozen v8 snapshot in profile-scoped runtime state. Durable v8 draft/snapshot recovery is a separate migration only if Alpha testing proves it necessary. This preserves the established version-7 import/restore and rollback contract.

Explicit exclusions: schema version 9; draft-store migration; category/PORTAL publication; private data; Persona/Alter Persona; marketplace behavior; a second IPFS or wallet implementation; server-side signing; automatic republish; destructive rollback; publication from Visitor/iframe; prototype changes; legacy cleanup.

Rollback: disable the PUBLISH control and restore the publication-version allowlist to version 7 for new writes. Keep the v8 reader and renderer deployed so already published v8 documents remain readable. Returning an on-chain profile pointer to version 7 is a new irreversible owner-authorized publication and is never an automatic rollback action.

Lean verification plan:

- focused builder/validator/serialization/publication/upload/server/publisher tests, including v7 and v8 positive cases and unsupported-version negative cases;
- stale snapshot, changed asset generation, changed profile, changed wallet/provider generation, changed CID, duplicate submission, failed receipt, and hash-mismatched read-back tests;
- owner and Visitor transitive import-isolation checks;
- one production build, bounded budget check, and `git diff --check` before interactive publication;
- manual publish profile A, then visit from profile B, signed out, direct URL, and logged-in/logged-out iframe; compare all nine tables, public identity, viewer facts, Keeper behavior, exact revision, and absence of owner controls/private state; publish revision two and repeat.

Exit criterion: the user accepts one real v8 publication and its second revision across every visitor route; the resolved document matches the frozen canonical bytes, v7 remains readable, and rollback requires no data deletion.

Pre-writer implementation checkpoint (2026-08-01): `ownerLatticePublicationDocument.js` now provides the pure production snapshot boundary without being imported by Owner UI or any writer. It reuses `buildProfileDocumentV8`, validates exact lattice/profile authority, preserves the first creation time, increments the prior validated publication revision, advances the export time monotonically, and lets ordinary validation enforce exact `lattice.lastPublished` equality. The compatibility spaces/canvas remain empty; private placements remain excluded; unresolved or mismatched public asset references fail closed. Frozen identical inputs serialize to identical canonical bytes. The focused v8 builder/Preview/production-snapshot set passes 12/12 and `git diff --check` passes. Publication version 7 remains the only accepted writer version; no upload, server, CID, wallet, provider, storage, or UI boundary imports or enables this builder yet.

Implementation checkpoint (2026-08-01): publication versions 7 and 8 now share one coherent canonical-artifact, upload, server-validation, CID-verification, wallet-submission, receipt, and resolver-read-back policy; unsupported versions remain rejected. The legacy local snapshot key remains deliberately version-7-only. Owner `PUBLISH` lazy-loads a profile-scoped RÄCK surface which explicitly separates PREPARE SNAPSHOT, UPLOAD + VERIFY (or manual CID verification/download), and PUBLISH VERSION 8. Its frozen context binds canonical bytes, draft and asset generations, CID generation, profile authority, wallet/provider state, and exact read-back; changing public content makes the artifact stale before an irreversible provider call. Session Theme, categories, private placements, owner UI state, and fallback display identity remain excluded. Closing resets the publication session and restores exact trigger focus.

Automatic verification passes 56/56 focused builder, validator, canonical-publication, upload, Netlify boundary, publisher, Owner-shell, Preview, and context tests. `git diff --check` passes. The production build and bounded budgets pass; the publication surface remains a separate lazy chunk at 29.04 kB raw / 9.90 kB gzip, Owner shell is 120.48 kB raw / 32.34 kB gzip, and the initial entry remains 1,237.75 kB raw / 362.45 kB gzip. Phase 8B remains open only for interactive surface checks and an explicit real publication/read-back matrix; no automatic wallet action was performed.

Interactive surface acceptance (2026-08-01): the owner accepted the PUBLISH RÄCK presentation, explicit snapshot preparation, FROZEN/STALE refresh behavior, and close/focus-return boundary. No upload, wallet signature, transaction, or on-chain pointer change was performed. Phase 8B remains open only for the explicit revision-one/revision-two publication and cross-route read-back matrix.

Final Phase 8B acceptance (2026-08-01): the owner published a real version-8 revision one from the verified production deployment, opened that published workspace through the direct `?view=0x…` route while authenticated as a different Universal Profile, then made one public owner-workspace change and published revision two. The second visitor read-back exposed the updated workspace correctly. This interactively confirms the public-IPFS upload, canonical CID verification, owner wallet transaction, on-chain pointer, latest-revision resolver, cross-account isolation, and direct visitor route. Phase 8 is complete; no rollback or data repair is required.

## Phase 9 — MODUL-8R staged parity, atomic cutover, and Alpha hardening

Status: `[x]`

Goal: build complete MODUL-8R parity outside the live production route, then switch one bounded owner integration atomically without deleting the fallback prematurely.

Includes:

- behavior-preserving extraction of reusable floating-window controllers before any visual work;
- a clean `.modul8r-*` production presentation that does not inherit old Rack/Browser structural CSS;
- a development-only owner comparison entrance proven absent from production output;
- real Library, Activity, People, Layers, Settings, and Theme parity through bounded adapters over existing authorities;
- one explicitly reversible atomic owner cutover only after complete parity acceptance;
- production error/loading/empty states;
- keyboard, focus, reduced-motion, and responsive checks;
- owner/visitor isolation audit;
- storage/publication migration audit;
- CSS/JS budget and build checks;
- live Netlify/domain smoke test;
- no Gallery room, Upper room, social room, marketplace execution, mobile authoring, or Keeper dialogue system in Alpha unless separately approved.

Signed-out direct-visit correction (2026-08-01, awaiting live acceptance): an explicit public `?view=0x…` target already resolves independently of wallet authority, but the Startveil gesture still opened the standalone sign-in modal whenever no wallet was connected. Entry now suppresses that connector request only for an explicit public profile target. The ordinary homepage retains sign-in, embedded visits remain host-owned, connected owner routing is unchanged, and the public boundary still receives no wallet or authoring capabilities. Focused routing, URL, owner-access, and visitor-isolation checks pass 14/14. The required visual test is a fresh private browser with no extension: open a published direct URL, enter through Startveil, and confirm the workspace is immediately viewable without a login modal.

Owner navigation completion checkpoint (2026-08-01, awaiting interactive acceptance): the stale Phase-4 disables are removed from CREATIONS, ACTIVITY, DISCOVER, and MORE. DISCOVER opens the current public INSCAPE profile directory and never revives Gallery. ACTIVITY opens indexed event history with explicit loading, partial, retry, refresh, close, Escape, and focus-return behavior; it remains distinct from metadata. CREATIONS reuses the isolated creator-attribution repository and opens decoded works through the accepted production NFT RÄCK, never the rejected flip/card viewer. MORE exposes only the existing functional SETTINGS surface; the undefined INTERFACE affordance stays hidden. The owner-only boundaries remain lazy and no schema, storage, publication, route, wallet, IPFS, visitor capability, Gallery, Upper, marketplace, or Keeper-dialogue behavior changes. The focused functional set passes 37/37, production-budget tests pass 9/9, and the production build passes at 1,238,211 initial JavaScript raw / 361,775 gzip, 261,694 owner JavaScript raw / 79,206 gzip, 65,581 owner CSS raw / 12,430 gzip, and 2,016,189 core JavaScript raw / 601,296 gzip. The owner JavaScript ceiling is deliberately recalibrated to 263,000 raw / 80,000 gzip and owner CSS gzip to 12,500 for this measured activation; initial limits remain unchanged.

Superseded MODUL-8R direction checkpoint (2026-08-01, documentation only): this checkpoint correctly selected the universal owner `MODUL-8R` name, LIBRARY/ACTIVITY/PEOPLE/LAYERS information architecture, exclusive-open content chassis, contextual Search/Size, Layers usage consolidation, Settings/Theme direction, and unchanged NFT/Identity RÄCK terminology. Its proposed narrow in-place shell cutover is superseded by the accepted 2026-08-02 architecture audit below. No runtime behavior changed at this checkpoint.

Owner-window styling checkpoint (2026-08-01): the standalone CREATIONS and ACTIVITY rollback surfaces now inherit the active owner menu/theme tokens and IBM Plex Mono interface grammar instead of fixed legacy colours. Their clean L-corner resize handles, the Browser resize handle, hidden native scrollbar buttons, and the seven-pixel expanded rack-content inset share the accepted owner-window treatment. The focused Browser, owner-shell, Creations, theme-window, and shared RÄCK-menu set passes 37/37; `git diff --check`, the production build, and the explicit production budget check pass at 1,238,211 initial JavaScript bytes. No repository, data, routing, persistence, publication, wallet, visitor, or prototype behavior changes.

MODUL-8R production-integration architecture checkpoint (2026-08-02, read-only and accepted): do not evolve `LatticeRackShell` into MODUL-8R in place. Browser currently owns Rack state and geometry, Rack CSS consumes Browser variables, Browser CSS reaches into Rack selectors, and the accepted accordion requires a different structure and transition model. The accepted sequence extracts reusable headless window/controllers first, builds a fresh `.modul8r-*` presentation behind a development-only owner entrance, connects real repositories through bounded adapters, certifies complete visual/functional/isolation/budget parity, and only then switches one owner import/wiring boundary atomically. The current `THE RACK`, Browser, standalone windows, routes, and production bundle remain unchanged through the parity gate. Old presentation source is retained as rollback until live cutover acceptance and a fresh reachability audit. The rejected uncommitted hybrid Task 1 was restored before this audit and contributes no checkpoint code. The sole detailed execution authority is `INSCAPE_MODUL8R_ROADMAP_AND_BOUNDARY.md` Task 1–9.

MODUL-8R Task 1 checkpoint (2026-08-02, implemented and interactively accepted): checkpoint `40f4137` extracts generic floating-window geometry and controllers into `src/lattice/windows/` while preserving the Browser workspace's exact `move`, `rackWidthResize`, `resize`, `windowPosition`, and `windowSize` interface. The production `THE RACK`, Browser JSX/CSS, standalone windows, routes, prototype, owner/visitor boundaries, schemas, storage, publication, and wallet behavior remain unchanged. The focused floating-window and Browser set passes 24/24 and `git diff --check` passes. Interactive review accepted movement, both resize paths, viewport containment, close/reopen, reduced motion, and the existing focus, Escape, inert, and stacking behavior. Task 2 is not started.

MODUL-8R Task 2 checkpoint (2026-08-02, implemented and interactively accepted): checkpoint `ea23eb7` adds a clean production-grade `Modul8rShell`, separate shell model, fresh `.modul8r-*` stylesheet, focused tests, and the strictly development-only `/development/owner/modul-8r` entrance. The accepted master/module geometry, fixed order, exclusive-open behavior, collapse state retention, right-edge resize, responsive containment, focus/Escape behavior, reduced motion, six themes, and title click-versus-drag semantics are preserved; the title is visible and aligned with the module labels. The final focused shell/controller set passes 9/9, the real Edge browser matrix passes 1/1, the previously verified Task 1 Browser regression set passes 24/24, `git diff --check` and the production build pass, and output, manifest, and owner-runtime-graph searches contain zero MODUL-8R development markers. The live owner graph and Task 3 remain untouched.

MODUL-8R Task 3 checkpoint (2026-08-02, implemented and interactively accepted): checkpoint `bbf03d8` mounts the real profile-scoped Library inside the development-only live-owner shell at `/development/owner/modul-8r?live=1` through a bounded adapter over the accepted Browser content, workspace-v8, category-command, progressive-media, selection, and canonical placement authorities. Search, Size, filters, labels, unavailable results, category operations, drag-to-category, and ARRANGE-gated drag-to-canvas remain functional without importing the old Browser window or `THE RACK` presentation. Focused Task 3 tests, the production build and budgets, and production output/manifest/owner-runtime isolation checks passed. The old production Browser and `THE RACK` remain live and are the rollback; no production route was cut over.

MODUL-8R Task 4 status (2026-08-02): `[x]` — Activity and People headless controllers and development-shell adapters are implemented, automatically verified, and interactively accepted at checkpoint `16abf9b`, including the limited core-budget recalibration.

MODUL-8R Task 4 accepted checkpoint (2026-08-02): checkpoint `16abf9b` makes the standalone Activity and Profile Discovery surfaces delegate request/query/selection state to DOM-free injected controllers while retaining their existing window, modal, focus, Escape, resize, and restoration ownership. Development-only Activity and People adapters consume those controllers through an explicit stable active lifecycle; switching modules, collapsing the master, closing MODUL-8R, or unmounting aborts active work without discarding accepted rows, results, query, or selection state. People selection still calls the existing owner `onVisitProfile` authority, and Activity retains indexed-event and official-profile-link provenance. The focused controller/repository/standalone/MODUL-8R/owner-isolation set passes 68/68, production-build utility tests pass 9/9, the six-theme/six-viewport shell browser matrix passes 1/1, the production build and budgets pass, and production output/manifest/owner-graph searches contain zero development MODUL-8R markers. The interactively approved limited aggregate core ceiling is 2,025,000 raw / 605,000 gzip; actual core is 2,021,273 raw / 603,175 gzip while initial entry remains 1,238,211 raw / 361,786 gzip. The pre-existing real-App owner-routing browser harness passed two cases but its owner A-to-B case failed twice during Startveil/navigation timing, and the published-visitor fixture failed before mounting; neither failure is claimed as a Task 4 pass. Task 5 remains not started.

MODUL-8R Task 5 status (2026-08-02): `[x]` — the honest OWNED/CREATED Library union is implemented, automatically verified, and interactively accepted at implementation checkpoint `61b8775`.

MODUL-8R Task 5 accepted checkpoint (2026-08-02): checkpoint `61b8775` projects independently progressive owned and strongly creator-attributed records into one canonical stable-ID union. Owned records remain authoritative on overlap; created-only records use the adapter's explicit strong-created path without manufactured ownership, remain visibly `CREATED · NOT OWNED`, and retain actual or null current-owner facts. Accepted created records remain available to canonical placement and editing when MODUL-8R closes, while active CREATED network work is cancelled; profile changes and unmount clear the supplemental authority. Focused correction tests pass 53/53, the expanded Task 3–5/creator/category/viewer/placement/owner-isolation set passes 185/185, the MODUL-8R browser matrix passes 1/1, `npm run build`, `npm run build:check`, and `git diff --check` pass, and production budgets remain within the accepted ceiling. Initial JavaScript is 1,238,211 raw / 361,798 gzip, owner JavaScript is 262,968 raw / 79,544 gzip, and aggregate core JavaScript is 2,021,889 raw / 603,402 gzip. Task 6 remains unstarted and requires a separate explicit instruction.

MODUL-8R Task 6 status (2026-08-02): `[x]` — implementation checkpoint `71282fa` provides canonical active-table Layers, read-only all-nine-table usage navigation, and Settings/Theme parity; it is automatically verified and interactively accepted behind the development-only live-owner boundary. The implementation reuses the exact owner layer/media/selection/reorder/navigation authorities, the signal Settings store, and session-only owner surface/menu theme callbacks. MODUL-8R Library alone no longer exposes USED ON CANVAS; the production Browser, standalone Settings, top-level Theme, routes, schemas, storage, publication, wallet, visitor runtime, and prototype remain unchanged. Focused sets pass 102/102, the Edge shell matrix passes 1/1, production build/budgets and `build:check` pass at unchanged Task 5 totals, `git diff --check` passes, and production output contains zero MODUL-8R markers. Task 7 remains unstarted.

MODUL-8R Task 7 status (2026-08-02): `[x]` — full development parity, the production bundle gate, and the complete visual confirmation are interactively accepted. No Task 1–6 product-code regression or parity gap was found, so no corrective product scope was added. The complete focused MODUL-8R/controller/repository/owner-isolation matrix passes 176/176, and the real Edge shell matrix passes 1/1 across the accepted six viewports, six themes, reduced motion, drag, resize, module lifecycle, collapse-state retention, close, Escape, and focus restoration. The sequential full suite completes 1,006/1,009; all three failures are pre-existing stale assertions outside this boundary: the Phase 3 visual-fixture graph whitelist predates later canonical authoring dependencies, the legacy viewer test expects a now multiline `createLayout` call, and the frozen MODUL-8R prototype contrast parser accepts only hex despite checkpoint `0f1136d` using valid `rgb(...)` tokens. Those frozen/unrelated sources remain untouched. The production build, budget check, and 18/18 explicit production/owner-isolation checks pass at 1,238,211 initial JavaScript bytes; the owner graph has zero leaks and production output has zero MODUL-8R/development markers. Task 8 remains unstarted and the accepted production rollback surfaces remain intact.

MODUL-8R Task 8 status (2026-08-02): `[x]` — the atomic production owner cutover is implemented at the two-line selected-runtime seam, with a production-named MODUL-8R wrapper and build-selected presentation graph. The old Rack, Browser workspace, and standalone owner windows cannot co-render in the selected owner runtime; all existing canonical authoring, Library, Activity, People, Layers, Settings/Theme, Preview, Publish, focus, profile, storage, wallet, IPFS, and visitor authorities remain in place. Focused Task 8/build/isolation tests pass 50/50, the wider focused matrix passes 463/463, the dedicated real Edge shell matrix passes 1/1, production build and `build:check` pass, and both the MODUL-8R selector and exact two-line LATTICE rollback selector build within budgets. The required full-suite run completed 1,005/1,012; the four Task 8 source-contract failures from that run are corrected and green in later focused matrices, leaving only the same three known stale failures. Final production totals are 1,240,851 raw / 362,737 gzip initial JavaScript, 263,459 / 79,743 owner JavaScript, and 2,043,467 / 611,060 aggregate core JavaScript, with zero owner leaks and no old `BrowserWorkspace` in the selected output. The ordinary-route Edge test reached its late stale Rack-era disabled-control cardinality check after exercising production mounting, navigation, pointer ownership, and storage isolation; the assertion is corrected semantically but not rerun. The user accepted the production preview on 2026-08-02, completing Task 8. Task 9 remains unstarted and unauthorized.

MODUL-8R Task 9 status (2026-08-02): `[~]` — a fresh reachability inventory removed only two superseded presentation panels, `BrowserIndexPanel.jsx` and `BrowserCategoriesPanel.jsx`, plus their exclusive tab/category-section CSS. Every old Rack/Browser/standalone surface required by the exact two-line LATTICE rollback remains, as do shared authorities, visitor/direct/iframe compatibility, tests, fixtures, prototypes, and user assets. The focused production-shell/Browser/selector/isolation set passes 110/113 with three unchanged stale development-wrapper source assertions; a wider authority/workflow set passes 211/211; build utilities pass 10/10; and the real Edge MODUL-8R shell matrix passes 1/1. Both exact LATTICE rollback and restored MODUL-8R builds pass budgets, `build:check` passes, the selected graph has zero owner leaks, and selected output has zero old Browser/Rack, deleted-panel, development-route, fixture, or structure-only markers. The sequential suite completes 1,009/1,015: its failures are the three already documented stale Phase 3/viewer/frozen-prototype checks plus the same three stale wrapper-source assertions, with no Task 9 regression. The ordinary owner-navigation and Browser harnesses timed out, profile routing passed 1/3 before its known timing/cleanup instability, and the legacy published-visitor fixture again failed before mount. Task 9 remains `[~]` pending the required live localhost/deploy/domain/direct/iframe/rollback acceptance; no later work is authorized.

MODUL-8R Task 9 acceptance (2026-08-02): the owner approved the complete cleanup and live acceptance checklist. Task 9 and Phase 9 are `[x]`. This acceptance does not authorize Task 10, broader cleanup, or post-Alpha work.

Post-Task-9 placement-presentation parity repair addendum (2026-08-03): `[x]` — the production owner placement menu and a LATTICE-native inspector restore authoring access to the existing canonical frame, mat, backing, and transparency fields through one stale-safe atomic operation and the existing profile-scoped draft store. The change adds no schema, key, publication or visitor contract, LEGACY/prototype dependency, Task 10 work, or cleanup. Focused verification passes 112/112, wider renderer/domain/visitor isolation passes 82/82, direct/iframe/public-access coverage passes 64/64, both MODUL8R and exact LATTICE rollback builds pass, and the selected graph has zero leaks. The sequential suite remains at its six documented stale failures (1,018/1,024); stale owner browser harnesses fail before reaching this repair. A live pointer-boundary defect found during acceptance was corrected with an explicit interactive portal boundary and a focused 21/21 regression matrix; the production build remains green. The owner accepted the repaired Frame & mat flow on 2026-08-03. This acceptance does not authorize Task 10 or broader work.

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

MODUL-8R Task 9 is `[x]`: the post-acceptance unreachable-presentation cleanup is implemented, automatically verified, and interactively accepted. Do not begin broader cleanup or Task 10, or start embedded mode, Atelier/control cells, MEDI-8R, persistence, schema, publication, wallet, or visitor work without separate approval.
