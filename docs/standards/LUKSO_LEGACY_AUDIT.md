# INSCAPE legacy LUKSO standards audit

Initial audit: 2026-08-07  
Starterkit context: `395112e1e7be97344c0c3c3ac55fa9ba43db0517`

This is a living audit of the existing codebase. `PASS` means the inspected
boundary has explicit regression coverage; it is not a certification of every
possible LUKSO behavior.

## Verified boundaries

- `PASS` — Network-facing Library normalization uses canonical chain-aware asset
  IDs and retains field provenance.
- `PASS` — Direct fallback discovers contracts through LSP5, then verifies
  current LSP7 balances or LSP8 token IDs instead of treating receipt as current
  holding.
- `PASS` — LSP5 received and LSP12 issued counts are resolved independently.
- `PASS` — Creator-attributed works remain distinct from current holdings in the
  Library/Grid union and can be presented without inventing owner authority.
- `PASS` — LSP7 non-holding does not invent one alternate owner; LSP8 can expose
  a concrete indexed holder when supplied.
- `PASS` — Owner authoring authority remains separate from URL/profile identity
  and depends on current provider, supported chain, and verified permissions.
- `PASS` — Unprovenanced cached metadata cannot enter the owner NFT dossier.
- `PASS` — Creator collection drilldown uses Envio only for bounded token
  discovery and indexed holder facts. When indexed token media still equals the
  collection cover, current token metadata is resolved through direct LUKSO RPC
  in the official `getDataForTokenId` then `LSP8TokenMetadataBaseURI` order.
  Coverless collections may use the first discovered token's directly resolved
  image as a non-placeable token preview; it is never relabelled as a collection
  cover. Verified against the official LUKSO NFT metadata guide on 2026-08-07.

## Open review items

- `REVIEW` — Creations discovery currently uses indexed LSP4 `AssetCreators` and
  `TokenCreators`. This proves strong creator attribution, not automatically an
  LSP12-issued relationship. Audit LSP12-backed discovery before product copy or
  filtering uses `issued` or `released` as an authoritative category.
- `REVIEW` — `luksoRpcProfileRepository.js` retains manually copied LSP4/LSP5/LSP7/LSP8
  data keys and interface IDs. Compare and preferably replace these with official
  package constants in a separately scoped migration.
- `REVIEW` — Mainnet RPC, explorer roots, and chain ID literals exist in more than
  one production module. Centralize them without changing the canonical public
  document schema or CSP boundary.
- `REVIEW` — The live indexer GraphQL schema is an external availability and
  compatibility dependency. Keep its response normalization fail-closed and
  periodically verify it against official LUKSO standards.
- `REVIEW` — LSP8 concrete holder display currently depends on indexed holder
  data. Add direct RPC owner verification before describing that address as a
  security-sensitive source of authority.

## Old-checkout comparison

The read-only comparison against `../INSCAPE` on 2026-08-07 passed four of five
standards gates. It failed the metadata-provenance gate because creator records
in that checkout do not carry `fieldProvenance`. That explains why its strict
owner dossier can expose only Technical facts for creator-attributed work. The
active release branch contains the reviewed correction. The old checkout was
not modified or backported.

## Audit commands

```bash
npm run test:lukso-standards
INSCAPE_LUKSO_AUDIT_TARGET=../INSCAPE npm run test:lukso-standards
npm test
npm run build
npm run build:check
```

New findings belong here with an explicit status and affected boundary. Do not
silently “fix everything” during an unrelated feature.
