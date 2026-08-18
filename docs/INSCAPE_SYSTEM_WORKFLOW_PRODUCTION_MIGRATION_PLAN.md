# INSCAPE System Workflow Production Plan

Status: `[x]` - clean-break direction approved; Phases 1 and 2 complete; Phase 3 not started

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
    guideSize,
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

Status: `[ ]`

1. Promote accepted visual components outside prototypes.
2. Connect profile/provider authority and draft v4.
3. Connect real Grids, placements, media, Library/categories, Discover, Profile, Activity, and Settings.
4. Connect selection, marquee, move, resize, duplicate, layers, lock, delete, crop, rotate, mirrors, frame, mat, backing, and transparency.
5. Connect canonical Preview.
6. Preserve focus, Escape, dismissal, keyboard, themes, and reduced motion.

Preserve the accepted visual details: fixed bottom UI; restrained/fading selection; exact crop viewer transition; no orphan handles; centered artwork/counter; hidden focus-view guides; smooth Native Fit; thin crop boundary; outside crop completion; locked-item pass-through; outward frames; stable filter rail.

Use a development-only review entry. Do not change production selection mid-phase.

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
| 3. Production System Workflow shell | `[ ]` |
| 4. Publication/discovery/cutover | `[ ]` |
| Post-acceptance cleanup | `[ ]` |

Phases 1 and 2 are complete. Phase 3 remains unauthorized and must not start without explicit approval.

Do not commit, push, deploy, upload, sign, or publish without explicit authorization.
