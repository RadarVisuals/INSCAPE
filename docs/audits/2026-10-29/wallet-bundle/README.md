# Wallet bundle optimization — 2026-10-29

Validated wallet optimization, based on snapshot `eae8c88cb5a4867c2c38e8dba051652c802aeaef` of the shared checkout, including completed Library and codebase work. Applied to the current shared dev checkout after focused production browser verification. No deployment.

## Change

- Import the existing connector setup from the SDK's public `@lukso/up-modal/auto-setup` entry.
- At production build time, expose only the exports consumed by the reviewed `@lukso/up-modal` 0.21.11 dynamic imports of Wagmi and Viem. Resolve dependencies from their original SDK importer, preserving nested package versions. Leave provider imports and connector implementations unchanged.
- Fail the build when the reviewed SDK version/source hashes or expected imports change. This intentionally requires review on SDK upgrades; it is a maintenance cost, not a general-purpose dependency optimizer.
- Identify the wallet chunk using emitted source membership, because Rollup now merges it into a chunk named `chains`. Reject missing, unreachable or eagerly loaded wallet boundaries instead of silently counting zero wallet bytes.
- Add checks in the existing production browser suite for the compiled wallet lifecycle, using a disposable provider and mocked RPC. This check now passes using the installed Chromium headless shell, with no real wallet or external RPC traffic.

## Measurements

Production builds of the same local snapshot, before and after this patch. Gzip level 9, each emitted file compressed separately, then summed. Total JS/CSS includes lazy routes and wallet dependencies; it is not the initial page download. Images and fonts are excluded.

| Gzip bytes | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| All JavaScript + CSS | 2,172,687 | 1,839,042 | 333,645 (15.36%) |
| Standalone wallet JavaScript, excluding initial shared code | 1,208,494 | 881,269 | 327,225 (27.08%) |
| Initial JavaScript + CSS | 247,592 | 241,258 | 6,334 (2.56%) |

All CSS remains 79,696 gzip bytes. Existing production budgets were not raised. The large saving primarily affects optional wallet code, so it does not imply a 15% faster initial screen.

## Verification

- 44 focused wallet/build/plugin tests passed.
- 3 wallet-store race tests passed, including rejection of obsolete permission results.
- 5 LUKSO standards checks passed.
- Production build and `build:check` passed.
- ESLint on changed implementation scripts and wallet session passed; `git diff --check` passed.
- Both production browser tests passed (5.6 seconds): initial loading isolation and compiled wallet connect, account change, unsupported-chain revocation, supported-chain restoration, reacquisition without another account prompt, and disconnect. The simulated provider now implements wallet_switchEthereumChain. All intercepted RPC requests are read-only; both simulated profiles receive LSP0 supportsInterface checks. Ordinary Chromium binaries failed to spawn on Windows; the installed chromium_headless_shell-1228 works via INSCAPE_BROWSER_EXECUTABLE. Real extension/mobile wallet integration remains outside this simulated check.
- No full unit or 105-suite release run was performed for this bounded task.

Evidence in this checkout: `.verification/wallet-bundle/` contains baseline/candidate reports, comparison JSON, build logs, focused test logs and wallet-final.log with the passing browser results. The baseline build is preserved there; the candidate build is in `dist/`.

The checkout reuses the shared checkout's locked dependencies through a `node_modules` junction. Application sources, build outputs and test outputs are isolated. No dependency installation or package-lock modification was required.

## Follow-up: load the mobile provider on selection

Applied in the shared dev checkout. The reviewed SDK transform now defers the
Wagmi mobile connector's eager setup and disables both automatic mobile prewarm
hooks. The connector implementation itself remains the installed Wagmi connector.
Fresh/extension reconnect excludes WalletConnect; persisted mobile selection can
still restore its session. A phone tap reserves its navigation tab synchronously,
then loads the provider and redirects when the connection URI arrives. Desktop
retains the SDK's QR flow. This applies in development and production. The same
guarded transform participates in Vite's normal dependency prebundling; source-map
comment removal by Vite is the only permitted difference from the reviewed SDK.
Installed dependency files are not edited. The dev wallet selection screen was
also verified with the installed headless browser and external requests blocked.

The identified Ethereum-provider/sign-client chunks total 312,828 gzip bytes;
the browser checks prove those chunks are absent during modal opening and the
complete extension lifecycle, and requested only on mobile selection. Other
dependencies may also be deferred. This is a loading-time improvement, not a
claim of a smaller total distribution (all JS remains about 1.76 MB gzip).

Verification: 10 focused unit checks, 5 LUKSO standards checks, three production
browser checks, production build/budgets and targeted lint. The browser coverage
includes desktop/phone selection and failed-download recovery. For that failure
check only, the app's generic chunk-error reload listener is isolated so wallet
error handling can be asserted. Provider/download traffic is intercepted; no real
WalletConnect relay, physical iPhone/Safari or UP Mobile pairing is claimed.
Navigation/URI delivery, success, cancellation and blocked-pop-up handling are
also covered with simulated providers in the focused unit checks.

Evidence: `.verification/mobile-wallet-lazy/` in the shared checkout. No full
release test run, dependency upgrade, push or deployment was performed.
