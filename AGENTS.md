# INSCAPE project instructions

## Sole product authority

- Read `docs/INSCAPE_ACTIVE_CONTRACT.md` before substantial work.
- Do not use deleted documents, Git history, archived handoffs, phase plans,
  roadmaps, art-direction notes, or the protected untracked continuation handoff
  as current product direction unless the user explicitly asks for them.
- The current code and tests describe implemented behavior. The active contract
  describes accepted direction. Do not silently confuse the two.
- Preserve user-owned and unrelated changes. Never add, edit, delete, or treat
  `docs/INSCAPE_ALPHA_CONTINUATION_HANDOFF.md` as authority.

## Retained operational references

- `docs/NETLIFY_PUBLIC_IPFS_PUBLICATION.md` is only the deployment/publication
  operations reference.
- `docs/INSCAPE_ALPHA_TESTER_SUPPORT.md` is only the supervised-Alpha support
  and privacy reference.
- Before LUKSO-facing work, read
  `docs/standards/LUKSO_ENGINEERING_BASELINE.md` and verify time-sensitive facts
  against current official sources.

## LUKSO and publication invariants

- Source priority is `lukso.network`, `docs.lukso.tech`, then official
  `github.com/lukso-network` repositories.
- Never treat creator attribution, LSP12 issuance, LSP5 receipt, current LSP7
  holding, current LSP8 holding, contract ownership, and Universal Profile
  controller authority as interchangeable relationships.
- Unknown or stale facts remain unknown. Retain source and scope.
- Never expose secrets to browser code. Never perform an upload, deployment,
  wallet prompt, signature, or transaction without explicit user authority.
- Do not use forced dependency fixes, unsupported overrides, or downgrades to
  hide inherited advisories.

## Visual implementation discipline

- Read the visual-language section in `docs/INSCAPE_ACTIVE_CONTRACT.md` before
  UI or CSS work. Inspect the active component, its CSS, sibling production
  surfaces, and the user's screenshots before proposing a visual change.
- Reuse established tokens, line weights, selector grammar, spacing, and
  responsive patterns. Use Inscape Sora for human interface copy and Inscape
  IBM Plex Sans Condensed for technical and dense secondary copy. Do not invent
  an adjacent design system or approve another interface font.
- Never substitute generic rounded cards, pills, gradients, glass effects,
  oversized spacing, arbitrary shadows, or decorative grids for INSCAPE's flat,
  bounded, structural language.
- Visual grids must control alignment or interaction; they are not decoration.
- Preserve owner, Visitor, Discover, and public-presentation parity where they
  share a component. Do not solve one mode with an unrelated visual variant.
- Validate visual work at representative wide and narrow viewports. Inspect
  screenshots for alignment, clipping, overflow, scroll containment, focus,
  active selectors, and exact boundary behavior before calling it complete.
- When the intended visual hierarchy is ambiguous, present a mock or concrete
  alternatives and obtain direction before implementing a broad redesign.

## Verification

- Run focused tests for every changed boundary.
- Run `npm run test:lukso-standards` after LUKSO-facing changes.
- Run `npm run build` and `npm run build:check` for production-boundary changes.
- Before a release checkpoint, run the complete `npm test` suite.

