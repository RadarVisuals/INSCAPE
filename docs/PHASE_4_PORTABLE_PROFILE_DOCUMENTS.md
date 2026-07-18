# Phase 4 portable profile documents

## Purpose

Phase 4 turns the locally authored public canvas into a portable, versioned presentation document. The owner can build an immutable snapshot, preview it through an isolated visitor renderer, export JSON, validate an imported document, preview that import without changing the draft, and explicitly restore supported presentation fields.

This phase is local and read-only with respect to LUKSO. It does not connect a wallet, sign, upload to IPFS, call Pinata, write ERC725Y data, or claim that a snapshot is published.

## Feature boundary and public API

`src/profileDocument` owns the feature:

- `domain/` contains the builder, canonical asset identity, validation, migration, serialization, visitor projection, stale detection, and pure restore planning.
- `state/` owns snapshot, imported-document, and preview isolation state.
- `storage/` optionally stores the last valid snapshot and restored Keeper/stage selection in separate profile-scoped records.
- `components/` contains the Share panel and immutable visitor renderer.
- `index.js` exports the small framework-neutral API.

The builder receives projections from existing owners. It does not read localStorage, issue requests, import React/Pixi, or replace the library, Signals, rendering, or identity stores.

## Draft, snapshot, and imported preview

- **Draft** is the editable local library workspace plus the current Keeper/stage and visitor-facing Signals preferences.
- **Snapshot** is a detached v1 public document built from an allowlisted projection. Rebuilding increments its revision and never freezes or overwrites the draft.
- **Imported document** is untrusted external JSON held separately after complete validation.
- **Visitor preview** receives a detached snapshot/import projection. It never becomes the draft. Exiting drops the preview and reveals the unchanged authoring state.

A content fingerprint excludes revision and timestamps and is computed from the public projection. Public-to-private and private-to-public transitions report **DRAFT CHANGED**. Label, placement, or membership edits inside a space that remains private do not change the public fingerprint. Making it public projects its current contents; making it private removes it completely on rebuild.

## Pinned for me versus shown to visitors

Canvas Space pinning and visitor visibility are independent authoring decisions. A v3 workspace launcher owns `visitorVisible` alongside its stable launcher identity and placement. A launcher with `visitorVisible: false` remains pinned, positioned, searchable, draggable in Edit mode, and fully usable on the owner's homescreen. It is not part of the visitor presentation.

Existing v2 pinned launchers migrate to `visitorVisible: true` so an upgrade does not silently empty an established public composition. New pins, including Favorites, always start with `visitorVisible: false`; public inclusion must be intentional. Unpinning removes the presentation record and therefore makes the view non-public. Repinning starts private again. The Edit-only **SHOW TO VISITORS ON/OFF** control changes only this boolean. It never changes membership, Favorites, labels, placement, Signals, or other state.

Workspace normalization accepts v1, v2, and v3, emits only v3, reconstructs canonical launcher IDs, and treats a malformed or non-boolean v3 visibility value as private. Migration is deterministic, idempotent, profile-scoped, and preserves folder IDs/names/timestamps/membership, Favorites, pins, order, and launcher/window placement.

## Version 1 schema

Document versions are independent from library workspace, Signals storage, and render-configuration versions.

```json
{
  "documentType": "OS_UNDERNEATH_PROFILE",
  "version": 1,
  "documentId": "profile:0xf3c189819fd5b042f692983bfbfd57ab607ee709",
  "revision": 1,
  "createdAt": "2026-07-18T00:00:00.000Z",
  "exportedAt": "2026-07-18T00:00:00.000Z",
  "network": { "name": "lukso-mainnet", "chainId": 42 },
  "profile": {
    "address": "0xf3c189819fd5b042f692983bfbfd57ab607ee709",
    "cachedIdentity": {
      "address": "0xf3c189819fd5b042f692983bfbfd57ab607ee709",
      "name": "optional bounded fallback",
      "avatarUrl": "optional https/http/ipfs fallback"
    }
  },
  "presentation": {
    "keeperId": "abyssal_eye",
    "stageId": "moonpurple",
    "systemModules": [
      { "id": "identity", "visible": true, "placement": null },
      { "id": "signals", "visible": true, "placement": null }
    ],
    "signals": {
      "notifications": true,
      "speech": true,
      "visualEffects": true,
      "audio": false
    }
  },
  "spaces": [{
    "id": "library:folder:stable-folder-id",
    "launcherId": "library:folder:stable-folder-id",
    "kind": "folder",
    "label": "Exhibition",
    "order": 0,
    "placement": { "column": 2, "row": 3 },
    "windowPlacement": null,
    "assets": [{
      "stableAssetId": "42:0x1111111111111111111111111111111111111111:0x01",
      "network": "lukso-mainnet",
      "chainId": 42,
      "tokenStandard": "LSP8",
      "contractAddress": "0x1111111111111111111111111111111111111111",
      "tokenId": "0x01",
      "cachedName": "optional fallback",
      "cachedPreviewUrl": "ipfs://optional-fallback"
    }]
  }],
  "metadata": {}
}
```

All object shapes are closed in v1: unknown keys are rejected. `metadata` is a future-safe extension point but must remain an empty object until a later schema version defines fields.

## Ownership and public/private boundary

| Field | Source owner | Exported projection |
| --- | --- | --- |
| Profile address | library profile configuration | canonical normalized address |
| Cached name/avatar | shared Phase 3.1 identity resolver | small optional fallback only |
| Keeper/stage | canonical rendering state | known public IDs only |
| Signals preferences | Signals store | four visitor-facing booleans |
| Canvas Spaces | library workspace v3 launcher records | pinned launchers with `visitorVisible: true` only |
| Membership | library workspace v3 folders/Favorites | stable references from visitor-visible spaces only |
| Asset fallback | normalized in-memory assets | bounded name and safe preview URL only |
| Built-in placement | public module layout owner | supported public module placement only |

The builder explicitly constructs every output field. It includes only launchers that are both pinned and visitor-visible. Private pinned spaces are omitted completely: no record, flag, ID, label, placement, membership, cached metadata, or count reveals their existence. It also excludes unpinned folders, unpinned Favorites, Collection search/pagination, inventory records and raw metadata, Signals history/known IDs/read state/reaction queues/speech, fixture state, identity caches, localStorage keys, active drag/loading/error/window state, editor controls, wallet/session data, credentials, presets, and unrelated Atelier state. One canonical asset may appear in multiple public spaces; each public membership is preserved.

## Canonical asset references

Canonical identity is `chainId:normalized-contract:normalized-token-or-contract`. Addresses and hexadecimal token IDs are lowercase. LSP8 requires a token ID; LSP7 requires `null`. Cached names and URLs are presentation fallbacks and never identity. Full LSP4 payloads, binaries, base64 data, repository records, pagination IDs, and array positions are forbidden.

The visitor first matches the reference against currently normalized Collection assets. If found, current metadata replaces cached fallback fields. Otherwise the card remains in the space with an intentional unavailable state. A failed lookup never removes the reference or collapses the space. Ownership and metadata availability are not distinguished unless a repository can establish that difference reliably.

## Public identity fallback

The Universal Profile address is authoritative. The document may cache only address, bounded display name, and safe avatar URL. Preview renders immediately from that fallback and calls the existing Phase 3.1 `useProfileIdentity` boundary. A live LSP3 result progressively replaces fallback presentation. Failure leaves the cached/address fallback intact and never blocks the canvas. Complete LSP3 metadata and identity-cache state are not exported or persisted by this feature.

## Validation and defensive limits

Imported JSON is measured before parsing and treated as untrusted. Validation checks document type/version, closed shapes, required fields, normalized profile/contract addresses, LUKSO mainnet, known Keeper/stage/module IDs, unique space/launcher/module IDs, canonical token identity, per-space duplicate references, bounded labels/names, safe URL schemes, integer placements, timestamps, revisions, nesting, arrays, and total size.

Limits are 512 KiB JSON, depth 10, 24 spaces, 200 assets per space, 1,000 total references, 80-character labels/names, 200-character IDs, and 2,048-character URLs. Placement columns are 0–63 and rows 0–127. Only HTTP, HTTPS, and IPFS cached URLs are accepted. IDs use a non-executable alphanumeric/colon/underscore/hyphen grammar. Strings are rendered by React as text; documents cannot select components, inject HTML/CSS/JavaScript, define filesystem paths, RPC endpoints, or application configuration.

Failure produces diagnostics and no draft mutation. Unsupported future versions and unrelated document types are rejected explicitly.

## Serialization and migration

Formatted export and canonical serialization both validate immediately. Canonical serialization recursively sorts object keys, removes no meaningful array ordering, contains no `undefined`/functions/framework values, and preserves space/asset order because it is presentational. Equivalent documents yield identical canonical JSON. The content fingerprint omits revision and timestamps for stale comparison; the complete canonical document is the future hashing input.

`migrateProfileDocument(input)` detects type and version and validates v1. No v2 is invented and ambiguous values are never guessed. A future migration can add a pure `v1 -> v2` step before validating the new closed schema.

## Share, export, and import flow

The existing **SHARE** HUD command opens a bounded module. **BUILD/REBUILD SNAPSHOT** constructs and validates a local snapshot and optionally stores it separately. Its summary reports **Public spaces** and **Public asset references**, never total pinned counts or private names. **PREVIEW PROFILE** enters the isolated visitor renderer and therefore shows only spaces already present in the document. Exiting restores the owner's unchanged homescreen, including private pinned launchers. **EXPORT PROFILE** revalidates, formats canonical field order, and downloads `os-underneath-<name>-profile-v1.json`. No export action changes the draft or says “published.”

Import accepts a local JSON file, bounds size, parses once, and validates completely. The panel reports valid/invalid status, type/version summary, profile identity/address, space/asset counts, and a different-profile warning. File selection never mutates authoring state. **PREVIEW IMPORT** renders the detached document. **RESTORE PRESENTATION** is a separate confirmed action.

## Atomic restore

`createProfileDocumentRestorePlan` validates first and creates a detached plan. Every imported document space is restored pinned and visitor-visible. Existing private pinned launchers remain pinned and private, including their placement and membership. Existing public folders with the same identity are intentionally updated. A collision with an unpinned or private folder receives a deterministic numeric suffix so private data is never overwritten. If an imported Favorites space collides with private pinned Favorites, its public references are restored as a deterministic custom folder rather than changing the private launcher's visibility. Imported documents cannot infer or recreate private spaces because that information was never exported.

The UI persists through the existing workspace and Signals owners and a small profile-scoped Keeper/stage record, then applies state. If any write/application fails it restores the previous workspace, Signals settings, Keeper/stage, and local record. It never clears unpinned folders, unrelated memberships, Signals history/known IDs, identity caches, preferences outside the four public settings, presets, Atelier state, or Reset Layout ownership.

Reset Layout clears only launcher/window coordinates. It preserves pinned state, `visitorVisible`, membership, Favorites, classification, Signals, and the immutable last snapshot. A public placement change can make the draft differ from that snapshot, but Reset Layout never rewrites the snapshot itself.

## Local snapshot storage

The optional key is `os-underneath.profile-snapshot.v1:<normalized-profile>`. It is separate from mutable authoring records, profile-scoped, size-bounded, and validated on read. Corruption returns `null`; deleting it cannot affect the draft. Restored Keeper/stage selection uses `os-underneath.restored-presentation.v1:<normalized-profile>` because those choices previously had no profile-scoped persistence owner.

## Security considerations and limitations

- Documents are public presentations, not backups and not authorization artifacts.
- A portable document is specifically not a private workspace backup; private pinned spaces cannot be recovered from it.
- Import does not prove profile ownership or document authorship.
- Cached remote URLs remain external resources; unsafe schemes are rejected.
- Current metadata resolution depends on existing public repositories and gateways.
- Images are the only specialized asset renderer in this phase.
- Preview uses the current canvas and temporary immutable presentation override; it does not duplicate the document into subsystem stores.
- Cross-key browser storage has no native transaction primitive. The restore path precomputes all values, writes bounded validated records, and performs explicit rollback on failure.

## Phase 5 extension points

Phase 5 can take canonical serialization as the byte input for content hashing, upload the exact document through a protected Pinata/IPFS integration, encode immutable CID plus hash as an LSP2 VerifiableURI, and write that URI to a dedicated custom ERC725Y singleton key. The conceptual key should mean “OS_UNDERNEATH public profile document,” be resolved by Universal Profile address, and never overwrite `LSP3Profile`. Key derivation and on-chain registration are deliberately not finalized or written in Phase 4.
