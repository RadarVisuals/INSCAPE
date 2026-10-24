# Independent audit: priority repairs — 2026-09-08

This records implementation and verification of the independent audit's three
immediate recommendations. It is evidence, not additional product direction.
Changes are local and uncommitted; the preceding committed checkpoint is df8ffca.

## Repairs

- **F1 — Preserve existing drafts.** Automatic owner startup preserves a valid
  local draft when its publication baseline is absent, corrupt or unreadable.
  Missing drafts can still be restored, including when a baseline remains.
  Failed draft writes are no longer reported as successful startup alignment.
  Failed baseline writes cannot authorize overwriting later local edits.
- **F2 — Restore selected media.** Storage restoration now calls the existing
  domain mapper instead of maintaining a second mapper. Placement and avatar
  media selections survive restoration. Private Grids are retained during an
  authorized automatic update; the special cover Grid is not duplicated.
- **F3 — Scope Activity and Settings.** Profile initialization is independent of
  whether Activity is open. Unread counts and Settings reflect the current
  profile; callbacks from a previous profile cannot mutate or refresh the new one.
- **F4 — Resolve saved artwork on cold entry.** The reference resolver receives
  its profile independently of optional Library inventory loading. Persisted
  referenced artwork resolves without opening Library.
- **F5 — Bound fallback metadata reads.** RPC fallback uses the shared streaming
  JSON reader, retaining cancellation and deadlines through the response body
  and enforcing its 2 MiB limit. Image responses retain their existing meaning.
- **F6 — Reset visitor sessions on publication revision.** A new profile/document
  revision starts a fresh visitor session before rendering, avoiding an invalid
  selected Grid when the new document contains fewer Grids.

## Verification repairs (F10)

- Library's storage fixture now supplies the workspace/module references required
  by the real component. Its server origin is configurable.
- Vite ignores suffixed browser runtime directories and scans only actual HTML
  entry locations, excluding audit export copies.
- The production harness records GraphQL operation names. The reported aborted
  request was `InscapeDirectory` cancelled as connecting replaces the public
  portal. Only that request during the observed connection transition is
  classified as expected; unrelated failures still fail the gate.
- Request origin is retained because cancellation delivery can follow authority
  readiness. The support gate distinguishes controlled `eth_chainId`, `eth_call`
  and `eth_getCode` reads from writes rather than rejecting every HTTP POST.
  Uploads, transaction submission and unexpected endpoints still fail it.
- Visitor setup allows a bounded cold transform within its existing overall
  deadline (measured at approximately 5.7 seconds, above the old five-second
  limit). The reverse-swipe test waits for the forward transition to settle.
- Production browser checks run sequentially: simultaneous hardware-browser
  runs exposed a Windows process-inventory cleanup deadline. No global timeout
  relaxation or broad network-error suppression was added.

## Evidence

- Full `npm test`: **766 passed**.
- `npm run test:lukso-standards`: **5 passed**.
- `npm run build` and `npm run build:check`: passed; initial JavaScript remains
  **784,709 bytes**. This does not resolve F11's owner-ready measurement gap.
- New browser regressions: profile Settings while Activity is closed; actual
  startup reconciliation preserving private draft bytes (downstream runtime
  stubbed); cold referenced artwork with Library closed; shrinking Preview revision.
- Existing browser checks: Library storage failure/reload/external overwrite at
  1440px and 700px; seven Identity cases; real owner/profile routing; real startup;
  production owner authority and Alpha support; twelve published-visitor cases.
- Browser requests and providers are synthetic/local. Final visitor cleanup was
  graceful, with no remaining owned browser PIDs.
- Logs are in `.browser-test-runtime/audit-repair-*.log`; Library failure screenshots
  were inspected. Generated artifacts are not application changes.

## Still open

F7's corrupt-draft recovery/export UI, F8's development-only recovery action,
F9's public pinning audience/enforcement, and F11's owner-ready measurement are
not repaired by this pass. Do not use the development recovery action or assume
anonymous pinning is ready for unsupervised public exposure.

This is not a clean bill of health for every historical browser suite. Older
Board/inspector/full-Preview fixtures and the legacy owner Identity suite remain
outside this verified set. Reference-resolution failure/retry presentation and
concurrent-tab atomicity also remain limited. No physical mobile performance,
real-wallet publication, deployed endpoint policy, upload or deployment was tested.

The concrete architectural simplification is one restoration mapper and reuse
of the bounded metadata reader. Activity remains a scoped singleton; this work
does not establish a general module-instance architecture or change v4/v9 schemas.
