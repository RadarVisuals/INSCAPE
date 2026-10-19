# Netlify Public IPFS publication

INSCAPE publishes prepared profile snapshots through the Netlify Function at `POST /api/profile-publications`. The function validates the closed profile-document schema, requires the exact canonical serialization, streams at most 512 KiB, and accepts same-origin requests only. It also requires a short-lived signed upload authorization from an explicitly invited Universal Profile and reserves durable profile/global quotas before contacting Pinata. It returns only the resulting CID.

The browser never receives a Pinata credential. It verifies the returned CID against the canonical snapshot bytes before enabling the existing wallet publication transaction. The manual canonical-file and CID workflow remains available as a recovery path.

## Netlify configuration

The repository pins Node `24.20.0` in `.node-version`; `package.json` declares
the supported Node 24 range. Netlify reads this file for builds, but an external
`NODE_VERSION` setting can override it. Verify the actual build and Functions
runtime in deployment logs before a release; editing this file does not deploy.
See [Netlify's dependency documentation](https://docs.netlify.com/build/configure-builds/manage-dependencies/).

On the current Windows workstation, NVM has Node 24 installed but the global
Node link may still select Node 18. NVM commands require an interactive terminal;
do not repeatedly invoke NVM through noninteractive automation (it opens dialogs).
For a local PowerShell session, select the installed version without changing
Windows settings or requesting elevation:

```powershell
$inscapeNode = Join-Path $env:NVM_HOME ('v' + (Get-Content .node-version).Trim())
$env:Path = "$inscapeNode;$env:Path"
node --version
npm --version
```

This changes only that terminal and its child processes. New terminals must
select the version again until the workstation's global NVM link is corrected.

1. Connect the repository to the Netlify project. `netlify.toml` configures `npm run build`, the `dist` publish directory, the Functions directory, and the single-page-app fallback.
2. In Netlify, create secret Function environment variables `PINATA_JWT` and `INSCAPE_UPLOAD_AUTH_SECRET`. Give the Pinata JWT only the file-write permission required for uploads. The upload authorization secret must contain 64 hexadecimal characters generated from 32 cryptographically random bytes. Never use a test fixture value. Neither variable may have a `VITE_` prefix: those values are public browser configuration. Scope these settings to the intended guarded deployment context; do not grant a fresh working credential to an older unguarded production function.
3. Set `VITE_PROFILE_DOCUMENT_IPFS_GATEWAY_URL` to an operated public HTTPS IPFS gateway that ends in `/ipfs/`. This gateway is used for the mandatory byte-for-byte verification and published-profile recovery.
4. Set `INSCAPE_UPLOAD_ALLOWED_PROFILES` to the comma- or whitespace-separated mainnet UP addresses invited to upload. A missing or invalid list, missing secret, or invalid quota configuration disables upload with HTTP 503. There is no wildcard/public-open mode. Enable Netlify Blobs for this site and verify that the Function runtime provides strong-consistency access, including conditional writes. No process-memory fallback is used.
5. Review the alpha defaults below; override them with Function environment variables where appropriate. Deploy, then check unauthenticated rejection and the challenge response before testing a real upload. With explicit user consent, test prepare → sign upload authorization → upload → CID verification → separate Publish transaction → visitor read-back. A successful mocked test does not certify a real wallet or hosting configuration.

| Variable | Default | Meaning |
| --- | ---: | --- |
| `INSCAPE_UPLOAD_HOURLY_PER_PROFILE` | 12 | Reserved attempts per profile in a fixed UTC clock hour; maximum configurable 100. |
| `INSCAPE_UPLOAD_MONTHLY_LIMIT` | 1,000 | Reserved attempts across the site per UTC month; maximum 10,000. |
| `INSCAPE_UPLOAD_MONTHLY_BYTES` | 134,217,728 | Sum of reserved canonical JSON bytes per UTC month (128 MiB); maximum 512 MiB. |

These are provisional invited-alpha limits, not a hosting billing cap. Failed and uncertain attempts still count. Successfully cached results reuse their CID in the same month without another upload. Stored files can accumulate across months; RPC, Functions, Blobs and gateway usage also have costs. Review the provider's own plan limits and alerts before broader access.

For local end-to-end testing of the function, run the site through Netlify Dev rather than plain `npm run dev`. Plain Vite serves only the frontend and has no `/api/profile-publications` server function. Unit tests mock Pinata and never need a real JWT.

## Security and operations

### Hosted mini app origins

Mini apps accept external HTTPS URLs directly in Workbench Settings. The former
`VITE_MINI_APP_ORIGINS` configuration is no longer used; adding another domain
requires no code change or rebuild after this host version is deployed.
The production CSP permits `frame-src 'self' https:` while script and network
authority for INSCAPE itself retain their existing restrictions.

Microphone uses the browser's default policy and explicit iframe delegation.
Both the bridge frame and its app frame start with `microphone 'none'`. The Mic
action reloads only that app and delegates to its exact origin, subject to browser
permission. Camera, geolocation, payment and USB remain disabled in response
headers. Function responses still disable microphone as well.

Deploy `mini-app-host.html` alongside `index.html` and the generated assets;
the generated `_headers` requires revalidation of both HTML entries. Serving
INSCAPE inside another site's frame can impose stricter microphone restrictions
that INSCAPE cannot override. This configuration does not authorize deployment.

### Local transaction recovery

Publish reserves a small `inscape:publication:v1:42:<profile>` localStorage
record before requesting the wallet. It retains only the profile, chain,
canonical content hash, IPFS URI, timestamp, transaction hash and submission
state. It contains no draft, snapshot bytes, controller details or credentials.
Unavailable or invalid storage blocks a new wallet request and preserves the
existing record. A Web Lock additionally excludes concurrent publication in
other tabs on browsers that support it; localStorage alone is not an atomic
cross-tab lock.

Reopening Publish after a reload checks the saved hash using a read-only
mainnet client. A successful receipt must also match the profile and canonical
hash of the current published document before recovery reports Published.
Missing receipts, RPC errors and read-back mismatches stay unknown. Check Again
only repeats reads. A confirmed failure or verified publication can be
acknowledged; the next publication still requires a fresh snapshot/CID check
and an explicit wallet action. Recovery does not overwrite the local draft.

A repriced hash is saved when the receipt watcher observes it. A replacement
that happened while the app was closed may remain unknown: recovery does not
guess the new hash. If the app closes before the wallet returns a hash, or that
hash cannot be saved, the pre-request reservation remains. Check wallet activity
and use supervised support; do not delete the record or repeat the request
without resolving the previous outcome. Clearing browser data removes this
local recovery information. There is no remote recovery journal.

Standards boundary rechecked against the official
[Universal Profile setData documentation](https://docs.lukso.tech/contracts/contracts/UniversalProfile/)
on 2026-09-06. Recovery does not change the custom ERC725Y key, LSP2 encoding,
or controller-authority checks.

### Service operation

- Public IPFS is permanent public content. Only the already-filtered public snapshot is uploaded.
- The endpoint is not a generic file uploader: noncanonical and invalid profile documents are rejected before Pinata is called.
- Same-origin enforcement is not identity proof. A five-minute server-authenticated challenge binds the deployment origin, profile, chain 42, exact canonical hash/byte count, nonce and expiration. The wallet signs its reconstructed SIWE message; the server calls the UP's ERC-1271 `isValidSignature` on mainnet. A controller address is not assumed to equal the profile. SIGN permission authorizes upload access; the separate existing Publish transaction still needs its own contract permissions. See the [official LUKSO SIWE guide](https://docs.lukso.tech/learn/universal-profile/connect-profile/siwe/).
- Netlify's additional IP limit is 36 requests/hour across challenge/upload routes. The configured edge limit must be verified on the actual deployment; it is not the profile/global quota and it does not limit all other hosting costs.
- The site-wide `inscape-publication-uploads` Blobs store holds one `month-YYYY-MM` ledger per UTC month, with `RESERVED`, `COMPLETE` and `REJECTED` entries. Each entry contains a profile address, content hash, byte count, timestamp, nonce and optional CID; it contains no JSON presentation, signature, controller identity or secret. Treat access to this operational record as restricted. Strong reads and atomic `onlyIfNew`/`onlyIfMatch` writes reserve all three budgets together, following [Netlify Blobs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/). Redeploying does not reset a named site store. Deploy Previews for the same site share its budget.
- A completed profile/hash returns its saved CID within that month. A pending or unknown result stays reserved: timeouts never release it automatically. A confirmed upstream rejection can be attempted with a new signature but the failed attempt still counts. Permits expire before the UTC month boundary; a newly authorized attempt in a later month has a new budget. This is bounded monthly deduplication, not a permanent global content registry.
- For an unknown result, compare the recorded profile/hash and Pinata's actual uploaded bytes/CID. Only after verifying the result may an operator mark it complete or confirm rejection; preserve the counted reservation. Do not delete quota data, blindly reupload or infer failure from a timeout. There is no automatic reconciliation job or operator UI. Old monthly records remain until an explicit retention policy is agreed; removing a current-month ledger resets its budget and is unsafe.
- Before enabling a working Pinata credential, retire/restrict old unguarded deployments and revoke their previous credential. Updating the latest preview alone does not secure immutable old deployments. If an old credential still works, it can bypass this new endpoint's accounting.
- On upload errors, logs contain only bounded status/error information. Canonical profile bytes and the JWT are never logged.
- If the JWT is ever exposed, revoke it in Pinata and replace the Netlify secret immediately.
- A successful IPFS upload is not an on-chain publication. Only the verified Universal Profile owner can complete the separate wallet transaction.

