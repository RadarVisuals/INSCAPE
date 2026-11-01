# Visitor mint interaction preview

Open `http://127.0.0.1:5173/prototypes/visitor-mint/` while `npm run dev` is running.
Connect a **demo profile**, choose Mint, and confirm the simulation. Preview
controls exercise free/paid, paused, sold out, unavailable reads, failed
transactions, changing prices and interrupted submissions. Reload after an
interruption, reconnect the same demo visitor, and Check mint status.

This is a local, interactive proposal for the first visitor workflow. It is not
a public mint integration, contract deployment, wallet connection or asset sale.
It is outside Vite's production entries and changes no draft/publication schema.
No dependencies were added. Price (2 LYX), edition size (25), and per-profile
limit (1) are illustrative choices awaiting product direction. A free example
still says the wallet must disclose any network fee.

The image is the founder-linked existing creature, displayed through an `img`
element with scripts disabled by the browser's image context. Its original token
is linked for provenance. No claim is made that the original token is mintable
or available for sale, or that a particular collection owner is the visitor.

## Responsibilities

- `main.jsx` presents the offer and owns the simulated confirmation dialog.
- `mintSession.js` binds asynchronous reads and requests to the demo buyer/sale.
  Its journal only retains recovery state; it cannot grant wallet authority.
- `simulation.js` owns demo availability and transaction results. Its ledger is
  the sole simulated outcome source; it makes no RPC or provider requests.
- Storage keys use `inscape:prototype:visitor-mint:`. Reset preview removes only
  this prefix. Existing INSCAPE records are not read or changed. Malformed
  recovery/ledger records remain intact and visibly block progress until reset.

This separates the experiment from the owner-only publication implementation.
No existing architecture was refactored. Demo recovery is not evidence that
real transaction recovery or wallet/controller authority has been validated.
The simulation deliberately lacks multi-tab coordination and real account,
chain, gas-estimation, replacement, finality and event verification.

## Live implementation prerequisite

The intended first release is visitors minting from a creator's supported
collection, with creator issuance tools later. Implement and test one explicit
sale contract/ABI; do not infer public minting from LSP8 interface support.

The linked collection (`0x611d3df50a3d930fba0a1f951e9d44bd9d3aea21`) was inspected
read-only on 2026-09-29: its proxy points to `LSP8MintableInit` at
`0xE0835D37b9b2Ed3719409B52499Af6411CEF49eB`. Its mint method requires
`MINTER_ROLE`; its token-metadata writes require collection ownership. These
are distinct permissions. A new sale adapter needs explicit authorisation and
a metadata strategy, such as creator-prepared unused token IDs, or a purpose
built collection. Its current roles and implementation must be rechecked before
integration. Never reuse token #4 for a new edition or grant every buyer the
collection's mint role. Holder-editable character configuration is separate work.

Before live integration, settle edition supply, price, per-profile policy,
recipient/treasury and metadata behavior; enforce them in the contract with
reentrancy and LSP1 receiver-hook tests. Then bind the visitor's existing wallet
session, simulate the exact call, journal before submission, and verify matching
sale/collection/buyer/token events on the supported chain. Account/chain changes,
reload, cancellation, replacement and unavailable receipts need real provider
tests. Contract deployment, authorisation and real minting remain separate
explicit actions. No Solidity implementation has been added by this preview.

Official references checked 2026-09-29:
[LSP8 and receiver hooks](https://docs.lukso.tech/standards/tokens/LSP8-Identifiable-Digital-Asset/),
[UP contract interactions](https://docs.lukso.tech/learn/universal-profile/interactions/interact-with-contracts/).
Verified implementation source:
[LUKSO explorer](https://explorer.execution.mainnet.lukso.network/address/0xE0835D37b9b2Ed3719409B52499Af6411CEF49eB?tab=contract).

## Checks

`node --test prototypes/visitor-mint/mintSession.test.js`

`node --test browser-tests/visitor-mint.browser.mjs` (local Vite required).
Set `INSCAPE_MINT_ROOT` to override the origin. Screenshots are written to
`.browser-test-runtime/visitor-mint-*.png`.
