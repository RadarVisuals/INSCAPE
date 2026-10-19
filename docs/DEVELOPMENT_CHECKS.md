# Local verification

Start with the [current product map](INSCAPE_ACTIVE_CONTRACT.md#current-product-map-2026-10-19)
and the relevant detailed contract section. This file defines verification
procedures, not product scope or a record that a particular run passed.

The shared [audit checkpoint and verification evidence](audits/2026-10-19/README.md)
records the current outcome and remaining boundaries. The original long audit
remains in the founder's local workspace; a GitHub checkout uses the portable
summary and logs here. Product decisions remain in the active contract.
Layers/dock implementation waits until the current audit agenda is finished.

Use the Node version required by `package.json` and the existing lockfile. A local
Chrome, Edge or Chromium installation is required for browser checks. Set
`INSCAPE_BROWSER_EXECUTABLE` to choose an executable; the runner otherwise checks
the Playwright cache and common Windows, macOS and Linux installation paths.
No browser download or dependency installation is performed by the runner.

`npm run verify` runs the complete Node suite, the maintained browser selection,
LUKSO standards checks, the design-system inventory check, the production build
and its existing budgets, then the built-app startup browser check. Any failure, cancelled browser test or skipped browser
test fails the command. This is a local verification command, not a deployment.

The runner stores each step's log and `verification.json` beneath a unique
`.verification/run-*` directory. Set `INSCAPE_VERIFY_REPORT` to choose a new,
nonexistent directory. Existing evidence is never overwritten. `source-manifest.json`
records exact bytes and SHA-256 hashes for the application, fixtures, scripts,
workflow, product documents and config inputs listed in `SOURCE_INPUTS` in
`scripts/releaseEvidence.mjs`. The protected continuation handoff is excluded
before it is opened. Unrelated experiments, secrets, dependencies and generated
output are outside this source identity. Dependencies require a separate `npm ci`
from the recorded lockfile; the runner never installs them implicitly.

Use a checkout without local `.env` files. Supply public `VITE_*` build settings
explicitly; their collective hash is recorded without copying their values.
Unchanged public configuration, the Node version, the lockfile and the source
manifest identify the inputs. File hashes use exact bytes, including line endings.
CI uses `.node-version` and installs Chromium through the locked `playwright-core`.
Local verification uses the existing browser selection described below.

Tests stop the pipeline on nonzero exit, cancellation or incomplete TAP totals,
including skipped/todo tests and a zero-test run. A source change during verification
invalidates the final result. Only a successful run writes `artifact-manifest.json`,
which hashes every built file. The build contains `release-identity.json` linking it
to the source and lockfile hashes; this file alone is **not** proof that checks passed.
The passing report and matching artifact hashes supply that evidence. A dirty local
tree retains its observed HEAD only as metadata, and uses `development` in the support
UI rather than claiming that its build is the clean commit.

`.github/workflows/verify.yml` runs the same command on pushes, pull requests and
manual dispatch. It uses read-only repository access, fixed action SHAs and no
application secrets. Failed runs retain available logs; only successful runs retain
the build artifact. No deployment is configured here. On 19 October 2026, the
`main` branch was configured to require `Source, tests and production build`
from the GitHub Actions app (15368), with up-to-date source and enforcement for
administrators. The setting was read back through GitHub's API. A fork or another
branch does not inherit this protection from the workflow file. See the
[hosted verification repair and merge gate](audits/2026-10-19/hosted-verification.md).
Repository rules and hosting settings are separate. Netlify's existing preview
build command does not enforce this workflow; a successful preview is not release
approval. Production deployment must explicitly consume the verified artifact or
require a matching successful check before rebuilding. Branch protection gates
updates to main, not manual hosting deployments or a host-side rebuild's exact bytes.

`npm run test:browser` owns an isolated localhost Vite server on a free port and
runs the suites listed in `scripts/runBrowserTests.mjs` sequentially. It closes
its server on completion and leaves other development servers alone. The older
routing suites own and clean up their own isolated server/browser lifecycles.
The preload centralizes executable selection without changing test assertions.

For a focused run, pass names without their suffix:

```sh
npm run test:browser -- library-filter-keyboard image-load-recovery
```

Logs, per-suite screenshots and `results.json` go into a unique directory beneath
`.browser-test-runtime`. `INSCAPE_BROWSER_REPORT` can select a different report
directory. Some older suites still write their screenshots to their existing
fixture directories; the per-suite log remains authoritative for the outcome.

The maintained selection covers the audit's 32 suites plus the complete Keeper
editor flow, entry contrast and Image recovery through the complete owner runtime. It uses disposable browser
storage and mocked external services. It does not run all historical browser
files, prove a live wallet/OAuth integration, upload content or approve a release
deployment. The source array is the exact current selection. Wallet startup tests
cover fresh/disconnected visits, persisted reconnect hints, malformed storage and
retry after setup failure, using a simulated connector.

`npm run test:browser:production` requires a current `npm run build`. It checks
the actual production entry at 1440 and 390 pixels, blocks external services,
and caps downloaded JavaScript at 1,000,000 decoded bytes for a fresh visit.
Neither wallet nor owner chunks may be requested before an explicit action.
It also imports the built wallet module without initializing a connection.
This complements the static bundle budgets; returning sessions intentionally
load the connector to restore and verify their authority. It does not measure
real network latency or exercise a live wallet.

When changing CSS, regenerate `npm run design-system:tokens` and review the
generated inventory diff before running `verify`. The inventory records source
locations as well as token values; a source-line change can require regeneration.
The generator normalizes CRLF to LF before parsing, so multiline values and
selectors produce the same inventory on Windows and Linux. Source/artifact
evidence continues to hash exact bytes, including checkout line endings.

Keep the current product contract separate from test history. Display remains
experimental and absent from ordinary creation. For Image, an ordinary click
selects without camera travel; native double-click or Enter focuses. F focuses
the selected/focused module and returns through the existing navigation context
when invoked again; I or the explicit Inspect action opens artwork inspection.
Native text editing and control-specific keys retain their own scope. Tests of retained
Display behavior use isolated fixtures and do not restore a creation route.

## Storage and private recovery checks

The `text-filled-workbench` browser suite keeps twelve filled Text editors open
at 1440 and 390 pixels. It checks target switching, sibling content and editor
identity, failed writes and explicit retry, native text undo/redo, and reload.
It also checks that the active Text transfer menu follows background Display
locking/unlocking without an article edit or a change of editor focus.
It is part of the maintained selection. Run it with `node scripts/runBrowserTests.mjs text-filled-workbench`.

For performance comparisons, distinguish the Vite development server from a
production React build. Record exact source and fixture sizes, CPU throttling,
warm-up and sample count. Measure real editor input separately from the store;
animation-frame callbacks are opportunities to paint, not actual presentation
timestamps. Include first activation and drag outliers as well as steady motion.
Optimization must retain full candidate validation, confirmed synchronous writes,
history and recovery. Unchanged recursively frozen articles may reuse a successful
validation result; outer-only freezing and accessors are not sufficient.

The `workbench-activation` suite checks a filled twelve-article Workbench while
retargeting Text, Image and Shape tools at 1440, 600, 390 and 1200 pixels. Camera
controls and Actions popups must stay clear of the complete creation/action rail;
activation and viewport changes must preserve article DOM and saved content.
Opening and closing Settings must reattach measurement to the new toolbar node.
`image-duplicate` also checks geometry-only undo/redo with unchanged Image data.
Measure initial pointer activation separately from steady dragging, and repeat
long input samples before attributing an isolated maximum to a specific cause.
Measured toolbar CSS dimensions belong to their toolbar/camera rail, rather than
the entire authored Workbench subtree; keep width/height invalidation local.

The maintained browser selection includes `workbench-storage` and
`text-article-tools`. The storage fixture uses synthetic profiles and its own
browser context. It checks two-tab exclusion, independent profiles, stale-store
writes after disposal, close/reacquire, absent Web Locks, backup download and
explicit replacement, invalid and other-profile files, failed writes, cancelled
file reads, corrupted unpublished drafts, and restored geometry after reload.
The article suite also checks downloading unsaved Text as an independent file.

For a targeted run, use `node scripts/runBrowserTests.mjs workbench-storage text-article-tools owner-profile-routing`. Production stores request editor
enforcement; injected repositories used by isolated fixtures retain their own
write ownership. Browser locks apply only to the same origin/storage partition.
No wallet connection, signature, external upload or real profile content is
needed for these tests. Run `npm run verify` for the full evidence chain.


## Documentation-only changes

Keep the product map inside the active contract. Update the corresponding
detail and creative-intent interpretation together when a founder decision
supersedes an earlier example. Historical verification numbers remain dated;
test files and preview specimens are evidence of behavior, not product approval.

For prose-only reconciliation, check relative links and anchors, inspect the
diff against the actual working files, and run existing tests that consume the
changed documents. Do not add tests that merely repeat the new prose. A change
to a test expectation, route, runtime, style or schema needs its own behavioral
verification. Do not report a previous full browser run as a new one.
