# Phase 1C2C — Published profile recovery

Published-profile resolution remains a read-only LUKSO mainnet visitor operation. It does not initialize owner stores, request a wallet, publish, upload, or use local workspace data.

## Public endpoint configuration

All `VITE_*` values are compiled into frontend JavaScript and are public. Never place RPC secrets, Pinata credentials, private gateway tokens, or other credentials in them.

- `VITE_LUKSO_RPC_URL` is the primary LUKSO mainnet JSON-RPC endpoint.
- `VITE_LUKSO_RPC_FALLBACK_URLS` is an optional comma- or newline-separated ordered fallback list.
- `VITE_PROFILE_DOCUMENT_IPFS_GATEWAY_URL` is the dedicated primary profile-document gateway. When absent it retains the existing `VITE_IPFS_GATEWAY_URL` fallback.
- `VITE_PROFILE_DOCUMENT_IPFS_GATEWAY_FALLBACK_URLS` is an optional comma- or newline-separated ordered fallback list.

Endpoint lists are normalized, trailing slashes are removed safely, and duplicates retain their first position. Production resolution accepts HTTPS endpoints only and rejects embedded URL credentials. The on-chain pointer must remain a safe `ipfs://` URI and can select only its CID/path; neither the pointer nor the document can select RPC or gateway infrastructure.

Each endpoint is attempted at most once per address-scoped generation. There is no background or infinite retry loop. Fallbacks improve availability, but do not replace operating HTTPS RPC and gateway services with suitable CORS policy, rate limits, capacity, and service-level guarantees.

## Bounds and endpoint policy

The exported production defaults are:

- ERC725Y JSON-RPC response: 12 seconds per endpoint.
- IPFS gateway response establishment: 15 seconds per endpoint.
- publication response-body streaming/read: 20 seconds per endpoint.

Timeout and caller-abort resources are cleared after every attempt. A timeout aborts the attempt signal; a stalled locked body reader is cancelled. Caller/address-generation abort remains an `AbortError`, performs no fallback, and cannot commit an obsolete state.

RPC endpoints are checked in configured order. Network errors, timeouts, malformed JSON-RPC transport responses, HTTP rate limits, and server errors move to the next endpoint. `UNAVAILABLE` requires a definitive empty pointer result from every configured endpoint. Any valid non-empty value can continue, but distinct non-empty values fail closed as `RPC_POINTER_CONFLICT`.

After a pointer is decoded, every gateway may request only that pointer's controlled IPFS CID/path. Every response independently retains the 512 KiB streaming limit, exact-byte hash check, hash-before-UTF-8 rule, migration and closed-schema validation, and embedded profile-address match. Availability failures and timeouts fall back. Hash mismatch or oversize may fall back without parsing the response. A later response resolves only if it passes the complete verification chain.

## Final state and retry rules

- A definitive empty pointer across all RPC endpoints is `UNAVAILABLE`.
- Pointer conflict, malformed/unsafe pointer, exhausted integrity failure, verified-byte decoding/schema failure, oversize, or profile-authority mismatch is `INVALID`.
- Exhausted transport, rate-limit, server, gateway HTTP, or timeout failures are `ERROR` without prior verified data.
- The same transient failures are `STALE` only when this session already verified a document for the same profile address. That document stays visible.
- `INVALID` and `UNAVAILABLE` discard stale presentation. An address change never displays the prior address's document.

The published status and stale surfaces expose a keyboard-native Retry button for `ERROR`, `STALE`, `UNAVAILABLE`, and `INVALID`. Retry begins one new address-scoped generation. Rapid activation is deduplicated while busy, the button exposes `aria-busy` and is disabled, and only the newest generation may commit. A stale retry keeps the verified document visible. Retry performs no owner-storage access, wallet request, publication, or local fallback.
