# Static bento handoff and source checkpoint

Recorded on 26 October 2026. This task prepared the
[implementation handoff](../../../handoffs/2026-10-26-static-reception-bento.md),
recorded the accepted static scope in the active contract, and preserved the
[Hanssen geometry references](../../../design-references/2026-10-26-bento/README.md).
No application implementation, dependency or runtime stylesheet was changed.

## Verified source recovery point

- Repository: `https://github.com/RadarVisuals/INSCAPE.git`.
- Application commit: `3cfd6cf5da12218938d7706268ebd10bed890966`.
- Original branch: `codex/audit-checkpoint-2026-10-19`, directly read from the
  remote and matching the local source before this documentation work.
- Annotated checkpoint tag: `checkpoint/pre-bento-2026-10-26`.
- Tag object: `0f82190a8a0bef9a57abb5ee2e7c9176864b4a9c`.
- The tag was pushed and read back with `git ls-remote --tags`; its peeled
  commit is the exact application commit above.
- Handoff branch: `codex/static-bento-handoff-2026-10-26`. Its documentation
  commit follows the checkpoint without changing application source. Verify
  the remote branch HEAD before starting future work.

The tag protects application source already present on GitHub. It is not a
backup of browser drafts, local media, secrets or every untracked evidence file.
The pre-existing modified `docs/audits/2026-10-23/code-quality-progress.json`
was deliberately not included in this documentation commit. An unchanged local
copy was saved under the parent project's
`handoffs/2026-10-26-bento-local-backup/`. Unrelated screenshots/logs were left
in place, and the protected continuation document was not read or modified.

## Verification of the baseline

Node 24.20.0, npm 11.19.0 and the existing installed dependencies were used.
Application code remained at the checkpoint throughout these tests.

- First `npm test` inside the sandbox: 1,462 tests, 1,461 pass, 1 fail, no
  cancellations/skips/todos. The failing alternate-output-directory production
  build test reported Windows/esbuild access denied while resolving
  `vite.config.js`. No source repair was made to suppress it.
- The same complete `npm test` outside the sandbox: **1,462 pass, 0 fail,
  0 cancelled, 0 skipped, 0 todo**, about 42.3 seconds. See the
  [extracted test totals](unit-baseline-summary.txt).
- Raw logs remain local: `unit-baseline.log` and
  `unit-baseline-unsandboxed.log`. Their respective SHA-256 hashes are
  `b3950fa554fc2113521f8fa9cf3d3f484b4921213c8c14e0259880553874cfc2`
  and `1a3c8ced7acb3bd76737d173ad5d82f840b964e98bbf407fbeb9dac68e6dad53`.
- No new full browser/release gate or independent full production build was
  run for this documentation-only handoff. Future implementation needs its own
  checks on its final source.

## Hosted evidence for that exact application commit

Read from GitHub during handoff preparation:

- [PR 5](https://github.com/RadarVisuals/INSCAPE/pull/5) was open against main
  with that exact head commit.
- `netlify/enterinscape/deploy-preview` reported success and linked to the
  [existing preview](https://deploy-preview-5--enterinscape.netlify.app).
- Both GitHub Actions runs for that SHA were completed with **cancelled**
  conclusions: [40338966078](https://github.com/RadarVisuals/INSCAPE/actions/runs/40338966078)
  and [40338957224](https://github.com/RadarVisuals/INSCAPE/actions/runs/40338957224).

The Netlify status does not establish a green release gate. These are observed
statuses at preparation time; query again rather than treating them as current
evidence for a later commit. No merge into main, production deployment, profile
upload, wallet signature or on-chain publication was performed.
