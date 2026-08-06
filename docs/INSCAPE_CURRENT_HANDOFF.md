# INSCAPE current handoff

Updated: 2026-08-06 (Europe/Brussels)

This is the current travel checkpoint. It describes two intentionally separate branches. Do not merge, deploy, publish to IPFS, or perform a wallet action merely because this document exists.

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
