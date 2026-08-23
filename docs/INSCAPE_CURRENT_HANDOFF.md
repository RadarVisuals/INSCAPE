# INSCAPE current handoff

Updated: 2026-08-23 (Europe/Brussels)

This is the current travel checkpoint. It describes two intentionally separate branches. Do not merge, deploy, publish to IPFS, or perform a wallet action merely because this document exists.

## Current System Workflow migration checkpoint

- Branch: `migration/system-workflow-2026-08-17`
- Required starting HEAD: `c8c1e12f38f03f5410364462cfd84c18be9b8eb1`
- Scope implemented: Phase 4A plus the user-authorized Phase 4B review candidate, corresponding to Phase 4 steps 1-10.
- Review state: Phase 4A remains independently audited **GO** and committed at `9ff866f51e9ef6938d40d25025f2c4a2be38cadd`. Phase 4B automated certification, manual acceptance, and independent audit are all **GO** with no blocking findings. Overall Phase 4 is `[x]`; the accepted Phase 4B changes are committed locally in the current checkpoint.
- Selected production runtime: `SYSTEM_WORKFLOW`, loaded lazily through `OwnerSystemWorkflowShell`. MODUL8R remains only the bounded one-file rollback target and is not mounted by the selected production path.

The active legacy authorities replaced in this slice were the local `OSUnderneathProfileDocument` singleton name/hash, the resolver's injectable generic v1-v8 parser, the Discovery query's old-key filter, generic v7/v8 publication serialization, and the active legacy/Lattice Visitor selector. Publisher, resolver, and Discovery now share the Phase-1 `INSCAPE_PROFILE_DOCUMENT_KEY`. Upload preparation, upload Function validation, CID verification, wallet-publication preparation, resolver read-back, Preview, and Visitor use strict canonical Profile Document v9 bytes. No dual-read, dual-write, migration, parser injection, or legacy-key fallback was added.

Phase 4B connects the promoted shell to the existing owner runtime seam, mounts the existing v9 publication rack, preserves profile-keyed resets and lazy owner isolation, and selects the System Workflow shell atomically. The final public browser pass also restored the v9 Visitor's dropped `onReturn` callback, verified its persistent identity-rack focus return, and bounded DISCOVER/RETURN inside a 390px viewport without adding a legacy Visitor branch.

Verification at the current Phase 4B review candidate:

- focused Phase-4A publication/resolver/Discovery/Profile-v9 matrix: `115/115` passed, including the exact singleton-key authority and hash-valid BOM-prefixed resolver/upload rejection;
- production budget, owner/runtime isolation, public-boundary, and artifact matrix: `38/38` passed;
- System Workflow 24-Grid notice/safety regression matrix: `16/16` passed; the notice now dismisses on click and automatically after 4.5 seconds without changing the ceiling;
- final full sequential Node suite: `1240/1240` passed;
- consolidated System Workflow browser suite: `14/14` passed;
- selected hardware production owner/authority/iframe gate: `1/1` passed with no forbidden provider operation;
- published canonical-v9 Visitor/direct-profile fixture: `12/12` passed, including Return, persistent identity, artwork inspection, CSP/media failure, 390px layout, and zero owner storage operations;
- canonical v9 publication rack browser gate: passed with local snapshot preparation only and zero upload requests;
- independent Phase 4B audit matrix: `44/44` passed with no blocking findings;
- `npm run test:lukso-standards`: `5/5` passed;
- `npm run build`: passed, 5,430 modules transformed, production budgets passed;
- `npm run build:check`: passed at 802,502 initial JavaScript bytes;
- owner runtime graph: `leaks: []`;
- first independent audit: `NO-GO` for one blocker. Hash-valid formatted/reordered v9 JSON could resolve because schema parsing was not followed by canonical serialization equality. That defect was corrected.
- second independent audit: `NO-GO` because `TextDecoder` and `Request.text()` stripped a UTF-8 BOM before the string comparison. Resolver and upload Function now retain the original bytes, parse through fatal UTF-8 decoding, and compare those bytes against the central `profileDocumentV9HashInput` output. Hash-valid BOM-prefixed JSON now returns resolver `INVALID / NON_CANONICAL_DOCUMENT` and upload HTTP `422 / NON_CANONICAL_DOCUMENT` before credentials or Pinata.
- final independent re-audit: **GO**. Both canonical-byte blockers are fully resolved; no blocking findings remain. Its sole non-blocking finding was that the checkpoint count omitted the singleton-key test (`114/114` instead of `115/115`), corrected here.
- measured selected System Workflow owner budgets: JavaScript `365_023` raw / `110_353` gzip; CSS `143_850` raw / `21_133` gzip. Initial and standalone-wallet limits were not relaxed, and exact-boundary plus limit-plus-one tests remain.

Official LSP2, LSP6, and LSP0 authorities were rechecked on 2026-08-23. No live controller preflight was performed because no wallet action was authorized; no permission issue was discovered. No upload, signature, transaction, ERC725Y write, deployment, merge, push, environment-variable, or Netlify configuration action occurred during Phase 4B.

Phase 4 is accepted, independently audited, and committed locally. Before any separately authorized live publication, perform the real LSP6 controller preflight and stop on any permission issue. Post-acceptance cleanup remains a separate unstarted phase; do not begin cleanup, push, deployment, upload, signature, or transaction without explicit authorization.

The older cross-branch travel notes below remain historical context and are not authorization to alter those lanes.

## Remote checkpoints

### Product and experimental lane

- Branch: `ui/creations-browser`
- Checkpoint before this document: `cf3fc04`
- Purpose: active product work, the lightweight Grid Walker, Startveil wordmark, and DEV-only walker studies.
- New commits:
  - `6f70bf7` - Add grid walker prototype studies
  - `4eace74` - Introduce lightweight grid walker runtime
  - `fe637fd` - Integrate grid walker with owner workspace
  - `d51a178` - Update Startveil wordmark presentation
  - `cf3fc04` - Tighten grid resident boundary coverage

### Pre-Alpha hardening lane

- Branch: `release/pre-alpha-hardening`
- Task 5 code checkpoint (required ancestor of the current branch): `a0dce3c`
- Commit: `Modernize Alpha support error surfaces`
- Draft PR: `#2`
- Deploy Preview: `https://deploy-preview-2--enterinscape.netlify.app`
- Production remains locked. No production deployment, merge, IPFS upload, signature, or transaction was performed.

## Accepted product direction

- The heavyweight Keeper is deferred until the Pixi/Atelier rendering path is deliberately optimized.
- The active application root now mounts one lightweight code-only `GridWalkerCanvas`; it does not mount `ArtCanvas`, `PixiEngine`, or `AssetResolver` through `App.jsx`.
- The Walker supports autonomous movement, dock/release, right-click tuning, signal bubbles, and line/dot grid presentation.
- MODUL-8R no longer leaves a fixed production reopen button in the center after closing. Focus return is owned by the existing workspace trigger.
- Startveil uses `public/assets/inscapestartveilwordmarknew.svg` as the accepted current static wordmark presentation.
- The canonical Mist-style published-profile error surface and full Alpha support guidance were visually accepted locally.

## Hardening status

- Task 0: `[x]`
- Task 1: `[~]` - preview evidence complete; production-live historical lock-URL check remains.
- Task 2: `[~]` - preview evidence complete; production-live headers/runtime check remains.
- Task 3: `[x]`
- Task 4: `[x]`
- Task 5: `[~]` - repair is committed and pushed at `a0dce3c`; one refreshed Deploy Preview review remains.
- Task 6: `[ ]` - exact combined release-candidate certification has not started.
- Task 7: `[ ]` - supervised Alpha cohort is intentionally deferred until explicit user authorization.

## Verification evidence

### Release lane at `a0dce3c`

- Focused support and production-budget tests: `22/22` passed.
- `npm run build`: passed; 6,375 modules transformed.
- `npm run build:check`: passed.
- `git diff --check`: passed.
- Initial CSS: `116,030` raw / `20,572` gzip.
- Initial CSS ceiling: `117,000` raw / `20,587` gzip. The repair retains exactly 15 gzip bytes of measured headroom.
- The known corrupt untracked `.browser-test-runtime/` was not staged, cleaned, or modified.

### Product lane at `cf3fc04`

- `node --test src/public/publicBoundary.test.js`: `14/14` passed.
- Vite transformed 5,494 modules and completed chunk rendering.
- The production budget gate then failed because this branch still has its older pre-hardening budgets and has not been combined/re-measured:
  - owner JS raw: `296,713 / 276,000`
  - owner JS gzip: `90,015 / 83,500`
  - initial CSS raw: `120,260 / 117,000`
  - initial CSS gzip: `21,176 / 20,000`
  - owner CSS raw: `75,658 / 70,000`
  - owner CSS gzip: `14,490 / 13,200`
- Do not raise these limits in isolation. Attribute and set combined candidate budgets only after integrating the two branches for Task 6.
- No full suite or production browser matrix was run for this travel checkpoint.

## Deliberately excluded local files

The following remain only on the original desktop and are not part of the remote checkpoint:

- review screenshots and Startveil render/contact-sheet PNGs;
- experimental banner PNG variants and `public/inscape-x-banner-composition.html`;
- the duplicate untracked hardening-plan copy in the product worktree;
- `src/prototypes/inscape-logo-morph/` and `src/prototypes/profilecard/`;
- the abandoned `src/prototypes/startveilCube/`, its browser harness, and its OTF font, whose repository/web-embedding licence was not approved;
- `connect4-page.png`.

Do not use `git add -A` in the original product worktree. These files require an explicit keep/archive/delete decision later.

## Exact next task

1. Wait for PR #2 to expose a Deploy Preview for exact commit `a0dce3c`.
2. Open the safe resolver failure route used during Task 5 and confirm the accepted Mist rack, readable support copy, buttons, focus, and copied bounded evidence.
3. If accepted, update the authoritative hardening plan on `release/pre-alpha-hardening`, mark Task 5 `[x]`, commit, and push that documentation checkpoint.
4. Keep both branches separate until ready for Task 6.
5. For Task 6, integrate the product commits into the clean release lane, produce one exact candidate SHA, re-attribute all bundle changes, and run the complete automatic/manual certification matrix.
6. Real IPFS upload, wallet publication, production promotion, and external tester invitations always require separate explicit user authorization.

## Laptop setup

After cloning or opening the repository on the laptop:

```powershell
git fetch origin
git switch ui/creations-browser
git pull --ff-only origin ui/creations-browser
```

For hardening work, use the remote release branch in a separate worktree or checkout. Example from the repository parent directory:

```powershell
git worktree add ..\INSCAPE-pre-alpha-release -b release/pre-alpha-hardening --track origin/release/pre-alpha-hardening
```

If the local branch already exists, omit `-b` and attach that existing branch instead. Never open both worktrees on the same branch simultaneously.

## Codex chat continuity

This chat is backed by the current desktop host. A repository clone alone does not carry the local chat. Codex Remote/Handoff can transfer a chat and its Git state to another connected Mac or Windows host when both hosts are signed in and the matching project is saved. Without that setup, start a fresh laptop chat and tell it to read this document and the authoritative hardening plan before acting.
