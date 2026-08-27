# INSCAPE project instructions

## Required project context

- Read `docs/TRAVEL_INSTRUCTIONS.md`, `docs/INSCAPE_CURRENT_HANDOFF.md`, and
  `docs/INSCAPE_PRE_ALPHA_RELEASE_HARDENING_PLAN.md` before substantial work.
- Preserve the accepted phase boundaries, publication gates, wallet authority,
  privacy rules, and user-owned changes described there.
- Use the commands and verification level required by those documents. For any
  LUKSO-facing behavior, also run `npm run test:lukso-standards`.

## LUKSO standards baseline

- Before changing LUKSO integration, metadata, identity, asset, wallet,
  publication, or public-facing LUKSO copy, read
  `docs/standards/LUKSO_ENGINEERING_BASELINE.md` and the relevant official spec.
- Source priority is: `lukso.network`, `docs.lukso.tech`, then official
  `github.com/lukso-network` repositories. The vendored starterkit baseline is
  context and a checklist, never authority over a newer official source.
- Never treat LSP4 creator attribution, LSP12 issuance, LSP5 receipt, current
  LSP7 balance, current LSP8 token holding, contract ownership, and Universal
  Profile controller authority as interchangeable relationships.
- Normalized facts must retain source and scope. Unknown or stale facts stay
  unknown; do not infer or invent them for UI completeness.
- Use official package schemas, constants, interfaces, and data keys where
  practical. Any retained literal must be covered by a focused test and traced
  to an official source.
- Verify time-sensitive facts live before changing code or copy. Record the
  official source and retrieval date in the relevant plan, handoff, or audit.
- New LUKSO behavior needs focused tests for success, unavailable/malformed
  data, wrong profile or chain, stale async results, and relationship confusion.

## Existing-code audit

- Treat `docs/standards/LUKSO_LEGACY_AUDIT.md` as the reviewed baseline, not a
  claim that all legacy code is conformant.
- Do not silently expand a feature fix into a broad standards migration. Record
  newly discovered legacy issues in that audit and fix them through an explicit
  scoped change.
- Run `npm run test:lukso-standards` after changing any audited boundary.

