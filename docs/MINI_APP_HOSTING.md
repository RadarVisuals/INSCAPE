# Mini app hosting

Use Workbench right click → Add → Mini App, enter a name and the public app URL,
and Save. Any external HTTPS app URL can be added without coding its domain,
changing deployment configuration, or rebuilding for each new site. RADAR at
`https://radar725.netlify.app/` and P1 at `https://p1.upturn.live/` use this same
path. The external site must be available and permit embedding. Connect App uses the
profile already connected to INSCAPE; Connect Profile opens INSCAPE's existing
connection flow when available. Mic reloads that app with microphone delegation
enabled or disabled. RADAR still has its own audio control. Reload, close, and
preview end the app connection. Reload and close also turn Mic off.

Apps start private. Include in publication saves an explicit public choice;
the usual Prepare Publication and Publish workflow remains required. A saved
app URL does not freeze that website or copy its internal configuration.

P1's deployed player was checked inside the host on 2026-09-13. It renders and
exposes its own Connect control. The founder confirmed that wallet connection
inside the mini apps works. The isolated automated P1 check did not establish
an INSCAPE UP Provider handshake and does not perform real wallet approvals.
Apps can use their own connection controls independently of INSCAPE's Connect
App control; the latter becomes available when the app establishes that handshake.

## Ownership and transport

- `miniAppSession.js` commits app records through the existing profile draft
  store, with profile/generation checks, persistence confirmation, and undo.
- `MiniAppsWorkbench.jsx` hosts the shared Workbench window. Its geometry is
  temporary presentation state supplied explicitly to publication preparation.
- `miniAppWalletSession.js` derives authority from the existing wallet store.
  Its per-instance grant contains no durable credential. Public desktop context
  does not authorize the connected account or the profile's controller.
- `mini-app-host.html` creates one isolated connector document per remote app.
  The official `@lukso/up-provider` connector is a document singleton, and its
  forwarded request callback has no caller identity. A dedicated MessageChannel
  connects each bridge to its own parent wallet session; the actual wallet
  provider is never passed into the connector.
- The bridge accepts discovery only from the registered app's window and exact
  origin. Its nested discovery adaptation uses the connector's supported iframe
  handshake. Empty global account defaults prevent automatic account disclosure.
  The transport remains enabled with empty accounts until explicit Connect;
  public context is restored after the upstream client's disconnect handling.

LUKSO mainnet is the supported chain. The parent session permits bounded public
RPC reads and, after Connect, `eth_sendTransaction`, `personal_sign`, and
`eth_signTypedData_v3/v4`, requiring the connected sender. It rejects other
forwarded methods and wrong-chain transactions. The standard client handles
some account and chain methods locally; its chain switch does not switch the
host wallet. The connector is kept on mainnet. Wallet concurrency is limited
across app instances. Obsolete results are discarded and never retried
automatically; closing cannot cancel a prompt already open in the wallet.

The external app is sandboxed, with no top navigation or host DOM access.
Its own popups, forms and downloads remain available. Apps may use their own
remote services. This host does not proxy media or expose INSCAPE draft data.
The shared URL validator replaces the former deployment origin list. The saved
draft and publication formats are unchanged. Localhost URLs in older private
drafts remain readable; only development hosts run them. Production HTTPS
embedding and explicit per-frame microphone delegation are described in
[Netlify operations](NETLIFY_PUBLIC_IPFS_PUBLICATION.md#hosted-mini-app-origins).

This provides UP Provider protocol hosting. It does not import or write LSP28
Grid data. Existing INSCAPE ERC725Y publication semantics are unchanged.

Official references checked 2026-09-13:
[LUKSO mini app connection guide](https://docs.lukso.tech/learn/mini-apps/connect-upprovider/),
[UP Provider source](https://github.com/lukso-network/tools-up-provider),
[LSP28 Grid draft](https://github.com/lukso-network/LIPs/blob/main/LSPs/LSP-28-TheGrid.md).
The installed connector evaluated here is `@lukso/up-provider` 0.3.7.

## Local verification

Use the repository's Node version. Run `node browser-tests/mini-apps.server.mjs`
in one terminal, then `node browser-tests/mini-apps.browser.mjs` in another.
The test server disables file watching and stores its cache in `output/mini-apps`.
Run `npm run build` before
`node browser-tests/mini-apps.production.browser.mjs`; that check starts and stops
its own preview server on port 5193 using production response headers.

Set `INSCAPE_TEST_LIVE_RADAR=1` or `INSCAPE_TEST_LIVE_P1=1` to include the
corresponding deployed site in either browser check. The tests use an isolated
browser, synthetic microphone device and mock
wallet accounts. They never sign, transact, publish, or use a real microphone.
Browser fixtures use two unrelated HTTPS domains with no host configuration.
Checks cover saving new URLs, independent grants, account changes, stale connections,
close/reopen, unregistered frame discovery, microphone delegation, viewport
bounds, public filtering and Visitor isolation. Screenshots go to
`output/mini-apps`. Automated checks do not verify real wallet approval. Mobile
Safari and microphone delegation when INSCAPE itself is embedded on Universal
Everything remain unverified.
