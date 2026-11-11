# Upload admission and durable limits — 19 October 2026

**Follow-up:** the founder subsequently chose access for every valid Universal
Profile. [Open profile access](upload-open-access.md) supersedes the invitation
assumption below. The following counts remain evidence of the earlier repair.

An unsigned, canonical profile document could previously reach the paid Pinata
upload. The saved regression probe returned HTTP 201 and invoked the fake Pinata
adapter once. After the repair the same request returns 401 and invokes it zero
times. Both probes used synthetic data; no real file was uploaded.

The existing Netlify function now issues a five-minute SIWE challenge for an
explicitly invited Universal Profile, deployment origin and exact document
hash/byte count. It verifies the signed message through the profile's ERC-1271
contract on LUKSO mainnet, then atomically reserves durable upload allowances.
Changing an origin, profile, document, signature or expired permit prevents the
upload. Current SIGN authority is checked again even for a cached result.
This does not confer SETDATA authority or bypass the separate Publish transaction.

The existing publication rack owns preparation and explicit user actions. Its
upload client binds challenge/sign/upload results to the same wallet, profile,
draft and snapshot generations. A profile change, stale draft, wallet refusal,
expired approval or disposal stops the next operation. The rack disables repeat
activation while a request is in flight. Exact CID verification still precedes
the separately enabled Publish action. No additional wallet store, publication
state machine or document format was introduced.

The server owns admission, permit signing, profile verification and accounting.
One named site-wide Netlify Blobs store replaces the absence of durable limits;
it is not a copy of the private Workbench. Each UTC month has one bounded ledger.
Strong reads and conditional writes jointly enforce 12 attempts/profile/clock
hour, 1,000 attempts/site/month and 128 MiB of canonical JSON/site/month by default.
All values are configurable within explicit maxima. These defaults assume a
small invited alpha; broader admission remains a founder decision.

Concurrent requests for the same profile/hash cause one upstream submission.
Completed results reuse their CID during that month. Unknown outcomes retain
their reservation; confirmed rejections consume their allowance and require a
new authorization to try again. Storage/RPC outages and invalid configuration
fail closed. Permits cannot cross a month boundary; this is monthly deduplication,
not a permanent global registry. The [operations reference](../../NETLIFY_PUBLIC_IPFS_PUBLICATION.md)
defines limits, recovery, retention and activation requirements.

## Evidence and verification scope

Local result: **1,261/1,261 Node tests, 8/8 targeted browser cases and 5/5
standards tests** pass, with no skipped tests. Production build and budgets pass
at **822,709 initial JavaScript bytes**. See the [source/log summary](upload-admission/summary.json),
[unsigned before](upload-admission/anonymous-before.log),
[unsigned after](upload-admission/anonymous-after.log),
[focused chain](upload-admission/focused-node.log),
[actual SDK adapter](upload-admission/storage-sdk.log),
[browser results](upload-admission/browser.log),
[wide view](upload-admission/authorization-1440.png) and
[narrow view](upload-admission/authorization-390.png).
These local results do not certify an unconfigured live service.

The focused Node tests cover unsigned requests, changed hashes/origins, expiry,
revoked authority, chain mismatch, concurrent reservations, global count/byte
limits, lost completion acknowledgements, corrupt ledgers, month rollover and
bounded request streams. Client tests cover invalid challenges, refusal,
expiration, cancellation and identity/draft changes at each asynchronous boundary.
The mixed-module test traverses the real client, function, signature verifier,
CID verifier, publisher and public reader with synthetic wallet/RPC/Pinata I/O.

The installed Blobs SDK is tested through the production adapter against an
in-process HTTP fixture. It sends strong, site-wide reads and `If-None-Match` /
`If-Match` conditional writes; stale writes fail. Its automatic error backoff
could otherwise outlive a Function deadline, so the adapter stops accounting
errors before that retry path. Only bounded conditional-write conflicts retry.
This verifies SDK integration, not the real site's Blobs provisioning.

Eight browser cases use the production publication rack at 1440 and 390 pixels:
accepted authorization, refusal, denied admission, profile change during signing,
unmount, quota exhaustion and invalid CID content. Only an explicit action asks
for a fixture signature; preparation does not. No case performs a real upload or
transaction. The accepted route verifies bytes before enabling Publish; the
failure routes cannot enable it. Screenshots were inspected for clipping and
overflow. The suite is now part of the maintained browser selection.

One initial browser assertion expected the word “canonical” in the existing CID
error. The actual public error is “CID verification failed”; the assertion was
corrected without changing or weakening CID verification. The initial failure is
retained locally. Test totals and the final source identity are recorded in the
adjacent evidence summary; GitHub Actions results certify their exact revision.

`@netlify/blobs` 11.1.4 adds 46 lockfile package records and changes **zero existing
package records**. It supplies hosted, atomic storage across independent Function
instances; a process-local map cannot enforce these quotas. The new dependency
is server-only and does not increase the initial browser JavaScript budget.
The current npm audit reports 85 inherited advisories (10 low, 58 moderate,
14 high, 3 critical); none target the added package paths. This work does not
resolve those inherited dependency findings.

## Deployment boundary

This repair requires `INSCAPE_UPLOAD_ALLOWED_PROFILES`, a random server-only
`INSCAPE_UPLOAD_AUTH_SECRET`, a scoped Pinata credential and functional Netlify
Blobs. Without configuration the challenge returns 503 before any wallet prompt
or upload. A normal Vite server still cannot provide the Netlify endpoints.

Do not give old unguarded deployments a new paid-upload credential. Revoke their
previous credential and restrict/retire their endpoints before activation. The
latest preview cannot retroactively secure immutable older deployments. Monthly
application quotas are not a total storage/billing cap, and there is no automatic
operator reconciliation or ledger cleanup. Real UP extension signing, hosted
storage concurrency, one consented IPFS upload and the separate on-chain
publication/read-back remain live acceptance checks.

The implementation follows the official
[LUKSO SIWE verification guide](https://docs.lukso.tech/learn/universal-profile/connect-profile/siwe/),
[mainnet parameters](https://docs.lukso.tech/networks/mainnet/parameters/),
[Netlify Blobs conditional writes](https://docs.netlify.com/build/data-and-storage/netlify-blobs/)
and [Function configuration](https://docs.netlify.com/build/functions/api/),
checked on 19 October 2026. Sources establish the integration contract; local
fixtures do not establish live account configuration.
