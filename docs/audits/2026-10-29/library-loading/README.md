# Library loading: first performance changes

Date: 2026-10-29. Local, uncommitted implementation on
`codex/static-reception-bento-2026-10-26`, based on
`5c5a00e8cff831f97987042be24d071c9aab2052`.

Requested profile: `0xf3C189819Fd5b042f692983bFbFD57ab607ee709`.
The accepted scope is the first performance pass after investigating large NFT inventories.

## Changes and ownership

- Collection repositories now emit normalized indexed pages before direct token
  metadata refresh. The store can show and select those records immediately.
  Metadata still refreshes all loaded tokens in bounded batches afterward.
- The Library indexer timeout now applies to the wait for each page. A healthy
  inventory taking more than eight seconds no longer triggers a full RPC scan.
  An eight-second stalled page still invokes the existing recovery path.
- RPC repair validates the exact requested canonical identities, groups them by
  contract and verifies current LSP8 ownership with `tokenOwnerOf`, or LSP7 holding
  with `balanceOf`. It no longer discovers LSP5 or enumerates all `tokenIdsOf`
  during targeted repair. Empty/invalid requests cannot expand to a full scan;
  failed ownership reads remain unknown. Full fallback discovery is retained.
- Collection metadata now uses the existing normalized Library refresh. The
  collection store replaces each refreshed record, preventing removed attachments
  or an old cover from being merged back in. Holder and creator facts remain on
  their original records. Request/profile cancellation suppresses late updates.
- Removed the superseded collection overlay and unused full-inventory priority
  sorting option (no production callers). Extracted the identical LSP pointer,
  stored-number and token-ID decoders used by both RPC paths into one module.

Repositories own reads and normalization, stores own inventory and request
lifecycles, and the existing Library presenter owns selection and image display.
This change does not introduce another cache or metadata authority.

## Measurements

The raw probes and logs are in
`output/library-loading-research-2026-10-29/` at the application root. Selected
evidence is copied beside this report.

| Workload | Before | After |
| --- | --- | --- |
| HALO collection, 1,328 indexed tokens: requests before first 24 records | 51 | 1 |
| Same first-page API call, single sequential run | 4,262 ms | 53 ms |
| Synthetic 1,000 records, 48/page, 400 ms/page | Stops at 912 and invokes RPC fallback | All 1,000 ready; no fallback |

The timing is one sequential run with warm upstream conditions, not a stable
latency promise or browser paint measurement. Both first pages contained 24 image
pointers; this does not establish that remote media was decoded. The first-page
probe intentionally closes the iterator after that page. It does not measure or
claim completion of the collection's background refresh.

The actual held-profile probe remained expensive: in a diagnostic run capped at
45 seconds, requests dropped from 193 to 169, but the run still ended with partial
metadata. The new run had 180 indexed candidates, 159 initial usable image
pointers and 164 usable records at the cutoff, with 16 unresolved. The earlier
run recovered seven missing records and the later one five; variable gateway
responses and the cutoff prevent treating these runs as equivalent completeness
measurements. No complete-load or end-to-end speed guarantee follows from them.

## Verification

- 207 unit tests passed across `src/library`, `src/creations` and
  `src/lattice/browser`, including all LSP8 ID formats, malformed input, exact
  repair ownership, healthy/stalled pagination, metadata replacement and aborts.
- LUKSO standards: 5 passed.
- Lint passed (88 pre-existing recorded hook dependency observations).
- Typechecks passed.
- Production build and `build:check` passed without changing the budget.
  Existing large-chunk advisory remains; initial JS is 831,095 raw bytes.
- 26 browser tests passed for loading, images and drag lifecycle, including 1,440 px and
  700 px viewports. The progressive fixture uses the actual repository, store,
  projection and presenter, with two indexed pages and a gated metadata resolver.
  It verifies cards and decoded artwork before metadata, retained selection,
  removal of stale image choices, and cancellation of late updates. Screenshots
  await image decoding, then browser paint, before capture.

Browser results and screenshots are included here. This is focused verification,
not a release checkpoint or a claim that the complete application test suite ran.

## Remaining work and state

The first visible inventory is no longer blocked by collection metadata. All
indexed pages are still requested automatically and metadata refresh still visits
the complete loaded inventory. Scroll-driven pagination, visible/selected-only
metadata work, virtualization and asynchronous persistent caching remain separate
follow-up work. Existing synchronous cache writes and large-list projection costs
are unchanged. Metadata gateway latency still matters for unresolved records.

Unrelated pre-existing edits in camera controls, workbench crop tests, design
tokens, the active contract, lint debt and production-build scripts were preserved.
No commit, push, deployment, upload, wallet prompt or transaction was performed.
At the start of implementation the remote HEAD had a successful Netlify preview
status, while Actions run 40775463649 was cancelled. Neither is validation of
these local changes.

Official references checked during research:

- [LUKSO indexer API](https://docs.lukso.tech/tools/apis/indexer-api/)
- [LSP8 contract reads](https://docs.lukso.tech/contracts/contracts/LSP8IdentifiableDigitalAsset/)
- [Reading NFT metadata](https://docs.lukso.tech/learn/digital-assets/nft/read-nft-metadata/)
