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
- Clean-lane host inventory: Node `v18.20.7`, npm `10.8.2`, Windows NT `10.0.22631.0`, AMD64. Required public deployment configuration name: `VITE_PROFILE_DOCUMENT_IPFS_GATEWAY_URL`. Optional public endpoint overrides are `VITE_IPFS_GATEWAY_URL`, `VITE_IPFS_GATEWAY_FALLBACK_URLS`, `VITE_LUKSO_RPC_URL`, `VITE_LUKSO_RPC_FALLBACK_URLS`, `VITE_PROFILE_DOCUMENT_IPFS_GATEWAY_FALLBACK_URLS`, `VITE_LUKSO_INDEXER_URL`, `VITE_CHILLWHALES_INDEXER_URL`, and `VITE_LUKSO_WSS_RPC_URL`. Required server-only secret name: `PINATA_JWT`; no values were read or recorded. `npm ci` completed from the lockfile; it warned that the current Node patch level is below several transitive packages' declared engines, but the authorized build and focused checks completed successfully.
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

Status: `[x]`

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

2026-08-04 accepted read-only production dependency triage (`[x]`):

- Checkpoint and audit: branch `release/pre-alpha-hardening`, clean HEAD `1abdb90bf33b3e123f96d9322e1c82398ef2c3c3`. `npm audit --omit=dev --json` at `2026-08-04T10:38:50+02:00` reported exactly `3` critical, `15` high, `53` moderate, `10` low, `0` info, and `81` total advisories across `916` production, `127` optional, `9` peer, `66` development, and `1,060` total dependency records. The nonzero audit exit was the expected advisory result.
- Dependency and lock evidence: `npm ls --all --omit=dev` traced every critical/high installed path. Lockfile version 3 confirmed exact package versions, registry tarball resolutions, integrity records, and optional flags. The common installed legacy path is `@lukso/up-modal@0.21.11 -> @lukso/core@1.10.1 -> @lukso/lsp-smart-contracts@0.16.7 -> @lukso/lsp0-contracts@0.15.5 -> @erc725/smart-contracts@7.0.0 -> solidity-bytes-utils@0.8.0 -> @truffle/hdwallet-provider@2.1.15`. `solidity-bytes-utils` declares the provider as a runtime dependency but references it only from its Truffle configuration.
- Production reachability: `@lukso/up-modal` itself is shipped in the lazy standalone-wallet chunk, but the production bundle report attributed zero bytes to every critical/high package below. None appears in the Vite production module graph, owner graph, Netlify publication Function graph, or INSCAPE source/build imports. The Function imports only local canonicalization, validation, limit, CID, and response-policy modules. INSCAPE neither holds mnemonics/private keys nor initializes the legacy HD wallet, provider-engine, VM, BZZ/Swarm, request, multipart, archive, LevelDB, or old WebSocket paths.
- Optional branch: lock-only `axios@1.16.0` is reached through optional Coinbase/Base connector metadata. It is marked optional, is absent from `node_modules`, returns `(empty)` from `npm ls axios --all --omit=dev`, contributes zero bundle bytes, and is absent from browser, Function, wallet, and build execution graphs. The relevant high advisory is expressly limited to the Node HTTP adapter and does not establish browser impact.
- Upgrade decision: no current safe upstream-supported upgrade exists. `@lukso/up-modal@0.21.11` remains the stable `latest` release. The npm suggestion to use `0.10.0` is a prohibited semver-major downgrade. Patched leaf releases are outside exact or incompatible legacy parent constraints: `solidity-bytes-utils@0.8.4`, `secp256k1@4.0.4`, `semver@5.7.2`, `form-data@2.5.6`, and patched `tar`/`ws` lines cannot be selected safely without a parent release or an advisory-hiding override. `@coinbase/cdp-sdk@1.54.0` remains latest and pins `axios@1.16.0`. No dependency, package, lockfile, source, build, Function, or environment change was made.
- Moderate/low summary: the `53` moderate records group into propagated LUKSO contract-package findings, the same unshipped legacy Web3/request/ethers subtree, and the absent optional Coinbase/Axios branch. The `10` low records are `@ethersproject/abi`, `@ethersproject/abstract-provider`, `@ethersproject/abstract-signer`, `@ethersproject/hash`, `@ethersproject/signing-key`, `@ethersproject/transactions`, `@metamask/eth-sig-util`, `elliptic`, `ethereumjs-util`, and `web3-shh`; all lie in the proven unshipped legacy subtree.
- Acceptance: `RadarVisuals/user` accepted both residual-risk groups on `2026-08-04` for the invite-only, supervised Alpha only: (1) the absent optional Coinbase/Axios lock branch and (2) the installed but entirely unshipped and runtime-unreachable legacy Truffle/Web3 subtree under `@lukso/up-modal@0.21.11`. This acceptance rests on the absence of a safe upstream-supported upgrade, zero critical/high bytes in browser/Function/production artifacts, absence of private-key or mnemonic processing, non-initialization of all affected legacy paths, preservation of wallet authority and security/publication boundaries, and the prohibition on overrides, forced fixes, and downgrades.
- Acceptance expires and this triage must be repeated on any new `@lukso/up-modal`, `@lukso/core`, or relevant parent release; any wallet/provider or publication architecture change; any INSCAPE private-key or mnemonic processing; any legacy module gaining production-bundle bytes; installation or delivery of the optional Axios branch; or before expansion beyond the small supervised Alpha.
- Verification required for any future supported candidate: run focused embedded and standalone wallet/provider/modal/reconnect/disposal checks without a transaction; owner, Visitor, direct-profile, iframe, and isolation coverage; Pixi rendering and enforced-CSP coverage; publication Function canonicalization/boundary tests without upload; then `npm audit`, complete `npm ls`, exact lock review, production build, production bundle gate, owner-runtime isolation, module-group comparison, and all existing bundle budgets.
- **Deep-clean candidate revalidation (2026-08-28):** `npm audit --omit=dev --json` now reports `3` critical, `15` high, `54` moderate, `10` low, and `82` total advisories across `903` production dependency records. Direct versions remain `@lukso/up-modal@0.21.11`, `@lukso/up-provider@0.3.7`, and `@erc725/erc725.js@0.28.2`; no supported direct upgrade is available and npm still proposes the prohibited `@lukso/up-modal@0.10.0` downgrade. A fresh exact-identifier search found no `swarm-js`, `web3-bzz`, `web3-provider-engine`, `@truffle/hdwallet-provider`, `solidity-bytes-utils`, or bundled `node_modules/tar` path in `dist/assets` or the active `src`, `scripts`, and `browser-tests` sources. The accepted upstream-only exception therefore remains in force for the supervised Alpha; no forced fix, override, downgrade, package, or lockfile change was made.

| Package/advisory | Dependency path | Shipped/reachable | Decision and mitigation | Review trigger | Accepted by/date |
| --- | --- | --- | --- | --- | --- |
| `@truffle/hdwallet@0.1.4` high via vulnerable `secp256k1@4.0.3` ([GHSA-584q-6j8j-r5pm](https://github.com/advisories/GHSA-584q-6j8j-r5pm)) | Common legacy path -> `@truffle/hdwallet@0.1.4` -> `secp256k1@4.0.3` | Production-installed; zero artifact bytes; no browser, Function, build, or runtime path. Exploitation requires a resident private key and attacker-controlled ECDH public keys. | Temporarily accept as proven unshipped/unreachable. INSCAPE holds no private key; do not downgrade or override. | Any common acceptance-expiry trigger above, especially private-key handling or new parent release. | RadarVisuals/user, 2026-08-04 |
| `@truffle/hdwallet-provider@2.1.15` high through HD wallet, Web3, and provider-engine | Common legacy path | Production-installed; zero artifact bytes; never initialized. | Temporarily accept. Wallet authority remains with supported external EIP-1193/UP providers. | Any wallet/provider architecture change, new parent release, or nonzero bundle bytes. | RadarVisuals/user, 2026-08-04 |
| Optional `axios@1.16.0` high ([GHSA-gcfj-64vw-6mp9](https://github.com/advisories/GHSA-gcfj-64vw-6mp9)) | `@lukso/up-modal` -> `@wagmi/connectors`/Reown optional Base account -> `@coinbase/cdp-sdk@1.54.0` -> `axios@1.16.0` | Lock-only and optional; not installed, bundled, or executed. Advisory requires Node HTTP adapter, prototype pollution, a cloning interceptor, and an outgoing request without a safe own proxy value. | Temporarily accept as absent optional branch; no browser impact established and no Function path exists. | Axios branch becomes installed/shipped, Coinbase parent changes, or common expiry trigger. | RadarVisuals/user, 2026-08-04 |
| `eth-lib@0.1.29` and `0.2.8` high through old crypto/request/`ws` | Common legacy path -> `web3@1.10.0` -> BZZ/Swarm -> `eth-lib@0.1.29`; second account path to `0.2.8` | Production-installed; zero artifact bytes; no crypto, request, or old WebSocket execution. | Temporarily accept as proven unshipped/unreachable. | Legacy crypto/network path gains bundle bytes or any common expiry trigger. | RadarVisuals/user, 2026-08-04 |
| `ethereumjs-block@1.7.1` and `2.2.2` high through Merkle/LevelUP/semver | Common legacy path -> provider-engine -> `ethereumjs-block`; second copy below `ethereumjs-vm@2.6.0` | Production-installed; zero artifact bytes; no local block/VM execution. | Temporarily accept as propagated, unshipped risk. | VM/provider-engine use, graph inclusion, or common expiry trigger. | RadarVisuals/user, 2026-08-04 |
| `ethereumjs-vm@2.6.0` high through block/Merkle dependencies | Common legacy path -> `web3-provider-engine@16.0.3` -> `ethereumjs-vm@2.6.0` | Production-installed; zero artifact bytes; no embedded EVM execution. | Temporarily accept as proven unshipped/unreachable. | Local EVM/provider architecture change or common expiry trigger. | RadarVisuals/user, 2026-08-04 |
| `form-data@2.3.3` critical/high ([GHSA-fjxv-7rqg-78g4](https://github.com/advisories/GHSA-fjxv-7rqg-78g4), [GHSA-hmw2-7cc7-3qxx](https://github.com/advisories/GHSA-hmw2-7cc7-3qxx)) | Common legacy path -> provider-engine -> `request@2.88.2` -> `form-data@2.3.3` | Production-installed; zero artifact bytes. Exploitation requires actual multipart generation plus observable PRNG/control of a field, or attacker-controlled field/filename input. | Temporarily accept; no multipart path is initialized. | Request/multipart use, Function graph inclusion, or common expiry trigger. | RadarVisuals/user, 2026-08-04 |
| `levelup@1.3.9` high through `semver@5.4.1` | Common legacy path -> provider-engine -> block -> Merkle -> `levelup@1.3.9` -> `semver@5.4.1` | Production-installed; zero artifact bytes. Exploitation requires untrusted semver range input. | Temporarily accept; no LevelDB or semver product input exists. | Database/VM path becomes reachable or common expiry trigger. | RadarVisuals/user, 2026-08-04 |
| `merkle-patricia-tree@2.3.2` high through LevelUP/semver | Common legacy path -> provider-engine -> block/VM -> `merkle-patricia-tree@2.3.2` | Production-installed; zero artifact bytes; no trie execution. | Temporarily accept as propagated, unshipped risk. | VM/trie path becomes reachable or common expiry trigger. | RadarVisuals/user, 2026-08-04 |
| `request@2.88.2` critical aggregation through `form-data`, `qs`, `tough-cookie`, and `uuid` | Common legacy path -> provider-engine -> `request`; second path through Web3/BZZ/Swarm/eth-lib/servify | Production-installed; zero artifact bytes. SSRF/multipart impact requires server invocation with attacker-controlled URL or multipart metadata. | Temporarily accept; no browser, Function, publication, or build invocation exists. | Any server/request use, Function inclusion, or common expiry trigger. | RadarVisuals/user, 2026-08-04 |
| `secp256k1@4.0.3` high ([GHSA-584q-6j8j-r5pm](https://github.com/advisories/GHSA-584q-6j8j-r5pm)) | Common legacy path -> `@truffle/hdwallet@0.1.4` -> exact `secp256k1@4.0.3`; deduped under old ethereumjs utilities | Production-installed; zero artifact bytes. Exploitation requires ECDH against a locally held private key. | Temporarily accept; parent pins the vulnerable leaf exactly and INSCAPE holds no signing key. | Private-key/ECDH handling, patched parent release, bundle inclusion, or common expiry trigger. | RadarVisuals/user, 2026-08-04 |
| `semver@5.4.1` high ([GHSA-c2qf-rxjj-qqgw](https://github.com/advisories/GHSA-c2qf-rxjj-qqgw)) | Common legacy path -> provider-engine -> block -> Merkle -> LevelUP -> `semver@5.4.1` | Production-installed; zero artifact bytes. ReDoS requires untrusted input to `new Range`. | Temporarily accept; `levelup` constrains `~5.4.1`, excluding the patched `5.7.2`. | Patched parent release, untrusted semver input, graph inclusion, or common expiry trigger. | RadarVisuals/user, 2026-08-04 |
| `swarm-js@0.1.42` high through `eth-lib` and `tar` | Common legacy path -> `web3@1.10.0` -> `web3-bzz@1.10.0` -> `swarm-js@0.1.42` | Production-installed; zero artifact bytes; BZZ/Swarm is never initialized. | Temporarily accept. Canonical publication remains on the bounded same-origin IPFS Function path. | Publication architecture change, BZZ/Swarm use, or common expiry trigger. | RadarVisuals/user, 2026-08-04 |
| `tar@4.4.19` critical/high ([GHSA-23hp-3jrh-7fpw](https://github.com/advisories/GHSA-23hp-3jrh-7fpw), [GHSA-34x7-hfp2-rc4v](https://github.com/advisories/GHSA-34x7-hfp2-rc4v), [GHSA-8qq5-rm4j-mr97](https://github.com/advisories/GHSA-8qq5-rm4j-mr97), [GHSA-83g3-92jg-28cx](https://github.com/advisories/GHSA-83g3-92jg-28cx), [GHSA-qffp-2rhf-9h96](https://github.com/advisories/GHSA-qffp-2rhf-9h96), [GHSA-9ppj-qmqm-q256](https://github.com/advisories/GHSA-9ppj-qmqm-q256), [GHSA-r6q2-hw4h-h46w](https://github.com/advisories/GHSA-r6q2-hw4h-h46w), [GHSA-8x88-c5mf-7j5w](https://github.com/advisories/GHSA-8x88-c5mf-7j5w)) | Common legacy path -> Web3/BZZ/Swarm -> `tar@4.4.19` | Production-installed; zero artifact bytes. Exploitation requires parsing/extracting/replacing an attacker-controlled archive with local filesystem authority. | Temporarily accept; no archive API is imported or executed by browser, Function, or build. | Archive processing, server/build inclusion, patched parent release, or common expiry trigger. | RadarVisuals/user, 2026-08-04 |
| `web3@1.10.0` high through BZZ/core/provider subtrees | Common legacy path -> `web3@1.10.0` | Production-installed; zero artifact bytes; no legacy Web3 instance is created. | Temporarily accept. INSCAPE uses supported `viem` and external EIP-1193/UP providers. | Legacy Web3 initialization, wallet architecture change, or common expiry trigger. | RadarVisuals/user, 2026-08-04 |
| `web3-bzz@1.10.0` high through `swarm-js` | Common legacy path -> `web3@1.10.0` -> `web3-bzz@1.10.0` | Production-installed; zero artifact bytes; no BZZ behavior. | Temporarily accept as proven unshipped/unreachable. | BZZ/Swarm use, publication change, or common expiry trigger. | RadarVisuals/user, 2026-08-04 |
| `web3-provider-engine@16.0.3` high through block, VM, and request | Common legacy path -> `web3-provider-engine@16.0.3` | Production-installed; zero artifact bytes; never initialized. | Temporarily accept; supported provider paths remain unchanged. | Provider-engine initialization, wallet architecture change, or common expiry trigger. | RadarVisuals/user, 2026-08-04 |
| Nested `ws@3.3.3` high ([GHSA-3h5v-q93c-6h6q](https://github.com/advisories/GHSA-3h5v-q93c-6h6q), [GHSA-96hv-2xvq-fx4p](https://github.com/advisories/GHSA-96hv-2xvq-fx4p)) | Common legacy path -> Web3/BZZ/Swarm -> `eth-lib@0.1.29` -> `ws@3.3.3` | Production-installed; zero artifact bytes. Exploitation requires an active vulnerable WebSocket server/peer and malicious headers or fragmented data. | Temporarily accept; old ws is never loaded. Actual modern production-tree `ws@8.21.0` nodes are outside the vulnerable ranges. | Old ws becomes bundled/executed, network architecture changes, or common expiry trigger. | RadarVisuals/user, 2026-08-04 |

## 11. Task 4 - Replace the fragile owner mega-journey with dependable production-preview gates

Status: `[x]` (2026-08-04)

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

#### Task 4A - Theme and Settings production-preview gate

Status: `[x]` (2026-08-04)

- **Root cause and disposition:** the Task-4A browser harness inherited `--disable-gpu`, causing Edge to fall back to ANGLE SwiftShader. The earlier software-rendered THEME click took 22,582.4023 ms and exhausted most of the fixed Settings phase budget. No production Theme or navigation defect was found; all hardware-authoritative runs completed without navigation, reload, page hide, page close, or renderer crash.
- **Hardware authority:** Task 4A now has a dedicated Edge argument list without `--disable-gpu`, `--use-angle=swiftshader`, `--enable-unsafe-swiftshader`, or other software-renderer forcing. A renderer preflight runs before Startveil and records WebGL/WebGL2 availability plus the unmasked vendor and renderer in the actionable ledger. It fails closed for SwiftShader, llvmpipe/softpipe, lavapipe, Microsoft Basic Render Driver, WARP, software rasterizer, GDI Generic, Mesa OffScreen, missing WebGL evidence, or an unavailable renderer; it does not require a specific GPU vendor or model.
- **Hardware evidence:** the accepted renderer was `ANGLE (NVIDIA, NVIDIA GeForce RTX 2080 (0x00001E87) Direct3D11 vs_5_0 ps_5_0, D3D11)` with unmasked vendor `Google Inc. (NVIDIA)`, WebGL and WebGL2 available, `navigator.gpu` present, and no software-renderer classification.
- **Three consecutive production-preview runs:** against `https://deploy-preview-2--enterinscape.netlify.app`, the cold first run passed in 22,038.6953 ms (total Node test 22,409.9136 ms), run 2 passed in 17,929.4769 ms (total 18,299.3661 ms), and run 3 passed in 9,065.3521 ms (total 9,438.5683 ms). Their owned Edge root PIDs were respectively 22872, 28612, and 7904. Cleanup was graceful in 683 ms, 661 ms, and 700 ms; each run reported empty `forcedPids` and `remainingPids`, and each unique Task-4A runtime was removed.
- **Coverage in every run:** Settings opened through the accepted MODUL-8R Theme control; exactly one accessible Settings dialog was resolved from the production `role="dialog"` plus `aria-labelledby` contract and checked atomically. The six canonical workspace themes and six canonical menu themes (`carbon`, `graphite`, `slate`, `ash`, `mist`, and `paper`) were selected and semantically verified, for twelve theme selections total. The gate also verified stable owner, dialog, control, and MODUL-8R identity and attachment; Escape close and exact Theme-focus restoration; reopen, explicit close, and exact focus restoration; and no navigation or reload throughout the sequence.
- **Bounded diagnostics and cleanup:** the existing fixed phase deadlines remain unchanged, including `themeSettingsMs = 30_000`; production code and timeout values were not changed. The post-setup watchdog, monotone Settings-step telemetry, authoritative atomic snapshot, actionable operation ledger, and success/failure cleanup contract remained active for the proof runs.
- **Runtime preservation:** the pre-existing corrupt legacy `.browser-test-runtime` directory was deliberately left untouched. Only the exact unique Task-4A runtime and its owned PID tree were cleaned per run.
- **Gate files:** `browser-tests/owner-theme-settings.browser.mjs`, `browser-tests/owner-production-preview-harness.mjs`, `browser-tests/owner-production-preview-harness.test.mjs`, `browser-tests/browser-test-lifecycle.mjs`, `browser-tests/browser-test-lifecycle.test.mjs`, `browser-tests/playwright-browser-adapter.mjs`, and the `test:browser:owner-theme-settings` package script.

#### Task 4B - Remaining owner isolation, authoring persistence, and preview/publication preparation

Status: `[x]` (2026-08-04). Task 4 as a whole is complete.

- **Four independent production-preview gates:** entry/authority, authoring persistence, owner A-to-B isolation, and Preview/publication preparation each own their full production-preview setup, hardware preflight, bounded journey, actionable ledger, and success/failure cleanup. They run sequentially through `test:browser:owner-task4b`; no fixed sleeps, product-source hooks, HMR route, or shared browser state are used.
- **Official Mini-App authority and fail-closed behavior:** the parent fixture uses the installed `@lukso/up-provider` channel contract, allowlists only the two explicit synthetic profiles, and changes authority through awaited `connector.setContextAccounts(...)` plus `channel.setupChannel(...)`. The gate proved disconnected state, accepted owner A, deliberate mismatched A-account/B-context rejection, disappearance of owner tools and MODUL-8R, byte-identical storage during rejection, and exact A recovery in the same preview document. The exact synthetic `getPermissions` diagnostic is narrowly classified; no general console suppression was added.
- **Canonical authoring persistence:** a profile-scoped GraphQL fixture supplies one valid production Library asset per synthetic owner. With ARRANGE enabled, the gate performed the real pointer drag onto an unobstructed active-table point, keyboard move and resize, keyboard context-menu activation, and `Frame & mat…` Apply with DOSSIER frame and mat. The resulting Version-2 LATTICE draft contained exactly one placement. Switching A-to-B removed it; returning to A restored the same placement with byte-identical persisted draft data and still exactly one canonical record.
- **Owner A-to-B isolation:** owner A Library selection, placement selection, temporary carbon surface, and open publication surface did not appear for owner B. B had its own Library asset, zero A placements, the default mist surface, no publication rack, and no leaked selection. Returning to A restored the exact seeded placement while both canonical draft byte strings remained unchanged.
- **Preview and publication preparation:** Preview rendered exactly the one public placement and excluded the private placement, then restored focus to the exact Preview trigger. Version-8 snapshot preparation and download succeeded; the downloaded JSON contained only the public placement and no private placement bytes. Wallet publication remained disabled, no `/api/profile-publications` POST occurred, and the provider ledger contained no signing, upload, or transaction method.
- **Three consecutive hardware matrices:** against `https://deploy-preview-2--enterinscape.netlify.app`, matrix 1 passed 4/4 in 39,976.4104 ms, matrix 2 passed 4/4 in 46,320.8466 ms, and matrix 3 passed 4/4 in 49,453.2256 ms. Across all three matrices the result was 12/12 passed, zero failed, zero cancelled, and zero skipped. Each gate used the accepted hardware-only renderer arguments, a fresh UUID runtime, independent profile/storage fixtures, and complete owned-process cleanup.
- **Focused regressions:** the Task-4A/4B harness contract matrix passed 20/20, covering absolute lifecycle bounds, fail-closed renderer classification, official channel ordering, profile-scoped canonical indexer responses, valid Version-2 draft seeds, independent gate ownership, opt-in download handling, and the prohibition on automated publication.
- **Scope and preservation:** production source, CSP, dependencies, lockfiles, environment variables, deploy state, IPFS state, and wallet state were not changed. The pre-existing corrupt legacy `.browser-test-runtime/` remains untouched and untracked. Task 5 was not started.
- **Task-4B files:** `browser-tests/owner-task4b-fixtures.mjs`, `browser-tests/owner-task4b-gates.test.mjs`, `browser-tests/owner-entry-authority.browser.mjs`, `browser-tests/owner-authoring-persistence-preview.browser.mjs`, `browser-tests/owner-profile-isolation-preview.browser.mjs`, `browser-tests/owner-preview-publication-preparation.browser.mjs`, the shared `owner-production-preview-harness` additions and regressions, and the `test:browser:owner-task4b` package script.

## 12. Task 5 - Add minimum viable Alpha observability, recovery guidance, and support intake

Status: `[x]`

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

Status: `[x]` (2026-08-07). The bounded implementation, automated Deploy Preview evidence, repaired resolver surface, and manual acceptance are complete.

- **Approved first-cohort mode:** local bounded diagnostics plus manual issue submission only. No remote monitoring service, account, SDK, endpoint, source-map upload, production token, automatic message, or analytics event was added.
- **Collected fields:** the user-triggered Copy support details action contains only the INSCAPE Alpha product label, bounded release commit, route class, viewport class, browser family/version, normalized support code, operation phase, provider category, optional public profile address, and optional already-submitted transaction hash. Arbitrary error text, full URLs, complete user agents, wallet/provider objects, controllers, signatures, calldata, canonical bytes, storage, private tables, placements, searches, unpublished metadata, screenshots, and console output are excluded.
- **Retention and recipient:** INSCAPE sends and retains nothing. Evidence is constructed in memory only after the user opens a relevant support surface and is copied locally only after an explicit button press. The tester reviews it and sends it through the private channel where the Alpha invitation was received. No external recipient integration exists.
- **Visible classification:** owner authority initialization, unexpected owner-runtime failure, Preview preparation, IPFS upload, CID verification, wallet rejection/provider failure, submitted transaction timeout/revert/replacement, resolver failure, and invalid/unavailable published-document states use one bounded support-code set while preserving the existing publication-error descriptions. There is no second publication error taxonomy.
- **Recovery contract:** every relevant support surface distinguishes pre-hash retry from post-hash investigation. When a transaction hash exists, the UI explicitly forbids submitting a duplicate publication transaction. The permanent public nature of IPFS publication and the desktop owner-authoring boundary are visible in the support surface and documented in `docs/INSCAPE_ALPHA_TESTER_SUPPORT.md`.
- **Release identity:** Vite injects only a validated Netlify `COMMIT_REF`, GitHub `GITHUB_SHA`, or explicit public `VITE_COMMIT_REF`; invalid or absent values become `development`. No Git subprocess or environment-value dump is used.
- **Verification:** the focused support/build/owner/publication matrix passed 66/66. `npm run build` passed after 6,375 modules, `npm run build:check` passed, and `git diff --check` passed. Production totals are initial JavaScript `1,285,198` raw / `374,480` gzip; owner JavaScript `274,107` / `82,274`; standalone wallet JavaScript `3,943,745` / `1,042,210`; core JavaScript `2,074,595` / `619,142`; initial CSS `114,250` / `20,299`; owner CSS `69,159` / `12,957`; public assets `14,821,307`; largest asset `2,574,306`. The three previously failing measurements add exactly the final canonical Task-5 delta while preserving their previous raw/gzip headroom; every other ceiling remains unchanged.
- **Deploy Preview evidence:** `test:browser:alpha-support` passed 1/1 against `https://deploy-preview-2--enterinscape.netlify.app` on exact commit `b1be10250d8d1a1ad56fe33ee998d8f9b00fc124`. It opened the selected canonical Version-8 publication rack, proved that the compact support row is inside the visible owner viewport without scrolling, measured at least `4.5:1` text contrast on the light production surface, and verified the explicit `OWNER` route class, exact release SHA, bounded field set, visible copy success/failure feedback, zero non-GET support requests, zero forbidden provider methods, and complete owned-process/runtime cleanup. Earlier runs correctly exposed and stopped on URL-only owner route misclassification, an off-viewport support presentation, and insufficient light-theme contrast; explicit surface-owned route classification plus the compact, token-correct publication-rack row fixed those harness-discovered evidence defects before the passing rerun.
- **Manual review finding:** on 2026-08-06 RadarVisuals/user accepted the compact Version-8 publication notice, exact release identity, copy behavior, narrow focus treatment, and contrast across all six themes on refreshed Deploy Preview commit `2891037f944bd3b9f59ff6103bbec4c6af636ec6`. Review of the bounded published-visitor resolver failure then exposed a remaining presentation defect: every support call-site used compact mode, the legacy status card remained visible, labels collapsed into narrow columns, resolver guidance incorrectly referenced an ambiguous wallet action, and the required private-invitation, desktop-only, permanent-public-IPFS, and screenshot-privacy wording was not visible. The white cross-route bar was separately proven to be Netlify's injected `/.netlify/scripts/cdp` preview container rather than product UI; production CSP was not weakened. At that checkpoint Task 5 remained `[~]` pending the bounded canonical status/support repair and one refreshed preview. The approved support route remains manual submission to RadarVisuals through the same private invitation channel; INSCAPE sends no automatic request.
- **Final manual acceptance:** on 2026-08-07 RadarVisuals/user accepted the repaired published-visitor resolver surface on `https://deploy-preview-2--enterinscape.netlify.app/?view=0x1111111111111111111111111111111111111111`, built from exact release commit `ef294c1f253c449e01803470deb7bdeee8de8ed1`. The accepted surface showed the canonical Mist/grid rack, readable status and support presentation, Directory and Retry actions, explicit no-wallet/no-publication guidance, bounded review details with the exact release identity, private-invitation routing, invite-only and desktop-authoring boundaries, permanent public IPFS guidance, and screenshot privacy guidance. Copy Support Details, visible keyboard focus, and the narrow/mobile layout were manually accepted. Return was correctly absent for this direct explicit visitor route without a connected owner; existing fail-closed routing coverage requires Return only when a distinct verified return profile exists.
- **Scope:** no dependency, lockfile, wallet authority, publication contract, IPFS state, environment setting, remote account, deploy, upload, signature, or transaction was changed. Task 6 was not started. The corrupt legacy `.browser-test-runtime/` remains untouched and untracked.

## 13. Task 6 - Build and certify the exact release candidate

Status: `[~]`

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

- **Pre-clean functional freeze (2026-08-26):** RadarVisuals/user accepted the integrated local System Workflow behavior and visual review surface on the real-profile and bounded fixture routes. The accepted behavior includes profile-scoped Library categories and sections, owner/Visitor canvas Grid parity with Grid-free NFT and expanded-Profile inspection, the canonical v9 Preview/Publish boundary, and a Library collection filter constrained to the Library window with an internally scrollable list. This acceptance is the immutable behavioral baseline for cleanup; it is not yet the exact Task-6 candidate or permission to deploy, upload, sign, or transact.
- **Pre-alpha cleanup decision (2026-08-26):** the user requires a dedicated deep-clean gate before the exact candidate commit and first Alpha. Begin from a pushed pre-clean checkpoint, inventory production, test, static-asset, Function, documentation, ignored, and untracked reachability, and classify paths as `KEEP`, `DELETE`, or `REVIEW`. Removal is limited to generated, temporary, replaced, orphaned, development-only, or otherwise proven-unneeded material and must not change the accepted behavior. Ambiguous or user-owned paths require explicit review. Required security, recovery, rollback, canonical-v9, wallet-authority, and active regression boundaries remain. After cleanup, repeat the complete affected certification matrix and create a new exact candidate SHA.
- **Deep-clean recertification checkpoint (2026-08-28):** the cleaned branch preserves the accepted behavior in the user's deploy-preview review. The fresh automatic matrix is fully green: production build; `build:check` at `779,905` initial JavaScript bytes with owner and standalone-wallet runtimes outside the initial entry; LUKSO standards `5/5`; and the complete Node suite `661/661`, including the alternate-output production-build gate. `git diff --check` passes. The dependency exception was revalidated above without package mutation. The two explicitly protected untracked paths, `.browser-test-runtime/` and `docs/INSCAPE_ALPHA_CONTINUATION_HANDOFF.md`, remain outside version control and the candidate. This checkpoint certifies cleanup equivalence; it does not authorize a wallet transaction, IPFS upload, deployment promotion, public launch, or external Alpha invitations.

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

- Phase 10 architectural cleanup beyond the authorized bounded pre-alpha deep-clean gate, including speculative refactors and compatibility removal;
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

The bounded pre-alpha deep-clean gate recorded in Task 6 may remove only classified, proven-unneeded material while preserving required legacy-document readers and accepted behavior. Any broader Phase 10 architectural cleanup still receives its own later authorization and must not be smuggled into Tasks 0-7.

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
