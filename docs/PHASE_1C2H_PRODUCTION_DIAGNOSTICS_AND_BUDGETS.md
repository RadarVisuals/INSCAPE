# Phase 1C2H production diagnostics, output safety, and budgets

## Diagnostic inventory

Production has no mutable wallet-store or Pixi-engine diagnostic binding. `useWalletStore` and `__UNDERNEATH_ENGINE__` are installed only by the shared development diagnostics guard, which Vite replaces and removes in a production build. The former `simulateGothicEvent` global was unnecessary: the owner-only Web3 simulator now calls an internal reaction function directly. Wallet session logging is development-only and contains no addresses, account/context arrays, provider/client objects, metadata objects, or permission results. Unexpected wallet client, metadata, and permission failures retain bounded production error codes and messages; long hexadecimal data and nested objects are not logged.

The browser globals that remain are contracts rather than production diagnostics:

- `window.__fixture` and `window.__providerFixture` exist only in browser fixture entry points.
- CDP harness globals such as `__visitorStorageOps`, `__phase42events`, clipboard capture, and `window.confirm` replacements are injected only by test scripts.
- browser APIs used by the application (`location`, history/events, iframe provider behavior) remain normal runtime contracts and are not diagnostic handles.

Publication and resolver errors continue through their controlled UI states. Transaction hashes remain available for post-submission recovery. No production authority override or diagnostic `VITE_*` switch exists.

## Measured starting baseline and enforced limits

The clean Phase 1C2H starting build at `c6a10ab4b5aedd3833f8180c6b60296f8fb93121` measured:

| Category | Baseline raw | Baseline gzip | Limit raw | Limit gzip | Headroom |
| --- | ---: | ---: | ---: | ---: | ---: |
| Initial static JavaScript closure | 1,186,369 | 347,024 | 1,250,000 | 365,000 | 5.4% / 5.2% |
| Owner-only dynamic JavaScript | 205,191 | 58,515 | 220,000 | 63,000 | 7.2% / 7.7% |
| Initial CSS | 107,973 | 18,817 | 115,000 | 20,000 | 6.5% / 6.3% |
| Owner-only CSS | 28,515 | 5,800 | 31,000 | 6,300 | 8.7% / 8.6% |
| Total emitted JavaScript | 1,719,287 | 500,393 | 1,820,000 | 530,000 | 5.9% / 5.9% |
| Public/static assets | 14,203,890 | n/a | 15,000,000 | n/a | 5.6% |
| Largest public asset | 2,574,306 | n/a | 2,700,000 | n/a | 4.9% |

The headroom is deliberately modest but allows normal minifier and focused implementation variation. `npm run build` always creates the report and enforces the limits. `npm run build:check` checks an existing standard build; pass an output directory to `node scripts/checkProductionBuild.js <outDir>` for an alternate build. Failures name the category, actual bytes, allowed bytes, and overage. Hashed names and static closures are resolved from the Vite manifest. Owner leakage is checked independently through `owner-runtime-graph.json`.

Every successful build writes `bundle-report.json` and `owner-runtime-graph.json` into the resolved active `outDir`. The report includes initial/owner/lazy JS, CSS classification, raw/gzip bytes, public totals and largest assets, utilization, and Rollup-supported major module groups. Neither report nor `dist` is committed.

The starting initial chunk remains accepted technical debt. Rollup identifies Pixi, Viem, the resident engine, UP Provider, React, ERC725, and related dependencies as its largest module groups. Pixi renderer/runtime splitting is deferred: required resident/visitor code is not moved behind authority merely to improve a budget. ModuleGridShell, Library, Signals, and owner persistence must remain outside the initial visitor closure.

## Output-directory safety

The build plugin resolves `build.outDir` from Vite's resolved configuration, so configuration, CLI `--outDir`, and supported project-root changes agree on one target. It refuses the project root, filesystem roots, the user profile, the system temporary root itself, and unrelated absolute directories. Focused authoring-asset pruning operates only below that verified active directory; Vite continues to own general output cleanup. Alternate builds neither prune nor write reports into normal `dist`.

## Production deployment and rollback contract

- Serve content-hashed JS, CSS, and emitted assets with long-lived immutable caching, for example `Cache-Control: public, max-age=31536000, immutable`.
- Serve `index.html` with revalidation/no stale shell caching. Non-hashed files copied from `public/` are not immutable unless their URLs are explicitly content-versioned.
- CID-addressed IPFS bytes are immutable by content identity. Gateway responses and the on-chain pointer still require the Phase 1C2F validation, hashing, size, timeout, and fallback policies.
- Deploy HTML and its hashed chunks atomically. Avoid stale HTML referencing removed chunks; where a host cannot make the switch atomically, retain old hashed chunks long enough for in-flight clients.
- Install the response-header CSP, framing policy, referrer policy, permissions policy, and content-type policy specified in `PHASE_1C2F_PUBLISHED_CONTENT_SECURITY.md`. Do not weaken the owner/visitor boundary to accommodate deployment.
- `VITE_*` values are public build inputs and must never contain secrets or authority overrides.
- Monitor resolver/publication error codes, latency, and required transaction hashes. Do not log provider objects, account/context arrays, metadata, canonical publication bytes, calldata, or nested session errors.
- A rollback publishes the previous complete HTML-and-hashed-asset release atomically, while preserving any chunks referenced by still-cached/in-flight HTML. Schema/publication bytes are unchanged by this phase; no republish is part of an application rollback.

No service worker or platform-specific deployment integration is introduced.
