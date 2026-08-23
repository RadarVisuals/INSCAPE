# INSCAPE System Workflow Production Plan

Status: `[x]` - clean-break direction approved; Phases 1, 2, and 3 complete; Phase 4A independently audited **GO**; overall Phase 4 remains open

Branch: `migration/system-workflow-2026-08-17`

Accepted prototype checkpoint: `91894afefba0839d29509885eecd4a9c954e52a7`

Prototype route: `/owner-shell-system-prototype.html`

Date: 2026-08-18

## 1. Goal

Replace the current owner workflow with the accepted System Workflow and connect it directly to INSCAPE's real production authorities.

INSCAPE is pre-alpha. RadarVisuals is the only user. Existing local drafts and published profile documents have no migration value.

Proceed directly:

- replace fixed nine-table Lattice storage with ordered dynamic Grids;
- replace the old public document with an INSCAPE-only Version 9 contract;
- promote the extracted System Workflow into a clean production shell;
- retain the real profile, Library, authoring, IPFS, wallet, and provider authorities;
- switch publication to the new INSCAPE ERC725Y key;
- certify the complete path once;
- remove obsolete UI/topology/compatibility code after acceptance.

Do not build backwards compatibility for experimental data or UI.

## 2. Canonical product decisions

The visible and internal concept is **Grid**.

A profile has:

- one or more ordered Grids;
- a stable unique ID per Grid;
- freely reorderable Grids;
- the first public Grid as the Visitor entry;
- no fixed 3x3 topology;
- no mandatory nine slots;
- no new `tableId` terminology.

The fixed 32x18 artboard remains the authored geometry inside each Grid. It is independent of the removed nine-Grid topology.

The owner interface remains fixed while selected Grid content changes beneath it. Any transition is derived from list order, not persisted coordinates.

## 3. Explicit clean break

Do not preserve or migrate:

- old local nine-table drafts;
- `table-01` through `table-09` identities;
- fixed Grid coordinates and cardinal navigation;
- `ACTIVE` / `UNUSED` slots and activation order;
- old Profile Document v1-v8 parsing in the active route;
- old key fallback;
- old Visitor runtime selection;
- prototype fixture records;
- Rack or MODUL-8R presentation compatibility.

Old local-storage values and IPFS CIDs may continue to exist physically. The new application ignores them.

Use a new singleton key:

```text
INSCAPEProfileDocument
0x804dd24d51189d1d9e972f155541cead2653af105983d5acac1ec2b3478d9362
```

The key was verified with the repository's installed `@erc725/erc725.js` `encodeKeyName` implementation.

Create one central key module, provisionally:

```text
src/profileDocument/domain/inscapeProfileDocumentKey.js
```

Publisher, repository, discovery, permissions diagnostics, and tests import that module. Do not define the key inside the repository again.

The next real publication writes the new CID and verification hash to this key. No new Pinata account, IPFS setup, contract, or environment variable is required.

Before the first real publication only, inspect the live controller:

- `SUPER_SETDATA`: no AllowedERC725YDataKeys change required;
- restricted `SETDATA`: explicitly authorize adding the new key before any wallet action.

This is a publication preflight, not implementation work.

## 4. Keep existing authorities

Retain rather than reproduce:

- Universal Profile/provider owner authority;
- profile-address isolation;
- Library inventory and categories;
- asset/media resolution;
- normalized 32x18 placement geometry;
- stale-session, lock, bounds, overlap, crop, layer, and single-commit rules;
- canonical byte generation, hashing, CID verification, and read-back;
- Pinata upload Function/client;
- wallet context, chain/profile checks, and `setData` submission;
- direct-profile and iframe routing boundaries;
- support diagnostics;
- CSP and completed release-hardening work.

Adapt topology-independent authoring operations mechanically from `tableId` / `draft.tables` to `gridId` / `draft.grids`. Do not move authority into components or prototype hooks.

Do not globally replace every `table` string. Older Library table APIs are a different model and must only change if their actual import graph requires it.

## 5. Exact draft v4 contract

Use a new storage prefix such as:

```text
inscape.system-workflow-draft.v1:<normalized-profile-address>
```

Never read, migrate, or delete `inscape.lattice-production-draft.v1:*`.

Required draft shape:

```js
{
  profileAddress,
  draftVersion: 4,
  artboard: { aspectWidth: 16, aspectHeight: 9 },
  geometry: { columns: 32, rows: 18 },
  appearance: {
    surfaceId,
    menuSurfaceId,
    dossierSurfaceId,
    guideMode,     // 'LINES' | 'DOTS' | 'NONE'
    guideSize,     // signed Grid density, -8..+8; 0 preserves the base cell and guide strokes remain 1 px
    guideColor
  },
  identityPresentation,
  grids: [
    {
      id: 'grid:<stable-id>',
      title: 'HOME',
      subtitle: '',
      visibility: 'PUBLIC',
      labelVisible: true,
      labelAnchor: 'top-left',
      labelOffset: { column: 0, row: 0 },
      placements: []
    }
  ]
}
```

Limits reuse already established profile-document safety ceilings:

- `maxJsonBytes`: 512 KiB;
- `maxGrids`: 24;
- `maxPlacementsPerGrid`: 200;
- `maxTotalAssetReferences`: 1000;
- existing text, ID, URL, crop, span, layer, and geometry limits.

These are safety limits, not a nine-Grid product model. They may be raised later with measured evidence.

Rules:

- At least one Grid exists.
- Array order is canonical navigation order.
- Grid and placement IDs are stable and unique.
- IDs use a production UUID/random authority, never `Date.now()`.
- Create appends a private Grid with a safe default name.
- Reorder atomically changes array order.
- Delete requires exact impact/fingerprint confirmation.
- The final remaining Grid cannot be deleted.
- Private Grids and placements never enter public projection.
- Publication is blocked when no public Grid exists.
- The first Grid remaining after public filtering is the Visitor entry.

## 6. Exact Profile Document v9 contract

Use this clean envelope:

```js
{
  documentType: 'INSCAPE_PROFILE',
  version: 9,
  documentId,
  revision,
  createdAt,
  exportedAt,
  network: { name: 'lukso-mainnet', chainId: 42 },
  profile: { address, cachedIdentity },
  artboard: { aspectWidth: 16, aspectHeight: 9 },
  geometry: { columns: 32, rows: 18 },
  appearance,
  identityPresentation,
  grids: [/* ordered public Grids only */],
  metadata: {}
}
```

Version 9 does not inherit the old v7 envelope. It contains no Keeper, stage, environment, signals, systemModules, spaces, canvasObjects, Lattice wrapper, redacted private slots, or compatibility fields.

Each public Grid contains its stable ID, presentation text/labels, and ordered public placements. Each placement preserves the existing publishable asset reference, geometry, crop, frame, mat, backing, transparency, layer, navigation order, and transforms. Owner lock state is not public.

Update together:

- constants, builder, validator, serializer/fingerprints;
- v9-only restore/reconciliation if refresh/read-back recovery remains useful;
- public Grid projection;
- Preview builder and media preload entry selection;
- upload Function accepted version;
- resolver parser;
- Visitor projection/rendering;
- direct-profile and iframe fixtures;
- publication/support version labels.

Do not add v1-v8 migration or dual parsing to the active route.

## 7. Accepted UI source and production boundary

The accepted reference is frozen under `src/prototypes/owner-shell-system/` at checkpoint `91894af`.

Read its equivalence map, inconsistency ledger, parent, stylesheet, and the relevant extracted component/controller test before promoting a boundary.

Prototype React state, pixel placement, fixture records, timestamp IDs, and prototype mutation hooks are not production authorities.

Production must not import from `src/prototypes/**`.

Use a clean target such as:

```text
src/public/OwnerSystemWorkflowShell.jsx
src/public/ownerSystemWorkflow/
  components/
  adapters/
  hooks/
  ownerSystemWorkflow.css
```

Keep the shell thin. Do not incrementally turn `OwnerLatticeShell` into the new shell and do not copy either the old shell or prototype parent into a second monolith.

## 8. Four implementation phases

### Phase 1 - Contract, domain, storage, and authoring

Status: `[x]`

1. Add central INSCAPE document identity/key constants.
2. Implement draft v4, exact validation, and new storage prefix.
3. Implement dynamic Grid create, rename, visibility, reorder, and delete.
4. Convert topology-independent placement operations and authoring session to `gridId`.
5. Replace coordinate navigation with ordered Grid selection.
6. Replace fixed-nine tests with dynamic invariants.

Focused proof: initial Grid; max 24; stable IDs; CRUD/reorder/reload; last-Grid protection; profile isolation; stale rejection; placements survive reorder; single commits; old storage ignored.

Phase 1 checkpoint:

- dynamic draft v4 with the new isolated storage prefix;
- central `INSCAPEProfileDocument` key authority;
- dynamic Grid CRUD, reorder, and confirmed delete;
- complete topology-independent canonical authoring parity;
- fail-closed storage and stale-interaction protection;
- focused Phase 1 tests: 31/31 passed;
- LUKSO standards tests: 5/5 passed;
- independent final audit: **GO**.

### Phase 2 - Public v9 vertical slice

Status: `[x]`

1. Implement the v9 builder, validator, serializer, and public projection.
2. Implement v9-only Preview with first-public-Grid media preload.
3. Rewrite Visitor from nine spatial planes to ordered public Grids.
4. Adapt the injectable v9 parser/review seam, direct-profile, iframe, and v9-only reconciliation. The default resolver, key, and publication cutover remain Phase 4 work.
5. Remove v1-v8 branches from the active route.
6. Keep real publication disabled in this phase.

Focused proof: exact envelope; byte/quantity limits; private omission; entry selection; Preview equals Visitor; refresh/read-back recovery; no owner/Library imports in Visitor.

Phase 2 checkpoint:

- exact `INSCAPE_PROFILE` version `9` contract with only `documentType`, `version`, `documentId`, `revision`, timestamps, LUKSO-mainnet network/profile authority, artboard, geometry, appearance, identity presentation, ordered `grids`, and empty `metadata` at the document root;
- ordered public Grids and public placements only, with the first remaining public Grid as Visitor entry; private state is omitted and publication is blocked when no public Grid remains;
- canonical asset references preserve placement geometry, crop, frame, mat, backing, transparency, layer, navigation order, transforms, and source/scope-qualified creator provenance;
- exact validation, deterministic canonical serialization/hash input, content fingerprints, and v9-only reconciliation/read-back preserve public order while retaining non-conflicting private local Grids;
- v9 Preview and Visitor share rendering, focus, media preload, and first-public-Grid behavior across profile/provider, direct-profile, and iframe review boundaries;
- the injectable v9 parser is an isolated review seam only; the default resolver/key/publication path remains unchanged for Phase 4, and the selected MODUL8R production runtime plus its v8 Preview remain intact;
- the v9 browsergate was modernized for the ordered-Grid contract and creator provenance;
- focused Phase 2 regression matrix: 47/47 passed; browsergate: 12/12 passed; LUKSO standards: 5/5 passed;
- full production build utility tests: 14/14 passed; owner-runtime isolation: 2/2 passed; production build and `build:check`: passed with `leaks: []` and no v9 module in the production owner closure;
- minimal independently proven owner-JavaScript gzip rebaseline: `91_234` to `91_370`; accepted build measured `91_364` bytes;
- independent final audit: **GO**.

### Phase 3 - Production System Workflow shell

Status: `[x]`

1. Promote accepted visual components outside prototypes.
2. Connect profile/provider authority and draft v4.
3. Connect real Grids, placements, media, Library/categories, Discover, Profile, Activity, and Settings.
4. Connect selection, marquee, move, resize, duplicate, layers, lock, delete, crop, rotate, mirrors, frame, mat, backing, and transparency.
5. Connect canonical Preview.
6. Preserve focus, Escape, dismissal, keyboard, themes, and reduced motion.

Preserve the accepted visual details: fixed bottom UI; restrained/fading selection; exact crop viewer transition; no orphan handles; centered artwork/counter; hidden focus-view guides; smooth Native Fit; thin crop boundary; outside crop completion; locked-item pass-through; outward frames; stable filter rail.

Use a development-only review entry. Do not change production selection mid-phase.

#### Open structural blocker - fullscreen Grid/world contract

The current fixed `32x18` / `16:9` artboard contract causes unavoidable letterboxing whenever the usable browser viewport is not exactly `16:9`. The dock and other fixed UI span the viewport, but the authoring surface and placement bounds remain restricted to the centered artboard. This produces large unusable bands at common fullscreen `1440p` and `1080p` browser sizes and prevents placements from reaching the visible workspace edges. This is a contract defect, not a bounded CSS or responsive-styling defect.

Do not solve this by stretching the `32x18` artboard or by masking the unused bands. Before continuing visual parity work, replace the hard outer artboard with a fullscreen world/Grid viewport:

- the complete stage above the fixed bottom UI is usable;
- Grid cells remain square and snap-to-Grid remains authoritative;
- viewport size determines how many rows and columns are visible instead of creating letterbox borders;
- placements remain stored in Grid/world coordinates rather than viewport pixels;
- each Grid may retain an explicit camera/start view for authoring, Preview, and Visitor projection;
- wider or taller viewports reveal more world without stretching, cropping, or changing placement geometry;
- existing placement-count, asset-reference, payload-size, and coordinate safety limits remain fail-closed.

Phase 3 resolves the start-view choice without introducing a fictitious per-Grid camera: the sole canonical authority is the shared, centered `SYSTEM_WORKFLOW_DEFAULT_VIEW` with `CONTAIN_REFERENCE` zoom semantics. Owner authoring, Preview, and Visitor all project through that same authority. Draft v4 and public v9 therefore intentionally contain no camera field. A persisted per-Grid camera may be introduced only with a future authored pan/zoom feature and must then replace this authority across all three consumers in one contract change.

This correction affects the Phase-1 draft geometry and bounds authorities plus the Phase-2 v9 publication/Preview/Visitor projection. Because the new workflow has not been selected or published and no backward compatibility is required, correct those contracts directly before Phase 3 acceptance rather than adding a compatibility layer. Preserve the committed Phase-1 and Phase-2 checkpoints as Git rollback points. No implementation of this blocker is authorized by this note alone.

#### Binding Phase-3 parity blockers - 2026-08-19 review

These are not independent micro-polish requests. They identify incorrectly recreated interaction, geometry, motion, presence, and styling contracts. Correct them as coherent shared primitives after comparing the final System Workflow prototype and the production review route at identical viewports and states. Do not stack local CSS exceptions or declare parity from source assertions alone.

**Artwork geometry, crop, toolbar, and focus viewer**

- Resizing changes the placement/frame geometry without ever distorting the media's intrinsic aspect ratio. Turning a square placement into a rectangle must recompose the undistorted image inside that frame, as in the final prototype.
- Crop starts from that exact composition. Zoom and pan then choose the crop inside the resized frame; entering Crop must not preserve or expose a previously distorted media ratio.
- `NATIVE FIT` must perform a real, visible fit operation and preserve smooth media rendering. Crop pointer movement must not be inverted, and resize/crop/rotate must share one coherent transform authority.
- Rotation must not break crop geometry, frame geometry, opening origin, closing destination, or media interpolation.
- Artwork open and close must be one continuous source-to-destination transition from the exact Grid placement, with no cropped substitute, snap, handoff, or final-frame correction.
- The modules following the artwork inside the NFT viewer must retain the prototype's transition between module states; they must not simply appear or disappear.
- Double- and triple-check the complete crop toolbar and artwork interaction against the final prototype rather than fixing only the currently reported examples.

**Profile/Activity cards, dismissal, and presence**

- Compact-to-expanded and expanded-to-compact Profile transitions must use the final prototype's single clean card animation. Do not use a crossover or handover that first resizes and then snaps position.
- Clicking outside either the compact or expanded Profile card returns directly to the Grid. Outside dismissal must never become unresponsive.
- Apply the same continuous-identity rule to artwork/NFT viewer motion wherever the current implementation swaps surfaces.
- Ordinary menus and panels must not dim or fade the background. Only immersive expanded surfaces that did so in the final prototype, such as expanded Profile or Activity, may alter background presence. Verify this literally against the prototype.
- Expanded Activity controls require deliberate spacing and responsive behavior; actions must not disappear at smaller supported viewports.

**Discover and shared Browser workspace**

- Restore the complete Discover side-column styling and behavior from the final prototype, including its collapse/resize behavior.
- Search inputs must not show the heavy native black focus rectangle after pointer interaction. Preserve an accessible keyboard-only `:focus-visible` treatment without exposing that pointer-state ring.
- Filter and Sort menus require the accepted typography, spacing, surfaces, selected-state treatment, and custom presentation; do not expose unstyled browser controls.
- Restore the accepted hover-information treatment and use the same shared treatment in Discover and Library.
- Discover `CREATE` must work and match the accepted control styling.

**Grid switcher**

- Preserve the working vertical active indicator, Grid selection, and drag reorder.
- Remove the six-dot drag decorations and trailing ellipsis menus; they add no useful information.
- Put direct icon-only actions on each Grid row for rename, public/private visibility, and delete, each with a clear hover label.
- Public/private state must be truthful and unambiguous; never show a closed/private icon for a public Grid.
- Keep the row visually quiet and do not replace the removed dot/ellipsis clutter with another permanent control cluster.

**Library and category creation**

- Creating a category must not arbitrarily darken most of the workspace as though it were selected. Reproduce the prototype's intentional modal/presence treatment exactly.
- Restore the final prototype's hover-information treatment and apply its shared version to Discover.
- Restore the accepted Filter/Sort dropdown typography and styling.
- Remove the heavy native pointer focus rectangle from Library search while retaining keyboard `:focus-visible` accessibility.

**Bottom dock**

- Rebuild spacing and responsive behavior as one dock layout rather than hiding or squeezing arbitrary controls.
- Required logical order: `PROFILE`, `LIBRARY`, `GRIDS`, `DISCOVER`, `ACTIVITY`, `PREVIEW`, `PUBLISH`, `SETTINGS`.
- Controls must remain understandable and reachable at supported viewport widths; responsive variants must preserve the workflow rather than silently dropping actions.

**Preview and fullscreen Grid projection**

- Preview must consume the corrected fullscreen world/Grid projection and must not reintroduce fixed-artboard edge restrictions, stretching, clipping, or letterbox bands.
- Authoring, Preview, and Visitor must share placement geometry and camera/start-view semantics so a successful authoring correction cannot diverge again at publication review.

**Settings**

- Recreate the complete final-prototype Settings presentation rather than patching the current partial panel.
- Replace visibly native browser sliders and dropdowns with the accepted shared control styling while preserving semantic inputs and keyboard access.
- Square-guide size must visibly and correctly change the square guide geometry. Lines, dots, none, guide size, guide color, canvas color, themes, and related controls must all operate through canonical appearance authority.
- Place the close action within the Settings layout without overlapping labels or controls.
- Validate Settings at all supported viewport widths and all themes; incomplete styling or inert controls block Phase-3 acceptance.

**Acceptance method**

- Capture matched prototype/review screenshots for every major state above at identical viewport dimensions, including transitions where still frames alone are insufficient.
- Compare computed geometry, typography, presence, and interaction outcomes, not only approximate visual resemblance.
- Consolidate fixes in the smallest correct shared primitives. Do not respond to this list with a sequence of isolated one-off offsets, opacity overrides, or component-specific copies.
- Phase 3 remained `[~]` until the fullscreen Grid/world correction and every blocker in this review were manually accepted; the completion checkpoint below records that acceptance.

#### Phase-3 completion checkpoint - 2026-08-23

Phase 3 is accepted and frozen at the development-only System Workflow review boundary:

- the fullscreen Grid/world projection uses square cells across the complete usable viewport and shares its centered default-view authority with owner authoring, Preview, and Visitor without adding a persisted camera field;
- placement, movement, group movement, proportional resize, crop, rotation, mirroring, selection, marquee, duplication, layer ordering, locking, removal, and snap-to-Grid behavior use the canonical System Workflow authorities;
- artwork opening/closing, ratio-safe browsing, profile identity transitions, disclosure modules, Grid swipe transitions, selection presence, and reduced-motion behavior retain continuous visual identity without orphaned controls or transition-owned geometry;
- Profile, Activity, Library, Discover, dynamic categories/sections, Grid switching/reordering, Settings, Docs, Preview, Visitor, the fixed dock, the layer inspector, and narrow layouts were reviewed as one coherent shell;
- the Sora and IBM Plex Sans Condensed typography, supplied wordmark, shared controls, six themes, guide modes, guide color, and separate workspace/interface surfaces were manually accepted; the user explicitly waived another duplicate six-theme review before freeze;
- Library/Discover organization and drag placement retain source aspect ratios, truthful membership semantics, accessible keyboard focus, theme-aware context actions, and responsive two-row control layouts;
- MODUL8R remains the selected production owner runtime; the System Workflow entrance remains development-only and no Phase-4 key, resolver, publication, Discovery-event, upload, wallet, or deployment cutover has occurred.

Final verification:

- focused Phase-3 domain, shell, preview, runtime, build, isolation, and LUKSO matrix: 90/90 passed;
- real Edge System Workflow browser matrix: 13/13 passed across canvas, projection, crop, inspector, Library, panels, and completion coverage;
- complete repository suite: 1,230/1,230 passed, with zero failures, cancellations, or skips;
- production build: passed; `build:check`: passed at 856,289 initial-JavaScript bytes; owner dependency leaks: none;
- `git diff --check`: passed before staging.

### Phase 4 - Publication, discovery, cutover, and certification

Status: `[ ]`

1. Switch publisher and resolver to the central INSCAPE key.
2. Switch Discovery event/query filtering to that same key.
3. Accept only v9 in the upload Function and active parser.
4. Connect existing upload, CID verification, wallet publication, and read-back UI.
5. Add `OwnerSystemWorkflowShell` to runtime loader, isolation, and production-build mappings.
6. Run one consolidated visual polish pass.
7. Run focused tests, then one full sequential suite.
8. Run production build, bundle check, isolation, and artifact scan.
9. Run hardware owner, published Visitor, direct-profile, and iframe browser gates.
10. Select the new shell through the lazy owner seam and obtain manual acceptance.

No real upload, signature, transaction, merge, or deploy without separate explicit authorization. Perform the LSP6 controller preflight before the first publication.

Phase 4A checkpoint (2026-08-23; independently audited **GO** and committed locally; Phase 4B awaits explicit authorization):

- steps 1-4 are implemented as a clean v9 cutover; overall Phase 4 remains `[ ]` because runtime integration, browser certification, shell selection, and acceptance are Phase 4B work;
- publisher, resolver, and Discovery now import the Phase-1 `INSCAPE_PROFILE_DOCUMENT_KEY` authority; the active `OSUnderneathProfileDocument` name/hash and Discovery filter were removed;
- the upload Function, upload client, publisher artifact preparation, default resolver parser, active Preview, and Visitor accept canonical Profile Document v9 only and fail closed for v1-v8, malformed, noncanonical, wrong-profile, or hash-mismatched bytes;
- the prepared System Workflow publication rack reuses the existing upload, CID verification, wallet preparation, generation/stale-write guards, read-back, and support authorities without being mounted into the production runtime;
- focused Phase-4A publication/resolver/Discovery/v9 matrix: `115/115` passed, including the singleton-key authority plus formatted, reordered, and UTF-8 BOM-prefixed noncanonical byte rejection; production budget/runtime/isolation/artifact matrix: `38/38` passed; LUKSO standards: `5/5` passed; production build and `build:check` passed at `803_295` initial JavaScript bytes with `leaks: []`;
- the first independent audit found that the resolver accepted hash-valid formatted/reordered v9 JSON; serialization equality corrected that defect. The second audit found string comparison still hid a UTF-8 BOM because `TextDecoder` and `Request.text()` removed it. Resolver and upload Function now compare the original fetched/request bytes with the central `profileDocumentV9HashInput` output and reject hash-valid BOM-prefixed bytes as `NON_CANONICAL_DOCUMENT` before resolution, credentials, or Pinata;
- final independent re-audit: **GO** with no blocking findings. Both canonical-byte blockers are fully resolved. The sole non-blocking count correction (`114/114` to `115/115`) is incorporated in this checkpoint; overall Phase 4 remains `[ ]` and Phase 4B is not authorized by this result;
- user-authorized measured budget: owner JavaScript remains `325_345` raw and measures `95_611` gzip against the retained `95_620` ceiling; owner CSS remains `85_913` raw / retained `15_408` gzip ceiling and measures `15_076` gzip, including the accepted guide-free inspection correction, with exact-boundary and limit-plus-one tests preserved;
- MODUL8R remains selected; `ownerRuntimeSelected.js` and the production runtime loader are unchanged; the audited Phase 4A checkpoint was committed locally after GO, while no IPFS upload, signature, transaction, ERC725Y write, deployment, merge, push, environment, or Netlify configuration change occurred.

Official standards rechecked on 2026-08-23: [LSP2 ERC725Y JSON Schema](https://github.com/lukso-network/LIPs/blob/main/LSPs/LSP-2-ERC725YJSONSchema.md), [LSP6 Key Manager](https://github.com/lukso-network/LIPs/blob/main/LSPs/LSP-6-KeyManager.md), and [LSP0 ERC725 Account](https://github.com/lukso-network/LIPs/blob/main/LSPs/LSP-0-ERC725Account.md). LSP6 `SETDATA`/allowed-data-key permission behavior is unchanged; controller permission preflight remains mandatory before the first separately authorized live publication.

## 9. Post-acceptance cleanup

After proven cutover, remove in a separate commit:

- fixed activation slots and nine-table validation;
- cardinal navigation and 3x3 overlay from production;
- v1-v8 migration/compatibility branches;
- legacy Visitor selection;
- `OwnerLatticeShell`, `OwnerModul8rShell`, and obsolete Rack/MODUL8R presentation code;
- old Library table APIs only when import-graph evidence proves them unused.

Git history is sufficient code rollback. Do not maintain permanent old runtime compatibility.

## 10. Working and acceptance rules

For each phase:

1. report branch, HEAD, worktree, and selected runtime;
2. name exact files/authorities;
3. preserve unrelated work;
4. implement directly without compatibility scaffolding;
5. run focused tests during iteration;
6. provide the local route and short manual checklist;
7. fix bounded review findings;
8. report changed files and worktree;
9. wait for commit/push authorization.

Stop only for an unexpected wallet permission, key/infrastructure/security-policy change, unrelated authority rewrite, or real external action. Do not stop because old experimental data becomes unreadable.

Final acceptance covers dynamic Grid lifecycle/order, real authoring, all panels, six themes, Preview/Visitor parity, publication preparation, direct-profile, iframe, keyboard, reduced motion, runtime isolation, and absence of Keeper/Pixi/Startveil/unrelated prototype work.

## 11. Status and next action

| Phase | Status |
| --- | --- |
| Clean-break plan | `[x]` |
| 1. Contract/domain/storage/authoring | `[x]` |
| 2. Public v9 vertical slice | `[x]` |
| 3. Production System Workflow shell | `[x]` |
| 4. Publication/discovery/cutover | `[ ]` |
| Post-acceptance cleanup | `[ ]` |

Phases 1, 2, and 3 are complete. Phase 4A steps 1-4 are implemented and independently audited **GO**. Overall Phase 4 remains open; do not begin Phase 4B without explicit authorization.

Do not commit, push, deploy, upload, sign, or publish without explicit authorization.
