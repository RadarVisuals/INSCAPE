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

- [ ] The frozen lattice UI is not yet the production owner workspace.
- [ ] The frozen lattice UI is not yet the published visitor renderer.
- [ ] The production profile-document schema does not yet use the canonical nine-table model.
- [ ] Production INDEX/CATEGORIES stores are not yet wired to the isolated Browser.
- [ ] Production NFT viewer, identity dossier, and fixed chrome are not yet cut over to the frozen implementations.
- [ ] Legacy Home/Gallery/Upper/five-table behavior remains compatibility data, not the Alpha destination.

Phase 1 production integration inventory is complete and approved. The next work is Phase 2A pure domain definition, not production wiring or more broad prototype invention.

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

Status: `[ ]` — **next phase**

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

Status: `[ ]` — **next executable slice; approval required before implementation**

Exact boundary:

- add isolated production owner-draft and published-lattice domain modules plus tests;
- expected modules are `src/lattice/domain/latticeProductionDraft.js`, `src/lattice/domain/latticeProductionPublication.js`, and `src/lattice/domain/latticeProductionAdapter.js`, with colocated tests;
- define the permanent row-major 3 × 3 topology and fixed 32 × 18 square-cell authored plane;
- persist placement geometry conceptually as integer `column`, `row`, `columnSpan`, and `rowSpan` values;
- define deterministic layers, navigation order, crop, frame/mat/backing, transparency, visibility, label, appearance, and identity-overlay validation;
- project real production stable asset records into validated public asset references;
- preserve nine-table topology while redacting private table and placement content and inactive private identity values;
- make the projection pure so Owner Preview and visitor rendering can later consume the exact same value.

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

## Phase 3 — shared production table renderer

Status: `[ ]`

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

User visual test:

1. Open the same table directly and in two differently sized iframes.
2. Confirm composition order and relative placement remain identical.
3. Confirm no stretching, random reflow, pixel gaps, or transparency haze.

Exit criterion: the same public table renders deterministically across owner preview, visitor, direct, and iframe surfaces.

## Phase 4 — owner lattice navigation and fixed chrome

Status: `[ ]`

Goal: make the nine-table lattice the production owner workspace behind a controlled cutover.

Includes:

- table swipe/drag/chevron navigation with snap-to-position arrival;
- Profile Rail and workspace toolbar;
- lattice minimap and directional controls;
- Keeper dock behavior;
- palette/menu-surface coordination;
- table identity and INSCAPE signature;
- no camera-motion illusion when the table should move.

User visual test:

1. Navigate all nine tables using drag, wheel/swipe where supported, keyboard, chevrons, and minimap.
2. Confirm arrival always locks to the same positions.
3. Confirm fixed chrome and Keeper do not drift with tables.
4. Confirm the current table is always legible.

Exit criterion: owner navigation is intuitive, deterministic, responsive, and does not regress profile/session behavior.

## Phase 5 — production Browser and authoring geometry

Status: `[ ]`

Goal: wire the isolated Browser to real INDEX/CATEGORIES data and enable table authoring.

Includes:

- one Browser window with INDEX and CATEGORIES tabs;
- real profile-scoped asset records only;
- add/place, move, resize from all corners, crop, mat/frame, layer, transparency, replace, remove, public/private, lock/unlock;
- context menus use the shared visual system;
- explicit selection and focus restoration;
- deterministic autosave without cross-profile leakage;
- no automatic arrangement on load.

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

Prepare **Phase 2A — pure canonical schemas and public-projection adapter** as the next executable slice.

Do not implement Phase 2A until the user approves its exact file and test boundary. Phase 2A must not wire production runtime, storage, profile-document versions, publication versions, or feature flags.
