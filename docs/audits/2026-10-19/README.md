# Inscape audit checkpoint — 19 October 2026

This checkpoint shares the current application after the local audit and sixteen
remediation/verification rounds. It includes the existing development history;
it is a review/deployment-preview candidate, not a production release approval.

## Verified locally

The complete local verification passed on Node 24.20.0 / Windows:
1245/1245 Node tests, 191/191 browser cases in 48 maintained suites, five LUKSO
standards tests, design inventory, production build/budgets and built startup
at 1440/390 px. Fresh startup loaded 822709 decoded JavaScript bytes without
acquiring wallet or owner code. No tests were skipped. See the
[summary](local-verification/summary.json), [Node log](local-verification/unit.log)
and [browser results](local-verification/browser/results.json).

This historical local result identifies its source bytes, not this later Git
commit. The checkpoint excludes untracked development-only recovery/artwork
media and their six manual review fixtures, and adds this portable evidence.
Production code and the maintained test selection are unchanged. The independent
GitHub Actions result for the checkpoint commit is authoritative for hosted CI.
Local path roots in shared logs are redacted; counts and test outcomes are intact.

## What the audit repaired

- Current behavioral tests and proven reachability, contrast, undo-label and
  keyboard-focus problems; one maintained verification command and CI workflow.
- Targeted dependency paths and separate fresh-entry/wallet loading costs.
- Repeated document validation/layout work, with preservation of confirmed saves,
  undo and recovery. Performance limitations remain explicitly bounded.
- One editable tab per profile/origin and manual private Workbench backup/restore.
- Spaced IPFS filenames, bounded SVG loading and Library failure/retry state.
- Image click selects, double-click focuses, F focuses/returns, and the measured
  stale animation-clock start plus repeated fractional Properties updates.
- A current product map distinguishing implemented, experimental and future work.

## Remaining boundaries

- Public upload admission, identity quotas and abuse/replay protection remain
  unresolved before an open paid-upload service. Existing same-origin checks and
  per-IP limits are not uploader authentication.
- Deployment-preview environment, server credentials and real UP publication
  require separate checks. No wallet signature, transaction or IPFS upload was
  performed by the automated verification.
- Upstream dependency advisories, heavy-input/first-activation outliers and the
  real user's browser remain bounded by their earlier measurements, not solved
  by a green regression run. No blanket performance or security certification.
- Branch protection and release gating must be configured separately; successful
  Netlify builds alone do not establish passing tests.
- Layers and detachable tools are accepted future direction, deferred until the
  current audit agenda is finished. This checkpoint does not implement them.

## Reproduce and use the preview

Use Node from [.node-version](../../../.node-version), run
`npm ci --no-audit --no-fund`, install Chromium through the locked Playwright
CLI if needed, then run `npm run verify`. See
[verification procedures](../../DEVELOPMENT_CHECKS.md). No wallet or Pinata
credential is needed for the isolated test suite.

For real Publish use the normal browser with the UP extension. A preview has a
different origin from localhost, so local private drafts do not move with login.
Export a Workbench backup locally and restore it explicitly in the preview if
that is the composition you intend to publish. Preparation, IPFS upload and the
wallet transaction remain separate explicit actions. See
[hosting operations](../../NETLIFY_PUBLIC_IPFS_PUBLICATION.md).

The original long audit and per-round evidence remain in the founder's local
audit workspace. This repository summary and the shared logs make the current
checkpoint understandable without access to that workstation.
