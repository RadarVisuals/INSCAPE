# Library token media overwritten by indexer discovery

Date: 2026-10-30. Local working-tree change on
`codex/profile-work-index-2026-10-30`, based on
`d181c5496dcb53786cf9f2d10038e1e7e7eda3e2`. Not committed, pushed or deployed.
Unrelated design-lab work in this shared checkout was preserved.

## Observed failure

The reported asset is LUKSO mainnet contract
`0x611d3df50a3d930fba0a1f951e9d44bd9d3aea21`, bytes32 token ID ending in `0001`.
It is held by profile `0x001048331cd14cef40dd5da644a738e7324fe691`.
The indexer returned this holding, but supplied only one image group: the
`images-10-female%202%20pale.svg` attachment. A direct token metadata read returned
12 image groups, including the Resident Zero cover.

The inventory merge accepted a late indexer record wholesale. It could replace
the direct token media after a metadata refresh, or when Library reopened.
A gated store reproduction changed a resolved cover and 12 groups back to the
indexer's single attachment. Both initial regression cases failed before the fix.

## Change and boundary

`libraryInventoryActions` now retains media with explicit direct token RPC
provenance when merging indexer discovery or targeted category-reference results.
`libraryMetadataDemand` owns this narrow merge rule alongside the existing
metadata merge. The replaced operation was unconditional record replacement
at these two indexer ingress points; no alternate inventory or new cache exists.

Only image fields and their provenance survive the indexer merge. Incoming
inventory membership, holding evidence and other indexed fields remain current.
Later direct reads can replace media, including a confirmed empty image list.
The existing metadata refresh and cache lifecycle are otherwise unchanged.
This is a response-order fix, not a wider Library architecture cleanup.

## Verification

- 33 focused tests passed across `useLibraryStore.loading.test.js`,
  `libraryMetadataDemand.test.js` and `refreshLibraryTokenMetadata.test.js`.
  New cases cover direct metadata before refresh, during pending inventory,
  and during a pending category-reference request; they also check current
  indexer fields, cached media and subsequent direct removal of images.
- 30 related tests passed across LUKSO standards, metadata images, content URL
  resolution, the profile indexer repository and Library asset union.
  `npm run test:lukso-standards` also passed explicitly.
- `npm run lint` passed with the existing recorded hook observations.
- `npm run build -- --outDir output/library-metadata-build` and
  `npm run build:check -- output/library-metadata-build` passed.
  Separate build output avoided the other active task's output.
- The isolated browser fixture passed with a delayed indexer response after
  direct metadata, switching to Owned, and closing/reopening Library. Store
  image URLs and rendered image URLs remained current. Three lifecycles stayed
  within the 24 loaded token IDs. Probe and results are under
  `output/library-metadata-probe.mjs` and `output/library-metadata-browser.log`.
- In the user's original local tab, all seven token cover images loaded; token
  1 retained its 12 images after Owned / All Assets navigation. Screenshot:
  `output/library-live-after.png`.

## Limits

The separate reports of "Artwork unavailable" were not reproduced during the
final check. Three sampled media URLs returned HTTP 200, but that does not prove
all media hosts, formats or retry paths are reliable. This fix does not establish
that every intermittent missing-media report has the same cause.

Hosted CI was not used as proof of this local change: the queried commit had no
returned check status or workflow runs. No release checkpoint or deployment was
performed. Browser startup initially stalled; the completed fixture run used an
isolated Vite configuration and installed Chrome. The user tab was left open;
its earlier view-only state had cleared before final inspection.
