# Netlify Public IPFS publication

INSCAPE publishes prepared profile snapshots through the Netlify Function at `POST /api/profile-publications`. The function validates the closed profile-document schema, requires the exact canonical serialization, enforces the 512 KiB document limit, accepts same-origin requests only, and is rate-limited by source IP. It uploads to Pinata's public IPFS network and returns only the resulting CID.

The browser never receives a Pinata credential. It verifies the returned CID against the canonical snapshot bytes before enabling the existing wallet publication transaction. The manual canonical-file and CID workflow remains available as a recovery path.

## Netlify configuration

1. Connect the repository to the Netlify project. `netlify.toml` configures `npm run build`, the `dist` publish directory, the Functions directory, and the single-page-app fallback.
2. In Netlify, create a secret environment variable named `PINATA_JWT`. Give that Pinata JWT only the file-write permission required for uploads. Do not name it `VITE_PINATA_JWT`; every `VITE_*` value is public browser configuration.
3. Set `VITE_PROFILE_DOCUMENT_IPFS_GATEWAY_URL` to an operated public HTTPS IPFS gateway that ends in `/ipfs/`. This gateway is used for the mandatory byte-for-byte verification and published-profile recovery.
4. Deploy and test the owner flow: prepare snapshot, upload to Public IPFS, wait for CID verification, request wallet publication, confirm the transaction, and reopen the profile as a visitor.

For local end-to-end testing of the function, run the site through Netlify Dev rather than plain `npm run dev`. Plain Vite serves only the frontend and has no `/api/profile-publications` server function. Unit tests mock Pinata and never need a real JWT.

## Security and operations

- Public IPFS is permanent public content. Only the already-filtered public snapshot is uploaded.
- The endpoint is not a generic file uploader: noncanonical and invalid profile documents are rejected before Pinata is called.
- Same-origin enforcement reduces browser abuse; Netlify applies a limit of 12 upload attempts per IP per hour. Monitor function usage and tighten the limit if the public alpha attracts abuse.
- On upload errors, logs contain only bounded status/error information. Canonical profile bytes and the JWT are never logged.
- If the JWT is ever exposed, revoke it in Pinata and replace the Netlify secret immediately.
- A successful IPFS upload is not an on-chain publication. Only the verified Universal Profile owner can complete the separate wallet transaction.

