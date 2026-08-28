# INSCAPE travel instructions

Updated: 2026-08-06 (Europe/Brussels)

## 1. Purpose

This document is the operational continuation plan for INSCAPE while working from another computer or from a fresh Codex chat. It is intentionally detailed enough that a Codex window with no conversation history can establish the correct repository state, identify the next authorized task, and continue without guessing.

Start every new travel chat with:

> Read `docs/TRAVEL_INSTRUCTIONS.md` and `docs/INSCAPE_CURRENT_HANDOFF.md` completely. If working on the hardening branch, also read `docs/INSCAPE_PRE_ALPHA_RELEASE_HARDENING_PLAN.md` completely. Inspect the current branch, HEAD, remote tracking state, staged state, and untracked files before doing anything. Report what you found and continue only with the next task authorized by me. Do not merge, deploy, publish, sign, upload to IPFS, change environment variables, delete local files, or widen bundle budgets without explicit evidence and authorization.

This file does not itself authorize a merge, deployment, wallet action, IPFS upload, deletion, or external tester invitation.

## 2. Current repository map

There are two intentionally separate remote branches.

### Product lane

- Branch: `ui/creations-browser`
- Travel checkpoint commit before this document: `7be5254fe6fa67f400703832e4722081123a503e`
- Contains:
  - the lightweight code-only Grid Walker runtime;
  - dock/release, autonomy, tuning, signals, and line/dot grid integration;
  - the MODUL-8R production reopen-button/focus repair;
  - the current Startveil wordmark presentation and its SVG;
  - the retained Grid Walker and Spider Keeper DEV-only prototype studies;
  - `docs/INSCAPE_CURRENT_HANDOFF.md`.
- This branch is an active product lane, not yet the certified release candidate.

### Hardening lane

- Branch: `release/pre-alpha-hardening`
- Current remote checkpoint before this document: `a0dce3c16d592a5d0f0234b1b938c94c3493bbf3`
- Draft pull request: GitHub PR `#2`, from `release/pre-alpha-hardening` into `ui/creations-browser`.
- Deploy Preview: `https://deploy-preview-2--enterinscape.netlify.app`
- Contains the authoritative hardening plan and Tasks 0-5 implementation history.
- Production is locked. A successful Netlify production-context build is not the same as publishing it, but neither should be triggered casually.

Always verify these values rather than assuming they are still current:

```powershell
git branch --show-current
git rev-parse HEAD
git status --short
git fetch origin
git rev-parse origin/ui/creations-browser
git rev-parse origin/release/pre-alpha-hardening
```

## 3. Authoritative documents

Read documents in this order:

1. `docs/TRAVEL_INSTRUCTIONS.md` — operational sequence and safety rules.
2. `docs/INSCAPE_CURRENT_HANDOFF.md` — exact checkpoint, accepted product decisions, exclusions, and latest evidence.
3. `docs/INSCAPE_PRE_ALPHA_RELEASE_HARDENING_PLAN.md` — authoritative hardening task definitions and exit criteria. This file is tracked on `release/pre-alpha-hardening`.
4. `docs/INSCAPE_VISION_AND_ART_DIRECTION.md` — product and artistic direction.
5. Relevant files under `docs/art-direction/` when doing visual or MODUL-8R work.

The product worktree previously contained an untracked duplicate of the hardening plan. Never stage that duplicate. The authoritative plan is the tracked release-branch version.

## 4. Laptop setup

### Fresh clone

```powershell
git clone https://github.com/RadarVisuals/INSCAPE.git
Set-Location INSCAPE
git fetch origin
git switch ui/creations-browser
git pull --ff-only origin ui/creations-browser
```

Install dependencies only after confirming the expected Node/npm versions from the hardening checkpoint. Prefer the lockfile-preserving command:

```powershell
npm ci
```

Do not regenerate or casually update `package-lock.json`.

### Separate hardening worktree

From the parent directory of the clone:

```powershell
git -C .\INSCAPE fetch origin
git -C .\INSCAPE worktree add ..\INSCAPE-pre-alpha-release -b release/pre-alpha-hardening --track origin/release/pre-alpha-hardening
```

If the local release branch already exists, attach that branch without `-b`. Git must never have the same local branch checked out in two worktrees simultaneously.

Suggested directories:

- `INSCAPE` — `ui/creations-browser`
- `INSCAPE-pre-alpha-release` — `release/pre-alpha-hardening`

### Continuing this exact Codex chat

The current chat uses the original desktop as its local host. Cloning Git does not automatically copy a local Codex chat. If Codex Remote/Handoff is available, connect both machines using the same ChatGPT account/workspace, save the matching repository project on both hosts, and use the chat footer's run-location menu to hand off the chat. Otherwise start a fresh chat on the laptop and use the opening prompt at the top of this document.

The repository and these documents are the durable source of continuity; never depend solely on remembered chat context.

## 5. Non-negotiable operating rules

1. Never use `git add -A` or `git add .` until all untracked paths have been classified.
2. Never delete, clean, move, or absorb `.browser-test-runtime/`. The release worktree contains a known corrupt untracked legacy runtime directory.
3. Never merge the product and release branches without explicit user authorization.
4. Never push directly to `main` during hardening.
5. Never unlock or publish the Netlify production deployment without explicit user authorization.
6. Never perform an IPFS upload, wallet signature, publication transaction, replacement transaction, or retry of an ambiguous submitted transaction without explicit authorization.
7. Never change environment variables or print their values. Required names may be documented; secret values may not.
8. Never weaken CSP for Netlify's Preview Drawer. The white preview bar/blocked `app.netlify.com` iframe is Netlify tooling, not INSCAPE product UI.
9. Never increase a bundle budget merely to make a build green. Attribute the exact change, prove it is necessary and non-duplicated, preserve the prior measured headroom, and add an exact regression boundary.
10. Never call a task `[x]` while a stated preview, production-live, wallet, publication, or user-acceptance criterion remains.
11. Do not run the full suite casually during visual iteration. Use focused checks proportional to the change. Task 6 explicitly requires the full sequential certification matrix.
12. Preserve user-owned review/branding material unless the user explicitly classifies it for commit, archive, or deletion.

## 6. Current accepted architecture and visual decisions

### Lightweight resident

- The active root mounts `GridWalkerCanvas`, not `ArtCanvas`.
- `App.jsx` must remain free of active `PixiEngine`, `pixi.js`, and `AssetResolver` imports.
- Heavy Keeper/Pixi work is deferred until the Pixi engine and Atelier rendering path receive a separate performance project.
- Heavy source may remain in the repository if lazy/deferred, but it must not silently remount in the active production root.
- Only one lightweight Walker is intended in the active resident layer.
- Walker feet use the same grid origin and cell spacing as the visible owner grid.
- Grid presentation may be lines or dots; placement snapping remains a separate canonical coordinate concern.
- The dock keeps right-click tuning controls and autonomy.

### MODUL-8R

- Closing MODUL-8R must not leave an immovable `OPEN MODUL-8R` button in the viewport center.
- Production reopening belongs to the existing workspace/tool trigger.
- Exact focus return must remain deterministic.

### Startveil and branding

- The currently accepted production wordmark asset is `public/assets/inscapestartveilwordmarknew.svg`.
- The Startveil is not considered final motion design, but the current wordmark checkpoint is intentional.
- Abandoned Rubik/cube motion studies and their OTF font are not part of the remote checkpoint.
- Do not commit or embed the OTF until its repository and web-embedding licence is explicitly approved.

### Alpha support/error surface

- The safe published-profile resolver error uses the canonical Mist/grid rack presentation.
- Support evidence is local-only and generated only after an explicit user action.
- It must include bounded release/route/browser/phase/provider/profile information and exclude secrets, storage, private tables, arbitrary console output, calldata, signatures, and canonical document bytes.
- Visible guidance must mention the private invitation channel, desktop-only authoring boundary, permanent public IPFS publication, and screenshot privacy review.

## 7. Immediate next task: finish Task 5

Task 5 is currently `[~]`. Its repaired code is committed and pushed on `release/pre-alpha-hardening` at `a0dce3c`.

### 7.1 Establish the exact preview

1. Work only in the hardening worktree.
2. Confirm clean tracked state. The known `.browser-test-runtime/` may remain untracked.
3. Fetch the remote branch.
4. Confirm local HEAD and remote head are the expected Task 5 commit or an explicitly documented successor.
5. Open GitHub PR #2 and verify the Deploy Preview is built from that exact SHA.
6. Do not accept a preview whose displayed support `release` value is an older commit.

### 7.2 Manual Task 5 acceptance

Use the safe resolver failure route:

```text
https://deploy-preview-2--enterinscape.netlify.app/?view=0x1111111111111111111111111111111111111111
```

Check:

1. The old black/orange legacy public-shell error presentation is absent.
2. The canonical Mist/grid background and centered rack are visible.
3. `PROFILE TEMPORARILY UNAVAILABLE` and the public network/content gateway explanation are readable.
4. Directory, Return, and Retry are visible and keyboard reachable.
5. The Alpha Support section does not wrap letter-by-letter or collapse into unusable columns.
6. `COPY SUPPORT DETAILS` is readable and operable.
7. Visible copy says no wallet action or publication transaction is involved for this resolver failure.
8. Visible policy says:
   - send details through the private Alpha invitation channel;
   - invite-only experiment;
   - desktop authoring only;
   - IPFS publication is public and permanent;
   - review screenshots for private information.
9. Expanding review details remains within the rack and is scrollable if needed.
10. Copy evidence contains only the documented bounded fields.
11. Narrow/mobile width remains usable.
12. Tab focus, buttons, disclosure, and copy feedback are visible.
13. The Netlify preview bar may appear; classify it as injected preview tooling rather than product UI.

### 7.3 If accepted

1. Change only the Task 5 status/checkpoint in the authoritative hardening plan.
2. Mark Task 5 `[x]` with the exact preview SHA, URL, date, and manual evidence.
3. Do not start Task 6 inside the same commit.
4. Run `git diff --check`.
5. Commit the documentation-only acceptance checkpoint.
6. Push `release/pre-alpha-hardening`.
7. Report the exact SHA and clean tracked state.

Suggested commit message:

```text
Accept Alpha support recovery surfaces
```

### 7.4 If rejected

- Keep Task 5 `[~]`.
- Record the exact visual/behavioral defect.
- Make only a bounded Task 5 correction.
- Use focused support tests, `npm run build`, `npm run build:check`, and `git diff --check`.
- Create a new preview and repeat the same acceptance route.
- Do not begin Task 6.

## 8. Prepare the combined release lane

This begins only after Task 5 is `[x]` and the user explicitly authorizes integration.

### 8.1 Why integration is required

The hardening branch contains CSP, artifact hygiene, support, browser gates, and release documentation. The product branch contains the Walker, current Startveil, and owner integration. Task 6 must certify the version that will actually ship, so it cannot certify either incomplete branch in isolation.

### 8.2 Pre-merge audit

1. Fetch both remote branches.
2. Confirm both tracked worktrees are clean.
3. Confirm the release branch contains the accepted Task 5 checkpoint.
4. List commits unique to each branch.
5. Inspect overlapping paths before merging.
6. Confirm no local-only prototype/font/review asset is staged.
7. Record the current rollback commit and Netlify production lock state.

Useful commands:

```powershell
git fetch origin
git log --oneline --left-right origin/release/pre-alpha-hardening...origin/ui/creations-browser
git diff --name-status origin/release/pre-alpha-hardening...origin/ui/creations-browser
git status --short
```

### 8.3 Integration strategy

Preferred strategy: merge the pushed product branch into the clean release branch using an explicit merge commit. Do not rewrite already-pushed release history merely to make it linear.

Before the merge, obtain explicit user authorization. During conflicts:

- preserve the authoritative release hardening plan from the release branch;
- preserve Task 2 CSP/Pixi compatibility code even if Pixi is no longer mounted by the active root, unless analysis proves it unreachable and deliberately removes it with replacement coverage;
- preserve the lightweight Grid Walker active-root selection from the product branch;
- preserve the Task 5 canonical support/error repair;
- preserve production MODUL-8R selection and the no-center-reopen behavior;
- keep DEV-only prototypes excluded from production output;
- never resolve a conflict by accepting an entire side without reading it.

After merging, the result is only a candidate source tree. It is not certified and must not be deployed to production.

## 9. Task 6: exact release-candidate certification

Task 6 starts only on a clean combined release commit.

### 9.1 Freeze and identify the candidate

Record:

- branch and exact candidate SHA;
- parent/merge commits;
- `git status --short`;
- Node and npm versions;
- `package-lock.json` SHA-256;
- production runtime selector (`MODUL8R` expected unless explicitly changed);
- names, never values, of required environment variables;
- previous known-good production deployment/commit;
- Deploy Preview URL and commit identity;
- Netlify production lock state.

After candidate freeze, any source, dependency, environment, or build-config change creates a new candidate and invalidates affected evidence.

### 9.2 Dependency installation

Use:

```powershell
npm ci
```

Do not run a dependency upgrade. Task 3 already records the accepted dependency risk and future review triggers.

### 9.3 Bundle attribution before budget changes

The product checkpoint compiled but its old standalone branch budgets failed at:

- owner JS raw `296,713 / 276,000`;
- owner JS gzip `90,015 / 83,500`;
- initial CSS raw `120,260 / 117,000`;
- initial CSS gzip `21,176 / 20,000`;
- owner CSS raw `75,658 / 70,000`;
- owner CSS gzip `14,490 / 13,200`.

These numbers are diagnostic, not authorized new ceilings. On the combined branch:

1. Generate the production bundle report.
2. Attribute deltas by chunk/module.
3. Prove the old heavy resident/Pixi graph is not duplicated in the initial root.
4. Confirm the lightweight Walker code is singular.
5. Determine whether CSS is duplicated across initial/owner chunks.
6. Reduce accidental duplication first.
7. If necessary growth remains, calculate the smallest ceilings that preserve the previously recorded headroom.
8. Add exact limit and `limit + 1` tests.
9. Report every changed ceiling and why it is required before treating it as accepted.

### 9.4 Automatic certification matrix

Run sequentially unless an existing harness explicitly owns isolated parallelism:

1. Focused Task 1 artifact-hygiene tests.
2. Focused Task 2 CSP/Pixi/security-policy tests.
3. Task 3 dependency/risk assertions if present.
4. Task 4 lifecycle, hardware-renderer, owner authority, Settings/Theme, persistence, isolation, and Preview/publication-preparation gates.
5. Task 5 support/evidence/recovery tests.
6. Grid Walker/public-boundary focused tests.
7. Complete Node suite with zero unexpected failures, cancellations, or skips.
8. `npm run build`.
9. `npm run build:check`.
10. Production owner-runtime graph and forbidden-marker scans.
11. `git diff --check`.
12. Published Visitor browser suite.
13. Direct-profile browser coverage.
14. Intended Universal Profile iframe coverage.
15. Owner production-preview gates.
16. Verify zero owned Edge/Node processes and zero new temporary runtime directories after each harness family.

Do not dismiss failures merely as pre-existing. Every candidate failure must be fixed, replaced as obsolete with meaningful coverage, or explicitly accepted by the user with evidence that it cannot reach the release.

### 9.5 Hardware-authoritative browser rule

Task 4 proved that `--disable-gpu` forced SwiftShader and created misleading 20-30 second render stalls. Hardware-authoritative gates must:

- avoid `--disable-gpu` and software renderer forcing;
- require WebGL and WebGL2;
- record unmasked vendor/renderer;
- fail closed for SwiftShader, llvmpipe, softpipe, lavapipe, WARP, Microsoft Basic Render Driver, software rasterizer, GDI Generic, or Mesa OffScreen;
- not require a particular NVIDIA/AMD/Intel model.

If the travel laptop cannot provide authoritative hardware rendering, do not weaken the gate. Complete non-hardware work and leave that evidence pending for the original desktop.

### 9.6 Manual candidate acceptance

Against the exact candidate Deploy Preview:

1. Enter through Startveil.
2. Confirm the current SVG wordmark and no unexpected legacy transition.
3. Connect through the supported Universal Profile environment.
4. Confirm the exact owner identity.
5. Confirm a mismatched/disconnected profile fails closed.
6. Confirm the lightweight Walker appears at expected scale and frame rate.
7. Exercise autonomy, dock/release, right-click tuning, and signal bubbles.
8. Toggle line/dot grid and confirm Walker/grid alignment.
9. Confirm no heavy Pixi Keeper or old resident co-renders.
10. Open all MODUL-8R modules.
11. Close MODUL-8R and confirm no center-screen reopen button appears.
12. Reopen through the canonical trigger and verify focus behavior.
13. Exercise all six themes and Settings.
14. Discover and select an asset.
15. Place it with ARRANGE.
16. Move, resize, reorder/layer, lock, and reload.
17. Edit frame, mat, backing, and transparency; verify Apply versus Cancel.
18. Preview and confirm private owner state is absent.
19. Prepare the canonical publication snapshot.
20. Inspect Alpha Support and a safe resolver failure.
21. Verify direct-profile, visitor, iframe, narrow layout, external media, viewer, and navigation.
22. Verify response headers for owner, visitor, iframe, assets, missing assets, and the publication Function.
23. Verify both historical Affinity-lock URLs return safe SPA HTML and no original metadata.
24. Demonstrate the documented application rollback on preview/staging only.

### 9.7 Real publication round trip

This is separately gated. Before performing it, ask the user explicitly for authorization naming:

- exact candidate SHA;
- exact designated test profile;
- one IPFS upload;
- one CID verification;
- one wallet publication transaction;
- receipt/resolver read-back;
- the rule against duplicate submission after an ambiguous hash.

If authorized:

1. Prepare one frozen snapshot.
2. Record only bounded metadata and hashes, never canonical private content.
3. Upload once.
4. Verify returned CID against exact bytes.
5. Open the wallet request once.
6. If rejected before a transaction hash, classify as pre-submission.
7. If a hash exists, never submit a duplicate; investigate the existing hash.
8. Confirm receipt.
9. Resolve the public document.
10. Confirm canonical bytes, CID, transaction reference, resolver, and visitor agree.

### 9.8 Task 6 completion

Task 6 becomes `[x]` only when:

- all automatic gates are green for one exact SHA/artifact;
- the manual preview matrix is accepted;
- the controlled publication round trip succeeds;
- rollback is demonstrated safely;
- no prototype or user-owned excluded asset entered production;
- the user explicitly authorizes promotion of that exact candidate.

## 10. Production promotion and live closure

Do not perform these steps without explicit authorization.

1. Confirm the candidate SHA still matches the certified artifact.
2. Confirm production is locked before any preparatory build.
3. Merge/promote only through the agreed branch/PR procedure.
4. Ensure no new commit appears between certification and promotion.
5. Publish the exact certified deployment.
6. Verify the live release identity.
7. Re-run bounded live checks:
   - CSP and required headers;
   - owner entry and wallet modal without unnecessary transaction;
   - MODUL-8R and Settings;
   - Visitor, direct profile, and intended iframe;
   - external media/provider connectivity;
   - publication Function safe rejection behavior;
   - historical Affinity-lock URLs disclose no original bytes or metadata.
8. Mark Tasks 1 and 2 `[x]` only after their production-live evidence succeeds.
9. Mark Task 6 `[x]` only when its full exit criteria and explicit promotion approval are recorded.

Rollback restores the application deployment only. It cannot erase IPFS content or rewrite an on-chain profile reference. Always communicate that distinction.

## 11. Task 7: supervised Alpha

Task 7 is not another feature-development phase. It is the controlled operation of the Alpha and may wait until the intended end-of-month launch window.

### First cohort

1. Invite 3-5 known testers.
2. Provide supported browser/device guidance.
3. State desktop-only owner authoring.
4. Explain that IPFS publication is public and permanent.
5. Give one suggested owner → arrange → preview → publish → visitor journey.
6. Give the private support channel and Copy Support Details instructions.
7. Tell testers not to repeat an ambiguous wallet publication when a transaction hash may exist.
8. Ask each tester to use one intentional public test profile.
9. Review failures daily during the first observation window.

### Stop conditions

Pause invitations immediately if:

- owner authority is granted to the wrong account/profile;
- private owner state enters Preview, publication, or Visitor;
- profile A data appears in profile B;
- canonical bytes, CID, transaction, and resolver disagree;
- the UI encourages a duplicate ambiguous publication transaction;
- CSP breaks the supported wallet or iframe boundary;
- repeated publication/resolver failures affect multiple testers;
- deployed source/temp files expose personal or secret material;
- owner-draft data loss or unrecoverable corruption is observed.

### Expansion

Expand toward 10-15 testers only after the first cohort completes critical journeys without an active stop condition. Task 7 completes only after cohort evidence, a continue/stop decision, and prioritized findings are documented without participant secrets.

## 12. Deferred work

Unless Alpha evidence promotes it, keep these separate:

- full Pixi/Atelier performance redesign;
- restoration of a complex shader-heavy Keeper;
- multiple simultaneous Keepers;
- abandoned cube/Rubik Startveil concepts;
- broader Startveil motion exploration;
- remote analytics/error SDKs;
- wider public Alpha access;
- speculative feature work unrelated to observed release blockers.

## 13. Known local-only material on the original desktop

The travel remote checkpoint intentionally excludes:

- MODUL-8R review screenshots;
- Startveil render/contact-sheet PNGs;
- banner variants and composition HTML;
- `src/prototypes/inscape-logo-morph/`;
- `src/prototypes/profilecard/`;
- `src/prototypes/startveilCube/`;
- `browser-tests/startveil-cube.browser.mjs`;
- the prototype OTF font;
- `connect4-page.png`;
- the duplicate untracked product-worktree hardening plan.

Do not report these as lost merely because they are absent on the laptop. They remain on the original desktop. Do not recreate, commit, or delete them without an explicit classification decision.

## 14. Known diagnostic distinctions

### Netlify preview white bar

The white bar seen on Startveil and application routes was Netlify's injected preview container and `/.netlify/scripts/cdp`, not INSCAPE UI. CSP correctly blocks its attempted `app.netlify.com` frame. Do not weaken `frame-src` to remove the bar.

### Product-branch build budget failure

The product checkpoint compiles but exceeds its old isolated budgets. This is not proof of a runtime crash. It is also not permission to raise ceilings. Resolve it only during combined Task 6 attribution.

### Corrupt browser runtime

The release worktree's `.browser-test-runtime/` contains a Windows-corrupt Edge cache path from earlier harness work. It is untracked and intentionally untouched. New harnesses must use validated unique runtime directories and clean only the exact directories they own.

### Preview versus production

A Deploy Preview and a locked production-context build do not alter the live site. `Publish deploy`, unlocking auto-publishing, merging into a production-triggering branch, or otherwise promoting a build can alter the live site and requires explicit authorization.

## 15. Commit and reporting discipline

For every task:

1. Inspect branch, HEAD, staged, modified, and untracked state first.
2. State the exact authorized scope.
3. Make bounded changes.
4. Run proportionate focused verification.
5. Report failures honestly; do not relabel them as stale without proof.
6. Update only the relevant task checkpoint.
7. Stage exact paths, never the entire worktree blindly.
8. Run `git diff --cached --check`.
9. Show the staged file list/stat.
10. Commit only after user authorization when external workflow state is material.
11. Push only the intended branch.
12. Verify local and remote SHAs.
13. Report staged, modified, and untracked final state.
14. State explicitly whether any deploy, upload, signature, transaction, environment change, merge, or production action occurred.

## 16. Ready-to-paste prompts

### Continue Task 5

> Read `docs/TRAVEL_INSTRUCTIONS.md`, `docs/INSCAPE_CURRENT_HANDOFF.md`, and the complete authoritative `docs/INSCAPE_PRE_ALPHA_RELEASE_HARDENING_PLAN.md`. Work only on `release/pre-alpha-hardening`. Inspect local/remote HEAD and worktree state. Do not modify anything initially. Confirm that the current release HEAD contains Task 5 repair commit `a0dce3c16d592a5d0f0234b1b938c94c3493bbf3` as an ancestor and that PR #2's Deploy Preview is built from the exact current release HEAD. Guide me through the bounded Task 5 resolver-error acceptance checklist. If I accept it, update only the Task 5 checkpoint to `[x]`, verify the documentation diff, and wait for explicit commit/push authorization. Do not start Task 6, merge, deploy production, upload to IPFS, change environment variables, or touch `.browser-test-runtime/`.

### Prepare product/release integration

> Read all three continuation documents completely. Perform a read-only pre-merge audit of `origin/ui/creations-browser` and `origin/release/pre-alpha-hardening`. Confirm Task 5 is `[x]`, list unique commits and overlapping paths, classify likely conflicts, identify excluded untracked assets, and propose the exact merge procedure into the release lane. Do not merge or modify files until I explicitly authorize it.

### Start Task 6

> Read `docs/TRAVEL_INSTRUCTIONS.md`, `docs/INSCAPE_CURRENT_HANDOFF.md`, and the full hardening plan. Work only from the explicitly approved combined clean release commit. Implement Task 6 exactly as written: freeze one candidate SHA, record environment and rollback metadata without secrets, attribute bundle deltas before changing any limit, run the complete sequential automatic matrix, and prepare the exact manual checklist. Stop for explicit authorization before any real IPFS upload, wallet action, merge, production promotion, or deploy. Preserve `.browser-test-runtime/` and all excluded user-owned files.

### Begin supervised Alpha later

> Read the continuation documents and confirm Task 6 is `[x]` for the exact live release commit. Do not invite anyone yet. Prepare a read-only Task 7 launch packet for an initial 3-5 known testers: supported environment, suggested journey, permanence warning, private support path, ambiguous-transaction warning, observation ledger, stop conditions, and expansion criteria. Wait for my explicit authorization before sending invitations or changing external state.

## 17. Definition of the travel checkpoint

The travel checkpoint is successful when:

- both branches are available remotely;
- a fresh laptop clone can reproduce their tracked contents;
- the new chat reads these documents before acting;
- local-only assets are not mistaken for missing production dependencies;
- Task 5 resumes at preview acceptance rather than being reimplemented;
- Task 6 does not certify an obsolete branch;
- no one deploys, publishes, signs, uploads, merges, deletes, or widens budgets by assumption.
