import { LUKSO_CHAIN_ID, LUKSO_RPC_URL, normalizeProfileAddress } from '../library/config.js';

const reads = new Set(['eth_call', 'eth_estimateGas', 'eth_gasPrice', 'eth_maxPriorityFeePerGas', 'eth_feeHistory',
  'eth_blockNumber', 'eth_getBalance', 'eth_getCode', 'eth_getStorageAt', 'eth_getLogs', 'eth_getTransactionCount',
  'eth_getTransactionByHash', 'eth_getTransactionReceipt', 'eth_getBlockByNumber', 'eth_getBlockByHash']);
const writes = new Set(['eth_sendTransaction', 'personal_sign', 'eth_signTypedData_v3', 'eth_signTypedData_v4']);
const pendingWallets = new WeakSet();
const failure = (code, message) => Object.assign(new Error(message), { code });
const accountOf = wallet => wallet.authorityLifecycleStatus === 'complete' && Number(wallet.chainId) === LUKSO_CHAIN_ID
  && wallet.isWalletConnected && wallet.provider ? normalizeProfileAddress(wallet.accounts?.[0]) : null;

// One disposable grant per app instance. The existing wallet store remains the
// sole wallet authority; neither published context nor stored data grants access.
export function createMiniAppWalletSession({ walletStore, profileAddress, onChange = () => {} }) {
  const context = normalizeProfileAddress(profileAddress);
  if (!context) throw new TypeError('A profile context is required.');
  let disposed = false, grant = null, generation = 0, pendingReads = 0;
  let previousProvider = walletStore.getState().provider;
  let previousAccount = accountOf(walletStore.getState());
  const state = () => {
    const wallet = walletStore.getState(), account = accountOf(wallet);
    const connected = !disposed && grant?.provider === wallet.provider && grant?.account === account && Boolean(account);
    return { connected, canConnect: !disposed && Boolean(account), accounts: connected ? [account] : [],
      contextAccounts: [context], chainId: LUKSO_CHAIN_ID, rpcUrls: [LUKSO_RPC_URL], generation };
  };
  const disconnect = () => { grant = null; generation += 1; if (!disposed) onChange(state()); };
  const unsubscribe = walletStore.subscribe(() => {
    const wallet = walletStore.getState(), account = accountOf(wallet);
    if (wallet.provider !== previousProvider || account !== previousAccount) {
      previousProvider = wallet.provider; previousAccount = account; disconnect();
    }
  });
  return {
    getState: state,
    connect() {
      const wallet = walletStore.getState(), account = accountOf(wallet);
      if (disposed || !account) return false;
      grant = { provider: wallet.provider, account }; generation += 1; onChange(state()); return true;
    },
    disconnect,
    async request({ method, params = [] } = {}) {
      if (disposed) throw failure(4900, 'This mini app is closed.');
      if (typeof method !== 'string' || !Array.isArray(params) || JSON.stringify(params).length > 131072) throw failure(-32602, 'Invalid request.');
      const snapshot = state(), wallet = walletStore.getState();
      if (method === 'eth_chainId') return `0x${LUKSO_CHAIN_ID.toString(16)}`;
      if (method === 'eth_accounts' || method === 'eth_requestAccounts') return snapshot.accounts;
      if (method === 'up_contextAccounts') return snapshot.contextAccounts;
      if (!reads.has(method) && !writes.has(method)) throw failure(4200, 'This method is not supported by the INSCAPE mini app host.');
      const capturedGeneration = generation;
      if (reads.has(method)) {
        if (!wallet.publicClient || pendingReads >= 16) throw failure(4900, 'Public reads are temporarily unavailable.');
        pendingReads += 1;
        try {
          const result = await wallet.publicClient.request({ method, params });
          if (disposed || capturedGeneration !== generation) throw failure(4900, 'This app connection changed.');
          return result;
        } finally { pendingReads -= 1; }
      }
      if (!snapshot.connected) throw failure(4100, 'Connect this mini app before requesting a wallet action.');
      const from = method === 'eth_sendTransaction' ? params[0]?.from : method === 'personal_sign' ? params[1] : params[0];
      if (normalizeProfileAddress(from) !== snapshot.accounts[0]) throw failure(4100, 'The request does not match the connected account.');
      if (method === 'eth_sendTransaction' && params[0]?.chainId != null && Number(params[0].chainId) !== LUKSO_CHAIN_ID) {
        throw failure(4901, 'This mini app uses LUKSO mainnet.');
      }
      if (pendingWallets.has(wallet.provider)) throw failure(-32002, 'A wallet request is already pending.');
      pendingWallets.add(wallet.provider);
      try {
        const result = await wallet.provider.request({ method, params });
        if (disposed || capturedGeneration !== generation || !state().connected) throw failure(4900, 'The app connection changed. Check wallet activity before retrying.');
        return result;
      } finally { pendingWallets.delete(wallet.provider); }
    },
    dispose() { disposed = true; grant = null; generation += 1; unsubscribe(); },
  };
}

export function miniAppRequestError(error) {
  const code = Number.isInteger(error?.code) ? error.code : -32603;
  return { code, message: code === 4001 ? 'The wallet request was declined.'
    : code === 4100 ? 'Connect this app with the requested account first.'
      : code === 4200 ? 'This wallet method is not supported.'
        : code === -32002 ? 'A wallet request is already pending.'
          : 'The request could not be completed. Check wallet activity before retrying.' };
}
