// src/store/useWalletStore.js
import { create } from 'zustand';
import { createClientUPProvider } from "@lukso/up-provider";
import { createWalletClient, createPublicClient, custom, http, numberToHex, getAddress } from "viem";
import { lukso } from "viem/chains";
import { ERC725 } from '@erc725/erc725.js';
import lsp3ProfileSchema from '@erc725/erc725.js/schemas/LSP3ProfileMetadata.json' with { type: 'json' };
import { createWalletProviderLifecycle } from './walletProviderLifecycle.js';
import { developmentLog, installDevelopmentGlobal, reportControlledError } from '../diagnostics.js';

const DEV_DIAGNOSTICS = typeof __DEVELOPMENT_DIAGNOSTICS__ !== 'undefined' && __DEVELOPMENT_DIAGNOSTICS__ === true;

const LUKSO_MAINNET_RPC = "https://rpc.mainnet.lukso.network";
const IPFS_GATEWAY = "https://api.universalprofile.cloud/ipfs/";

let metadataRequestGeneration = 0;
let permissionRequestGeneration = 0;
let providerLifecycleManager = null;

const sameAddress = (left, right) => typeof left === 'string' && typeof right === 'string'
  && left.toLowerCase() === right.toLowerCase();

export const normalizeWalletChainId = (chainId) => {
  if (chainId === null || chainId === undefined) return null;
  if (typeof chainId === "number") return numberToHex(chainId);
  if (typeof chainId === "string") {
    const lower = chainId.toLowerCase().trim();
    if (/^0x[0-9a-f]+$/u.test(lower)) return numberToHex(Number.parseInt(lower, 16));
    if (/^[0-9]+$/u.test(lower)) return numberToHex(Number.parseInt(lower, 10));
  }
  return null;
};

const LUKSO_MAINNET_CHAIN_ID = normalizeWalletChainId(lukso.id);

function lifecycleManager(set, get) {
  if (!providerLifecycleManager) providerLifecycleManager = createWalletProviderLifecycle({
    get, set, createProvider: createClientUPProvider,
    normalizeChainId: normalizeWalletChainId, supportedChainId: LUKSO_MAINNET_CHAIN_ID
  });
  return providerLifecycleManager;
}

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
  authorityLifecycleStatus: 'pending',
  publicationContextGeneration: 0,
  providerCleanupLimitation: null,
  initializationError: null,
  
  // Profile Metadata State Variables
  profileMetadata: null,
  isProfileLoading: false,
  lastFetchedAddress: null, // Tracks the currently active request key to block duplication


  initWallet: (options = {}) => {
    if (typeof window === 'undefined' && !options.provider) {
      set({ initializationError: new Error('Window environment not found.'), authorityLifecycleStatus: 'complete' });
      return Promise.resolve(false);
    }
    return lifecycleManager(set, get).initialize(options);
  },

  disposeWallet: () => lifecycleManager(set, get).dispose(),
  scheduleWalletRelease: () => lifecycleManager(set, get).scheduleRelease(),
  beginWalletTransition: () => {
    const report = lifecycleManager(set, get).dispose();
    set({ authorityLifecycleStatus: 'pending' });
    return report;
  },
  _recoverProviderContext: (reason) => lifecycleManager(set, get).recover(reason),

  _failClosedProviderContext: (initializationError = null) => {
    metadataRequestGeneration += 1;
    permissionRequestGeneration += 1;
    set((state) => ({ chainId: null, accounts: [], contextAccounts: [], hostProfileAddress: null,
      loggedInUserUPAddress: null, walletClient: null, publicClient: null,
      isWalletConnected: false, isHostProfileOwner: false, profileMetadata: null,
      isProfileLoading: false, lastFetchedAddress: null, initializationError,
      publicationContextGeneration: state.publicationContextGeneration + 1 }));
  },

  _applyAuthoritativeProviderContext: async ({ provider, accounts, contextAccounts, chainId, isCurrent }) => {
    let normalizedAccounts; let normalizedContext;
    try {
      normalizedAccounts = (Array.isArray(accounts) ? accounts : []).map((address) => getAddress(address));
      normalizedContext = (Array.isArray(contextAccounts) ? contextAccounts : []).map((address) => getAddress(address));
    } catch {
      normalizedAccounts = []; normalizedContext = [];
    }
    if (!isCurrent()) return;
    set((state) => ({ provider, accounts: normalizedAccounts, contextAccounts: normalizedContext, chainId,
      initializationError: null, publicationContextGeneration: state.publicationContextGeneration + 1 }));
    get()._recreateClients();
    if (!isCurrent()) return;
    await get()._updateConnectionStatus();
    if (!isCurrent()) return;
    void get().fetchProfileMetadata();
  },

  /**
   * Queries standard LSP3 Profile Metadata from contract storage keys.
   */
  fetchProfileMetadata: async () => {
    const { hostProfileAddress, publicClient, chainId } = get();
    if (!hostProfileAddress || !publicClient) {
      metadataRequestGeneration += 1;
      set({ profileMetadata: null, isProfileLoading: false, lastFetchedAddress: null });
      return;
    }

    // Intercept back-to-back triggers for the exact same Profile address
    const lastFetched = get().lastFetchedAddress;
    if (lastFetched && lastFetched.toLowerCase() === hostProfileAddress.toLowerCase()) {
      return; // Deduplicate concurrent execution loop
    }

    const generation = ++metadataRequestGeneration;
    const requestIsCurrent = () => {
      const current = get();
      return metadataRequestGeneration === generation
        && sameAddress(current.hostProfileAddress, hostProfileAddress)
        && current.publicClient === publicClient
        && current.chainId === chainId;
    };
    set({ isProfileLoading: true, lastFetchedAddress: hostProfileAddress });
    if (DEV_DIAGNOSTICS) developmentLog('[wallet-metadata] query started');

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

        if (DEV_DIAGNOSTICS) developmentLog('[wallet-metadata] query completed');
        if (requestIsCurrent()) set({ profileMetadata: parsedMetadata, isProfileLoading: false });
      } else {
        if (requestIsCurrent()) set({ profileMetadata: null, isProfileLoading: false, lastFetchedAddress: null });
      }
    } catch (err) {
      reportControlledError('wallet-metadata-unavailable', err);
      if (requestIsCurrent()) set({ profileMetadata: null, isProfileLoading: false, lastFetchedAddress: null });
    }
  },

  _recreateClients: () => {
    const { provider, chainId, accounts, initializationError } = get();
    const activeChainId = chainId;
    if (DEV_DIAGNOSTICS) developmentLog('[wallet-client] rebuilding for verified chain');

    if (activeChainId !== LUKSO_MAINNET_CHAIN_ID) {
      set({ publicClient: null, walletClient: null });
      return;
    }
    const currentChain = lukso;
    const rpcUrl = LUKSO_MAINNET_RPC;

    try {
      const publicClient = createPublicClient({
        chain: currentChain,
        transport: http(rpcUrl, { timeout: 30000 })
      });
      set({ publicClient });
      if (DEV_DIAGNOSTICS) developmentLog('[wallet-client] public reader ready');
    } catch (err) {
      reportControlledError('wallet-public-client-init', err);
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
        if (DEV_DIAGNOSTICS) developmentLog('[wallet-client] write client ready');
      } catch (err) {
        reportControlledError('wallet-write-client-init', err);
        set({ walletClient: null });
      }
    } else {
      set({ walletClient: null });
    }
  },

  _updateConnectionStatus: async () => {
    const { chainId, accounts, contextAccounts } = get();
    const isConnected = chainId === LUKSO_MAINNET_CHAIN_ID && accounts.length > 0 && contextAccounts.length > 0;
    
    const hostProfileAddress = (contextAccounts && contextAccounts.length > 0) 
      ? contextAccounts[0] 
      : null;

    if (DEV_DIAGNOSTICS) developmentLog('[wallet-session] authoritative status refreshed');

    metadataRequestGeneration += 1;
    permissionRequestGeneration += 1;
    set((state) => ({
      isWalletConnected: isConnected,
      hostProfileAddress,
      isHostProfileOwner: false,
      loggedInUserUPAddress: null,
      profileMetadata: null,
      isProfileLoading: false,
      lastFetchedAddress: null,
      publicationContextGeneration: state.publicationContextGeneration + 1
    }));

    await get()._checkPermissions();
  },

  _checkPermissions: async () => {
    const { accounts, hostProfileAddress, publicClient, chainId, provider } = get();
    const exposedAccountAddress = accounts[0];
    const generation = ++permissionRequestGeneration;
    set({ isHostProfileOwner: false, loggedInUserUPAddress: null });

    const requestIsCurrent = () => {
      const current = get();
      return permissionRequestGeneration === generation
        && sameAddress(current.accounts[0], exposedAccountAddress)
        && sameAddress(current.hostProfileAddress, hostProfileAddress)
        && current.chainId === chainId
        && current.publicClient === publicClient
        && current.provider === provider;
    };

    if (!exposedAccountAddress || !hostProfileAddress || !publicClient || chainId !== LUKSO_MAINNET_CHAIN_ID) {
      if (DEV_DIAGNOSTICS) developmentLog('[wallet-permissions] skipped without authoritative context');
      return;
    }

    if (DEV_DIAGNOSTICS) developmentLog('[wallet-permissions] verification started');
    let isOwner = false;

    if (exposedAccountAddress.toLowerCase() === hostProfileAddress.toLowerCase()) {
      // UP Provider exposes the Universal Profile. Its privately selected authorized
      // controller remains inside the provider and is never inferred by this app.
      isOwner = true;
      if (DEV_DIAGNOSTICS) developmentLog('[wallet-permissions] host profile verified');
    } else {
      try {
        const erc725 = new ERC725(
          lsp3ProfileSchema, 
          hostProfileAddress, 
          publicClient.transport.url, 
          { ipfsGateway: IPFS_GATEWAY }
        );
        const permissions = await erc725.getPermissions(exposedAccountAddress);
        if (typeof permissions === 'string') {
           const decoded = ERC725.decodePermissions(permissions);
           isOwner = decoded.SUPER_SETDATA;
        } else if (typeof permissions === 'object') {
           isOwner = permissions.SUPER_SETDATA;
        }
        if (DEV_DIAGNOSTICS) developmentLog('[wallet-permissions] contract permissions resolved');
      } catch (e) {
        reportControlledError('wallet-permission-check', e);
        isOwner = false;
      }
    }

    if (requestIsCurrent()) {
      set((state) => ({
        isHostProfileOwner: isOwner,
        loggedInUserUPAddress: isOwner ? hostProfileAddress : null,
        publicationContextGeneration: state.publicationContextGeneration + 1
      }));
    }
  }
}));

export function resetWalletStoreForTests() {
  providerLifecycleManager?.dispose();
  providerLifecycleManager = null;
  metadataRequestGeneration = 0;
  permissionRequestGeneration = 0;
  useWalletStore.setState({
    provider: null, walletClient: null, publicClient: null, chainId: null,
    accounts: [], contextAccounts: [], hostProfileAddress: null, loggedInUserUPAddress: null,
    isWalletConnected: false, isHostProfileOwner: false, publicationContextGeneration: 0,
    authorityLifecycleStatus: 'pending',
    providerCleanupLimitation: null, initializationError: null,
    profileMetadata: null, isProfileLoading: false, lastFetchedAddress: null
  });
}

// Bind store to window object in browser development settings for diagnostic queries
if (DEV_DIAGNOSTICS) installDevelopmentGlobal('useWalletStore', useWalletStore);
