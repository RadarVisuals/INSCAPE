# Library: paged inventory and a chosen opening category

Local implementation, 29 October 2026. Continues the earlier
`../library-loading/README.md` research. The stopped WIP is retained separately
at commit `91893532e41d5a310554189eddf7f080e9bb9455`; its old green results do
not validate this implementation. No push or deployment is included.

## Behavior

- Owned and Created start with a requested page. Scrolling near the end or
  choosing Load more advances them. A paused iterator has no active deadline.
  Search, sorting and counts explicitly describe loaded results.
- The category context menu has a checked **Open Library here** action.
  The existing profile-local editor-preferences owner stores that choice.
  Reopening/reloading starts there with search/relationship filters cleared.
  Deleting the chosen category falls back to All. Without a chosen opening
  category, existing browsing preferences continue to apply.
- Categories resolve their known asset IDs in bounded groups, independently
  of full held/creator inventory. Already resolved references are retained for
  the current profile session; explicit category retry clears that resolution
  bookkeeping. It is not ownership authority or published data.
- Visible and selected LSP8 records drive metadata refresh, four at a time.
  Selection leads the next batch. Offscreen queued work is discarded;
  cancellation and a deadline discard late results, including an uncooperative
  provider. Failures retain indexed previews and offer retry. Token metadata
  replaces media groups but cannot change creator or holding relationships.
- Targeted missing-preview repair is explicit and bounded to 24 identities per
  attempt. Incomplete evidence cannot silently clear retained cached holdings.
- Creations now uses one page-consumption path for both its full independent
  view and demand-driven Library view. The unused fixture fallback and the
  obsolete full-collection scan for known references were removed. Production
  and reference reads use the existing targeted repository.

The interface retains the existing artwork, category, selection, placement and
preference owners. No schema migration, wallet action or new dependency.

## Test quality and evidence

The previous metadata-after-inventory assumptions had left unreachable waits.
Those tests now use explicit page/metadata requests. Checks of hook variable
names and source snippets were replaced by behavioral boundary checks and the
real-hook browser fixture. Architectural prohibitions elsewhere are retained.

The new 5,000-token fixture mounts the production owner hook, stores, Library
workspace and presenter. It checks initial page counts, bounded metadata work,
scrolling while metadata is blocked, selection through refresh, collection
opening/closing, persisted category opening with zero full-inventory queries,
and late-result rejection on profile switch. It runs at 1440 and 700 pixels.
This proves request bounds and transitions, not a mainnet latency guarantee or
the rendering cost of putting all 5,000 cards on screen simultaneously.

Existing meaningful checks cover failed RPC reads, cache retention, repair,
token-scoped provenance, attachments, drag cancellation and keyboard focus.
The image browser test now waits for the panel to mount after opening rather
than counting before its transition; its exact card and placement assertions
remain. The recovery test explicitly requires targeted repair not to restart
the full inventory.

Evidence is under `.verification/library-resume-*.log` in this checkout:

- Focused boundary/data tests: 225 passed; the subsequent metadata timeout
  regression also passes and is included in the final complete unit run.
- Browser suite batch: 33/34 passed; the remaining panel-mount race was fixed.
  The subsequent affected image/loading suites passed 3/3, including both
  viewport variants. Earlier direct-launch failures used a nonexistent Edge;
  verification uses `scripts/browserEnvironment.mjs` and installed Chromium.
- Lint, contract/type checks and five LUKSO baseline checks passed.
- Final full unit run: **1573/1573 passed**, no skipped/cancelled tests, 55 seconds
  (`library-resume-unit-complete.log`). Earlier failures remain in their logs.
- Final production build and build:check passed (`library-resume-build-accepted.log`
  and `library-resume-buildcheck-accepted.log`). Core JavaScript measures
  2,689,736 raw / 883,607 gzip bytes. The prior 2,687,000 / 883,000 limits failed
  by 2,736 / 607 bytes. The founder explicitly approved +3 kB raw / +1 kB gzip;
  the final limits are 2,690,000 / 884,000. Other limits and failure assertions
  remain intact. This is a documented allowance, not a reduction in bundle size.

A live read of `0xf3C189819Fd5b042f692983bFbFD57ab607ee709` returned 35
renderable records in the first combined indexer page, with more available.
A second query for three exact IDs returned exactly those three, no failures.
The query uses each requested contract/token pair rather than a complete scan.
The request totals are not the profile's definitive NFT balance.

Current official LSP8 context was checked at
https://docs.lukso.tech/standards/tokens/LSP8-Identifiable-Digital-Asset/:
token metadata and collection metadata retain separate scope. Holding and
creator evidence remain distinct throughout the existing normalization path.

## Remaining acceptance boundary

This work does not claim a complete 105-suite release verification, external
CI acceptance, or resolution of the earlier Windows inventory/cleanup issues.
The codebase-consolidation chat's final report remains independent evidence.
The accepted budget and local build checks now pass. Network timing on a real
5,000-NFT profile and rendering all 5,000 cards at once remain unmeasured.

Latest curated-category screenshots: [700 pixels](curated-700.png) and
[1440 pixels](curated-1440.png). The top-right buttons are fixture controls.

## Follow-up: individual category images

The founder reported that adding an expanded image filed its entire parent NFT.
Both context-menu and drag paths discarded the selected media and saved only
the source ID. The old image browser test explicitly expected that behavior.

Categories now retain optional `imageSelections` containing a source asset ID
and the exact selected image URL. Their source `assetIds` remain canonical and
continue to drive bounded reference loading. The existing workspace persistence
validates and saves the image selection, and the browser adapter carries it to
the existing ImageChoice renderer. Multiple chosen images from one source show
individually; removal preserves siblings. Whole-asset and invalid stored-image
states cannot silently substitute for a saved image selection. Profile-scoped
commands and source provenance remain unchanged.

The single-asset assignment delegates to the existing bulk assignment path.
Development review commands now reuse these domain operations rather than
maintaining a second membership implementation. This does not redesign Library
selection or create a new source asset identity.

Adding an image to a previous whole-asset category entry narrows it. Earlier
discarded image choices cannot be inferred; the user must select that image
again. Curated image URLs survive later parent-metadata changes. No migration,
publication, wallet operation or remote upload is performed.

Tests exercise production persistence and UI: save/reload, one NFT with two
chosen images, removal of only one, obsolete profile callbacks, invalid stored
media, exact network image requests, drag selection and parent-metadata refresh.
The fixture again runs at 1440 and 700 pixels. See `.verification/library-individual-images-*.log`.
Screenshots: [700 pixels](single-image-700.png), [1440 pixels](single-image-1440.png).

The initial follow-up build exceeded the prior budget by 2,332 raw / 314 gzip
bytes. The founder explicitly approved a further +3 kB raw / +1 kB gzip,
bringing the limits to 2,693,000 / 885,000. Other budgets are unchanged.

Final follow-up checks: **1576/1576 unit tests** and **29/29 browser cases**
passed, without skips or cancellations. Production build and build:check pass.
Lint and contract checks also pass. Logs ending in `unit-complete`,
`browser-final`, `build-complete` and `buildcheck-complete` record the final runs;
earlier failed logs remain available. No complete release/CI claim is made.
