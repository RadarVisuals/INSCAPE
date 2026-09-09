# Netlify Public IPFS publication

INSCAPE publishes prepared profile snapshots through the Netlify Function at `POST /api/profile-publications`. The function validates the closed profile-document schema, requires the exact canonical serialization, enforces the 512 KiB document limit, accepts same-origin requests only, and is rate-limited by source IP. It uploads to Pinata's public IPFS network and returns only the resulting CID.

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
2. In Netlify, create a secret environment variable named `PINATA_JWT`. Give that Pinata JWT only the file-write permission required for uploads. Do not name it `VITE_PINATA_JWT`; every `VITE_*` value is public browser configuration.
3. Set `VITE_PROFILE_DOCUMENT_IPFS_GATEWAY_URL` to an operated public HTTPS IPFS gateway that ends in `/ipfs/`. This gateway is used for the mandatory byte-for-byte verification and published-profile recovery.
4. Deploy and test the owner flow: prepare snapshot, upload to Public IPFS, wait for CID verification, request wallet publication, confirm the transaction, and reopen the profile as a visitor.

For local end-to-end testing of the function, run the site through Netlify Dev rather than plain `npm run dev`. Plain Vite serves only the frontend and has no `/api/profile-publications` server function. Unit tests mock Pinata and never need a real JWT.

## Security and operations

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
- Same-origin enforcement reduces browser abuse; Netlify applies a limit of 12 upload attempts per IP per hour. Monitor function usage and tighten the limit if the public alpha attracts abuse.
- On upload errors, logs contain only bounded status/error information. Canonical profile bytes and the JWT are never logged.
- If the JWT is ever exposed, revoke it in Pinata and replace the Netlify secret immediately.
- A successful IPFS upload is not an on-chain publication. Only the verified Universal Profile owner can complete the separate wallet transaction.

