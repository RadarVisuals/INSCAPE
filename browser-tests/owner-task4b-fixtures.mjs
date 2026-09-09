import { createEmptyLatticeProductionDraft } from '../src/lattice/domain/latticeProductionDraft.js';

export const TASK4B_PROFILE_A = '0x1111111111111111111111111111111111111111';
export const TASK4B_PROFILE_B = '0x2222222222222222222222222222222222222222';
export const TASK4B_CONTRACT_A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
export const TASK4B_CONTRACT_B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
export const TASK4B_CREATED_LSP7 = '0xcccccccccccccccccccccccccccccccccccccccc';
export const TASK4B_CREATED_COLLECTION = '0xdddddddddddddddddddddddddddddddddddddddd';
export const TASK4B_CREATED_TOKEN_ID = `0x${'0'.repeat(63)}1`;
export const TASK4B_MEDIA_ORIGIN = 'https://task4b-fixtures.invalid';

export const task4bAssetId = (contractAddress) => `42:${contractAddress}:contract`;
export const task4bDraftKey = (profileAddress) => `inscape.lattice-production-draft.v1:${profileAddress}`;
export const task4bWorkspaceKey = (profileAddress) => `inscape.library-workspace.v8:${profileAddress}`;
export const task4bAssetKey = (profileAddress) => `inscape.library-assets.v1:${profileAddress}`;

export function task4bAsset(profileAddress, contractAddress, name, previewUrl) {
  return {
    id: task4bAssetId(contractAddress), chainId: 42, ownerAddress: profileAddress, contractAddress,
    tokenId: null, standard: 'UNKNOWN', name, description: '', collectionName: 'TASK 4B',
    imageUrl: `${TASK4B_MEDIA_ORIGIN}/library-study.svg`, thumbnailUrl: `${TASK4B_MEDIA_ORIGIN}/library-study.svg`,
    originalImageUrl: `${TASK4B_MEDIA_ORIGIN}/library-study.svg`, imageWidth: 1200, imageHeight: 800,
    creators: [], attributes: [], metadataStatus: 'ready', rawMetadata: {},
  };
}

export function task4bPlacement(id, stableAssetId, overrides = {}) {
  return {
    id, stableAssetId, column: 10, row: 5, columnSpan: 8, rowSpan: 6, layer: 0, navigationOrder: 0,
    crop: null, frameId: 'NONE',
    mat: { enabled: false, color: '#090a0a', inset: { top: 0, right: 0, bottom: 0, left: 0 } },
    backing: { enabled: false, color: '#d8d4ca' }, transparencyMode: 'AUTO', visibility: 'PUBLIC', locked: false,
    transform: { quarterTurns: 0, mirrorX: false, mirrorY: false }, ...overrides,
  };
}

export function task4bProfileSeed({ contractAddress, name, previewUrl, profileAddress, placements = [],
  createdAssetRows = [], collectionTokensByContract = {} }) {
  const asset = task4bAsset(profileAddress, contractAddress, name, previewUrl);
  const draft = createEmptyLatticeProductionDraft(profileAddress);
  draft.tables[4].placements = placements.map((placement) => structuredClone(placement));
  return {
    profileAddress,
    asset,
    createdAssetRows,
    collectionTokensByContract,
    workspace: { version: 8, profileAddress, favorites: [], folders: [], canvas: { launchers: [], objects: [] }, tables: { placements: [] } },
    draft,
  };
}

export function task4bCreatedAssetRow({ contractAddress, isCollection = false, name, previewUrl, profileAddress }) {
  return {
    id: `creator:${profileAddress}:${contractAddress}`,
    profile_id: profileAddress,
    asset_id: contractAddress,
    asset: {
      id: contractAddress, name, lsp4TokenName: name, standard: isCollection ? 'LSP8' : 'LSP7',
      isLSP7: !isCollection, isCollection, description: `${name} creator attribution`, error: null,
      images: [{ index: 0, src: `${TASK4B_MEDIA_ORIGIN}/library-study.svg`,
        url: `${TASK4B_MEDIA_ORIGIN}/library-study.svg`, width: 1200, height: 800, fileType: 'image/svg+xml', error: null }],
      lsp4Creators: [{ profile_id: profileAddress, profile: { name: 'TASK 4B CREATOR' } }],
      attributes: [], holders: [], tokens: isCollection ? [{ tokenId: TASK4B_CREATED_TOKEN_ID }] : [],
    },
  };
}

export function task4bCollectionTokenRow({ collectionAddress, name, previewUrl, tokenId = TASK4B_CREATED_TOKEN_ID }) {
  return {
    id: `${collectionAddress}:${tokenId}`, tokenId, formattedTokenId: '1', name, lsp4TokenName: name,
    description: `${name} revealed token metadata`, error: null,
    images: [{ index: 0, src: `${TASK4B_MEDIA_ORIGIN}/created-token.svg`,
      url: `${TASK4B_MEDIA_ORIGIN}/created-token.svg`, width: 1200, height: 800, fileType: 'image/svg+xml', error: null }],
    lsp4Creators: [], attributes: [], holders: [{ id: 'holder', profile_id: TASK4B_PROFILE_B, balance: '1' }],
    asset: null,
    baseAsset: {
      id: collectionAddress, name: 'TASK 4B COLLECTION', lsp4TokenName: 'TASK 4B COLLECTION',
      standard: 'LSP8', isLSP7: false, isCollection: true, description: 'Collection', error: null,
      images: [{ index: 0, src: `${TASK4B_MEDIA_ORIGIN}/collection-cover.svg`,
        url: `${TASK4B_MEDIA_ORIGIN}/collection-cover.svg`, width: 1200, height: 800, fileType: 'image/svg+xml', error: null }],
      lsp4Creators: [], attributes: [],
    },
  };
}

export function installTask4BStorageFixture({ profiles, seedDrafts = true }) {
  for (const profile of profiles) {
    localStorage.setItem(`inscape.library-workspace.v8:${profile.profileAddress}`, JSON.stringify(profile.workspace));
    localStorage.setItem(`inscape.library-assets.v1:${profile.profileAddress}`, JSON.stringify({
      version: 1, profileAddress: profile.profileAddress, updatedAt: Date.now(), assets: [profile.asset],
    }));
    if (seedDrafts) localStorage.setItem(`inscape.lattice-production-draft.v1:${profile.profileAddress}`, JSON.stringify(profile.draft));
    else localStorage.removeItem(`inscape.lattice-production-draft.v1:${profile.profileAddress}`);
  }
  window.__task4bStorageOperations = [];
  if (!window.__task4bStorageProbeInstalled) {
    window.__task4bStorageProbeInstalled = true;
    for (const method of ['getItem', 'setItem', 'removeItem']) {
      const original = Storage.prototype[method];
      Storage.prototype[method] = function task4bStorageProbe(key, ...rest) {
        if (/^(?:inscape\.library-|inscape\.lattice-production-draft)/u.test(String(key))) {
          window.__task4bStorageOperations.push({ method, key: String(key) });
        }
        return original.call(this, key, ...rest);
      };
    }
  }
}

export function createTask4BIndexerFixture(profiles, onRequest) {
  const byProfile = new Map(profiles.map((profile) => [profile.profileAddress, profile]));
  return ({ postData }) => {
    let query = '';
    let variables = {};
    try {
      const body = JSON.parse(postData || '{}');
      query = body?.query || '';
      variables = body?.variables || {};
    } catch { /* fail closed below */ }
    onRequest?.({ operation: /query\s+(\w+)/u.exec(query)?.[1] || null, variables });
    const creatorProfile = variables.profile?.toLowerCase() || null;
    if (/query\s+ReferencedCreations\b/u.test(query) && creatorProfile) {
      const profile = byProfile.get(creatorProfile);
      const requestedContracts = new Set((variables.contracts || []).map((value) => value.toLowerCase()));
      const requestedTokenIds = new Set((variables.tokenIds || []).map((value) => value.toLowerCase()));
      const assetRows = (profile?.createdAssetRows || []).filter((row) =>
        requestedContracts.has((row.asset_id || row.asset?.id || '').toLowerCase()));
      const tokens = profiles.flatMap((candidate) => Object.entries(candidate.collectionTokensByContract || {})
        .filter(([contract]) => requestedContracts.has(contract.toLowerCase()))
        .flatMap(([, rows]) => rows))
        .filter((row) => requestedTokenIds.has((row.tokenId || '').toLowerCase()));
      return { data: { AssetCreators: assetRows, TokenCreators: [], Token: tokens } };
    }
    if (/query\s+ProfileCreations\b/u.test(query) && creatorProfile) {
      const profile = byProfile.get(creatorProfile);
      const rows = profile?.createdAssetRows || [];
      return { data: {
        AssetCreators: rows, AssetCreators_aggregate: { aggregate: { count: rows.length } },
        TokenCreators: [], TokenCreators_aggregate: { aggregate: { count: 0 } },
      } };
    }
    const collectionAddress = variables.contract?.toLowerCase() || null;
    if (/query\s+CollectionTokens\b/u.test(query) && collectionAddress) {
      const rows = profiles.flatMap((profile) => profile.collectionTokensByContract?.[collectionAddress] || []);
      return { data: { Token: rows, Token_aggregate: { aggregate: { count: rows.length } } } };
    }
    if (!variables.owner) return { data: {} };
    const owner = variables.owner?.toLowerCase() || null;
    const profile = byProfile.get(owner);
    if (!profile) return { data: {
      owned_asset: [], owned_asset_aggregate: { aggregate: { count: 0 } },
      owned_token: [], owned_token_aggregate: { aggregate: { count: 0 } },
    } };
    const asset = profile.asset;
    return { data: {
      owned_asset: [{
        id: asset.id, address: asset.contractAddress, balance: '1',
        tokenIds_aggregate: { aggregate: { count: 0 } },
        digitalAsset: {
          address: asset.contractAddress,
          lsp4TokenName: { value: asset.name },
          lsp4TokenType: { value: 'TOKEN' },
          lsp4Creators: [],
          lsp4Metadata: {
            name: { value: asset.name }, description: { value: asset.description || '' },
            decode_error: null, fetch_error_code: null, fetch_error_message: null,
            images: [{ image_index: 0, url: asset.imageUrl, width: asset.imageWidth, height: asset.imageHeight }],
            icon: [], assets: [], attributes: [],
          },
        },
      }],
      owned_asset_aggregate: { aggregate: { count: 1 } },
      owned_token: [], owned_token_aggregate: { aggregate: { count: 0 } },
    } };
  };
}
