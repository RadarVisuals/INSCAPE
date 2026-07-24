# Phase 1 profile library

## Purpose

Phase 1 adds one useful path to INSCAPE: open Index, progressively load image assets held by a Universal Profile, search them locally, preview them, and organize stable asset references into persistent personal folders.

The integration is read-only. It does not connect a wallet, request a signature, submit a transaction, transfer an asset, or write organization data to a Universal Profile.

## Data flow

```text
Profile address
  -> Chillwhales LSP indexer (owned assets and owned tokens)
  -> LSP7 contract records / LSP8 identifiable token records
  -> normalized internal asset records
  -> Zustand library state
  -> Index search, views, grid, and preview

Indexer unavailable
  -> direct LUKSO RPC ownership verification
  -> LSP4 metadata resolution
  -> the same normalized internal asset records

Folder and favorite actions
  -> versioned workspace model
  -> profile-scoped localStorage record
```

UI components do not decode ERC725Y values or depend on GraphQL response shapes. The live and fixture repositories expose the same progressive batch interface. Search runs only over normalized records already in memory and therefore makes no request per keystroke.

## LUKSO data sources

The primary repository uses the public Chillwhales LSP Indexer GraphQL endpoint:

```text
https://indexer.chillwhales.dev/v1/graphql
```

The endpoint is isolated in `src/library/data/chillwhalesProfileRepository.js`. It exposes current contract ownership, individual LSP8 token ownership, and resolved LSP4 metadata. Collection-level ownership rows are not rendered when their individual owned tokens are available, avoiding duplicate collection wrappers in the Index.

The public service has no application-controlled availability guarantee. If it does not respond within eight seconds, `luksoRpcProfileRepository.js` verifies ownership directly through the profile's LSP5 received-assets array and LSP7/LSP8 contracts. Previously cached normalized records remain visible while either source refreshes. Records without a resolvable image are counted as incomplete rather than crashing the inventory.

References:

- Chillwhales LSP Indexer: https://github.com/chillwhales/lsp-indexer
- LUKSO mainnet parameters: https://docs.lukso.tech/networks/mainnet/parameters/
- LSP4 digital asset metadata: https://docs.lukso.tech/standards/tokens/LSP4-Digital-Asset-Metadata

## Profile configuration

The default prototype profile is declared once in `src/library/config.js`:

```text
0xf3C189819Fd5b042f692983bFbFD57ab607ee709
```

Use `?profile=0x...` to load another valid 20-byte profile address. Invalid overrides fall back to the prototype profile.

Optional Vite environment variables for the Index:

```text
VITE_CHILLWHALES_INDEXER_URL=https://indexer.chillwhales.dev/v1/graphql
VITE_LUKSO_RPC_URL=https://rpc.mainnet.lukso.network
VITE_IPFS_GATEWAY_URL=https://api.universalprofile.cloud/ipfs/
```

No secret is required. The default IPFS gateway is LUKSO's development gateway and should be replaced with an operated gateway before production-scale deployment.

## Normalized asset model

The stable normalized record contains:

```js
{
  id: '42:0xcontract:0xtoken-id-or-contract',
  chainId: 42,
  ownerAddress: '0x...',
  contractAddress: '0x...',
  tokenId: '0x...' | null,
  standard: 'LSP7' | 'LSP8' | 'unknown',
  name: 'Display name',
  description: '',
  collectionName: null,
  imageUrl: 'https://...' | null,
  thumbnailUrl: 'https://...' | null,
  originalImageUrl: 'ipfs://...' | 'https://...' | null,
  creators: [],
  attributes: [],
  metadataStatus: 'ready' | 'partial' | 'unavailable',
  rawMetadata: {}
}
```

Addresses and token IDs are lowercased in stable IDs. Array positions are never identifiers. URL resolution is centralized and accepts only HTTP, HTTPS, and IPFS input. Metadata-provided HTML is never rendered.

## Local workspace schema

The storage key is scoped to a normalized profile address:

```text
os-underneath.library-workspace.v1:0xf3c189...
```

The value is:

```js
{
  version: 1,
  profileAddress: '0x...',
  favorites: ['stable-asset-id'],
  folders: [{
    id: 'collision-safe-id',
    name: '1/1 Art',
    assetIds: ['stable-asset-id'],
    createdAt: 0,
    updatedAt: 0
  }]
}
```

Organization and stable references are persisted in the workspace record. A separate profile-scoped, expiring cache stores validated normalized asset metadata so an already visited Index and Gallery can render while fresh blockchain data is loading. Reads validate the version, profile, asset IDs, and URLs. Malformed JSON recovers safely. Unknown asset IDs remain harmless references and do not corrupt the live inventory.

## Fixture behavior

`public/fixtures/profile-library.v1.json` contains deterministic normalized records covering complete metadata, missing description, missing collection, searchable variants, and unavailable image metadata. Its local SVG images work without an external image host.

The status bar always labels the active source as `LIVE` or `FIXTURE`. Fixture mode is never presented as blockchain data and includes a Retry live data action.

## Known limitations

- The primary public Chillwhales endpoint has no INSCAPE-controlled SLA; direct RPC remains the slower fallback.
- The default IPFS gateway is intended for development and has no guaranteed SLA.
- Phase 1 handles images only. Non-image holdings contribute to progress/incomplete counts but are not shown as playable media.
- No virtualization is used. The stable responsive grid and lazy images are expected to be sufficient for the current 163-holding profile; incremental presentation can be added if measured rendering cost requires it.
- Folder prompts use restrained browser-native dialogs in this prototype.
- Organization is local to this browser and profile address.

## Deferred Phase 2 work

Dynamic folder launchers, canvas placement of folders, public/private publishing, decentralized manifests, wallet signing, on-profile organization writes, drag-and-drop between folders, video, audio/playlists, marketplace actions, transfers, and arbitrary iframe applications remain explicitly deferred.
