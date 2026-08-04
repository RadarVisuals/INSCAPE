import { createEmptyLatticeProductionDraft } from '../src/lattice/domain/latticeProductionDraft.js';

export const TASK4B_PROFILE_A = '0x1111111111111111111111111111111111111111';
export const TASK4B_PROFILE_B = '0x2222222222222222222222222222222222222222';
export const TASK4B_CONTRACT_A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
export const TASK4B_CONTRACT_B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

export const task4bAssetId = (contractAddress) => `42:${contractAddress}:contract`;
export const task4bDraftKey = (profileAddress) => `inscape.lattice-production-draft.v1:${profileAddress}`;
export const task4bWorkspaceKey = (profileAddress) => `inscape.library-workspace.v8:${profileAddress}`;
export const task4bAssetKey = (profileAddress) => `inscape.library-assets.v1:${profileAddress}`;

export function task4bAsset(profileAddress, contractAddress, name, previewUrl) {
  return {
    id: task4bAssetId(contractAddress), chainId: 42, ownerAddress: profileAddress, contractAddress,
    tokenId: null, standard: 'UNKNOWN', name, description: '', collectionName: 'TASK 4B',
    imageUrl: `${previewUrl}/fixtures/library-study.svg`, thumbnailUrl: `${previewUrl}/fixtures/library-study.svg`,
    originalImageUrl: `${previewUrl}/fixtures/library-study.svg`, imageWidth: 1200, imageHeight: 800,
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

export function task4bProfileSeed({ contractAddress, name, previewUrl, profileAddress, placements = [] }) {
  const asset = task4bAsset(profileAddress, contractAddress, name, previewUrl);
  const draft = createEmptyLatticeProductionDraft(profileAddress);
  draft.tables[4].placements = placements.map((placement) => structuredClone(placement));
  return {
    profileAddress,
    asset,
    workspace: { version: 8, profileAddress, favorites: [], folders: [], canvas: { launchers: [], objects: [] }, tables: { placements: [] } },
    draft,
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

export function createTask4BIndexerFixture(profiles) {
  const byProfile = new Map(profiles.map((profile) => [profile.profileAddress, profile]));
  return ({ postData }) => {
    let owner = null;
    try { owner = JSON.parse(postData || '{}')?.variables?.owner?.toLowerCase() || null; } catch { /* fail closed below */ }
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
