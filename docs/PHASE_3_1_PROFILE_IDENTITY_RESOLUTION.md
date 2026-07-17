# Phase 3.1 Universal Profile identity resolution

## Purpose

Phase 3.1 progressively replaces anonymous Keeper Signal counterparties with public Universal Profile display metadata. Signal history still renders immediately and remains useful offline. This is a read-only public-data feature: it does not connect a wallet, sign, transact, or write profile data.

The address is canonical identity. A name, description, avatar, and Universal Profile classification are mutable presentation metadata. They are never inserted into persisted `KeeperSignal` records and never participate in signal IDs, ordering, deduplication, or replay decisions.

## Shared feature boundary

`src/profileIdentity` owns framework-neutral identity normalization, the live and fixture repositories, request caches, and the focused `useProfileIdentity(address, { sourceMode })` hook. Signals components consume that API and do not fetch LSP3 data themselves.

The normalized record is deliberately small:

```js
{
  address,
  normalizedAddress,
  name,
  avatarUrl,
  description,
  isUniversalProfile,
  status,       // IDLE, LOADING, RESOLVED, UNAVAILABLE, ERROR
  source,       // LIVE or FIXTURE
  errorCode
}
```

Addresses are validated and lowercased for comparison. Names and avatars are optional. A Universal Profile with valid metadata but no name is still resolved; UI falls back to its abbreviated address. EOAs, non-profile contracts, and profiles without LSP3 metadata are normal `UNAVAILABLE` results rather than rendering failures.

## LSP3 resolution flow

The live repository uses the configured LUKSO mainnet RPC (`VITE_LUKSO_RPC_URL`, default `https://rpc.mainnet.lukso.network`) and the existing `@erc725/erc725.js` dependency:

1. Validate and normalize the counterparty address.
2. Read contract code so EOAs become an immediate unavailable result.
3. Call ERC165 `supportsInterface` for `LSP0ERC725Account`.
4. Read the `LSP3Profile` ERC725Y key from the official LSP3 schema.
5. Use `ERC725.fetchData('LSP3Profile')` to decode its VerifiableURI, retrieve the referenced JSON, and compare supported content hashes with the on-chain hash.
6. Normalize bounded plain-text fields, choose a compact profile image, and resolve IPFS through the same `resolveContentUrl` utility used by Collection.

The repository distinguishes missing/non-profile metadata from RPC, content, or verification failure. Abort signals are checked before and after asynchronous ERC725 operations, while the React subscription boundary prevents results for a previous address from updating the new address.

## Cache and request control

LIVE and FIXTURE use separate in-memory `ProfileIdentityCache` instances so deterministic fixture identities can never leak into live rows. Within each source, the normalized address is the only cache key.

- Simultaneous requests for one address share one promise.
- At most four repository resolutions run concurrently.
- Resolved identities remain fresh for 30 minutes.
- Unavailable and failed identities remain for one minute, then retry.
- The cache is memory-only and stores normalized records, never full LSP3 documents.
- History synchronization primes unique counterparties without awaiting them, so activity rendering and Keeper reactions are never blocked by identity I/O.

Cache errors degrade to address fallbacks. Switching activity source selects the matching cache and does not clear, overwrite, or cross-populate the other source.

## Signals presentation

Each row reserves a fixed 28-pixel avatar slot to avoid layout movement. Resolution enhances the row in place:

- the LSP3 name becomes the primary label when present;
- the abbreviated canonical address remains secondary;
- the full address remains in accessible text, the title detail, and a dedicated copy button;
- an available compact avatar uses lazy loading, preserved aspect ratio, no referrer, and an on-error fallback;
- long names are constrained and ellipsized;
- missing or failed identities retain the abbreviated-address label.

Resolved Universal Profiles with names link to `https://universaleverything.io/<canonical-address>`. The link is generated from the address, never the mutable name, opens outside the row with `noopener noreferrer`, and is not applied to EOAs or unclassified contracts.

## Keeper speech

Signal messages accept display identity as a separate argument. Synchronization starts identity resolution in the background. When a queued reaction reaches the front, it receives one bounded 450 ms opportunity for an in-flight identity request, then the store takes a one-time identity snapshot. The visible speech remains atomic for its entire display.

This uses the existing queue/cooldown window and adds at most a brief bounded handoff. If resolution is not ready by the deadline, speech uses the abbreviated address. A later result updates Signal rows but cannot modify visible speech, mutate history, enqueue work, or replay a handled signal.

## Fixtures

Fixture activity explicitly covers a named profile with avatar, a named profile without avatar, missing LSP3 data, an EOA, malformed metadata, a metadata failure, a repeated counterparty, and a long hostile-looking name. Fixture images are trusted root-relative project assets; remote live metadata remains restricted to HTTP, HTTPS, and IPFS by the shared content URL policy.

## Security and privacy

- Remote strings are rendered through React as text, with control characters normalized and names/descriptions bounded to 80/280 characters.
- HTML, CSS, JSX, and fetched framework objects are never stored or rendered from metadata.
- Avatar protocols are limited by the existing content URL resolver; scriptable and malformed URLs are rejected.
- ERC725 VerifiableURI content verification is used when the reference supplies a supported hash.
- No RPC or gateway secret is embedded. Configuration is public Vite configuration.
- There is no wallet access, signing, transaction, blockchain write, arbitrary proxy, or persistent identity database.

## Known limitations

- Identity availability depends on the public LUKSO RPC and referenced metadata host/IPFS gateway.
- ERC725 network work cannot always be physically cancelled after the dependency has issued its request; abort and generation/subscription checks discard stale presentation results.
- Cache state is intentionally lost on refresh.
- Universal Everything availability and URL behavior are external to this application.
- Keeper speech waits at most 450 ms for an already-started identity request and never guarantees that a name will be available.

## Phase 4 integration points

The shared hook and framework-neutral cache can enrich manifest authors, document attribution, folder collaborators, or other public identity surfaces without changing canonical record models. Phase 4 can inject the same normalized display context into document import/export views while keeping addresses authoritative and identity metadata out of stable document identity.
