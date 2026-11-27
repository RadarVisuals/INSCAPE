# INSCAPE LUKSO engineering baseline

Status: required engineering context for all LUKSO-facing work.

## Provenance and authority

This baseline adapts the MIT-licensed
[`LUKSO-LLM-Coding-Starterkit`](https://github.com/lukso-network/LUKSO-LLM-Coding-Starterkit)
at commit `395112e1e7be97344c0c3c3ac55fa9ba43db0517`, retrieved 2026-08-07.
The upstream repository describes itself as portable AI context and explicitly
says it is not a source of truth.

Resolve conflicts in this order:

1. `https://lukso.network`
2. `https://docs.lukso.tech`
3. Official `https://github.com/lukso-network` repositories, especially
   `LIPs`, `lsp-smart-contracts`, `docs`, and `network-configs`
4. Other official LUKSO channels
5. Direct ecosystem-project sources
6. Third-party sources only as background

Verify volatile facts live. Do not rely on this snapshot for current RPCs,
contract addresses, product availability, migration status, counts, prices,
grants, relayer policy, or the status of a draft LSP.

## Relationship model

INSCAPE must preserve these as independent facts:

| Fact | Appropriate evidence | What it does not prove |
| --- | --- | --- |
| Profile metadata | LSP3 metadata tied to a UP | controller authority or current asset holding |
| Creator attribution | LSP4 creator metadata with token/contract scope | issuance, current holding, or contract ownership |
| Issued asset | LSP12 Issued Assets entry plus any required direct verification | current holding or sole creative authorship |
| Received asset | LSP5 Received Assets discovery followed by a current contract check | a positive current balance by itself |
| Current LSP7 holding | positive `balanceOf(profile)` | sole ownership; LSP7 can have multiple holders |
| Current LSP8 holding | token returned by `tokenIdsOf(profile)` or an equivalent authoritative owner read | creator or issuer status |
| Contract ownership | the relevant contract ownership interface/state | token holding or UP controller permission |
| UP authoring authority | active supported chain, current provider state, and verified controller permissions | identity merely matching a URL or cached profile |

Product language must follow the proven relationship. Use `creator-attributed`
for LSP4 evidence, `issued` only for LSP12/direct issuance evidence, and `held`
or `currently held` for verified current LSP7/LSP8 state. Avoid the ambiguous
word `owned` where an LSP7 balance or contract ownership could be confused.

## Relevant standards

- LSP0: Universal Profile / ERC725 account foundation.
- LSP1: Universal Receiver notifications.
- LSP2: ERC725Y JSON schema and data-key encoding.
- LSP3: Universal Profile metadata.
- LSP4: LSP7/LSP8 digital-asset metadata.
- LSP5: received-assets registry; discovery requires a current holding check.
- LSP6: Key Manager permissions and controller authority.
- LSP7: digital asset with balances and potentially multiple holders.
- LSP8: identifiable digital asset with token IDs and token-level metadata.
- LSP12: assets issued by a profile.
- LSP25: relay execution; it does not mean every transaction is free.
- LSP26: follower system.
- LSP28: Grid-related work requires live spec-status verification.

This list is a routing aid. Read the official spec before implementing or
changing the corresponding behavior.

## Implementation rules

- Prefer `@erc725/erc725.js`, `@lukso/lsp-smart-contracts`, `@lukso/lsp-utils`,
  `@lukso/up-provider`, official schemas, and official chain configuration over
  copied constants.
- Centralize network identity, RPC endpoints, explorer roots, interface IDs,
  data keys, and schema imports. Do not add a second literal when a project
  constant already exists.
- Retain token-versus-contract scope and source provenance through normalization,
  caching, union projection, publication, and rendering.
- Treat indexers and gateways as fallible read providers. Bound requests, reject
  malformed or cross-profile results, and preserve an honest unavailable state.
- Direct RPC verification must be generation-safe and chain-scoped. Cached or
  indexer data cannot grant authoring authority.
- Public documents may contain validated publication facts, but must not imply
  that a publication-time holding snapshot is live ownership.
- Do not publish private provider data, wallet details, query strings, internal
  errors, or unbounded raw metadata.

## Required verification

For a LUKSO-facing change:

1. Identify the affected relationship and LSPs.
2. Check the relevant official docs/spec/package constants.
3. Add or update focused normalization and boundary tests.
4. Run `npm run test:lukso-standards`.
5. Run the broader tests/build required by the active hardening plan.
6. Record any unresolved legacy mismatch in `LUKSO_LEGACY_AUDIT.md`.

## Refresh procedure

At the start of a new release phase, or at least monthly while integration work
is active:

1. Review the starterkit's latest commit and diff from the pinned commit above.
2. Verify affected claims against the higher-priority live official sources.
3. Update this curated file; do not replace `AGENTS.md` or install the upstream
   global orchestration baseline automatically.
4. Update the pinned commit and retrieval date.
5. Run the standards audit and normal regression suite.

