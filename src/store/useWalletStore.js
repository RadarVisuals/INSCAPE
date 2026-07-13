// src/store/useWalletStore.js
import { create } from 'zustand';
import { createClientUPProvider } from "@lukso/up-provider";
import { createWalletClient, createPublicClient, custom, http, numberToHex, getAddress, isAddress } from "viem";
import { lukso, luksoTestnet } from "viem/chains";
import { ERC725 } from '@erc725/erc725.js';
import lsp3ProfileSchema from '@erc725/erc725.js/schemas/LSP3ProfileMetadata.json';

// LUKSO mainnet and testnet endpoints
const LUKSO_MAINNET_RPC = "https://rpc.mainnet.lukso.network";
const LUKSO_TESTNET_RPC = "https://rpc.testnet.lukso.network";
const IPFS_GATEWAY = "https://api.universalprofile.cloud/ipfs/";

// Module-level singletons to survive React StrictMode concurrently
let globalProviderInstance = null;
let isInitializing = false;

const normalizeChainId = (chainId) => {
  if (chainId === null || chainId === undefined) return null;
  if (typeof chainId === "number") return numberToHex(chainId);
  if (typeof chainId === "string") {
    const lower = chainId.toLowerCase().trim();
    if (/^0x[0-9a-f]+$/.test(lower)) return lower;
    try {
      const num = parseInt(lower, 10);
      if (!isNaN(num) && num >= 0) return numberToHex(num);
    } catch (_) {}
    if (/^[0-9a-f]+$/.test(lower)) return `0x${lower}`;
  }
  return null;
};

const VIEM_CHAINS = {
  [normalizeChainId(lukso.id)]: lukso,
  [normalizeChainId(luksoTestnet.id)]: luksoTestnet,
};

const RPC_URLS = {
  [normalizeChainId(lukso.id)]: LUKSO_MAINNET_RPC,
  [normalizeChainId(luksoTestnet.id)]: LUKSO_TESTNET_RPC,
};

export const useWalletStore = create((set, get) => ({
  provider: null,
  walletClient: null,
  publicClient: null,
  chainId: null,
  accounts: [],
  contextAccounts: [],
  hostProfileAddress: null, 
  loggedInUserUPAddress: null,
  isWalletConnected: false,
  isHostProfileOwner: false,
  initializationError: null,
  
  // Profile Metadata State Variables
  profileMetadata: null,
  isProfileLoading: false,
  lastFetchedAddress: null, // Tracks the currently active request key to block duplication

  initWallet: async () => {
    // 1. Synchronous singleton lock to catch concurrent strict-mode execution threads
    if (globalProviderInstance || get().provider || isInitializing) {
      console.log("⚡ [UP Wallet] Singleton initialization guarded. Exiting duplicate thread.");
      return;
    }
    
    isInitializing = true;
    console.log("🔌 [UP Wallet] Initializing UP Provider...");
    await new Promise(r => setTimeout(r, 100));

    if (typeof window !== "undefined") {
      try {
        globalProviderInstance = createClientUPProvider();
        console.log("✅ [UP Wallet] Singleton provider instance created successfully:", globalProviderInstance);
        set({ provider: globalProviderInstance });
      } catch (error) {
        console.error("❌ [UP Wallet] Client provider generation failed:", error);
        isInitializing = false;
        set({ initializationError: error });
        return;
      }
    } else {
      isInitializing = false;
      set({ initializationError: new Error("Window environment not found.") });
      return;
    }

    const provider = globalProviderInstance;

    // Handshake Event Listeners
    const handleAccountsChanged = (rawAccounts) => {
      console.log("🔔 [UP Wallet] Event triggered: accountsChanged ->", rawAccounts);
      const accounts = (rawAccounts || []).map(a => getAddress(a));
      set({ accounts });
      get()._updateConnectionStatus();
    };

    const handleChainChanged = (rawChainId) => {
      console.log("🔔 [UP Wallet] Event triggered: chainChanged ->", rawChainId);
      const normalized = normalizeChainId(rawChainId);
      const isValid = !!normalized && !!VIEM_CHAINS[normalized];
      
      set({ chainId: isValid ? normalized : null });
      if (!isValid) {
        console.warn("⚠️ [UP Wallet] Context is connected to unsupported chain:", rawChainId);
        set({ accounts: [], contextAccounts: [] });
      }
      
      get()._recreateClients();
      get()._updateConnectionStatus();
    };

    const handleContextAccountsChanged = (rawContext) => {
      console.log("🔔 [UP Wallet] Event triggered: contextAccountsChanged ->", rawContext);
      const contextAccounts = (rawContext || []).map(a => getAddress(a));
      set({ contextAccounts });
      get()._updateConnectionStatus();
    };

    try {
      provider.on("accountsChanged", handleAccountsChanged);
      provider.on("chainChanged", handleChainChanged);
      provider.on("contextAccountsChanged", handleContextAccountsChanged);
      console.log("✅ [UP Wallet] Handshake postMessage event listeners attached.");
    } catch (e) {
      console.warn("⚠️ [UP Wallet] Failed to attach handshake handlers:", e);
    }

    console.log("🕒 [UP Wallet] Querying eth_accounts and eth_chainId...");
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Handshake timeout")), 6000)
    );

    const fetchPromise = Promise.all([
      provider.request({ method: "eth_accounts" }),
      provider.request({ method: "eth_chainId" })
    ]);

    try {
      const [initialAccounts, initialChainId] = await Promise.race([
          fetchPromise,
          timeoutPromise
      ]);

      console.log("✅ [UP Wallet] Handshake completed successfully. Accounts:", initialAccounts, "Chain ID:", initialChainId);

      const normalizedChainId = normalizeChainId(initialChainId);
      const isValidChain = !!normalizedChainId && !!VIEM_CHAINS[normalizedChainId];

      set({
        accounts: (initialAccounts || []).map(a => getAddress(a)),
        contextAccounts: (provider.contextAccounts || []).map(a => getAddress(a)),
        chainId: isValidChain ? normalizedChainId : null
      });

      get()._recreateClients();
      get()._updateConnectionStatus();

    } catch (err) {
      console.warn("⚠️ [UP Wallet] Handshake timed out or failed standalone context check. Applying fallback default chain state.", err.message);
      
      set({
        accounts: [],
        contextAccounts: (provider.contextAccounts || []).map(a => getAddress(a)),
        chainId: null
      });
      get()._recreateClients();
      get()._updateConnectionStatus();
    } finally {
      isInitializing = false;
    }
  },

  // Manual Development Override action
  setHostProfileAddress: (address) => {
    if (!address || !isAddress(address)) {
      console.error("❌ [UP Wallet Override] Invalid Universal Profile address.");
      return;
    }
    const cleaned = getAddress(address);
    console.log("🛠️ [UP Wallet Override] Manually assigning profile address:", cleaned);
    set({ hostProfileAddress: cleaned });
    get()._recreateClients();
    get()._checkPermissions();
    get().fetchProfileMetadata();
  },

  /**
   * Queries standard LSP3 Profile Metadata from contract storage keys.
   */
  fetchProfileMetadata: async () => {
    const { hostProfileAddress, publicClient } = get();
    if (!hostProfileAddress || !publicClient) {
      set({ profileMetadata: null, isProfileLoading: false, lastFetchedAddress: null });
      return;
    }

    // Intercept back-to-back triggers for the exact same Profile address
    const lastFetched = get().lastFetchedAddress;
    if (lastFetched && lastFetched.toLowerCase() === hostProfileAddress.toLowerCase()) {
      return; // Deduplicate concurrent execution loop
    }

    set({ isProfileLoading: true, lastFetchedAddress: hostProfileAddress });
    console.log(`ℹ️ [UP Wallet] Querying LSP3 metadata for: ${hostProfileAddress}`);

    try {
      const rpcUrl = publicClient.transport.url || LUKSO_MAINNET_RPC;
      const erc725 = new ERC725(
        lsp3ProfileSchema,
        hostProfileAddress,
        rpcUrl,
        { ipfsGateway: IPFS_GATEWAY }
      );

      const profileData = await erc725.fetchData('LSP3Profile');
      
      if (profileData && profileData.value && profileData.value.LSP3Profile) {
        const rawProfile = profileData.value.LSP3Profile;
        
        // Safe IPFS link parsing helper
        const resolveIpfsLink = (urlStr) => {
          if (!urlStr) return "";
          if (urlStr.startsWith("ipfs://")) {
            return urlStr.replace("ipfs://", IPFS_GATEWAY);
          }
          if (urlStr.startsWith("ipfs/")) {
            return urlStr.replace("ipfs/", IPFS_GATEWAY);
          }
          return urlStr;
        };

        // Extract raw profile assets
        let avatarUrl = "";
        if (rawProfile.profileImage && rawProfile.profileImage.length > 0) {
          avatarUrl = resolveIpfsLink(rawProfile.profileImage[0].url);
        }

        let backgroundUrl = "";
        if (rawProfile.backgroundImage && rawProfile.backgroundImage.length > 0) {
          backgroundUrl = resolveIpfsLink(rawProfile.backgroundImage[0].url);
        }

        const parsedMetadata = {
          name: rawProfile.name || "Anonymous profile",
          description: rawProfile.description || "",
          avatarUrl,
          backgroundUrl,
          tags: rawProfile.tags || [],
          links: rawProfile.links || []
        };

        console.log("✅ [UP Wallet] Metadata queried successfully:", parsedMetadata);
        set({ profileMetadata: parsedMetadata, isProfileLoading: false });
      } else {
        set({ profileMetadata: null, isProfileLoading: false });
      }
    } catch (err) {
      console.warn("⚠️ [UP Wallet] Metadata extraction aborted or failed:", err.message);
      set({ profileMetadata: null, isProfileLoading: false });
    }
  },

  _recreateClients: () => {
    const { provider, chainId, accounts, initializationError } = get();
    const activeChainId = chainId || "0x2a";
    console.log("⚙️ [UP Wallet] Generating Viem clients for active chain context:", activeChainId);

    const currentChain = VIEM_CHAINS[activeChainId] || lukso;
    const rpcUrl = RPC_URLS[activeChainId] || LUKSO_MAINNET_RPC;

    try {
      const publicClient = createPublicClient({
        chain: currentChain,
        transport: http(rpcUrl, { timeout: 30000 })
      });
      set({ publicClient });
      console.log("✅ [UP Wallet] Public Viem reader successfully connected.");
    } catch (err) {
      console.error("❌ [UP Wallet] Viem Public initialization failed:", err);
      set({ publicClient: null });
    }

    if (!initializationError && provider && accounts.length > 0) {
      try {
        const walletClient = createWalletClient({
          chain: currentChain,
          transport: custom(provider),
          account: accounts[0]
        });
        set({ walletClient });
        console.log("✅ [UP Wallet] Wallet write-client active for address:", accounts[0]);
      } catch (err) {
        console.error("❌ [UP Wallet] Viem Wallet initialization failed:", err);
        set({ walletClient: null });
      }
    } else {
      set({ walletClient: null });
    }
  },

  _updateConnectionStatus: async () => {
    const { chainId, accounts, contextAccounts } = get();
    const isConnected = !!chainId && accounts.length > 0 && contextAccounts.length > 0;
    
    const hostProfileAddress = (contextAccounts && contextAccounts.length > 0) 
      ? contextAccounts[0] 
      : null;

    console.log("📊 [UP Wallet] Status refresh executed:", {
      isWalletConnected: isConnected,
      hostProfileAddress,
      activeAccount: accounts[0] || "None"
    });

    set({ 
      isWalletConnected: isConnected,
      hostProfileAddress 
    });

    await get()._checkPermissions();
    await get().fetchProfileMetadata(); // Initiate profile metadata updates
  },

  _checkPermissions: async () => {
    const { accounts, hostProfileAddress, publicClient } = get();
    const controllerAddress = accounts[0];

    if (!controllerAddress || !hostProfileAddress || !publicClient) {
      console.log("🔒 [UP Wallet] Standard permissions bypass: missing active connection elements.");
      set({ isHostProfileOwner: false, loggedInUserUPAddress: null });
      return;
    }

    console.log(`🔐 [UP Wallet] Fetching ERC725 permissions from key supervisor for ${controllerAddress}...`);
    let isOwner = false;

    if (controllerAddress.toLowerCase() === hostProfileAddress.toLowerCase()) {
      isOwner = true;
      console.log("👑 [UP Wallet] Verified: connected controller is the host profile owner.");
    } else {
      try {
        const erc725 = new ERC725(
          lsp3ProfileSchema, 
          hostProfileAddress, 
          publicClient.transport.url, 
          { ipfsGateway: IPFS_GATEWAY }
        );
        const permissions = await erc725.getPermissions(controllerAddress);
        if (typeof permissions === 'string') {
           const decoded = ERC725.decodePermissions(permissions);
           isOwner = decoded.SUPER_SETDATA;
        } else if (typeof permissions === 'object') {
           isOwner = permissions.SUPER_SETDATA;
        }
        console.log("🔑 [UP Wallet] ERC725 Permissions resolved (SUPER_SETDATA):", isOwner);
      } catch (e) {
        console.warn("⚠️ [UP Wallet] Key supervisor check bypassed or failed:", e.message);
        isOwner = false;
      }
    }

    set({ 
      isHostProfileOwner: isOwner, 
      loggedInUserUPAddress: isOwner ? hostProfileAddress : null
    });
  }
}));

// Bind store to window object in browser development settings for diagnostic queries
if (typeof window !== "undefined") {
  window.useWalletStore = useWalletStore;
}