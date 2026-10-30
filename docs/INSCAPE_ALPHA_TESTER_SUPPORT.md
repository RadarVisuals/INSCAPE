# INSCAPE Alpha tester support

INSCAPE Alpha is an invite-only experiment. Owner authoring is supported on desktop Chrome and Edge. Published visitor views may be reviewed on narrower devices, but narrow owner authoring is not part of this first support boundary.

## Feedback channel

Reply through the private channel where you received your Alpha invitation. Do not post unpublished work, wallet details, or support evidence publicly.

For a problem report, include:

- the public Universal Profile address involved;
- browser and operating system;
- the action you attempted;
- the visible INSCAPE error code and message;
- whether a wallet prompt appeared;
- a transaction hash only when the wallet actually returned one;
- a screenshot only after checking it for private information.

Use **Copy support details** when it is available. The generated report is local and contains only a bounded release identifier, route class, viewport class, browser family/version, visible error code, operation phase, provider category, optional public profile address, and optional submitted transaction hash. The visible error message is deliberately not copied automatically; add it manually after reviewing it. Nothing is sent or retained automatically.

Never send seed phrases, private keys, JWTs, signatures, calldata, environment values, complete console logs, local-storage contents, unpublished metadata, private table contents, searches, or wallet-provider objects.

## Publication safety and recovery

Publishing stores canonical public data on IPFS and a pointer on LUKSO. Treat the IPFS result as public and permanent.

- Before a transaction hash exists, a failed preparation, upload, CID verification, or rejected wallet prompt has not established an on-chain submission. Stop, copy the visible support details, and ask for help before retrying an ambiguous wallet action.
- After a transaction hash exists, do not submit another publication transaction. Preserve the hash and ask support to investigate confirmation, replacement, timeout, revert, or resolver mismatch against that same transaction.
- A wallet rejection is different from a provider or contract error. Report which one the visible error code identifies.
- Never approve an unexpected wallet request merely to clear an error.

## Monitoring decision

The first Alpha uses local bounded diagnostics plus manual issue submission only. INSCAPE does not automatically transmit diagnostics, screenshots, console logs, wallet data, or unpublished content. No remote monitoring account, retention policy, recipient integration, source-map upload, or production monitoring token is configured.
