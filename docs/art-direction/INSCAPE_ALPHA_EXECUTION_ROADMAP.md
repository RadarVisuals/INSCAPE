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
- [ ] Production INDEX/CATEGORIES stores are not yet wired to the isolated Browser.
- [x] Phase 4 fixed chrome is integrated and visually accepted; the production NFT viewer and identity dossier remain later-phase work.
- [ ] Legacy Home/Gallery/Upper/five-table behavior remains compatibility data, not the Alpha destination.

Phase 1 and Phase 2A–2C are complete and approved. The Phase 3 renderer-only checkpoint is accepted and remains `[~]` until later cross-surface integration. Phase 4 is implemented, verified, and visually accepted as `[x]`; Phase 5 is `[~]` after accepted Phase 5A, and Phase 5B onward remains unstarted.

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

Status: `[ ]` — **incomplete; Phase 2C is accepted and Phase 3 has not started**

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

Status: `[~]` — **Phase 5A accepted; Phase 5B onward remains unstarted**

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

Phase 5B onward status: `[ ]` — unstarted and requires a separate boundary review. Placement, geometry, transactions, visibility, crop, presentation, and Owner Preview behavior are not approved by Phase 5A.

User visual test:

1. Place square, portrait, landscape, and transparent assets.
2. Move, resize, crop, layer, mat, lock, reload, and switch profiles.
3. Confirm owner changes persist only for the correct profile.
4. Confirm private assets never appear in visitor preview.

Exit criterion: a user can build a table from real owned assets and recover the exact authored composition after reload.

## Phase 6 — production NFT focus viewer

Status: `[ ]`

Goal: wire the accepted focus-viewer interaction to real NFT facts.

Includes:

- table card expands smoothly from its actual placement;
- artwork remains visually primary;
- independent left narrative/traits dossier and right technical/media dossier;
- both may remain open;
- honest unresolved states, never invented metadata;
- browse next/previous while panel configuration remains stable;
- real creator, contract, marketplace/explorer links only when resolved;
- Escape and close restore focus correctly.

User visual test:

1. Open square, portrait, landscape, transparent, sparse-metadata, and rich-metadata NFTs.
2. Open either and both dossiers.
3. Browse several NFTs by click, chevron, keyboard, wheel, and swipe.
4. Close and confirm the card returns to its original table position without leftovers.

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
