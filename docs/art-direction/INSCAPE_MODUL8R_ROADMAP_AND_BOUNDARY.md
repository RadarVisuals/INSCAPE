# INSCAPE MODUL-8R Roadmap and Boundary

Status: accepted prototype authority and production boundary; production runtime implementation still requires the staged boundary below.

## Purpose

MODUL-8R is the proposed central owner workspace instrument inside INSCAPE. It replaces the current mental model of a Browser window inside `THE RACK` with one coherent module host. This document preserves the accepted direction, separates the Alpha consolidation from later Atelier and media concepts, and prevents a visual redesign from silently changing Library, ownership, publication, visitor, or storage authority.

Visible product name: `MODUL-8R`.

Spoken and accessible name: `Modulator`.

The underlying interaction grammar remains a modular rack with faceplates and expandable content. `MODUL-8R` names the INSCAPE instrument; it does not rename the NFT viewer or Identity MODULE RÄCK.

## Product conclusion

The current standalone CREATIONS, ACTIVITY, and DISCOVER owner windows are useful production bridges, but they are not the intended final information architecture. The direction to freeze through an isolated prototype is one freely positioned MODUL-8R with:

1. one 38px master faceplate aligned to the accepted owner RACK grammar;
2. global authoring tools on that master faceplate;
3. separate `LIBRARY`, `ACTIVITY`, and `PEOPLE` modules hosted by one shared content chassis and belonging to one exclusive-open group;
4. Search and Size accessories rendered only where the active expanded module gives them honest behavior;
5. one separate `LAYERS` module for the active composition and placement order, participating in the same exclusive-open accordion;
6. Theme inside Settings rather than as a separate top-level owner window;
7. the current navigation rail and top-right owner chrome retained until a later embedded mode has complete, accessible replacements.

The master can collapse all modules while keeping its direct tools reachable. Opening Library, Activity, People, or Layers collapses the previously open module without swapping its faceplate position. All expansion state remains session-only unless a later persistence boundary is approved. The discarded compact mode is not part of the accepted Alpha interaction.

## Alpha visual anatomy

```text
MODUL-8R                       ARRANGE  ROTATE  MIRROR  DUPLICATE  MENU  CLOSE
LIBRARY                        SEARCH                     SIZE
expanded Library content
ACTIVITY                       contextual accessories when expanded
PEOPLE                         contextual accessories when expanded
LAYERS                                                   MOVE UP / DOWN
```

The accepted master and module faceplates are 38px high. Expanded content, controls, focus, hover, lines, and text inherit the existing active owner interface/theme tokens. NFT, profile, creator, owner, media, or other metadata never controls MODUL-8R colours.

The accepted Alpha prototype contains no decorative status lights. Any future status indicator must report real state. Red remains reserved for an actual error or blocking condition.

## Information architecture

### Library

Library is the complete asset relationship surface, not only a wallet balance viewer.

Initial smart views:

- `ALL ASSETS`: the deduplicated union of accepted owned and creator-attributed assets;
- `OWNED`: assets currently owned or held by the active Universal Profile according to the bounded Library ownership repository;
- `CREATED`: assets safely attributed to the active profile as creator or issuer, including assets currently owned by another profile;
- `UNSORTED`: accepted assets with no membership in a user-authored category;
- user-authored categories, retaining the current profile-scoped category authority.

An asset may simultaneously be OWNED, CREATED, and a member of multiple custom categories. Smart views are relationships and filters, not stored folders. The same stable asset must appear only once in `ALL ASSETS` even when several relationships apply.

`USED ON CANVAS` is removed from primary Library navigation only after its useful runtime information is represented in Layers. The underlying all-nine-table usage derivation is retained; it must not be deleted merely because the navigation row disappears.

Creator access does not claim token ownership, transfer rights, copyright, or a protocol-enforced licence. A creator-attributed, non-owned asset may be composed into an INSCAPE workspace because the workspace references public media and attribution; the viewer must still expose honest current ownership and creator provenance. Publishing the composition never changes the NFT or its ownership.

Created attribution must retain explicit provenance states. Strong profile/issuer evidence may be marked verified. Authored metadata attribution remains labelled as authored or unverified. Matching a display name alone is not sufficient. Indexed mint/event history may support a relationship but remains event history rather than metadata.

### Activity

Activity reuses the existing indexed-event repository. It does not become NFT metadata and does not invent events while an indexer is unavailable.

The mode may support compact chronological rows and, at larger Size settings, visual activity cards. Search and later filters can match event type, profile, contract, asset, or publication where those values actually exist.

Activity is a routing surface:

- an asset event may open the accepted NFT viewer or Library result;
- a profile event may open People or the public profile;
- a workspace publication may open the published visitor route;
- unresolved targets remain unresolved instead of generating placeholder facts.

An Activity badge, if added, means unread or new activity only after a real session/read boundary exists. It must not display an unexplained total as an alert.

### People

People is the long-term replacement for a separate Discover window. Its first Alpha-safe mode may reuse the current public INSCAPE directory and profile activation without adding social persistence.

Future smart views may include Discover, Following, Followers, Favorites, Recently Viewed, and custom private lists. These may share the same visual category grammar as Library but must not reuse asset-category records or mix profile addresses and stable asset IDs in one stored collection. People lists require their own profile-scoped schema, privacy rules, mutation boundary, and publication decision before implementation.

### Contextual Search and Size

Search remains in a stable accessory position on the currently expanded content module and uses only that module's query authority:

- Library searches accepted asset fields and normalized metadata;
- Activity searches accepted indexed event fields;
- People searches accepted public profile identity and address fields.

No mode may query another mode's repository merely to produce richer-looking results.

Size controls presentation density, never underlying result membership. Library and People may use thumbnail/card density. Activity must expose a genuine compact-to-visual density response before Size is shown there. Each module retains its own session value so switching modules does not unexpectedly rewrite another module's preferred layout. An accessory must be absent or disabled with an honest explanation when its module cannot support it; no universal control may remain visible while doing nothing.

### Layers

Layers is composition state, not source-library state. It continues to expose the active table's placements in exact visual layer order and owns selection plus bounded layer movement.

The intended expansion is a table-aware usage view:

- current table placements and z-order remain the primary expanded content;
- all-nine-table usage can identify where a stable asset is placed and navigate to that table/placement;
- multiple instances remain distinct placements even when they reference one stable asset;
- selection, locks, private-table rules, and atomic authoring transactions remain canonical-lattice responsibilities.

Layers must not become a second asset repository, rewrite Library ownership, or store duplicate placement authority.

## Settings and owner launch surfaces

Theme moves into the existing Settings surface. The Theme controls continue to change only the current approved theme/session authority until persistence is separately approved. Removing the standalone Theme launcher is permitted only after Settings exposes equivalent keyboard, pointer, contrast, and focus-return behavior.

The proposed empty-grid context menu is a launcher into existing owner state, not a second window system. Its bounded command list is:

1. ARRANGE toggle;
2. MODUL-8R toggle;
3. CREATIONS compatibility launcher only until Library supersedes it;
4. ACTIVITY compatibility launcher only until the Activity mode supersedes it;
5. DISCOVER compatibility launcher only until People supersedes it;
6. SETTINGS.

PREVIEW and PUBLISH are explicitly excluded from the empty-grid context menu. Placement right-click retains the placement command menu. Empty-grid context activation must not open during CROP, a placement gesture, camera gesture, viewer/identity modal ownership, or another editing transaction, and must never implicitly cancel those sessions.

After MODUL-8R modes are accepted, the compatibility CREATIONS, ACTIVITY, and DISCOVER launchers can be removed from the context menu rather than kept as duplicate destinations.

## Accepted audit history and production integration sequence

### M0 — initial read-only repository and behavior audit

Status: `[x]` — completed read-only on 2026-08-01

The first audit correctly identified reusable repositories, storage authorities, canonical authoring commands, Layers projection, and standalone rollback windows. Its proposed narrow in-place shell cutover is superseded by M0.7 because later inspection proved that Browser and Rack presentation/state/CSS ownership are too entangled for a clean visual migration.

### M0.5 — isolated full-fidelity MODUL-8R prototype

Status: `[x]` — visually and interactionally accepted on 2026-08-02

Accepted authority:

- development route: `/prototype/modul-8r`;
- checkpoint: `0f1136d`;
- component and interaction authority: `src/prototypes/modul8r/Modul8rPrototype.jsx`;
- consolidated visual authority: `src/prototypes/modul8r/modul8rPrototype.css`;
- fixture and state coverage: `modul8rFixtures.js`, `modul8rModel.js`, and `Modul8rPrototype.test.js`.

The current live route and these checked-in files are the only visual and interaction authority. Historical screenshots and rejected full-colour module iterations are not authority. Prototype sources remain development-only reference material and must never be imported by a production owner or visitor graph.

### M0.6 — prototype acceptance freeze

Status: `[x]` — accepted authority frozen on 2026-08-02

The accepted measurements, module order, 38px master and faceplates, exclusive-open accordion, retained faceplate positions, transition behavior, narrow layouts, keyboard/focus rules, reduced motion, six-theme treatment, lack of compact mode, and lack of decorative status indicators are frozen. The consolidated prototype stylesheet has no duplicate exact selectors or obsolete compact/status selectors.

### M0.7 — production-integration architecture audit

Status: `[x]` — accepted read-only on 2026-08-02

The audit rejects in-place evolution of `LatticeRackShell` into MODUL-8R. Production behavior is reusable, but Browser owns Rack state and geometry, Rack CSS consumes Browser variables, Browser CSS reaches into Rack selectors, resize ownership crosses stylesheet boundaries, and the accepted accordion requires a different structure and transition model. Restyling the old Rack would create a hybrid and accumulate override debt.

The accepted target is:

1. extract reusable headless window and mode controllers without visual change;
2. build a clean production `Modul8rShell` with fresh `.modul8r-*` presentation selectors;
3. expose the incomplete shell only through a development-only owner entrance that is absent from production output;
4. retain the existing live `THE RACK`, Browser, and standalone windows unchanged while parity is built;
5. switch the owner integration atomically only after complete functional, visual, isolation, and budget acceptance;
6. delete old presentation only after the cutover has its own accepted rollback checkpoint.

Production budget headroom is too small to ship both complete presentations. The development-only comparison entrance must be provably tree-shaken from production.

## Approved executable production tasks

This is the sole approved execution order. A fresh Codex may be told `execute Task N` only after reading this complete boundary and the Alpha execution roadmap. Completing one task does not authorize starting the next. Every task ends with proportional automated verification, the stated manual acceptance, a roadmap update, and a reversible checkpoint commit. No task may import prototype source into production.

### Task 1 — extract reusable floating-window behavior

Status: `[x]` — implemented, automatically verified, and interactively accepted on 2026-08-02 at checkpoint `40f4137`

Extract positioning, viewport containment, free movement, independent right-edge Rack-width resizing, centered Browser/content resizing, keyboard resize, pointer capture/cancellation, resize-state marking, and viewport-resize clamping from `useBrowserWorkspace` into generic headless window modules.

Create:

- `src/lattice/windows/latticeFloatingWindowModel.js`;
- `src/lattice/windows/latticeFloatingWindowModel.test.js`;
- `src/lattice/windows/useLatticeFloatingWindow.js`;
- `src/lattice/windows/useLatticeFloatingWindow.test.js`.

Allowed existing files are `useBrowserWorkspace.js`, `browserWorkspaceModel.js`, their focused tests, and focused Browser tests only where imports follow the extraction. Keep the returned `move`, `rackWidthResize`, `resize`, `windowPosition`, and `windowSize` interface compatible so `BrowserWorkspace.jsx` requires no change.

No JSX, CSS, label, compact-mode, module, repository, routing, storage, publication, wallet, visitor, schema, or prototype change is allowed. Manual acceptance is that the current production `THE RACK` moves, resizes, clamps, closes/reopens, and behaves under reduced motion exactly as before at desktop, 640px, and 390×844.

Acceptance checkpoint (2026-08-02): floating-window sizing, viewport containment, free movement, independent right-edge Rack-width resizing, centered content resizing, keyboard resizing, pointer capture/cancellation, resize-state marking, and viewport-resize clamping now live in `latticeFloatingWindowModel.js` and `useLatticeFloatingWindow.js`. `useBrowserWorkspace.js` delegates through the unchanged `move`, `rackWidthResize`, `resize`, `windowPosition`, and `windowSize` interface, so `BrowserWorkspace.jsx` and all JSX/CSS presentation remain unchanged. The focused floating-window and Browser regression set passes 24/24 and `git diff --check` passes. Interactive review accepted the existing production RÄCK behavior. No production MODUL-8R entrance, shell, prototype import, schema, storage, publication, wallet, visitor, route, label, style, or visual change was introduced. Task 2 remains unstarted pending a separate explicit instruction.

### Task 2 — clean MODUL-8R shell behind a development-only owner entrance

Status: `[x]` — implemented, automatically verified, and interactively accepted on 2026-08-02 at checkpoint `ea23eb7`

Create a production-grade `Modul8rShell`, shell model, fresh `.modul8r-*` stylesheet, and focused tests. Reproduce the accepted master/module geometry, stable LIBRARY/ACTIVITY/PEOPLE/LAYERS order, exclusive-open state, retained faceplates, transition overflow suppression, complete-faceplate activation, master collapse state retention, right-edge resize, responsive layouts, focus behavior, and reduced motion using production theme/type/motion tokens and the Task 1 controller.

The shell must not import prototype code, reuse `lattice-rack-*` structural classes, or consume Browser-owned visual variables. It contains no fake repository facts or dead controls. The old live Rack remains unchanged. A narrowly gated development-only owner entrance may be added to `OwnerLatticeShell` only if production build and import-graph checks prove the new shell is absent from production output.

Manual acceptance compares the development shell directly with `/prototype/modul-8r` in all six themes and accepted viewport widths. This task does not cut over the live owner route.

Acceptance checkpoint (2026-08-02): the production-grade `Modul8rShell`, separate shell model, and fresh `.modul8r-*` presentation are available only at the development entrance `/development/owner/modul-8r`. The shell preserves the accepted master and module geometry, fixed LIBRARY/ACTIVITY/PEOPLE/LAYERS order, exclusive-open accordion, stable closed faceplates, collapse state, right-edge resize, containment, keyboard/focus/Escape behavior, reduced motion, and all six production themes. The master title is both the collapse/restore control and an explicit drag surface: movement beyond the three-pixel threshold suppresses exactly the resulting click, while ordinary clicks still toggle; close and future interactive controls remain non-draggable, and pointer cancel/lost capture clear the gesture without stale suppression. The title text shares the module-label alignment column. Focused model, component, controller, Browser-regression, and real Edge interaction checks pass; `git diff --check`, the production build, budgets, and output/manifest/owner-graph isolation checks pass with zero MODUL-8R development markers. The live Rack, Browser, standalone windows, production routes, repositories, storage, publication, wallet, visitor behavior, schemas, prototype source, and Task 3 remain unchanged.

### Task 3 — real Library parity inside the development shell

Status: `[ ]`

Mount the existing production Library/Browser behavior through a bounded MODUL-8R Library adapter. Preserve categories, ALL ASSETS, UNSORTED, USED ON CANVAS, filters, search, sort, labels, size, progressive decoded media, unavailable counts, selection, multi-select, asset/category menus, drag-to-category, and ARRANGE-gated drag-to-canvas. Split reusable Browser-content presentation from old Rack/window presentation without changing repository, workspace-v8, category, or canonical placement authority.

CREATED is excluded until Task 5. Activity and People repositories are excluded. The old Browser remains the live owner destination and rollback.

### Task 4 — Activity and People headless adapters

Status: `[ ]`

Extract reusable loading/query/abort/generation/retry controllers from the accepted standalone Activity and public discovery surfaces and mount their real repositories in the development shell. Preserve Activity complete, partial, failed, retry, refresh, empty, timeout, stale-generation, unresolved-target, and indexed-event-history semantics. Preserve People search, loading/failure, public-profile routing, and owner/visitor isolation.

Do not invent unread state, notifications, follows, favorites, lists, recents, or persistence. Standalone ACTIVITY and DISCOVER remain the live owner destinations and rollback.

### Task 5 — honest OWNED/CREATED Library union

Status: `[ ]`

Add CREATED through the existing creator-attribution repository/store and deduplicate it with the owned projection in `ALL ASSETS`. Preserve stable IDs, ownership, creator provenance, categories, unresolved states, and NFT-viewer facts. Created-but-not-owned work remains explicitly creator-attributed and must never be presented as owned.

Do not rewrite Library storage, NFT metadata, category membership, canonical placements, or publication. Metadata-only authored attribution remains excluded unless separately approved with an explicit unverified label.

### Task 6 — Layers usage and Settings/Theme parity

Status: `[ ]`

Preserve active-table thumbnails, exact placement identity, z-order, selection, multi-select, locks, and canonical atomic reorder. Add the cheapest honest non-reorderable all-table usage navigation needed to replace USED ON CANVAS. Move Theme into Settings only after equivalent six-theme access, contrast, Escape, close, and trigger-focus restoration exist in the development integration.

Do not create a second placement authority or persist Theme. Keep old USED ON CANVAS and Theme access available until equivalence is accepted.

### Task 7 — full development parity and bundle gate

Status: `[ ]`

Certify the complete development-only MODUL-8R against the accepted prototype and all existing production workflows. Verify pointer, keyboard, focus, Escape, context menus, queries, selections, module state, responsive layouts, reduced motion, no transient scrollbars/gaps, all repository failure states, owner/visitor isolation, and production budgets. Prove the development entrance and incomplete MODUL-8R graph are absent from production output.

No live owner route changes. Failure returns to the relevant prior task while production continues using the old Rack and standalone windows.

### Task 8 — atomic production cutover

Status: `[ ]`

Switch one bounded owner import/wiring boundary from the old Browser/Rack and compatibility destinations to the complete accepted `Modul8rShell`. Preserve authoring callbacks, canonical state, publication, wallet, IPFS, owner/visitor gates, focus refs, direct visits, iframes, and profile-remount session reset. Users must see the complete old Rack before deployment or the complete MODUL-8R after deployment, never a hybrid.

Run the complete focused and full regression matrix, production build/budgets, import isolation, direct/iframe checks, publication rollback, and live smoke test. Rollback restores the previous owner import/wiring checkpoint and requires no data migration.

### Task 9 — post-acceptance cleanup

Status: `[ ]`

After live Task 8 acceptance, perform a fresh reachability inventory and delete only presentation code proven unreachable. Candidate deletions include the old Rack presentation, old Browser window composition, unreachable tab panels/exports, and superseded launcher wiring. Retain repositories, stores, canonical commands, compatibility readers, published-document support, user assets, and the accepted rollback checkpoint.

Delete in small reviewable slices with full behavior, build, budget, isolation, route, publication, and live smoke verification after each slice. Cleanup must not change visible behavior.

## Explicit Alpha exclusions

The following concepts are documented but excluded from the MODUL-8R Alpha consolidation:

- hiding the fixed navigation rail and top-right owner toolbar;
- mounting MODUL-8R visually into the spatial grid;
- persisted MODUL-8R position, module layout, or compact state;
- detachable modules or multiple MODUL-8R instances;
- Keeper personality, dialogue, or reaction authoring;
- raw Atelier, shader-uniform, side-scrolling environment, or media parameter editors;
- user-authored control cells;
- NFT-skinned buttons, knobs, sliders, meters, or faceplates;
- visitor-interactive controls and control publication;
- MEDI-8R, audio/video transport, timelines, visualizer routing, or the large output display;
- arbitrary code or executable UI loaded from NFT metadata.

## Post-Alpha Atelier and device boundary

These are future concepts, not approved implementation slices.

### Embedded MODUL-8R mode

A later mode may hide the fixed navigation rail and top-right owner chrome only after NAVIGATION and SYSTEM modules provide complete equivalent capability. The instrument may align exactly to lattice cells and use subtle fastener/inset styling so it appears mounted into the grid, but it remains viewport-recoverable rather than being pannable off-screen with the authored canvas.

Required escape paths include keyboard recovery, an explicit undock action, and an empty-grid MODUL-8R launcher. Mobile requires a separate bounded layout. Floating mode remains rollback.

### Safe parameter module contract

Atelier may expose Keeper, Environment, Shader, and later Media parameters only through declarative descriptors with stable IDs, labels, types, ranges, defaults, steps, units, persistence scope, publication capability, and reset behavior. Raw shader uniforms or engine internals are not UI or persistence contracts.

Expanded modules may expose complete safe parameter sets. Compact faceplates may pin a small number of macro controls. Inputs may later modulate parameters only through explicit typed connections; examples include pointer position to shader distortion, audio to environment intensity, scroll to parallax, or activity to a Keeper reaction.

### Grid control cells

The lattice cell is the proposed control-layout unit:

```text
button, toggle, or knob  1 × 1 cell
horizontal slider        2 × 1 cells
vertical slider          1 × 2 cells
XY pad                    2 × 2 cells
display or transport      explicitly bounded multi-cell device
```

DESIGN mode places, sizes, skins, and binds controls. OPERATE mode interacts without moving their layout. Artwork placement and control interaction must have deterministic input ownership.

NFT artwork may skin a supported control or faceplate, but appearance and behavior remain separate. Workspace data stores the binding; INSCAPE does not mutate the NFT and never executes arbitrary remote JavaScript or HTML from NFT metadata. A future signed declarative device manifest may describe supported control types only after schema, validation, security, compatibility, and rollback review.

Every control requires an explicit scope such as owner-only, visitor-interactive, published default, or session-only. Visitor interaction cannot persist owner state without a separately authorized capability and write boundary.

### MEDI-8R

`MEDI-8R` is the reserved future media/output module concept. The large display, transport, audio/video state, waveform, visualizer input/output, looping, synchronization, and playful boot messaging belong there rather than on the sober MODUL-8R master faceplate.

## Data, storage, and publication boundary

The Alpha MODUL-8R consolidation is initially a view/controller refactor over existing bounded authorities. It does not authorize:

- a profile-document version change;
- a canonical lattice schema change;
- a Library workspace storage-key change;
- rewriting NFT or LSP metadata;
- inventing creator, owner, profile, event, notification, or marketplace facts;
- publishing private categories, People lists, MODUL-8R geometry, searches, filters, selection, compact state, or status LEDs;
- changing wallet, IPFS, resolver, direct-visit, iframe, or version-7 compatibility behavior.

Any later People lists, device layouts, control bindings, parameter values, modulation routes, or visitor-interactive controls require their own schema and migration boundary before implementation.

## Audited production implementation surface

Keep unchanged as authorities:

- Library workspace-v8/store, asset cache, category commands, and owned-asset repositories;
- `browserRenderableAssets.js`, the owned production Browser adapter, and pure Browser view/selection models;
- `useOwnerLatticeBrowser.js` and owner drag-to-canvas/canonical authoring callbacks;
- activity, creations, and profile-discovery repositories and their generation/abort semantics;
- current Layers projection, exact placement identity, canonical reorder helpers, and owner transaction boundary;
- `useLatticeChromePresence`, parent close/Escape/focus-return ownership, owner-runtime gating, visitor isolation, wallet, IPFS, publication, and direct/iframe routing;
- six-theme roles in `latticeMenuSurface.css` and shared chrome semantics in `latticeChromePrimitives.css`.

Extract or adapt through explicit controllers/props:

- floating-window geometry currently coupled to `useBrowserWorkspace.js`;
- Browser query/filter/sort/selection/media behavior for the Library module;
- drag-to-category gesture ownership;
- `LatticeWorkspaceToolbar` for the new master faceplate;
- `LatticeLayersModule` presentation so it consumes menu/module tokens rather than Browser tones;
- Activity and Profile Discovery presentation controllers;
- Settings/Theme callbacks and compatibility launchers only at their approved tasks.

Retain as source-level rollback until Task 8 is accepted:

- `LatticeRackShell.jsx` and `latticeRackShell.css`;
- `BrowserWorkspace.jsx` and its old window/Rack presentation rules;
- standalone CREATIONS, ACTIVITY, DISCOVER, and Theme surfaces;
- USED ON CANVAS and current owner launcher wiring.

New production presentation belongs under `src/lattice/modul8r/` with fresh `.modul8r-*` selectors. Frozen prototype files are reference-only. NFT/Identity RÄCK behavior, canonical draft/publication schemas, wallet/IPFS code, visitor rendering, legacy document readers, and user artwork are excluded unless a later approved slice explicitly proves they must change.

## Rollback strategy

1. Keep current repositories and storage authorities intact throughout the mode migration.
2. Preserve the current live `THE RACK`, Browser, CREATIONS, ACTIVITY, DISCOVER, Theme, and USED ON CANVAS destinations through Tasks 1–7.
3. Keep incomplete MODUL-8R work behind a development-only entrance that is absent from production output.
4. Do not perform incremental live destination cutovers. Task 8 switches one bounded owner import/wiring boundary only after complete parity acceptance.
5. A failed Task 8 restores the preceding owner import/wiring checkpoint; no stored or published data changes.
6. Retain old presentation source through Task 8 live acceptance and a fresh reachability inventory.
7. Begin deletion only in Task 9, in small verified slices.

Because the Alpha consolidation changes no approved stored or published schema, rollback is code/routing-only. Already published version-8 documents remain readable and unchanged.

## Lean verification plan

Each slice receives focused unit/component tests and a short manual acceptance before the next cutover. The final matrix includes:

- pointer, keyboard, focus return, Escape, context menu key, and outside-click ownership;
- Library progressive loading, unavailable media, category mutation, multi-selection, drag-to-category, and ARRANGE-gated drag-to-canvas;
- owned, created-non-owned, duplicate relationship, unresolved creator, and ownership-change cases;
- Activity complete, partial, failed, retry, refresh, empty, and unresolved-target states;
- People discovery, search, public-profile opening, and no unauthorized social persistence;
- Layers current-table order, multiple instances, all-table usage navigation, locked/private placements, and atomic reorder;
- Carbon, Graphite, Slate, Ash, Mist, and Paper contrast;
- ordinary, minimum-width, 900px, 760px, 640px, 520px, and 390×844 layouts;
- reduced motion and no layout jitter during module switching/collapse;
- proof that the development-only entrance and incomplete MODUL-8R graph are absent from production output;
- owner/visitor import isolation and no change to direct/iframe publication rendering;
- production build, budget checks, `git diff --check`, and live smoke test at the accepted deployment gate.

## Genuine unresolved product decisions

These decisions remain open and must not be guessed during implementation:

1. Whether authored-but-unverified creator attribution appears inside CREATED with an explicit label or remains excluded until verified.
2. The exact meaning and lifecycle of any Activity unread count.
3. Any future persistence of per-module Size values beyond the accepted session-only behavior.
4. The post-Alpha private/public model for People lists and following/favorites.
5. The later persistence and publication model for Atelier parameters, grid controls, and device layouts.

No unresolved decision blocks Task 1. Activity unread state remains hidden until a real lifecycle exists. Size is session-only per module for Alpha. The first all-table Layers implementation is read-only groups by table with distinct placement rows and navigation to the selected placement. Decorative master status labels/lights remain rejected.
