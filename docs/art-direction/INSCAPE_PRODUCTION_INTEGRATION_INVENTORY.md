# INSCAPE Production Integration Inventory

Status: canonical production-integration inventory

Approved: 2026-07-29

Execution source: [INSCAPE Alpha Execution Roadmap](./INSCAPE_ALPHA_EXECUTION_ROADMAP.md)

## 1. Purpose

This document records the approved Phase 1 audit of the production application and defines the integration boundary between the frozen lattice prototype and the production Alpha.

It is an architecture and migration contract. It does not authorize implementation by itself. The live roadmap identifies the next approved executable slice and remains the source of truth for phase status.

The frozen prototype is the visual and behavioral reference. It is not production architecture, fixture data is not production data, and new feature logic must not be added to `LatticeEnginePrototype.jsx`.

## 2. Confirmed production boundary

The active application separates verified owner authority from published visitor rendering:

```text
App
├─ verified owner viewing the same owned profile
│  └─ lazy OwnerRuntimeBoundary → ModuleGridShell
│     ├─ profile-scoped Library workspace and asset cache
│     ├─ owner draft, snapshot, preview, and reconciliation
│     └─ IPFS upload, wallet publication, and read-back verification
└─ every other authority state
   └─ PublishedProfileBoundary
      └─ validated published document → PublishedHomeWorld
```

The boundary has the following production guarantees:

- Owner code is lazy-loaded only after verified matching authority.
- An owner visiting another profile receives the published visitor runtime, not that owner's local workspace.
- The visitor import graph cannot reach owner stores or persistence.
- Owner storage is scoped by canonical Universal Profile address.
- Owner draft, publication snapshot, and published visitor document are distinct states.
- Publication freezes and hashes one canonical snapshot, verifies the pinned IPFS bytes, revalidates wallet/profile authority, writes the ERC725Y pointer, and reads the publication back.
- Direct visits and iframes resolve through the same published-document boundary.
- Embedded mode uses the Universal Profile wallet context without invoking standalone sign-in behavior.

These guarantees must remain intact throughout the migration.

## 3. Existing production sources of truth

### 3.1 Owner asset and organization state

The Library workspace is currently version 8 and stored under `inscape.library-workspace.v8:<profile-address>`. It owns:

- the profile address;
- Favorites;
- private folders and public categories;
- legacy Gallery canvas objects;
- legacy five-table placements.

The asset cache is a separate profile-scoped source of resolved real asset records. Stable asset identity is the canonical tuple:

```text
chainId:contractAddress:tokenId-or-contract
```

INDEX records and folders/categories remain production sources. Categories are organizational and publication structures; they are not lattice tables.

### 3.2 Current profile document

The published profile document is version 7. It contains:

- document identity, revision, timestamps, network, and profile authority;
- a cached official identity fallback;
- Keeper, legacy stage/environment, visitor-navigation, system-module, and Signals presentation;
- public folder/category spaces;
- public legacy Gallery canvas objects;
- an empty reserved metadata object.

Version 7 does not publish `workspace.tables.placements`. The existing five-table placement record is local compatibility data and is not a public lattice schema.

Versions 1 through 6 are migrated into the current validated legacy document shape. They must remain readable.

### 3.3 Current owner reconciliation

Owner reconciliation compares a profile-scoped local public projection, a stored publication baseline, and the latest resolved publication. It can adopt a baseline, keep the local draft, hydrate the publication, or stop for a conflict decision.

The current restore path replaces published folders and public Gallery objects while preserving unrelated private local folders and objects. Canonical lattice reconciliation must extend this boundary transactionally; it must not be embedded as more incidental state inside `ModuleGridShell`.

### 3.4 Current publication

The production publication flow must be retained:

1. Build and validate an owner snapshot.
2. Canonically serialize and hash the frozen snapshot.
3. Upload through the same-origin Netlify function; Pinata credentials remain server-side.
4. Resolve and verify the exact IPFS bytes.
5. Recheck snapshot, CID, wallet generation, connected account, chain, host profile, workspace profile, viewed profile, and owner authority.
6. Request the wallet `setData` action.
7. Wait for the transaction and read the on-chain publication back.
8. Accept it only when the resolved document matches the frozen artifact.

No lattice slice may weaken this sequence.

## 4. Canonical lattice geometry

The permanent topology is row-major 3 × 3, with the center coordinate `{ x: 0, y: 0 }` as the entry position for every session.

The 32 × 18 lattice grid is the authored coordinate plane. It is not the browser viewport, iframe viewport, or device canvas.

- Authored placement persists as integer `column`, `row`, `columnSpan`, and `rowSpan` values.
- The 16:9 authored plane produces square cells.
- Arbitrary browser and iframe sizes uniformly scale the complete authored composition to fit.
- Projection may letterbox while the seamless atmospheric grid fills remaining space, but it may not stretch, crop the authored plane, reflow, or mutate cell geometry or its derived normalized placement data.
- Additional visible grid beyond the authored plane is seamless atmosphere.
- The authored boundary is normally invisible.
- Native media proportions remain intact unless the owner explicitly authors a crop.
- Active table, camera offset, gesture offset, selection, focus, and open-window state are runtime-only.
- No active-table coordinate is stored. Every mount starts at the center table.

Normalized values may be derived temporarily inside rendering and pointer controllers. They are not the authoritative persisted placement geometry.

## 5. Canonical owner draft

Canonical lattice persistence will use one profile-scoped owner draft source. It will contain:

```text
profileAddress
draftVersion
artboard: 16:9
geometry: 32 × 18
appearance:
  surfaceId
  menuSurfaceId
  dossierSurfaceId
identityPresentation
tables[9]:
  permanent id
  permanent coordinate
  title and subtitle
  label visibility, anchor, and cell offset
  PUBLIC or PRIVATE visibility
  placements:
    id
    stableAssetId
    column, row, columnSpan, rowSpan
    layer
    navigationOrder
    crop
    frameId
    mat
    backing
    transparencyMode
    PUBLIC or PRIVATE visibility
    locked
```

It must not contain:

- active table or arbitrary camera position;
- drag, wheel, swipe, resize, crop, or snapping previews;
- open Browser, viewer, dossier, or utility-window state;
- selection, focus, or hover state;
- copied official identity metadata;
- copied NFT metadata beyond stable asset identity;
- wallet, CID, transaction, or publication state.

Once canonical lattice persistence is enabled, it becomes authoritative for lattice state. Legacy Home, Gallery, and five-table state remains readable only for compatibility, rollback, and a later explicit import workflow. It must not remain a second writable authority for canonical lattice content.

## 6. Canonical public projection

Owner Preview and published visitor rendering must receive the exact same pure public projection. Preview must never render the raw owner draft.

The public projection:

- preserves all nine permanent coordinate slots;
- includes public table titles, subtitles, label configuration, and public placements;
- replaces stable-ID-only placement references with validated public asset references built from real production asset records;
- includes the selected public appearance and sanitized identity overlay;
- omits locks and every owner callback or editing capability;
- omits private organizational data, Favorites, caches, and inactive private settings;
- uses the document publication timestamp as `LAST PUBLISHED`;
- never publishes an active table.

For a private table, the projection retains only its permanent ID, coordinate, and private visibility marker. It redacts:

- title;
- subtitle;
- label visibility;
- label anchor;
- label offset;
- placements.

For private or inactive identity presentation values:

- a non-INSCAPE avatar mode clears the inactive INSCAPE asset reference;
- a non-INSCAPE bio mode clears the inactive custom bio;
- private or inactive overlay values do not enter the public document;
- official Universal Profile values remain external immutable facts, not copied owner-authored overlay data.

Missing profile, NFT, activity, count, link, marketplace, or other facts remain honestly unresolved. `LAST ONLINE` is not part of Alpha. Fixture identity, NFT, marketplace, or metadata values must never enter production behavior.

## 7. Version 8 document authority

Version 8 will contain exactly one canonical lattice source of truth.

The version 8 envelope may retain the version-7-shaped `presentation`, `spaces`, and `canvasObjects` fields as a compatibility fallback. Those fields are not lattice inputs and must never:

- overwrite canonical lattice data;
- merge into canonical tables on load;
- silently regenerate canonical placements;
- become a second lattice persistence authority.

The validated `lattice` field is authoritative whenever a version 8 document is rendered as a lattice. Compatibility fallback fields exist only so a compatible application build can render the retained legacy presentation when lattice rendering is disabled or unavailable.

Versions 1 through 7 continue to resolve as legacy documents. They do not automatically migrate into empty or inferred nine-table documents.

The version 8 reader and legacy fallback must be deployed before version 8 publication is enabled. Once a version 8 publication exists, application-level rollback remains possible through the compatible legacy renderer. Returning the on-chain pointer to a version 7 document would require an explicit owner-authorized republish.

## 8. Legacy-to-canonical mapping

### 8.1 Library workspace

| Existing field | Canonical treatment |
| --- | --- |
| `profileAddress` | Draft storage scope and document authority |
| `favorites` | Private INDEX organization; never automatically published |
| `folders` | Categories, not tables |
| `folder.public` | Category publication visibility |
| `folder.assetIds` | Category membership using unchanged stable asset IDs |
| `canvas.objects` | Legacy Gallery compatibility only |
| `tables.placements` | Legacy five-table compatibility only |
| Profile-scoped asset cache | Runtime source for Browser, media rendering, and public asset references |

### 8.2 Legacy five-table placements

The historical IDs `identity`, `collections`, `archive`, `drops`, and `index` have no automatic mapping to the nine permanent coordinate slots. Canonical tables are owner-named presentation surfaces, not fixed feature pages.

Legacy five-table import is a later explicit owner-guided workflow. There is no automatic coordinate conversion.

If an owner later invokes an approved import, individual fields may be proposed as follows, but nothing runs on load:

| Legacy field | Owner-guided import candidate |
| --- | --- |
| `stableAssetId` | Preserve unchanged after validation |
| normalized `rect` | Quantize into 32 × 18 integer cell geometry only after the owner chooses a destination table |
| `crop` | Preserve after validation |
| `layer` | Normalize into canonical layer order |
| missing navigation order | Derive deterministically from legacy layer and ID |
| missing frame | `NONE` |
| missing transparency | `AUTO` |
| missing visibility | Private until the owner explicitly publishes it |
| legacy table ID | No default coordinate; owner chooses the canonical table |

### 8.3 Legacy Gallery objects

- Stable asset identity may be reused during a later owner-guided import.
- Presentation order may inform a proposed deterministic ordering.
- Gallery coordinates belong to a different spatial model and are not automatically mapped.
- Legacy frame, mat, background, and fit values may be translated only during an explicitly reviewed import.
- Until then, Gallery data remains readable through compatibility code.

### 8.4 Legacy Home and system state

| Existing state | Canonical treatment |
| --- | --- |
| Module positions | No mapping; canonical chrome is fixed |
| Utility-window geometry and start-open | Runtime owner utility state, not table identity |
| Home camera | No mapping |
| Gallery and Upper navigation | Legacy runtime only |
| Grid visibility | Local interface preference |
| Surface palette | Canonical appearance only when explicitly saved by the owner |
| Visitor navigation | Fixed public-chrome visibility |
| Keeper ID | Retained through the existing presentation boundary |
| Stage and environment | Legacy compatibility; not reinterpreted as tables |
| Signals settings | Retained by the existing Signals subsystem |

### 8.5 Version 7 profile document

| Version 7 field | Version 8 treatment |
| --- | --- |
| Document identity, revision, timestamps | Retain |
| Network and profile authority | Retain |
| Cached identity | Official fallback only; never an editable overlay |
| Keeper | Retain |
| Stage and environment | Retain for compatibility fallback |
| Avatar shape | May seed the owner's canonical avatar presentation choice |
| Visitor navigation | Retain for fixed public chrome |
| System modules | Compatibility fallback only |
| Signals | Retain |
| Public `spaces` | Public categories |
| Public `canvasObjects` | Legacy Gallery fallback |
| Empty `metadata` | Remain reserved |
| New `lattice` | Sole canonical published lattice source |

### 8.6 Identity

| Real source | Public identity use |
| --- | --- |
| LSP3 address | Immutable official address |
| LSP3 name | Immutable official handle/name |
| LSP3 image | Official avatar option |
| LSP3 description | Official bio option |
| LSP3 tags and links | Official values with retained provenance |
| Direct RPC `eth_chainId` | Active network fact; visible only when verified as LUKSO chain 42 |
| Direct LSP0 interface detection | Universal Profile classification after successful detection |
| Direct LSP5 `ReceivedAssets[]` length | Exact received asset-contract register length |
| Direct LSP12 `IssuedAssets[]` length | Exact issued asset-contract register length |
| Owner alias | INSCAPE overlay |
| Owner avatar selection | Official or INSCAPE overlay source |
| Owner bio selection | Official, INSCAPE, or hidden |
| Owner additional tags | INSCAPE overlay with retained provenance |
| Verified publication resolution document `exportedAt` | `LAST PUBLISHED`; epoch runtime projection excluded |
| Canonical address-based route | Shareable workspace URL |

The owner dossier data path is independent of Envio and indexed event history. Unresolved register reads are omitted rather than rendered as zero. LSP3 authored links and VerifiableURI content integrity never become social verification, verified badges, or truth claims. Visible Phase 7 technical identity excludes NFT/collection totals, controllers, permissions, activity, online/deployment dates, followers, handle semantics, and metadata-derived network values.

### 8.7 Production asset adapter

| Production asset field | Lattice use |
| --- | --- |
| `id` | `stableAssetId` |
| `name` | Browser title and accessible label |
| resolved thumbnail/image URL | Safe media source |
| resolved width and height | Native media ratio |
| description | Viewer narrative when present |
| collection name | Viewer record when present |
| creators | Real creator facts when present |
| attributes | Real traits when present |
| contract, token, standard, chain | Technical dossier facts |
| missing media type | Unresolved; do not infer unsupported facts |
| missing metadata | Explicit absent or unresolved state |

Viewer attribute completeness uses a bounded, non-destructive source chain: Chillwhales supplies the owned-asset inventory and initial normalized metadata; the official LUKSO Envio `Token.attributes` relation enriches LSP8 attributes by stable contract/token identity; direct RPC remains the independent fallback and decodes `LSP8TokenIdFormat` before resolving metadata base URIs. Envio enrichment may update a matching trait key or append an omitted trait, but an empty, failed, or timed-out enrichment cannot discard existing metadata. Token-specific attributes retain precedence; contract-level LSP4 attributes are used only when the token publishes none.

## 9. Parallel cutover

Cutover must remain independently reversible for owner, visitor, and publication behavior.

The intended eventual boundaries are:

- owner lattice runtime enabled independently from the legacy owner shell;
- visitor lattice rendering enabled independently from version 8 publication;
- version 8 publication enabled only after the version 8 reader and visitor fallback are live.

During parallel operation, the following remain active:

- `App` authority routing;
- `OwnerRuntimeBoundary` and the legacy `ModuleGridShell` fallback;
- `PublishedProfileBoundary` and `PublishedHomeWorld` for legacy documents and rollback;
- existing Library workspace and asset-cache storage;
- all historical profile-document readers;
- Home, Gallery, Upper, and five-table compatibility data;
- existing profile identity and asset repositories;
- current wallet/provider lifecycle;
- current IPFS upload, canonical verification, wallet publication, and read-back flow;
- current direct-visit and iframe routing;
- the frozen prototype route as reference only.

No legacy code is deleted before Phase 10.

## 10. Approved implementation sequence

### Phase 2A — pure canonical schemas and projection adapter

Define separate production owner-draft and public-lattice schemas, integer grid geometry, strict validation, real asset-reference projection, private redaction, and deterministic ordering. Do not connect runtime, storage, profile documents, publication, feature flags, or the prototype shell.

Expected isolated files:

- `src/lattice/domain/latticeProductionDraft.js`;
- `src/lattice/domain/latticeProductionPublication.js`;
- `src/lattice/domain/latticeProductionAdapter.js`;
- corresponding colocated unit tests.

Rollback: remove the new unreferenced modules. No stored or published data exists.

User visual test: none.

### Phase 2B — profile-scoped canonical lattice persistence

Introduce one new profile-scoped canonical lattice draft store. Autosave completed authoring operations only. Do not modify workspace-v8 records.

Rollback: stop reading the new isolated key; legacy records remain intact. Once enabled, this store is the sole writable lattice authority.

User visual test: none unless a deliberately approved development harness is added.

### Phase 2C — version 8 reader, builder, validation, and reconciliation

Add version 8 support while version 7 remains the publication default. Owner Preview uses the exact visitor projection. Versions 1 through 7 remain legacy documents.

Rollback: keep the version 8 reader but return snapshot building to version 7. Version 8 publication remains disabled.

User visual test: none unless a deliberately approved development harness is added.

### Phase 3 — shared production table renderer

Build a visitor-safe renderer and production media adapter. It must import no owner store or persistence module.

Rollback: select the legacy visitor renderer.

Manual test:

1. Open the same table directly and in two differently sized iframes.
2. Compare cell geometry, placement order, crop, media ratio, and transparency.
3. Resize every viewport.
4. Confirm there is no stretching, reflow, changed authored data, pixel gap, or transparency haze.

### Phase 4 — owner navigation and fixed chrome

Add a separate lazy owner lattice shell behind the existing verified authority gate. Do not extend `ModuleGridShell` into the new spatial model.

Rollback: select `ModuleGridShell`.

Manual test:

1. Reload and confirm the center entry.
2. Navigate all nine tables with drag, wheel/trackpad, keyboard, chevrons, and minimap.
3. Confirm one gesture moves at most one table and small clicks do not navigate.
4. Confirm invalid edge movement resists and returns.
5. Confirm fixed chrome and Keeper do not move.
6. Reload and confirm the active table was not persisted.

### Phase 5 — Browser and authoring

Adapt real INDEX assets and folders/categories into the isolated Browser contract. Authoring writes only to canonical lattice persistence.

Accepted production closure boundary (2026-07-31): placement right-click uses the shared `RackMenu` visual boundary over the existing `DesktopMenu` interaction engine and exposes only actions that already have complete canonical mutation transactions: CROP, BACK, BACKWARD, FORWARD, FRONT, and REMOVE. The menu is rendered outside the transformed stage and inside the active owner shell so it inherits the owner-menu theme and typography tokens. Keyboard access is the Context Menu key or `Shift+F10`. The replaced toolbar-docking implementation is deleted. Interactive review accepted the reachable placement commands and shared RÄCK presentation. `LatticeProductionMovementLayer.jsx`, its focused test and CSS, the shared menu primitive, and the layer domain/test are the complete implementation file set; owner storage, schemas, adapters, renderers, publication, visitor code, prototype code, PORTALS/categories, and Keeper behavior are excluded.

The Phase 5B.6 Alpha boundary review closes Phase 5 without exposing frame/mat/backing, manual transparency, replace-in-place, placement visibility, or lock editors. Their presence in the version-1 placement schema is not authority to expose partial editors; valid imported or reconciled values remain readable. Owner Preview belongs to Phase 8A because it must consume the actual visitor-safe version-8 runtime and exact pure public projection rather than an owner-shell imitation.

Rollback: select the legacy owner shell; existing INDEX, categories, Gallery, and legacy data remain intact.

Production context menus share one RÄCK visual boundary. `RackMenu` composes the established `DesktopMenu` focus, Escape, outside-click, viewport-clamping, keyboard, and cascade behavior with the same opaque theme-token surface, contiguous faceplates, three-pixel resting marker, active rail, and typography grammar used by the NFT viewer modules. The current production-reachable authoring caller is placement authoring; Keeper dock controls reuse the same surface and faceplate primitives while keeping their custom positioning and three-way speed layout. Category-action callers in the legacy `AssetIndex` and `ProfileNavigationDock` remain unreachable from the current owner Browser and are not production category-authoring authority. No caller owns a separate colour system; all inherit the active interface/theme tokens, and NFT/profile/asset metadata never controls menu colour. Prototype-only and frozen reference code is excluded.

Rollback: replace production `RackMenu` callers with the unchanged `DesktopMenu` engine and remove the optional shared faceplate classes from Keeper. Command models and every underlying authoring or navigation transaction remain unchanged; no stored data requires migration or rewriting.

Production category-authoring integration checkpoint (2026-07-31, awaiting interactive acceptance): `OwnerLatticeShell.jsx` injects the command object returned by `useOwnerLatticeBrowser.js` into the lazy current `BrowserWorkspace.jsx`; no Browser component imports the Library store. That command object captures only the normalized expected owner profile and resolves the current store at invocation. The single `commitCategoryForProfile` action in `useLibraryStore.js` derives a candidate through the existing `libraryWorkspace.js` folder operations, then revalidates the live store profile, workspace profile, and exact source workspace before state replacement and the existing debounced workspace-v8 save. Creation is private by default; rename rejects empty input; visibility mutates only `folder.public`; stable-ID membership and visibility no-ops preserve reference identity and schedule no write; deletion removes only the folder record. No second repository, storage key, projection mutation, publication, wallet, IPFS, lattice, placement, asset-cache, visitor, or initial-entry authority is introduced.

The exact runtime implementation set is `src/lattice/browser/BrowserWorkspace.jsx`, `BrowserCategoriesPanel.jsx`, `BrowserIndexPanel.jsx`, `BrowserAssetResults.jsx`, `BrowserCategoryDialog.jsx`, `browserWorkspace.css`, `latticeProductionBrowserAdapter.js`, `src/public/useOwnerLatticeBrowser.js`, `src/public/OwnerLatticeShell.jsx`, `src/library/state/useLibraryStore.js`, and `src/library/domain/libraryWorkspace.js`. Production category and NFT context menus now join placement authoring as current `RackMenu` callers and inherit the same owner theme tokens. Browser menus portal to `.owner-lattice-shell` so viewport anchors are not re-offset by the transformed Browser window; NFT membership is grouped into `ADD TO` and `REMOVE FROM` category cascades. Legacy `AssetIndex` remains unreachable and unchanged as a routing authority. Focused tests cover default-private create, rename, visibility, delete preservation, stable-ID add/remove and no-op idempotency, invalid/cancelled zero-write behavior, profile isolation and stale callbacks, pointer/keyboard menu activation, focus restoration, retained selection/PLACE, theme tokens, and owner/visitor/initial-entry graph isolation. The original focused sets pass 46/46 and 31/31; the portal/cascade correction set passes 34/34; production build and budget check pass. The updated real-App browser test timed out in setup without TAP output and is not claimed as passed. Manual acceptance is required before this checkpoint can become `[x]`.

The current production `LatticeProfileRail` now exposes CATEGORIES as an enabled destination. It sends an explicit request to the already-lazy `BrowserWorkspace`, which selects the CATEGORIES tab without introducing the legacy category Browser or a second data surface. Ordinary toolbar reopening retains the Browser's last active tab. Active-destination state and exact rail-versus-toolbar close focus remain runtime-only. The focused Browser/owner set passes 19/19 and the production build and budgets pass; interactive acceptance remains required.

Unified Browser / organization / drop checkpoint (2026-07-31, interactively accepted): the production Browser has one persistent INDEX / CATEGORIES sidebar, one collection/sort/label toolbar, one shared results surface, and no fixed footer. Search, thumbnail size, and unavailable count live on the Browser faceplate. The proposed MEDIA navigation and generic audio/video/3D icon vocabulary are deferred until Library ingestion can normalize those formats consistently; internal `mediaType` remains only an honest adapter/placement validation field. Favorites remain stored but unexposed. Unsorted derives from all category stable-ID membership; Used on Canvas derives at runtime from all nine accepted canonical tables. Multi-select is session-only and reconciles against progressive accepted assets without auto-selecting new arrivals. Card context and multi-selection drag expose category membership through shared RÄCK semantics. `setFolderAssets` and the guarded `assets` category command validate the entire canonical stable-ID set, replace the Library workspace once, and schedule the existing debounced save once; idempotent or stale requests write nothing.

Universal owner RÄCK checkpoint (2026-07-31, interactively accepted): `BrowserWorkspace.jsx` composes the reusable `LatticeRackShell.jsx` as `THE RACK` with TOOLS, BROWSER, and LAYERS faceplates. Preview, publish, and theme commands live on the master faceplate; there is no separate SYSTEM module. The master and module faceplates remain 38px, inherit only owner-menu tokens, preserve independent expansion state, and avoid metadata-derived colour. Runtime-only master options expose COMPACT MODE, per-module visibility, and SHOW ALL MODULES. Compact mode retains selection/filter/module/window state, uses the existing icon navigation grammar, and changes no Library, lattice, publication, wallet, or profile record. The owner window remains freely movable, horizontally resizable, viewport-clamped, responsive down to the existing 300px bound, and reduced-motion safe.

The authoring selection boundary now includes empty-plane marquee selection plus atomic grouped MOVE, RESIZE, ROTATE, MIRROR, DUPLICATE, REMOVE, and visual layer reorder. Group candidates revalidate exact accepted snapshots and reject the whole operation for any stale, locked, private, corrupt, or persistence-failing member. CROP remains single-primary by design. The expanded focused closing set passes 172/172, the budget utility passes 9/9, the production build and budgets pass, and `git diff --check` passes. PWA installation, service-worker caching, browser-extension authentication inside installed display mode, persisted RÄCK layouts, detachable modules, and public/visitor RÄCK composition remain excluded pending explicit decisions.

Current compact correction: the Browser has no fixed footer, duplicate results title, or empty vertical gutters. Canvas placement remains pointer-drag owned, while category membership remains available through card context and multi-selection drag. Browser faceplate controls own Search, thumbnail size, and the hover-described unavailable count, including while collapsed. At a 520px Browser container boundary the navigation becomes one vertical icon rail rather than a viewport-dependent horizontal strip. TOOLS renders commands directly on its static 38px faceplate; BROWSER and LAYERS own expandable bodies. Module numbers and visible expand/collapse glyphs are absent; aligned labels/grips own module toggling, and the complete master faceplate owns master collapse without interfering with drag. The master address/status is absent. Three owner-Browser-scoped decorative signal rails identify Tools, Browser, and Layers; they are not part of the reusable RÄCK shell, dossier themes, asset metadata, persistence, or publication. All surfaces, text, hover, selection, and focus states continue to inherit owner-menu tokens.

Final acceptance note (2026-07-31): the owner accepted category authoring, rail activation, Unified Browser, renderable-result policy, drag-to-category, drag-to-canvas, multi-select authoring, and the universal owner RÄCK after the compact correction. This supersedes the earlier acceptance-open wording retained in the chronological implementation notes above.

ARRANGE-gated pointer drag-to-place uses pointer capture, a threshold, a body-portal ghost, and a table-local snapped preview. Only the current active public table may receive a drop. Runtime preview never writes. A successful release supplies final clamped 32×18 geometry to the existing placement candidate and produces one completed PLACE commit while the Browser remains open. Every cancellation or stale-boundary path produces zero canonical writes. The Browser result boundary pre-decodes normalized thumbnail/display/safe-original candidates in order and reveals only supported successful visuals; failed attempts never mount a card or broken-image surface. Complete failures contribute to one compact unavailable count, category membership distinguishes visible from unresolved IDs, repaired records can retry progressively, and live loss cancels selection/drags plus revalidates PLACE/category commands without mutating cache, membership, canonical placements, or publication. Existing placement resolution remains lattice-owned. The final changed/new focused set passes 172/172; production build and budgets pass at 1,236,097 initial JS raw / 361,053 gzip, 253,857 owner JS raw / 72,661 gzip, 65,750 owner CSS raw / 9,715 gzip, and 1,956,247 core JS raw / 575,924 gzip. Interactive review accepted hierarchy, selection, progressive reveal, fallback, drag, compact mode, resize, collapse, and grouped authoring behavior.

Category rollback is code-only: stop injecting `categoryCommands`, remove the Browser menu/dialog activation and guarded store action, and restore read-only wording. Drag rollback removes the Browser pointer callback and explicit optional placement destination while retaining centered PLACE. The existing workspace-v8 and canonical-draft formats remain valid; no data migration, category deletion, asset rewrite, canonical draft rewrite, or publication rollback is authorized. PORTALS, AI categorization, category artwork, publication/visitor navigation, wallet/IPFS activity, favorites editing, legacy routing/cleanup, and Phase 5B.6 presentation work remain excluded.

Manual test:

1. Place real square, portrait, landscape, and transparent assets.
2. Move and resize from every corner.
3. Crop, layer, frame, mat, back, lock, hide, replace, and remove.
4. Reload and verify the exact composition.
5. Switch profiles and confirm isolation.
6. Preview and confirm private tables and placements are absent.

### Phase 6 — NFT focus viewer

Implement session-only global ARRANGE first, then adapt real asset records to the accepted production metadata rack. Narrative, Attribute, and Technical modules remain in a permanent order; one expands in place at a time, inactive faceplates slide around it, and the selected module persists while browsing. Production focus media is native and uncropped; authored placement presentation appears only at the exact opening and closing boundary. The rack inherits only the active owner-menu theme tokens, uses no NFT-derived color, and may expose only scoped, provenanced LUKSO facts or safe derived values. The default production surface and menu surface are Mist.

Rollback: remove the optional viewer activation callbacks and restore ARRANGE ON as the authoring-layer gate; the unchanged canonical draft/publication and storage records remain readable.

Manual test:

1. Open multiple ratios and both sparse and rich real metadata.
2. Expand each rack module and confirm faceplates slide without reordering or endpoint jitter.
3. Toggle the complete rack open and closed from the artwork.
4. Navigate by button, keyboard, wheel, and swipe without changing the active module.
5. Scroll rack content without moving the lattice.
6. Confirm unresolved fields remain honest.
7. Close and confirm focus and artwork return to the originating placement.

### Phase 7 — identity RÄCK

Combine shared live LSP3 identity, profile-scoped direct contract facts, the current owner draft identity projection, verified publication `exportedAt`, and canonical address-derived URLs in one pure adapter. The complete compact Profile Rail card expands directly through a body-portal transition into one centered RÄCK; its avatar resolves inside PROFILE MODULE, with no detached image, banner, or split composition. The legacy visitor card and prototype identity viewer remain unchanged. Use `LAST PUBLISHED` only.

Rollback: remove the optional rail activation, dossier render, and contract-facts hook. The unchanged Profile Rail summary, canonical draft/publication schemas, and persisted records remain readable.

Manual test:

1. Compare official facts with active editable overlay fields and verify inactive values are absent from the rendered model.
2. Change alias, avatar source, bio source, tags, and allowed visibility.
3. Confirm the official handle and address never change.
4. Confirm verified LUKSO chain 42, complete address, canonical explorer/Universal Everything/INSCAPE URLs, exact LSP5/LSP12 contract-register labels, and verified `LAST PUBLISHED`.
5. Confirm inactive private values do not leak.
6. Confirm Browser/Theme close, ARRANGE persists, viewer/gesture/CROP block opening, backdrop does not close, Escape restores trigger focus, and internal scroll never moves the lattice.
7. Check Carbon, Graphite, Slate, Ash, Mist, and Paper at 1280×720, 900px, 640px, and 390×844.

Accepted checkpoint (2026-07-30): the direct card-to-RÄCK transition, PROFILE / LINK / TECHNICAL module hierarchy, real media, progressive asset projection, responsive behavior, focus return, and shared theme-token contrast were interactively accepted. The final focused set passes 72 tests; production build and budget checks pass. Keeper control behavior and category/PORTALS work remain outside this checkpoint.

### Future identity boundary — PERSONA / ALTER PERSONA (documentation only)

The future public-facing presentations are named exactly **PERSONA** and **ALTER PERSONA**; never “Persona Mode” or “Incognito”. PERSONA is the standard light/Mist presentation sourced from the official Universal Profile and LSP3 (`SOURCE / UNIVERSAL PROFILE`). ALTER PERSONA is an alternate dark/Carbon INSCAPE presentation layered selectively over it (`SOURCE / INSCAPE`).

Alter Persona is presentation, not anonymity, privacy, verification, or a second account, and cannot mutate the Universal Profile or external profile appearance. Required copy: “Your Alter Persona changes only how you appear inside INSCAPE. Your Universal Profile and external profiles remain unchanged.”

Future candidate fields are display name, resident code/call sign, alternate profile/background images, tagline, long bio, tags, optional location, optional external handles, links, per-field visibility, and per-field inheritance. Untouched fields inherit PERSONA; selected overrides are labelled INSCAPE-authored. Handles remain optional, location is never inferred and defaults hidden, and no checkmark implies verification. A future compact card may use the approved square-grid mask, Mist/Carbon tokens, lattice-cell dissolve, and the reversible card-to-image-plus-RÄCK transition. Do not add editor UI, schemas, persistence, publication behavior, inheritance/provenance/rollback logic, a dead toggle, or production interaction without explicit approval.

### Phase 7.5 — Keeper cursor follow and click-to-move

The owner lattice delegates released-Keeper mouse/pen hover targets to the existing shared resident engine. One animation-frame scheduler retains only the newest target. Follow is enabled by default and is suspended by docking, ARRANGE, Browser, Theme, NFT or identity inspection, CROP, placement operations, table drag/swipe, Space-camera ownership, settling, and hidden interface state. Touch remains unavailable. Follow-disabled primary activation on otherwise unowned empty canvas is the approved next correction and must request one bounded target through the same engine without enabling continuous follow.

Right-clicking the dock opens shared-theme, session-only controls for `FOLLOW CURSOR` and `SLOW / NORMAL / FAST`; left-click remains dock/release. Continuous follow uses the ordinary engine easing with a subpixel-scale finishing cadence, while other engine movement retains its prior arrival behavior. Reduced motion places the target without flight.

Rollback: remove the owner pointer scheduler and optional dock control props. The unchanged shared engine, dock/release handoff, owner lattice, schemas, persistence, and visitor runtime remain valid.

Accepted checkpoint (2026-07-30): interactive review accepted follow smoothness, speeds, follow toggle, dock/release, and interaction ownership. The focused set passes 47 tests; production build and budget checks pass. Visitor reuse is deferred to Phase 8 cutover and must preserve this accepted controller contract.

Accepted correction (2026-07-31): cursor follow remains accepted and implemented. Follow-disabled empty-canvas click-to-move uses the same resident engine and is interactively accepted. Production placements and controls are rejected at pointer-down and pointer-up so NFT activation cannot also move the Keeper. The focused owner/follow/engine set passes 33/33; the production build and budgets pass. Phase 7.5 is `[x]`.

### Phase 8A — version 8 visitor deployment

Deploy the version 8 validator, resolver, canonical renderer, and legacy fallback before enabling version 8 publication. Owner Preview is the first consumer of this same visitor-safe runtime. It receives only the pure public projection, performs no owner write, excludes owner categories and session state, and must match later direct and iframe visitor rendering.

Read-only boundary audit (2026-07-31): the resolver and validator already accept version 8 and its canonical lattice, but `PublishedProfileDocumentPreview` currently routes every version into legacy `PublishedHomeWorld`, while owner `ProfileDocumentPreview` calls that legacy world directly. Phase 8A.1 adds one version-aware preview selector and one visitor-safe lattice world using the accepted pure renderer/navigation contracts. Versions 1–7 retain the legacy world. Owner Preview supplies a newly validated version-8 document to that exact selector; it does not render the raw draft or session Theme overrides. The first slice excludes viewer, identity, Keeper parity, publication, wallet/IPFS, reconciliation, categories, and schema changes; those visitor-parity items remain bounded Phase 8A follow-up work before acceptance.

Implemented checkpoint (2026-07-31, awaiting visual acceptance): the version-aware selector, visitor-safe nine-table lattice world, and owner PREVIEW adapter are connected. The preview adapter validates a public-only version-8 document, fails closed for unresolved referenced assets, and reaches the exact same published-preview component used by resolved visitor documents. Shared renderer/navigation CSS now has one production authority. Versions 1–7 and the version-7 publication default remain unchanged; all version-8 writes remain disabled. Focused tests pass 45/45 and the production build/budgets pass.

Accepted navigation correction and NFT-viewer checkpoint (2026-08-01, viewer awaiting interactive acceptance): the shared visitor world now owns its pointer surface above the inert owner shell, eagerly decodes the active transformed table, starts snap state in the destination frame, and uses the correct camera-cancel callback. Visitor placements activate the unchanged production `LatticeFocusViewer` / `LatticeProductionFocusArtwork` pair from their real table rectangles. The source hides only during modal ownership; same-table ready-entry browsing and exact close/focus return remain session-only. A narrow viewmodel option trusts only the already validator-accepted public asset fields and never reaches Library, indexer, RPC, owner, persistence, wallet, or writer state. Viewer modules inherit `appearance.menuSurfaceId` and the existing shared menu tokens, never NFT-derived colour. Focused Phase 8/renderer/owner tests pass 51/51; the production build and bounded budgets pass with exact measurements recorded in the roadmap.

Accepted public-identity checkpoint (2026-08-01): Visitor exposes one compact public profile source that expands through the accepted Identity MODULE RÄCK. One pure adapter consumes only validated `profile.cachedIdentity`, public `lattice.identityPresentation`, and its embedded avatar asset; live LSP3 identity and open-only direct contract facts can enrich those public fields without importing Library, owner draft, Persona/Alter Persona, wallet, persistence, or writer state. The RÄCK retains the existing theme tokens, 92% veil, focus/inert/close behavior, responsive layout, reduced motion, exact source return, and deterministic pointer release. Interactive review accepted the profile source, modules, return, and corrected table ownership.

Accepted Visitor Keeper checkpoint (2026-08-01): version-8 Visitor reuses the shared Phase 7.5 pointer scheduler, eligibility rules, speed multipliers, `KeeperDock`, and resident-engine callbacks. Explicit movement/dock capabilities cross the public boundary; the owner handoff object and owner state do not. Cursor-follow, session controls, follow-disabled click-to-move, dock/release, reduced motion, interaction suppression, and no-op click handling preserve the accepted Owner contract. Focused tests pass 37/37; production build and budget checks pass. Interactive review accepted the complete parity boundary.

Phase 8A completion audit (2026-08-01): shared Preview/Visitor routing, versions 1–7 fallback, pure v8 projection, public import isolation, viewer facts, Identity RÄCK, Keeper capabilities, and the publication guard pass 79/79 focused checks. Interactive Keeper acceptance is complete; Phase 8A is closed.

Rollback: select the legacy renderer; the compatible build can still read retained fallback fields.

### Phase 8B — version 8 publication

Enable version 8 snapshot publication through the unchanged IPFS, wallet, and read-back boundary.

Read-only implementation audit (2026-08-01): the readable v8 envelope, validator, migration path, canonical serializer, resolver, version-aware renderer, and legacy fallback already exist. Every production write boundary still correctly rejects v8. The deterministic Owner Preview builder is not a publication artifact: it fixes revision to 1 and both timestamps to the epoch. Production must instead use the existing pure `buildProfileDocumentV8` with one real export timestamp, preserved creation time, incremented revision, the canonical lattice draft, the exact accepted asset generation, and ordinary validation enforcing `lattice.lastPublished === exportedAt`.

The public-IPFS upload client, canonical artifact/hash code, wallet freshness binding, ERC725Y write, receipt confirmation, and repository read-back remain the single writer pipeline. V8 must be allowed coherently at the artifact, client upload, Netlify upload, CID verification, wallet submission, and read-back verification boundaries; no isolated allowlist change is safe. The new lattice publication surface stays lazy and capability-based. `OwnerLatticeShell.jsx`, Visitor, and the canonical renderer retain their prohibition on direct wallet/provider, IPFS, repository, and persistence imports.

The first cutover keeps the frozen v8 publication snapshot in profile-scoped runtime state rather than overloading the legacy `os-underneath.profile-snapshot.v1:` storage contract. Categories, private tables/placements, session Theme, RÄCK/window geometry, selection and editing state, camera/viewer state, and Keeper session controls remain excluded. Exact files, wiring order, negative tests, manual acceptance, and rollback are recorded in the Alpha execution roadmap.

Pre-writer checkpoint (2026-08-01): the pure production snapshot builder is implemented and tested but intentionally unreachable from Owner UI and every writer boundary. It supplies real monotone publication timing/revision behavior, exact authority checks, public-only projection, deterministic canonical serialization, and fail-closed asset resolution. The focused set passes 12/12. Version 7 remains the sole publishable version pending Phase 8A.4 visual acceptance and the coherent Phase 8B policy cutover.

Implemented Phase 8B checkpoint (2026-08-01, surface accepted; awaiting real-publication acceptance): versions 7 and 8 now share the complete existing upload, canonical verification, wallet, receipt, and resolver-read-back policy, while the legacy local snapshot store remains version-7-only. Owner PUBLISH lazy-loads a bounded RÄCK surface with explicit prepare, verify, and publish stages. The frozen v8 snapshot is runtime-only, profile-scoped, public-only, generation-bound, and becomes stale after any relevant live-context change. No automatic upload or wallet action occurs. Focused Phase 8B checks pass 56/56, `git diff --check` passes, and production build/budgets pass with the publication controller isolated in a 29.04 kB raw / 9.90 kB gzip lazy chunk. Interactive review accepted the publication surface and FROZEN/STALE lifecycle without initiating an upload or wallet action. Final acceptance requires the explicit revision-one/revision-two publication and cross-account/direct/iframe matrix.

Final Phase 8 acceptance (2026-08-01): a real version-8 revision one and a changed revision two were published from the production deployment. A different authenticated Universal Profile resolved both through the direct `?view=0x…` visitor route, and revision two exposed the new public workspace state. This accepts the public-IPFS upload, CID verification, wallet write, on-chain pointer, latest-document resolution, owner/visitor isolation, and production visitor renderer. Phase 8 is complete. Version 7 remains readable as the compatibility and rollback boundary.

Rollback: disable new version 8 publication. Already published version 8 documents remain readable. An on-chain return to version 7 requires explicit owner authorization.

Manual test:

1. Publish from profile A.
2. Visit from profile B, signed out, directly, and in logged-in and logged-out iframes.
3. Compare all nine tables, public identity, viewer facts, and Keeper behavior; confirm owner categories and authoring state are absent.
4. Confirm visitors perform no owner storage operations and receive no authoring controls.
5. Publish a second revision and confirm every route resolves it.
6. Select compatibility rendering and confirm the document remains readable.
7. Return to lattice rendering and confirm the canonical lattice returns unchanged.

### Phase 9 — cutover and Alpha hardening

Enable the production owner and visitor lattice paths while retaining the complete fallback. Verify isolation, accessibility, reduced motion, responsive behavior, performance budgets, deployment, and rollback.

Owner profile-navigation activation (2026-08-01, awaiting interactive acceptance): `OwnerLatticeShell.jsx` now owns mutually bounded CREATIONS, ACTIVITY, and DISCOVER session windows with exact rail-trigger focus return. `CreationsBrowser.jsx` retains the creator-attribution repository and progressive source states but replaces its old `NftFlipViewer` activation with the accepted `LatticeFocusViewer` RÄCK, decoded native dimensions, previous/next navigation, current menu-surface tokens, and explicit indexed, metadata, or derived technical labels. `ActivityBrowser.jsx` continues to consume `luksoActivityRepository` event history and now closes through Escape. `ProfileDiscoveryBoundary.jsx` remains the current public directory and no Gallery import is introduced. `LatticeWorkspaceToolbar.jsx` and `SettingsBrowser.jsx` activate MORE → SETTINGS only; unsupported INTERFACE remains absent. These are lazy owner-only surfaces and do not alter canonical documents, Library ownership, publication, routing, wallet/IPFS, or visitor capabilities.

### Phase 10 — legacy cleanup

Remove only code proven unreachable after live acceptance. Retain compatibility readers while published legacy documents exist.

## 11. Complexity findings and simpler boundaries

- `ModuleGridShell.jsx` already integrates legacy Home, Gallery, Upper, publication, Browser, and utility-window state. A separate lazy lattice owner shell is safer than adding another world model to it.
- The isolated lattice profile currently uses normalized float bounds even though production authorship is grid-cell based. Production must persist cells and derive normalized values only during projection.
- Prototype mat and backing data is held in parallel maps. Production should keep complete placement presentation in one canonical placement record.
- The isolated profile model currently combines private draft and public state. Separate schemas make redaction deterministic and testable.
- The Browser fixture shape differs from production asset records. A small pure adapter is safer than coupling the Browser to repository formats.
- The accepted production viewer uses one ordered rack rather than independent left/right dossiers. The paired side/lower dossier path remains prototype-only compatibility until the later legacy-cleanup phase and must not shape new production modules.
- The Library RPC repository and the Phase 7 contract-facts repository both read LSP5 today for different bounded outcomes: the former discovers asset contracts for inventory loading, while the latter exposes only an independently statused exact register length. Consolidation is deferred until it can preserve those separate failure and loading contracts.
- Exact document validation and canonical hashing mean version 8 requires a reader-before-writer rollout; it cannot be introduced as a silent optional field.
- The current owner restore path already performs multi-source reconciliation. Canonical lattice reconciliation should join that transaction through an adapter rather than increase `ModuleGridShell` responsibility.
- The dev-only five-table store is neither canonical nor published. It must remain compatibility input rather than being expanded.

## 12. Phase 1 conclusion

The first safe production slice is Phase 2A: pure canonical owner-draft and public-projection schemas plus a real-asset projection adapter.

Phase 2A has no visual output, no storage write, no publication change, no feature flag, and no runtime import. It is reversible until its domain contract is accepted. Implementation requires a new explicit approval gate under the live execution roadmap.
