# Publication access for all Universal Profiles — 19 October 2026

The founder explicitly chose access for everyone with a valid Universal Profile,
within the upload limits. This replaces the earlier unconfirmed invited-alpha
assumption. The upload policy no longer reads an address allowlist and a newly
connected profile does not require operator setup. A missing server signing
secret, missing Pinata credential or unavailable quota service still prevents
paid uploads.

Before reserving quota, the existing signature verifier checks chain 42, ERC165
support, rejection of its invalid interface, LSP0 support and the profile's
ERC-1271 approval of the document-bound SIWE message. The existing wallet check
and server share the LSP0 constant and ABI. These are standards/authority checks,
not issuer attestation or proof that each profile represents a different person.
The site-wide quota remains necessary even with per-profile limits.

Focused regression tests exercise two previously unlisted profiles, binding to
the intended profile, non-LSP0 and invalid ERC165 rejection before storage,
invalid/revoked signatures, unavailable configuration, and existing atomic quotas.
The browser suite covers unconfigured service before signing and invalid profile
after signing, alongside success, refusal, profile change, unmount, quota and CID
failure at wide/narrow widths. Fixtures perform no real upload or wallet write.

Local verification: **1,263/1,263 Node tests, 9/9 focused browser cases and
5/5 LUKSO standards checks pass**, without skipped tests. The production build
and budget check pass at **822,884 initial JavaScript bytes**. The narrow
authorization view was inspected for clipping and overflow. One intermediate
module import assumed an ABI export absent from the installed viem version;
the final implementation shares the project's existing ABI instead.

Verification results belong to the exact checkout/run that produced them. The
GitHub Actions check for this commit records complete Node/browser/standards and
build results. A green build does not certify live Netlify secrets, Blobs, Pinata
or a real user's signature. Those remain explicit activation checks in the
[operations reference](../../NETLIFY_PUBLIC_IPFS_PUBLICATION.md).

Official sources checked on 19 October 2026:
[LSP0](https://github.com/lukso-network/LIPs/blob/main/LSPs/LSP-0-ERC725Account.md),
[profile signature validation](https://docs.lukso.tech/learn/universal-profile/connect-profile/siwe/),
and [mainnet parameters](https://docs.lukso.tech/networks/mainnet/parameters/).
