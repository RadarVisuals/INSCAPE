# INSCAPE pre-alpha release-hardening execution plan

Status: `[ ]` not started

Document authority: this is the sole execution plan for the bounded work between the completed Alpha product phases and the first external, invite-only Alpha. It does not reopen MODUL-8R Tasks 1-9, authorize Phase 10, or turn experimental prototypes into production features.

## 1. Outcome

Produce one clean, reproducible, security-hardened INSCAPE release candidate that is safe enough for a supervised external Alpha with 5-15 known Universal Profile users.

The product is already feature-complete enough for that Alpha. This plan is release engineering, trust hardening, operational visibility, and release-gate stabilization. It is not another product-building phase.

The first cohort must have:

- desktop Chrome or Edge as the supported owner-authoring environment;
- mobile treated primarily as a visitor experience;
- one controlled published test profile per participant;
- an explicit warning that public IPFS publication is public and effectively permanent;
- a support path and a short issue template;
- a known application rollback target;
- no promise that published documents themselves can be rolled back or deleted.

## 2. Current evidence baseline

This section records the 2026-08-03 readiness-audit evidence. It is historical input, not permanent truth. Every affected claim must be reverified by the task that owns it.

- Product and feature readiness is approximately 85-90 percent for a closed Alpha.
- The canonical owner-to-visitor journey exists: authority resolution, asset discovery, nine-table authoring, Preview, canonical Version 8 serialization, public IPFS upload, wallet publication, resolution, direct visit, and iframe visit.
- The audit's complete Node suite passed 1,036/1,036.
- The production build, production bundle gate, owner-runtime isolation, and `git diff --check` passed.
- The modernized published-visitor browser suite passed 12/12 after an initial cold-Vite navigation timeout.
- The long real-App owner browser journey navigated successfully for several minutes, then lost its Theme select after an unexpected navigation/reload near `browser-tests/owner-lattice-navigation.browser.mjs:335`. It did not establish whether the cause was production behavior, Vite/HMR, or harness lifecycle.
- The real-App owner-profile routing harness has also historically reproduced an owner A-to-B timing failure.
- `netlify.toml` has build, function, and SPA redirect configuration but no explicit production response-header policy.
- The two source files below exist in `public/`, are copied to the deployed artifact, and contain local editor/workstation information:
  - `public/assets/actors/abyssal_eye/full multi eye purple.afdesign~lock~`
  - `public/assets/actors/skull_reaper/position.afdesign~lock~`
- `npm audit --omit=dev` reported 3 critical, 15 high, 53 moderate, and 10 low advisories, with much of the serious-looking chain reported beneath `@lukso/up-modal` and older Truffle/Web3 dependencies. Advisory count alone does not establish runtime exploitability.
- The audited production budgets were almost exhausted, but budget utilization is not itself a user-performance measurement.
- The worktree contained active, unrelated Startveil, branding, review-image, and procedural-organism prototype work. Those files are user-owned and outside this plan.

Do not preserve the numeric test counts as assertions. Tests can be added or removed legitimately. Preserve zero unexpected failures and the semantic gates instead.

## 3. Required reading for a context-free Codex window

Before implementing any task, read this entire document and then only the sources named by the authorized task. The following documents define the release boundary:

1. `docs/INSCAPE_VISION_AND_ART_DIRECTION.md`
2. `docs/PHASE_1C2F_PUBLISHED_CONTENT_SECURITY.md`
3. `docs/PHASE_1C2G_PROVIDER_LIFECYCLE_AND_PUBLICATION_ERRORS.md`
4. `docs/NETLIFY_PUBLIC_IPFS_PUBLICATION.md`
5. `docs/art-direction/INSCAPE_ALPHA_EXECUTION_ROADMAP.md`, especially the current status and Phase 10 boundary
6. `docs/art-direction/INSCAPE_MODUL8R_ROADMAP_AND_BOUNDARY.md`, especially the accepted Task 8-9, placement-presentation, test-maintenance, and published-visitor-harness checkpoints

Relevant implementation authorities include:

- `netlify.toml`
- `scripts/productionBuild.js`
- `scripts/productionBuild.test.js`
- `scripts/checkProductionBuild.js`
- `scripts/ownerRuntimeIsolation.js`
- `src/public/ownerRuntimeSelected.js`
- `src/diagnostics.js`
- `browser-tests/browser-test-lifecycle.mjs`
- `browser-tests/playwright-browser-adapter.mjs`
- `browser-tests/published-visitor.browser.mjs`
- `browser-tests/owner-lattice-navigation.browser.mjs`
- `browser-tests/owner-profile-routing.browser.mjs`
- `package.json`
- `package-lock.json`

Read additional production files only when a task requires them. Do not perform a broad cleanup or reinterpret the product architecture.

## 4. Status and execution protocol

Status markers:

- `[ ]` not started
- `[~]` implemented or investigated, but awaiting required evidence or user acceptance
- `[x]` accepted and complete
- `[!]` blocked by a concrete unresolved decision or external condition

Rules for every Codex window:

1. Implement only the task number explicitly authorized by the user.
2. Do not start the next task, even when it appears small or convenient.
3. Begin with `git status --short`, current branch, and current HEAD. Treat every existing modification and untracked file as user-owned.
4. Never reset, delete, move, stage, commit, or absorb unrelated work.
5. If an authorized change overlaps existing user work, stop and report the exact overlap before editing.
6. Use focused tests during implementation. Run the full release matrix only in the task that explicitly requires it.
7. Do not deploy, alter production environment variables, rotate credentials, publish to IPFS, submit a wallet transaction, commit, or push without explicit user authorization.
8. Do not change canonical document schemas, storage keys, publication bytes, profile authority, wallet semantics, owner/visitor separation, runtime selection, or accepted product behavior unless this plan explicitly says so.
9. Keep development prototypes and prototype assets out of the production graph and release artifact. This plan does not authorize Startveil experiments, procedural organisms, Keeper experiments, branding work, or their promotion.
10. Do not use Phase 10 as an excuse to remove compatibility readers or broadly delete legacy code.
11. Record implementation evidence only in the checkpoint area for the authorized task. Do not append release-hardening history to the older product roadmaps.
12. Mark a task `[~]` when implementation is complete but deploy-preview, live, wallet, or user acceptance remains. Mark it `[x]` only when all stated exit criteria are met.

Every implementation handoff must report:

- task number and final status;
- root cause or decision;
- exact files changed;
- exact checks run and their results;
- checks intentionally not run;
- remaining manual or external acceptance;
- current branch, HEAD, staged state, and unrelated dirty files preserved;
- whether a commit, push, deploy, IPFS upload, or wallet action occurred.

## 5. Non-negotiable product and security invariants

- The selected production owner remains MODUL-8R through the accepted owner-runtime selection seam.
- Owner drafts, private tables, private placements, selection, session themes, window geometry, search, filters, and wallet/provider state never enter the public document.
- Preview and Visitor continue to derive from the same validated canonical public projection.
- Version 8 remains canonical; accepted Version 7 documents remain readable through the compatibility boundary.
- Existing published documents are never silently rewritten, migrated, republished, or deleted.
- Automated tests must never perform a real IPFS upload or wallet transaction.
- A real publication acceptance uses only a designated test profile and requires explicit user authorization immediately before the external action.
- No Pinata JWT, provider object, private session state, canonical document body, calldata, complete local-storage dump, or secret environment value may be logged or attached to an issue.
- Public Universal Profile embedding is intentional. Do not apply `X-Frame-Options: DENY` or `frame-ancestors 'none'` globally.
- Owner and wallet-capable surfaces require clickjacking protection. Public embed support must not weaken that boundary accidentally.
- Production response security must be delivered by HTTP headers. A meta tag is not an adequate substitute for `frame-ancestors`.
- Arbitrary published HTTPS images remain part of the current document contract. CSP image policy must respect that contract unless a separate authorized product migration changes it.
- The public IPFS endpoint remains same-origin, canonical-document-only, size-bounded, rate-limited, and server-secret-backed.
- Any new diagnostics must remain bounded, redacted, and unable to mutate application authority.

## 6. Release gates at a glance

| Gate | Required result before external Alpha |
| --- | --- |
| Source hygiene | No editor lock, temp, source-project, secret, or prototype-only artifact in the release output |
| Response security | Exact enforced production headers, intentional embed policy, and no CSP breakage in critical journeys |
| Dependency risk | Every critical/high production advisory explained, fixed, mitigated, proven unshipped, or explicitly accepted with rationale |
| Owner journey | Stable production-preview owner gates with no unexplained reload, detached control, cross-profile leak, or owned-process leak |
| Visitor journey | Canonical published visitor, direct route, iframe, security, narrow layout, and storage isolation green |
| Operations | Bounded diagnostics, user-visible recovery, support channel, issue template, privacy-conscious evidence collection |
| Release reproducibility | Exact commit, clean checkout, recorded environment names, deterministic build/checks, artifact identity, known rollback |
| Manual acceptance | Controlled end-to-end owner, Preview, publication, visitor, direct, iframe, and rollback acceptance |

## 7. Task 0 - Freeze the release boundary and establish a reproducible baseline

Status: `[x]`

### Objective

Identify the exact stable product checkpoint from which hardening will proceed, while preserving all experimental and user-owned work. Establish a release lane that can be reproduced without relying on the current dirty working directory.

### Required procedure

1. Record current branch, HEAD, upstream, `git status --short`, staged files, and untracked files.
2. Classify dirty paths without modifying them:
   - accepted production changes awaiting commit;
   - development-only prototypes;
   - branding/review assets;
   - generated test/runtime output;
   - unknown ownership requiring user decision.
3. Confirm the current production owner selector and the accepted MODUL-8R checkpoint.
4. Confirm all prototype routes are guarded by `import.meta.env.DEV` and are absent from the selected production graph. This is inspection only; prototype redesign is out of scope.
5. Propose one exact release-base commit. Do not create a branch, worktree, commit, stash, or clean checkout until the user authorizes that operation.
6. Once authorized, create the release lane using a non-destructive method that cannot absorb or discard the existing dirty work. Prefer a separate clean worktree or clean clone rooted at the approved commit.
7. Record the release-base commit, Node/npm versions, operating system, and required public environment-variable names. Record names only, never secret values.
8. Produce a baseline build and focused release evidence only after the release lane is clean and the user authorizes verification.

### Exit criteria

- One exact release-base commit is approved.
- Experimental Startveil, branding, review, and procedural-organism work remains preserved and excluded.
- The release lane reports no unexplained tracked or untracked files.
- Baseline environment names and tool versions are recorded.
- The current production selector, build, and owner/visitor graph match the accepted product checkpoint.
- No production deployment or publication occurred.

### Stop conditions

- The intended release base depends on uncommitted product changes.
- An untracked file under `public/` is required for the product but absent from the chosen commit.
- A prototype import or asset appears in the production output.
- The current branch/HEAD does not match the user's understanding.

### Task 0 checkpoint

2026-08-03 accepted baseline checkpoint (`[x]`):

- Original lane at authorization: branch `ui/creations-browser`, HEAD `6e449e332d9dc1f10a5f350a7c06456be5400081`, upstream `origin/ui/creations-browser`, ahead/behind `0/0`, with no staged files. The user approved that exact commit as the product release base.
- Release lane: the non-destructive sibling worktree `E:\VSCODE\INSCAPE-pre-alpha-release` uses branch `release/pre-alpha-hardening`, whose sole parent/base is `6e449e332d9dc1f10a5f350a7c06456be5400081` (`test: modernize published visitor browser harness`). Only this hardening plan was copied from the original worktree and committed as release-process documentation.
- Dirty-path classification: `src/main.jsx`, `src/prototypes/startveilCube/`, `src/prototypes/spider-keeper/`, and `browser-tests/startveil-cube.browser.mjs` are development-only prototype work; root `startveil-v3-*.png`, root `modul8r-*-review*.png`, `public/assets/inscape-*.png`, and `public/inscape-x-banner-composition.html` are branding/review assets; this plan is release-process documentation. No accepted production change awaiting commit, generated tracked/runtime output, or unknown-ownership path was identified. All remain unstaged and preserved.
- The uncommitted prototype routes and lazy imports in the original `src/main.jsx` are individually guarded by `import.meta.env.DEV`. The release base contains only the previously accepted prototype/development routes, also guarded by `import.meta.env.DEV`. The original untracked public branding assets are absent from the release lane and have no committed production reference; the four table-grid banners are additionally named in the existing production-build prune list.
- Production owner selection remains the accepted two-line seam in `src/public/ownerRuntimeSelected.js`: selection `MODUL8R` with `OwnerModul8rShell.jsx`. The accepted product checkpoint is Version 8 canonical with Version 7 compatibility, MODUL-8R Tasks 1-9 `[x]`, placement-presentation parity `[x]`, test maintenance `[x]`, and published-visitor harness maintenance `[x]`; Phase 10 remains unauthorized.
- Clean-lane host inventory: Node `v18.20.7`, npm `10.8.2`, Windows NT `10.0.22631.0`, AMD64. Required public deployment configuration name: `VITE_PROFILE_DOCUMENT_IPFS_GATEWAY_URL`. Optional public endpoint overrides are `VITE_IPFS_GATEWAY_URL`, `VITE_LUKSO_RPC_URL`, `VITE_LUKSO_RPC_FALLBACK_URLS`, `VITE_PROFILE_DOCUMENT_IPFS_GATEWAY_FALLBACK_URLS`, `VITE_LUKSO_INDEXER_URL`, `VITE_CHILLWHALES_INDEXER_URL`, and `VITE_LUKSO_WSS_RPC_URL`. Required server-only secret name: `PINATA_JWT`; no values were read or recorded. `npm ci` completed from the lockfile; it warned that the current Node patch level is below several transitive packages' declared engines, but the authorized build and focused checks completed successfully.
- Baseline verification: `npm run build` passed after transforming 6,364 modules; `npm run build:check` passed; and the focused production build, owner-runtime, MODUL-8R selector, public-boundary, public-access, and isolation matrix passed 40/40 with zero failures, cancellations, or skips. `git diff --check` passed.
- Production totals: initial JavaScript 1,240,851 raw / 362,760 gzip; owner JavaScript 274,107 / 82,281; standalone wallet JavaScript 3,943,745 / 1,042,227; core JavaScript 2,054,796 / 613,812; total JavaScript 5,998,541 / 1,656,039; initial CSS 113,237 / 19,985; owner CSS 69,159 / 12,957; public assets 14,821,539 raw; largest public asset 2,574,306 raw. All accepted production budgets passed.
- Graph and isolation evidence: the selected entry is `MODUL8R`; `OwnerModul8rShell` and its Library/Signals stores are lazy owner chunks; the generated owner graph reports `leaks: []`; the manifest contains the canonical lazy `VisitorLatticeWorld` entry; cold visitor tests never request the owner chunk or perform owner persistence; public projection tests exclude private records and workspace mutation authority. A production-artifact scan found zero prototype source/route/component markers and zero markers for the excluded untracked branding assets.
- The release worktree was clean after the documentation commit and remained free of unexplained tracked or untracked files after baseline verification; generated `node_modules/` and `dist/` remain ignored build/install output. No push, deploy, production environment change, IPFS upload, publication, or wallet action occurred. Task 1 was not started.

## 8. Task 1 - Remove public editor leakage and add permanent artifact hygiene guards

Status: `[~]`

Depends on: Task 0 release-base decision.

### Objective

Remove the two known Affinity lock files from public source and deployment output, then make equivalent accidental publication fail deterministically in future builds.

### Required procedure

1. Search the full repository and tracked history-visible worktree for editor lock/temp patterns, including at minimum:
   - `*~lock~*`
   - common swap/backup/temp suffixes;
   - platform metadata files;
   - design-source lock companions;
   - credential-looking filenames.
2. Inspect matches only far enough to classify them. Never print secret contents into logs.
3. Remove the two confirmed public Affinity lock files from the release source:
   - `public/assets/actors/abyssal_eye/full multi eye purple.afdesign~lock~`
   - `public/assets/actors/skull_reaper/position.afdesign~lock~`
4. Decide explicitly which design-source files are intentionally shipped. Do not delete source artwork merely because it is large or editable; this task concerns proven deployment leakage.
5. Extend the production build guard so prohibited editor/temp files cause a clear failure instead of relying only on an exact-path prune list.
6. Keep destructive pruning constrained to the already verified build output directory. Never recursively delete from `public/` through a computed broad path.
7. Add focused tests proving:
   - a representative lock/temp artifact is rejected;
   - ordinary intended assets remain accepted;
   - pruning cannot escape the verified output directory;
   - the two historical paths cannot survive in the production artifact.
8. Inspect the final artifact by filename and content markers. A filename-only scan is insufficient when a renamed lock file could retain the leaked metadata.
9. After an authorized deploy preview, request the two historical URLs. Prefer a true not-found response; if SPA fallback returns HTML, prove that the original lock bytes and workstation/editor metadata are no longer served.
10. After an authorized production deploy, repeat the same live check and record the result.

### Likely files

- the two exact files under `public/assets/actors/`
- `scripts/productionBuild.js`
- `scripts/productionBuild.test.js`
- this plan's Task 1 checkpoint only

Do not modify unrelated assets or raise public-asset budgets to make the task pass.

### Exit criteria

- Both known lock files are absent from source and release output.
- No equivalent prohibited editor/temp file is present in the release artifact.
- A future prohibited artifact fails with an actionable build error.
- Build-output safety constraints remain intact.
- Deploy-preview and live historical URLs no longer disclose the original data.

### Task 1 checkpoint

2026-08-04 implementation checkpoint (`[~]`):

- Root cause and source decision: two tracked Affinity lock companions under `public/assets/actors/` exposed editor/workstation metadata because the production build copied them without a generic artifact-hygiene gate. Both lock companions were removed. No editable design source is intentionally shipped in the final artifact: the corresponding `full multi eye purple.afdesign` and `position.afdesign` source-artwork files remain intentionally retained in the repository and on the existing exact-path production prune list; no unrelated public asset was modified and public-asset budgets were not raised.
- Repository, history-filename, and non-ignored worktree scans covered `*~lock~*`, common swap/backup/temp suffixes, platform metadata, design-lock companions, and credential-looking filenames without printing candidate contents. The only classified matches were the two removed lock files and the safe `.env.example` configuration-name template. No non-ignored untracked match was present.
- `scripts/productionBuild.js` now fails the production build with artifact paths and actionable classifications for prohibited editor lock, swap, backup, temporary, platform-metadata, and credential-looking filenames. It also rejects the exact SHA-256 content fingerprints of both historical leaks even after renaming, without retaining or logging their contents. The guard runs before and after authoring-asset pruning. Prune targets are resolved beneath the already validated build output and fail before deletion if a path escapes it.
- Focused verification: `node --test scripts/productionBuild.test.js` passed 13/13 with zero failures, cancellations, skips, or todos, including representative rejection, ordinary intended-asset acceptance, output-escape rejection, both historical paths, and the alternate-output production build. A separate historical-blob check reconstructed both HEAD blobs only in a temporary directory and proved 2/2 were rejected under neutral `.bin` names by content fingerprint.
- Production verification: `npm run build` passed after transforming 6,364 modules and the new pre/post-prune guard passed. `npm run build:check` passed (`1,240,851` initial JavaScript bytes); its first sandboxed attempt was blocked by a Windows user-profile `EPERM`, then the unchanged read-only check passed with the required filesystem permission. Final totals remained within the accepted budgets: total JavaScript `5,998,541` raw / `1,656,039` gzip; public assets `14,821,307` raw; largest public asset `2,574,306` raw. Final artifact inspection reported zero prohibited filename or content-fingerprint findings, all four historical source/output path checks were absent, both intended design sources were present, and `git diff --check` passed.
- External acceptance remains pending: no deploy preview or production deploy was authorized, so the two historical URLs have not been requested against preview or live. Task 1 remains `[~]` until both deployed-response checks prove the original bytes and editor/workstation metadata are not served. No commit, push, deploy, IPFS upload, publication, wallet action, environment change, or Task 2 work occurred.

## 9. Task 2 - Install route-aware production response security

Status: `[~]`

Depends on: Task 0. Task 1 may run before or in parallel only in separate, non-overlapping work explicitly authorized by the user.

### Objective

Deliver production HTTP security headers that protect owner/wallet use, preserve intended Universal Profile embedding and public media, and are verified against real deploy-preview responses and critical browser journeys.

### Source authority

Use `docs/PHASE_1C2F_PUBLISHED_CONTENT_SECURITY.md` as the starting contract. Bracketed origins in that document are placeholders and must never be copied literally.

### Required procedure

#### 2.1 Build an exact route and origin inventory

1. Classify the deployed surfaces:
   - ordinary Startveil/application entry;
   - owner and wallet-capable workspace;
   - canonical published Visitor;
   - direct-profile visit;
   - intentional iframe/UP mini-app route;
   - Netlify publication function.
2. Determine whether Netlify can apply distinct header policies to the actual route patterns after SPA fallback. Do not assume browser-side routing creates a server-side security boundary.
3. Inventory every production network origin from code and deployed environment names:
   - primary and fallback LUKSO RPC endpoints;
   - WebSocket RPC endpoints;
   - owner indexer/Envio/Chillwhales endpoints actually used;
   - profile-document and media IPFS gateways, including fallbacks;
   - wallet/modal/relay endpoints actually reached;
   - Google Fonts origins if fonts remain remote;
   - intended Universal Profile parent origins;
   - same-origin Netlify Functions;
   - any deliberate blob download behavior.
4. Search for `fetch`, WebSocket, iframe, worker, blob/data URL, dynamic script, external font, image, audio, and video behavior. Classify actual production reachability instead of blindly allowlisting every source reference.

#### 2.2 Define the policy

The final enforced response set must include at minimum:

- `Content-Security-Policy`
- `Referrer-Policy: no-referrer`, unless a separately documented accepted policy supersedes the existing security contract
- `Permissions-Policy` disabling unused powerful features
- `X-Content-Type-Options: nosniff`

The CSP must explicitly address:

- `default-src`
- `base-uri`
- `object-src`
- `script-src`
- `style-src`
- `font-src`
- `img-src`
- `connect-src`
- `worker-src`
- `frame-src`
- `frame-ancestors`
- `form-action`
- `manifest-src`

Constraints:

- Do not add `unsafe-eval` to production.
- Retain `unsafe-inline` for styles only if current React/style behavior proves it necessary and record why.
- Do not allow `*` for `connect-src` or `frame-ancestors`.
- Do not globally deny framing while intentional UP embedding exists.
- Do not globally permit arbitrary framing merely to keep embeds working.
- Do not narrow `img-src` below the accepted arbitrary-HTTPS published-image contract without a separate migration.
- Do not add COOP, COEP, CORP, HSTS, or an X-Frame-Options policy casually. Each can affect wallet popups, cross-origin images, embeds, subresources, or deployment ownership and requires explicit evidence.
- Separate development/HMR policy from production. Development needs must never weaken production headers.

#### 2.3 Implement and validate safely

1. Add the policy in Netlify response configuration, not only HTML meta tags.
2. Add focused configuration tests that fail on missing mandatory directives, unresolved placeholders, wildcard framing, accidental global frame denial, or known required production origins omitted from the intended inventory.
3. Use a deploy preview for the first browser validation.
4. If practical, begin the preview with `Content-Security-Policy-Report-Only`; collect browser console/CDP violations without sending sensitive report bodies to an unapproved third party.
5. Exercise the complete critical preview matrix under the candidate policy:
   - Startveil and application entry;
   - owner authority transition;
   - MODUL-8R and Theme;
   - asset thumbnails and externally hosted published media;
   - Preview;
   - publication preparation and same-origin function boundary without an unapproved real upload;
   - wallet modal/provider initialization without an unapproved transaction;
   - published Visitor;
   - direct profile;
   - intended iframe/UP parent;
   - owner-only canonical-document blob download if retained.
6. Resolve violations by proving the required origin or feature. Do not broaden directives just to silence errors.
7. Switch the accepted policy to enforced mode on a new preview and repeat the matrix.
8. Inspect response headers for HTML routes, hashed assets, missing assets, and the publication function. Also verify appropriate HTML revalidation and long-lived immutable caching for content-hashed assets without treating published profile documents as build assets.
9. Production deployment requires separate user authorization. Verify live headers after deployment.

### Exit criteria

- All mandatory headers arrive in real HTTP responses.
- CSP contains no placeholders or unjustified wildcard authority.
- Owner/wallet surfaces have an accepted anti-framing boundary.
- Intended public/UP embedding still works from approved parents.
- Critical RPC, gateway, indexer, font, image, wallet, Preview, Visitor, and publication-preparation behavior works under enforced CSP.
- Development requirements have not weakened production policy.
- Deploy-preview evidence is complete; live evidence is required before `[x]`.

### Stop conditions

- Owner and public embed surfaces cannot receive distinct protection with the current deployment topology.
- Intended UP parent origins cannot be established authoritatively.
- A required wallet or media origin is dynamic and cannot be safely bounded.
- Enforcing the policy would require a product architecture or publication-contract change.

### Task 2 checkpoint

2026-08-04 bounded local implementation checkpoint (`[~]`; deploy-preview and live evidence outstanding):

- Route/topology inventory: Startveil, ordinary public entry, Preview, owner/MODUL-8R, Theme, direct-profile (`view`), and standalone application mode (`mode`) are browser-selected states or query parameters on the same SPA `index.html`; embedded mode is selected by `window.parent !== window`. Netlify static header matching is path-based and the `/* -> /index.html` rewrite does not turn those client states into separate server response boundaries. `/api/profile-publications` is a distinct Netlify Function response, and emitted/static assets are distinct file paths. The HTML policy therefore admits only the trusted UP parent boundary rather than pretending query-selected owner and Visitor modes have different CDN responses: `frame-ancestors 'self' https://universaleverything.io`. Official LUKSO Mini-App documentation identifies `universaleverything.io` as the Grid parent; arbitrary framing remains denied. The publication Function independently uses `frame-ancestors 'none'` because it is JSON and is not part of the embed flow.
- Production origin inventory: repository authorities contribute the configured/default LUKSO HTTPS RPC and comma/newline-separated fallbacks, `wss://` event RPC, Envio/LUKSO and Chillwhales indexers, media and profile-document IPFS gateways and profile gateway fallbacks, plus the hard-coded wallet metadata RPC/gateway. The locked standalone wallet graph contributes only its retained WalletConnect services: `api.web3modal.org`, `echo.walletconnect.com`, `explorer-api.walletconnect.com`, `pulse.walletconnect.org`, `rpc.walletconnect.org`, `verify.walletconnect.com`, `verify.walletconnect.org`, and `wss://relay.walletconnect.org`. Same-origin covers `/api/profile-publications`. Published images retain arbitrary `https:`; `data:` is retained for the wallet QR image. Owner canonical-document export is a downloaded blob URL and adds no network origin. Fonts are self-hosted, application scripts are same-origin, no child iframe is created by the enabled wallet configuration, and no application worker is created. Google Fonts, Pinata upload (server-side only), explorer/navigation links, package metadata URLs, test-only URLs, disabled embedded-wallet endpoints, and unused chain catalog endpoints are not allowlisted.
- Build-time policy generation validates and reduces every supported public endpoint value to an exact HTTPS/WSS origin, rejects credentials, insecure schemes, wildcard hosts, and `.example` placeholders, deduplicates origins, and writes Netlify's deployed `dist/_headers`. This avoids committing deploy-specific public endpoint values or copying placeholders. The manifest enumerates exact content-hashed JS/CSS/emitted assets for `public, max-age=31536000, immutable`; `/` and `/index.html` use revalidation. Netlify's documented default for other static responses remains `public, max-age=0, must-revalidate`. The Function returns `no-store` and its own restrictive security headers because Netlify static custom headers do not apply to Functions.
- Enforced HTML CSP: `default-src 'self'; base-uri 'none'; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' https: data:; connect-src 'self' <validated exact production origins>; worker-src 'none'; frame-src 'none'; frame-ancestors 'self' https://universaleverything.io; form-action 'self'; manifest-src 'self'; upgrade-insecure-requests`. Inline style remains necessary for current React style attributes and bundled wallet/Web Component styling; scripts receive neither `unsafe-inline` nor `unsafe-eval`. The other global response headers are `Referrer-Policy: no-referrer`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`, and `X-Content-Type-Options: nosniff`. No X-Frame-Options, COOP, COEP, CORP, or HSTS was added.
- Files changed: `scripts/productionSecurityPolicy.js`, `scripts/productionSecurityPolicy.test.js`, `scripts/productionBuild.js`, `scripts/productionBuild.test.js`, `vite.config.js`, `netlify/functions/pin-profile-document.mjs`, `scripts/pin-profile-document-function.test.mjs`, and this Task 2 checkpoint. Vite development/HMR remains unchanged; only built production preview receives the candidate enforced policy locally.
- Focused verification: the security-policy, Function, production-build, standalone-wallet, provider lifecycle, profile-target, upload-client, published-media, LUKSO RPC repository, and activity/indexer matrix passed 56/56 with zero failures/cancellations/skips. `npm run build` passed after 6,364 modules; the generated `_headers` contains every mandatory directive/header, no placeholder, `unsafe-eval`, wildcard `connect-src`/`frame-ancestors`, global frame denial, or X-Frame-Options. `npm run build:check` passed at 1,240,851 initial JavaScript bytes, and `git diff --check` passed. Local production-preview responses for `/`, `/?mode=atelier`, a hashed entry asset, and a missing asset all returned the enforced CSP and mandatory headers; HTML revalidated. Immutable caching is generated for exact manifest files and awaits real Netlify response confirmation.
- Browser verification: the first published-Visitor Edge run reproduced the documented cold-Vite pre-mount navigation timeout, cancelled 12 cases, and completed owned-process/runtime cleanup. The immediate warmed rerun passed 12/12 with zero failures/cancellations/skips, covering canonical Visitor, directory/return, focus viewer, provider lifecycle, navigation, HTTPS/IPFS media and no-referrer behavior, an actual CSP response blocking disallowed media, narrow accessibility, owner-storage isolation, and graceful cleanup with no remaining PIDs. No real upload, wallet prompt, or transaction occurred.
- Remaining deploy-preview acceptance: verify actual Netlify headers and cache behavior on entry/owner/Visitor/direct/iframe HTML, exact hashed assets, missing assets, and the Function; capture CSP console/CDP evidence for owner authority, MODUL-8R/Theme, external thumbnails/media, Preview, publication preparation and same-origin Function boundary without upload, standalone/embedded provider and wallet modal initialization without a transaction, published Visitor, direct profile, intended `https://universaleverything.io` iframe hosting, and retained blob download. The same authorized preview can close Task 1's two historical lock-file URL checks. A later production deployment and live header/embed verification remain separately authorized requirements before Task 2 can become `[x]`.
- State at this checkpoint: branch `release/pre-alpha-hardening`, pre-edit HEAD `98d09fbcdb9b74f12edc058b7fdb3ca24fc1dc9e`; Task 2 files are intentionally unstaged and no unrelated dirty file exists. No commit, push, deploy, environment-variable change, IPFS upload, publication, or wallet action occurred. Task 3 was not started.

## 10. Task 3 - Triage production dependency advisories by reachability and impact

Status: `[ ]`

Depends on: Task 0.

### Objective

Replace the raw advisory count with an evidence-backed production risk register, apply safe upgrades where available, and leave no unexplained critical or high advisory before inviting wallet-connected users.

### Required procedure

1. Capture dated outputs from:
   - `npm audit --omit=dev --json`;
   - `npm ls` for each critical/high dependency chain;
   - the exact installed versions in `package-lock.json`.
2. Consult current primary sources for each critical/high advisory: official package releases, maintainers' advisories, GitHub Security Advisories, or NVD/CVE records. Do not rely only on npm's summary text.
3. Classify every critical/high chain:
   - shipped and runtime reachable in the browser;
   - shipped but not reachable through INSCAPE's use;
   - Node/build-time only;
   - optional/platform branch absent from the selected production graph;
   - false positive or disputed, with source;
   - fixed by a compatible update;
   - no safe upstream fix, requiring mitigation or temporary acceptance.
4. Pay special attention to `@lukso/up-modal`, old Truffle/Web3 dependencies, `request`, old `form-data`, `tar`, `web3-provider-engine`, and old `ws` chains reported by the audit.
5. Inspect the production manifest/output and bundler graph. Package presence in `package-lock.json` is not proof that vulnerable code ships; absence of a readable package name in minified output is not by itself proof that it does not.
6. Prefer current compatible direct-dependency upgrades and upstream-supported paths.
7. Never run `npm audit fix --force`, never downgrade `@lukso/up-modal` merely because npm suggests it, and never add an override/resolution solely to hide an advisory.
8. Make dependency changes in small groups with focused wallet/provider/modal tests, then production build, bundle/isolation checks, and relevant browser smoke coverage.
9. Re-run the audit and compare exact remaining chains.
10. For every remaining critical/high advisory, record package, path, affected surface, reachability evidence, mitigation, decision owner, acceptance date, and review trigger.

### Risk acceptance standard

An advisory may remain for the invite-only Alpha only when all of the following are true:

- there is no safe supported upgrade;
- the affected path is proven unshipped, unreachable, or materially mitigated;
- wallet authority, secret handling, canonical publication, and remote-content boundaries are not weakened;
- the remaining risk and revisit trigger are written down;
- the user explicitly accepts the residual risk.

Moderate/low findings must be summarized and grouped, not ignored, but they do not automatically block the small supervised Alpha.

### Exit criteria

- No critical/high production advisory remains unexplained.
- Safe supported upgrades are applied and regression-checked.
- No forced downgrade or graph-breaking automatic fix was used.
- Residual risks have explicit rationale and user acceptance.
- Wallet/provider behavior and production graphs remain correct.

### Task 3 checkpoint and risk register

Record dated advisory totals and one row per remaining critical/high chain here when authorized.

| Package/advisory | Dependency path | Shipped/reachable | Decision and mitigation | Review trigger | Accepted by/date |
| --- | --- | --- | --- | --- | --- |
| _Pending_ | | | | | |

## 11. Task 4 - Replace the fragile owner mega-journey with dependable production-preview gates

Status: `[ ]`

Depends on: Task 0. Task 2 candidate headers should be included before final acceptance so the gate validates the intended release environment.

### Objective

Determine whether the reported Theme-selection reload is a product defect or harness/Vite artifact, then create short, semantic, repeatable owner release gates against a production preview.

### Required investigation

1. Read the browser lifecycle adapter and the complete owner navigation/routing harnesses before editing.
2. Reproduce the failure with timestamped lifecycle evidence:
   - page URL and navigation events;
   - page close/crash/reload events;
   - console and page errors;
   - selected profile and owner runtime readiness;
   - selector attachment before Theme interaction;
   - test-owned server/browser lifecycle.
3. Run the same semantic Theme action against:
   - Vite development only as a diagnostic;
   - the built production preview as the release authority.
4. Do not increase timeouts until the underlying wait condition and lifecycle are understood.
5. Do not classify a detached element as an application bug without proving what navigated or remounted the page.

### Required gate structure

Replace or supplement the single eight-minute journey with bounded independent journeys that each own setup and cleanup:

1. **Entry and authority**
   - Startveil entry;
   - fixture/provider readiness;
   - correct owner profile and MODUL-8R mount;
   - fail-closed unsupported or mismatched authority.
2. **Authoring persistence**
   - Library readiness;
   - ARRANGE-gated placement;
   - move/resize and one presentation edit;
   - reload/remount;
   - exact persistence with no duplicate placement.
3. **Theme and Settings**
   - open Settings through the accepted MODUL-8R path;
   - exercise representative and all-theme coverage as appropriate;
   - no navigation/reload;
   - focus/Escape/close restoration.
4. **Profile isolation**
   - owner profile A to profile B;
   - no A draft, selection, table, asset, Theme session, or publication state leaking into B;
   - return behavior remains explicit.
5. **Preview and publication preparation**
   - exact Preview projection;
   - private state absent;
   - publication preparation/canonical snapshot enabled only when valid;
   - no automated IPFS upload or wallet transaction.
6. **Cleanup contract**
   - zero test-owned Vite/preview/Edge processes after every pass or failure;
   - no manual deletion of protected runtime directories;
   - actionable diagnostics on timeout.

Use semantic roles, labels, state markers, and contract-level readiness. Avoid styling selectors and fixed sleeps where an authoritative readiness signal exists.

### Stability criterion

- Each production-preview gate passes three consecutive clean runs.
- At least one sequence begins from a cold production preview.
- No run has unexplained navigation, cancellation, skip, browser crash, detached control, or lingering owned process.
- Published Visitor remains independently green; do not merge owner and visitor into another mega-test.

### Exit criteria

- The Theme failure has an evidence-backed classification and resolution.
- Owner A-to-B isolation is dependable.
- Critical owner journeys are bounded and independently diagnosable.
- Production preview, not HMR behavior, is the release authority.
- All owned processes clean up on success and failure.

### Task 4 checkpoint

Record root cause, gate files, three-run evidence, cold-run evidence, and process cleanup here.

## 12. Task 5 - Add minimum viable Alpha observability, recovery guidance, and support intake

Status: `[ ]`

Depends on: Task 0. May be designed while Tasks 1-4 run, but production instrumentation requires separate authorization.

### Objective

Make real-user failures discoverable and actionable without collecting secrets or building a large analytics platform.

### Required design decisions before implementation

1. Define the events that matter for the first Alpha:
   - owner authority/provider initialization failure;
   - asset discovery failure by provider class;
   - Preview validation failure;
   - IPFS upload failure;
   - CID verification failure;
   - wallet rejection versus wallet/provider error;
   - submitted transaction timeout/revert/replacement;
   - post-publication resolver mismatch/failure;
   - published-document invalid/unavailable/media failure;
   - unexpected application error boundary.
2. Reuse existing bounded error classes and visible error codes where possible. Do not create a second publication error taxonomy.
3. Decide whether the first cohort uses:
   - local bounded diagnostics plus manual issue submission;
   - a privacy-conscious remote error service;
   - or both.
4. Any remote service, account, data retention, source-map upload, external message, or production token requires explicit user approval.

### Data minimization

Allowed only when needed and documented:

- application version/commit;
- route class, not full sensitive URL;
- browser family/version and viewport class;
- bounded public profile address or user-supplied profile address;
- normalized error class/code;
- operation phase and provider category;
- transaction hash only after submission and only when necessary for support.

Never collect automatically:

- wallet provider objects;
- controller addresses inferred as private authority;
- JWTs, environment values, signatures, calldata, or canonical document bytes;
- full local storage/session storage;
- private tables, placements, search terms, People queries, or unpublished metadata;
- arbitrary console logs or screenshots without user review.

### Required user-facing support package

1. A visible or clearly documented Alpha feedback channel.
2. A short issue template requesting:
   - public profile address;
   - browser and operating system;
   - action attempted;
   - visible error code and message;
   - whether a wallet prompt appeared;
   - transaction hash only if one was returned;
   - screenshot only after checking it for private information.
3. A concise Alpha notice covering:
   - invite-only experimental status;
   - desktop authoring support boundary;
   - public/permanent IPFS publication;
   - how to stop and ask for help before retrying an ambiguous wallet action;
   - security/support contact.
4. Recovery guidance that distinguishes pre-hash retry from post-hash investigation and never encourages duplicate publication transactions.

### Exit criteria

- A publication/resolver failure can be classified without asking the tester for a console dump.
- User-visible errors retain bounded recovery guidance.
- Support intake gathers enough evidence without gathering secrets.
- Any remote monitoring is explicitly approved, documented, redacted, and tested.
- The release commit/version is visible in support evidence.

### Task 5 checkpoint

Record the approved monitoring mode, collected fields, retention/recipient decision, support path, and manual acceptance here.

## 13. Task 6 - Build and certify the exact release candidate

Status: `[ ]`

Depends on: Tasks 1-5 implemented; deploy-preview portions of Tasks 1, 2, and 4 complete.

### Objective

Produce and certify one exact artifact from one exact clean commit. No code or dependency changes are allowed after certification without creating a new candidate and repeating affected gates.

### Release-candidate preparation

1. Start from the approved clean release lane, not the active experimental worktree.
2. Record:
   - branch and exact commit;
   - clean `git status`;
   - Node/npm versions;
   - lockfile hash;
   - names of required deployment environment variables;
   - production runtime selector;
   - previous known-good deployment/commit for rollback.
3. Install dependencies using the repository's lockfile-preserving CI method. Do not regenerate the lockfile implicitly.
4. Build exactly once for the candidate, then record artifact and report hashes. Rebuilds after source/environment changes create a new candidate.
5. Confirm no secret value is present in generated HTML, JavaScript, CSS, source maps, reports, or public files.

### Automatic certification matrix

Run sequentially unless a test explicitly owns isolated parallelism:

1. focused tests for Tasks 1-5;
2. complete Node suite with zero unexpected failures, cancellations, or skips;
3. `npm run build`;
4. `npm run build:check`;
5. production owner-runtime isolation and forbidden-marker scans;
6. `git diff --check`;
7. published Visitor browser suite;
8. direct-profile and iframe browser coverage;
9. the new bounded owner production-preview gates;
10. owned-process and temporary-runtime cleanup verification.

Do not declare success merely because failures are described as pre-existing. Every release-candidate failure must be fixed, removed as an explicitly obsolete assertion with replacement coverage, or accepted by the user with evidence that it cannot reach the release. The preferred release result is fully green.

### Manual acceptance matrix

Against the exact deploy preview:

1. Enter through Startveil.
2. Connect through the supported Universal Profile owner environment.
3. Confirm exact owner identity and fail-closed mismatched profile behavior.
4. Open all MODUL-8R modules.
5. Exercise Theme and Settings.
6. Discover/select an asset and place it with ARRANGE.
7. Move, resize, layer, and edit frame/mat/backing/transparency.
8. Reload and confirm exact persistence.
9. Preview and confirm private state is absent.
10. Prepare the canonical publication snapshot.
11. With explicit authorization and the designated test profile only, perform one real IPFS upload, CID verification, wallet publication, receipt confirmation, and resolver read-back.
12. Open the published visitor as an ordinary visitor.
13. Verify direct profile, intended iframe/UP embedding, narrow visitor layout, external media behavior, viewer, and navigation.
14. Verify response headers on owner, visitor, embed, assets, missing files, and function responses.
15. Verify the two historical lock URLs disclose no original data.
16. Exercise the documented application rollback on a preview/staging boundary. Do not mutate or claim rollback of the published document.

### Exit criteria

- All automatic gates are green and tied to the exact candidate commit/artifact.
- Manual acceptance is complete.
- Security headers are enforced on the preview and verified.
- One controlled publication round trip succeeds without duplicate wallet submission.
- Rollback is documented and demonstrated safely.
- No prototype or user-owned untracked asset entered the artifact.
- User explicitly authorizes promotion of this exact candidate.

### Task 6 checkpoint

Record the exact commit, artifact/report hashes, build totals, automatic matrix, manual matrix, preview URL, publication test identity, and rollback target here. Do not record secrets or canonical document contents.

## 14. Task 7 - Launch and operate the supervised Alpha

Status: `[ ]`

Depends on: Task 6 `[x]` and explicit user authorization to invite external testers.

### Objective

Learn from real use without turning a small Alpha into an uncontrolled public launch.

### Cohort procedure

1. Begin with 3-5 known testers for the first observation window.
2. Give each tester:
   - the supported browser/device boundary;
   - the IPFS permanence warning;
   - one suggested owner journey;
   - the feedback/support link;
   - instructions not to repeat an ambiguous wallet action when a transaction hash may exist.
3. Ask each participant to create or use one intentional published test profile.
4. Review failures daily during the initial cohort:
   - provider/authority initialization;
   - asset discovery latency/failure;
   - publication preparation/upload/verification;
   - wallet rejection/error/timeout;
   - resolver and media failures;
   - direct/iframe visitor failures;
   - usability blockers and misunderstood permanence.
5. Fix release blockers in a new release candidate. Do not patch production without repeating affected Task 6 gates.
6. Expand toward 10-15 only after the first cohort completes critical journeys without a stop condition.

### Immediate stop conditions

Pause invitations and assess rollback if any of the following occurs:

- owner authority is granted to the wrong profile/account;
- private draft state appears in Preview, publication, or Visitor;
- profile A data appears in profile B;
- canonical bytes, CID, transaction, and resolved document disagree;
- the application encourages or performs a duplicate ambiguous wallet transaction;
- security headers break the supported wallet or embed boundary;
- repeated publication/resolver failures affect more than an isolated provider incident;
- deployed source/temp files expose personal or secret information;
- data loss or unrecoverable owner-draft corruption is observed.

Application rollback restores the last known application deployment only. It does not erase IPFS content or rewrite on-chain profile references. Communicate that distinction explicitly.

### Exit criteria

- 5-15 invited testers have a documented support path.
- Critical owner/publication/visitor failures are visible and classified.
- No stop condition remains active.
- Findings are prioritized from observed user impact rather than speculative feature work.
- A separate decision is made about wider Alpha access.

### Task 7 checkpoint

Record cohort size, supported environment, release commit, observation period, aggregate failure classes, stop/continue decision, and follow-up priorities. Do not place participant secrets or private profile information in this document.

## 15. Work explicitly deferred beyond the first supervised Alpha

The following work remains separate unless real Alpha evidence promotes it:

- Phase 10 broad legacy cleanup and documentation consolidation;
- removal of compatibility readers for already-published documents;
- large bundle-budget recalibration or cleanup without measured user impact;
- full mobile owner authoring;
- audio/video/media modules;
- production integration of experimental Startveil work;
- production integration or canonical naming of procedural organism/Crawler experiments;
- broad Keeper redesign;
- an open, self-service public Alpha;
- large analytics, personalization, or unrestricted AI behavior;
- architectural refactors performed only for aesthetic cleanliness.

Phase 10 may remove only proven-unreachable production code while preserving required legacy-document readers. It receives its own later authorization and must not be smuggled into Tasks 0-7.

## 16. Definition of ready for the first external Alpha

INSCAPE is ready for the first supervised external cohort only when every answer below is yes:

- Is there one exact clean release commit and reproducible artifact?
- Are editor/temp leaks removed and permanently guarded?
- Are production response headers enforced and compatible with intended owner and embed behavior?
- Is every critical/high production dependency advisory explained or safely resolved?
- Do bounded owner gates pass repeatedly against a production preview?
- Do published Visitor, direct-profile, iframe, security, narrow, and isolation journeys pass?
- Can a tester report a provider, publication, or resolver failure without sharing secrets?
- Is public/permanent IPFS publication explained before the action?
- Has one designated test profile completed the exact publication/read-back journey?
- Is the previous application deployment known and rollback understood?
- Has the user explicitly approved inviting the cohort?

If any answer is no, the product can remain feature-complete while the release candidate remains not ready. Do not reopen product scope to compensate for an unfinished release gate.

## 17. Reusable prompt for a new Codex window

Use this prompt with exactly one task number:

```text
Implement only Task [NUMBER] from:
docs/INSCAPE_PRE_ALPHA_RELEASE_HARDENING_PLAN.md

Read the entire plan first, then read only the additional sources required by that task. Treat the plan as the sole authority for pre-alpha hardening. Do not start later tasks, Phase 10, product features, Startveil work, Keeper/Crawler experiments, or broad cleanup.

Before editing:
1. Report current branch, HEAD, staged state, tracked modifications, and untracked files.
2. Restate the authorized task's objective, in-scope files, invariants, verification, external actions, and stop conditions.
3. Identify any overlap with existing user-owned work. Stop if overlap cannot be resolved safely.

During implementation:
- preserve unrelated tracked and untracked work;
- make the smallest complete production-safe change;
- use focused verification required by the task;
- do not deploy, publish to IPFS, invoke a wallet transaction, commit, or push without explicit authorization;
- do not run the next task.

At handoff, update only the authorized task's checkpoint in the plan and report all evidence required by its execution protocol. Leave the task [~] when deploy-preview, live, wallet, or user acceptance remains. Mark [x] only when every exit criterion is satisfied.
```
