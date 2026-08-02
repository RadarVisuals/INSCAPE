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

## Alpha implementation roadmap

### M0 — read-only repository and behavior audit

Status: `[x]` — completed read-only on 2026-08-01; no runtime files changed by the audit

Audit the current Rack shell, Browser mode/state, Library adapter and category commands, creator-attribution repository, activity repository, public discovery boundary, Layers projection, Theme/Settings ownership, keyboard/focus behavior, responsive geometry, bundle boundaries, and currently uncommitted owner-window styling corrections.

Output exact reusable files, duplicated logic, repository gaps, storage implications, deletion exclusions, and focused verification targets. No visual or runtime mutation.

The audit confirmed that a narrow shell cutover is viable without rewriting `useBrowserWorkspace`, Library storage, canonical lattice state, publication, wallets, or visitor rendering. The current owned Browser is not yet an owned-plus-created union; created-only records require a bounded adapter and honest indexed creator provenance. Activity has real indexed event history but no honest unread lifecycle. People can reuse the public discovery repository but requires a separate future list schema. Layers already owns active-table order and can later add non-reorderable all-table usage. Standalone CREATIONS, ACTIVITY, DISCOVER, Theme access, and the legacy owner/document readers remain rollback or compatibility boundaries until their replacements are accepted. Production budget headroom is too small for speculative parallel UI systems.

### M0.5 — isolated full-fidelity MODUL-8R prototype

Status: `[x]` — visually and interactionally accepted on 2026-08-02

Build a development-only, fixture-driven prototype that imports no production owner stores, repositories, persistence, wallet, publication, or visitor code. It settles the master geometry, separate Library/Activity/People/Layers module faceplates, one exclusive-open accordion, contextual accessory placement, collapse/return behavior, narrow layouts, keyboard/focus behavior, reduced motion, and all six theme-token treatments. It may demonstrate patches as non-persistent factory configurations only; no dead controls or implied storage are allowed.

Accepted authority:

- development route: `/prototype/modul-8r`;
- component and interaction authority: `src/prototypes/modul8r/Modul8rPrototype.jsx`;
- consolidated visual authority: `src/prototypes/modul8r/modul8rPrototype.css`;
- fixture and state coverage: `modul8rFixtures.js`, `modul8rModel.js`, and `Modul8rPrototype.test.js`;
- prototype sources remain development-only and must never be imported by the production owner or visitor graph.

### M0.6 — prototype acceptance and production mapping freeze

Status: `[x]` — prototype mapping frozen on 2026-08-02

Record the accepted measurements, states, interaction ownership, responsive rules, reusable production components, adapter seams, exact M1 file boundary, rollback, and focused verification. Prototype source remains isolated reference material and is never imported into production. The accepted checkpoint has one consolidated stylesheet with no duplicate exact selectors or obsolete compact/status selectors.

### M1 — MODUL-8R shell and master-faceplate cutover

Status: `[ ]`

Rename only the owner universal `THE RACK` surface to `MODUL-8R`; retain NFT and Identity RÄCK terminology. Establish the accepted 38px master faceplate, move the existing authoring controls onto it, preserve free movement and resizing, and retain session-only module expansion state. Do not reintroduce compact mode or decorative status indicators.

Do not yet merge repositories or remove standalone profile windows. Rollback is the existing `THE RACK` label and faceplate composition.

### M2 — shared module host and exclusive-open content group

Status: `[ ]`

Replace the BROWSER-only composition with stable LIBRARY, ACTIVITY, PEOPLE, and LAYERS module faceplates hosted by one shared content chassis. Exactly one module may be expanded at a time; opening another animates the existing faceplates to their retained order rather than swapping labels or content in place. Activation is fully keyboard accessible, preserves focus predictably, does not leak queries or selection across modules, and remains responsive at narrow rack widths.

Initially each module may adapt its existing repository through a bounded adapter. Do not combine repository state or category schemas.

### M3 — Library relationship consolidation

Status: `[ ]`

Introduce the OWNED and CREATED smart-view derivations, deduplicate `ALL ASSETS`, preserve UNSORTED and custom categories, and keep honest ownership/creator provenance in the accepted NFT viewer. Remove the USED ON CANVAS navigation row only when Layers exposes equivalent placement discovery.

No NFT record, contract metadata, wallet balance, category membership, canonical placement, or publication is rewritten merely to classify a smart view.

### M4 — Activity mode migration

Status: `[ ]`

Render current indexed history within the content shell, preserving loading, partial, retry, refresh, unresolved, and event-history labelling. Add contextual search and genuine density behavior. Route accepted targets without importing owner-only data into visitor code.

After interactive acceptance, retire the standalone Activity window from active owner routing but retain reusable repository and presentation primitives.

### M5 — People mode migration

Status: `[ ]`

Render current public discovery within the content shell and preserve public-profile routing. Alpha does not add following mutations, favorites, recently viewed persistence, or custom People lists unless a separate storage/privacy boundary is approved.

After interactive acceptance, retire the standalone Discover window from active owner routing. Gallery is never revived as People or Discover authority.

### M6 — Layers usage consolidation

Status: `[ ]`

Retain current active-table z-order and authoring commands, then add the minimum all-table usage navigation needed to replace USED ON CANVAS. Preserve exact placement identity and canonical transactions. Remove the redundant Library smart-view row only after this is accepted.

### M7 — Settings/Theme and launcher cleanup

Status: `[ ]`

Move Theme into Settings with full six-theme contrast and exact trigger focus return. Add the bounded empty-grid context launcher without PREVIEW or PUBLISH. Remove compatibility CREATIONS, ACTIVITY, and DISCOVER routes only after their MODUL-8R modes have equivalent accepted behavior.

### M8 — Alpha verification and cleanup gate

Status: `[ ]`

Verify the complete owner workflow, progressive data, failure states, context-menu ownership, keyboard/focus, reduced motion, responsive and compact layouts, six themes, creator/non-owner presentation, Layers usage navigation, build budgets, owner/visitor import isolation, direct visits, publication rollback, and live deployment. Delete only code proven unreachable after this gate.

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

## Likely production implementation surface

The M0 audit must confirm the exact list before coding. Likely reusable or affected areas include:

- `src/public/OwnerLatticeShell.jsx`;
- `src/lattice/windows/LatticeRackShell.jsx` and `latticeRackShell.css`;
- `src/lattice/browser/BrowserWorkspace.jsx` and focused Browser components/styles;
- `src/public/useOwnerLatticeBrowser.js`;
- the existing Library workspace/domain/store boundaries;
- `src/public/CreationsBrowser.jsx` and its creator-attribution repository/adapter;
- `src/public/ActivityBrowser.jsx` and `luksoActivityRepository`;
- `src/profileDiscovery/ProfileDiscoveryBoundary.jsx` and its public directory repository;
- current Layers projection and canonical layer operations;
- `src/public/SettingsBrowser.jsx`;
- `src/lattice/rendering/LatticeProfileRail.jsx`;
- `src/lattice/rendering/LatticeWorkspaceToolbar.jsx`;
- shared owner menu/theme tokens and focused accessibility/contrast tests;
- this boundary, the Alpha execution roadmap, and the production integration inventory at accepted checkpoints.

Frozen prototypes, NFT/Identity RÄCK behavior, canonical draft/publication schemas, wallet/IPFS code, visitor rendering, legacy document readers, and user artwork are excluded unless a later approved slice explicitly proves they must change.

## Rollback strategy

1. Keep current repositories and storage authorities intact throughout the mode migration.
2. Preserve the accepted standalone CREATIONS, ACTIVITY, and DISCOVER components until their corresponding modes pass interactive acceptance.
3. Cut over one destination at a time; a failed mode returns routing to its standalone window.
4. Retain current `THE RACK` shell composition until M1 is visually accepted; its state is session-only and needs no data migration.
5. Do not delete USED ON CANVAS derivation when hiding its Browser row.
6. Theme remains reachable through its current launcher until Settings equivalence is accepted.
7. Do not begin Phase 10 deletion during MODUL-8R migration.

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
- ordinary, compact, minimum-width, 900px, 640px, and 390×844 layouts;
- reduced motion and no layout jitter during module switching/collapse;
- owner/visitor import isolation and no change to direct/iframe publication rendering;
- production build, budget checks, `git diff --check`, and live smoke test at the accepted deployment gate.

## Genuine unresolved product decisions

These decisions remain open and must not be guessed during implementation:

1. Whether authored-but-unverified creator attribution appears inside CREATED with an explicit label or remains excluded until verified.
2. The exact meaning and lifecycle of any Activity unread count.
3. Whether Size values are remembered per mode for the session only or later persisted as private preferences.
4. The first useful all-table Layers representation: grouped tables, placement search, or a selected-asset usage detail.
5. Whether the master status labels are diagnostic indicators, clickable module-visibility toggles, or both.
6. The future private/public model for People lists and following/favorites.
7. The later persistence and publication model for Atelier parameters, grid controls, and device layouts.

None of these blocks M0. M0 must report the cheapest honest option for each decision before M1 implementation is approved.
