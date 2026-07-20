# Phase 1C2G — Provider Lifecycle and Publication Error Hardening

## Provider lifecycle ownership

The application root is the single lifecycle owner. Its effect initializes the UP Provider and returns the explicit `disposeWallet` cleanup; the lazily mounted Atelier no longer initializes a second provider. Initialization is synchronously idempotent for an active provider, including repeated StrictMode/HMR-style calls.

The installed `@lukso/up-provider` 0.3.7 client exposes and documents three relevant events: `accountsChanged`, `contextAccountsChanged`, and `chainChanged`. The application installs one stable named callback for each event. Disposal removes only those callbacks, preferring the documented `removeListener` API and accepting `off` when that is the provider's removal API. Disposal and repeated initialization are idempotent. Provider replacement invalidates and disposes the previous generation before the replacement can become authoritative.

Some EIP-1193-compatible provider objects expose `on` but neither `removeListener` nor `off`. Client code cannot detach callbacks from such an emitter. In that case the attachment is retained and reused for a later initialization of the same provider, avoiding duplicate listeners. Its target lifecycle generation is changed, so callbacks belonging to a disposed or replaced provider cannot mutate state. `providerCleanupLimitation` and the disposer report state this external limitation rather than claiming removal succeeded.

## Authoritative recovery and fail-closed transitions

Every account, context, or chain event immediately clears accounts, context, host identity, verified ownership, wallet/public clients, metadata, and write capability. Event payloads never restore authority. Recovery uses only noninteractive provider calls:

1. Query `eth_accounts`.
2. Query `eth_chainId`.
3. Query the UP-specific `up_contextAccounts`, falling back to the documented `provider.contextAccounts` property when that method is unavailable.
4. Accept only confirmed LUKSO mainnet (`0x2a`) context.
5. Rebuild the public and UP Provider-backed wallet clients from that confirmed context.
6. Re-run connection, ownership/permission, and metadata resolution.

No recovery path calls `eth_requestAccounts`, requests a transaction, or prompts the user. Unsupported chains remain fully closed and create no clients. Returning to mainnet performs the full query sequence and does not depend on a later `accountsChanged` event. Account logout/login, iframe context replacement, provider replacement, and a valid event following an initial handshake timeout all use the same recovery path.

Provider and recovery generations guard every commit. A newer transition invalidates older provider queries, metadata work, and permission work. URL equality still grants nothing: owner authoring additionally requires verified ownership and equality among the host, workspace, and viewed profile. The account exposed by UP Provider remains the Universal Profile; the provider's privately selected authorized controller is neither exposed nor inferred.

## Publication error classes

The decoder uses the installed Viem 2.54.6 error shapes and focused official LUKSO ABI signatures from LSP6KeyManager and the LSP0/LSP20 call-verification implementation. Supported contract errors are:

- `NoPermissionsSet(address)` — `0xf292052a`
- `NotAuthorised(address,string)` — `0x3bdad6e6`
- `NoERC725YDataKeysAllowed(address)` — `0xed7fa509`
- `NotAllowedERC725YDataKey(address,bytes32)` — `0x557ae079`
- `InvalidEncodedAllowedERC725YDataKeys(bytes,string)` — `0xae6cbd37`
- `LSP20CallVerificationFailed(bool,bytes4)` — `0x9d6741e3`
- `LSP20CallingVerifierFailed(bool)` — `0x8c6a8ae3`
- `LSP20EOACannotVerifyCall(address)` — `0x0c392301`

EIP-1193 code `4001` is classified as pre-submission user rejection. Receipt timeout, reverted receipt, Viem `cancelled`/`replaced`/`repriced` replacement reasons, RPC/provider transport failures, malformed/empty revert data, and unknown selectors have distinct controlled messages. Permission guidance is emitted only for a decoded permission error.

Nested `cause`, `error`, `data`, and `originalError` graphs are inspected to a maximum depth and node count with visited-object tracking, so cyclic provider errors terminate. `shortMessage`, `details`, and `message` are used only as bounded diagnostics. Long hexadecimal values are omitted, messages are length-limited, and no provider object, calldata, canonical document bytes, or private session state is serialized into the UI. Unknown revert data exposes at most its four-byte selector.

## Exactly-once and post-hash behavior

Publication retains the Phase 1C2A synchronous identity lock and submits exactly one `setData` request through the UP Provider-backed wallet client. There is no public-client simulation using the Universal Profile as `from`. Artifact hash, CID, content fingerprint, profile identities, chain, provider generation, account, client, draft, snapshot, and authority bindings are revalidated immediately before the wallet request.

Before a hash exists, a genuine rejection or provider failure releases the lock for controlled retry. Once a hash exists, the submitted record owns all later confirmation and resolver attempts. Receipt timeout, resolver timeout, UI reopen, or provider/account/chain refresh reuses the submitted hash and captured public client and never calls `writeContract` again. Errors after submission carry the known hash when the error object permits annotation, while UI status already retains it. Viem replacement callbacks are accepted: repricing can confirm normally, while cancellation or replacement by different calldata is reported and never treated as a new publication request.

No client can eliminate the remaining provider ambiguity where a provider internally broadcasts a transaction but rejects its request without returning the hash. Without a returned hash the application cannot prove submission or safely recover that transaction; it therefore preserves the existing pre-hash retry semantics and documents this limitation rather than guessing.

## Verification boundary

Lifecycle and error tests use provider and Viem-shaped mocks only. The Edge/CDP fixture exercises initialization, disposal, remount, replacement, unsupported-chain fail-closed behavior, and mainnet recovery without a wallet extension, iframe, RPC, prompt, or transaction. The existing detached published visitor browser suite remains part of the same bounded harness.
