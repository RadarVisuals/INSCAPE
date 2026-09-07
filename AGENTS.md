# INSCAPE project instructions

## Sole product authority

- Read `docs/INSCAPE_ACTIVE_CONTRACT.md` before substantial work.
- Then read `docs/INSCAPE_CREATIVE_INTENT.md` before substantial product,
  architecture, UI, composition, asset-model, metadata, or module work. It is
  required product-meaning context, not independent implementation authority.
- Do not use deleted documents, Git history, archived handoffs, phase plans,
  roadmaps, art-direction notes, or the protected untracked continuation handoff
  as current product direction unless the user explicitly asks for them.
- The current code and tests describe implemented behavior. The active contract
  describes accepted direction. Do not silently confuse the two.
- Preserve user-owned and unrelated changes. Never add, edit, delete, or treat
  `docs/INSCAPE_ALPHA_CONTINUATION_HANDOFF.md` as authority.

## Change discipline: inspect dependencies before extending

- Before a feature or workflow change, trace the relevant existing path through
  UI, state, data, persistence, and access boundaries. Inspect the code and tests
  that the change will depend on; do not assume working screens prove sound
  separation. Keep this investigation proportional to the change.
- Before editing, briefly explain in plain language what the change depends on,
  who currently owns those responsibilities, and any concrete prerequisite
  cleanup. Distinguish accepted intent, observed behavior, and assumptions.
  Investigate technical questions yourself; ask the user about unresolved
  purpose or tradeoffs, not implementation details they cannot assess.
- If an observed responsibility conflict would make the requested change
  fragile or duplicate behavior, simplify that boundary first in a small,
  reviewable step. Replace the existing path and remove superseded logic where
  safe; do not merely add another flag, wrapper, or parallel implementation.
- Do not turn this into a mandatory whole-app audit or require a perfect
  foundation. Cleanup must address an evidenced dependency of the current work.
  More files and abstractions are not evidence of better architecture. If the
  existing boundary is adequate, proceed with the requested change.
- Keep Workbench hosting, module-specific behavior, navigation, wallet
  authority, and authored versus temporary state distinct as required by the
  active contract. Connect them through explicit actions and inputs rather than
  letting a change in one silently choose unrelated behavior in another.
- Verify the affected behavior and its important transitions, including existing
  workflows. Prefer behavioral regression evidence over assertions that merely
  match source text. Use the required checks below and inspect UI results.
- Report what the work revealed about the architecture, what was actually
  simplified, and what remains coupled or unproven. A behavior fix is not proof
  of an architectural cleanup. If new evidence changes the next step, explain
  why before proceeding; do not silently expand scope.

## Implementation guardrails

Apply these where the changed workflow touches the relevant boundary; they do
not require a separate audit or approval round for every edit.

- Give each fact one authoritative owner. Derive secondary views instead of
  maintaining synchronized copies. Document the purpose and invalidation of
  caches; a cache must not silently become a second source of truth.
- Treat saved drafts and published documents as compatibility boundaries.
  Changes to schemas, defaults, identifiers, or storage keys must explain how
  existing data is read or migrated and include representative old-data checks.
  Never reset or overwrite a user's work merely to make new code load.
- Bind asynchronous results and interactions to their originating profile,
  module, and request where relevant. Ignore or cancel obsolete work after
  navigation, account changes, closure, or disposal. Clean up listeners, timers,
  animation loops, and owned media resources according to their lifecycle.
- Distinguish loading, empty, unavailable, stale, and failed states. Do not turn
  failed reads into successful empty results or report persistence success
  before it is confirmed. Recovery actions must have a meaningful effect.
- Prefer explicit module targets and scoped events or references over global
  selectors and broadcasts. Introduce shared abstractions from concrete uses;
  do not build a generic plugin framework for hypothetical modules.
- Measure performance claims using representative content and workloads.
  Match media resolution to its purpose, bound network work, and avoid loading
  optional runtimes before needed. An empty canvas is not evidence that a
  covered artwork scene renders correctly or performs well.
- Reuse existing dependencies and shared UI before adding alternatives. Explain
  the need and maintenance cost of a new dependency or parallel styling system.
  Preserve keyboard access, focus recovery, and reduced-motion behavior when
  changing interactions.
- Keep changes reversible and reviewable. At a handoff, state what changed,
  what checks actually ran, outstanding limits, and whether work is local,
  committed, or pushed. Never imply that Git or a deployment contains changes
  that have not been saved there. Keep temporary progress out of this file;
  durable product decisions belong in the active contract.

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

