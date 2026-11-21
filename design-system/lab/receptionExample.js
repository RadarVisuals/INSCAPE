import { createReception } from '../../src/profileDocument/domain/receptionPresentation.js';
import { createCanonicalAssetId } from '../../src/profileDocument/domain/assetReference.js';

// Visible artwork, identity and crop observed in the founder's Reception on
// 2026-10-30. This is a disposable visual snapshot, never a saved-draft reader.
export const receptionProfile = {
  profile: {
    displayName: 'nomad',
    avatarUrl: 'https://api.universalprofile.cloud/image/QmTArnh1fTJ65K2uTGKYtkeyQfYfivpHPPw8KW3vhjURpe',
  },
  officialProfile: { name: 'nomad', url: 'https://universaleverything.io/0x001048331cd14cef40dd5da644a738e7324fe691' },
};

export function createReceptionExample() {
  const contractAddress = '0x611d3df50a3d930fba0a1f951e9d44bd9d3aea21';
  const tokenId = '0x' + '1'.padStart(64, '0');
  const reception = createReception();
  reception.regions[0].id = 'region:artwork';
  reception.regions[0].content = 'image:resident-zero';
  reception.mobile = [{ id: 'region:artwork', columns: 2, height: 600 }];
  reception.gutter = 0;
  reception.radius = 0;
  reception.surface = '#c2c2c2';
  reception.branding.name = 'nomad';
  reception.imageModules = [{
    id: 'image:resident-zero', name: 'Human Underneath', width: 1200, height: 1000, visibility: 'PUBLIC',
    artwork: {
      id: 'artwork:resident-zero',
      asset: { stableAssetId: createCanonicalAssetId({ chainId: 42, contractAddress, tokenId }),
        network: 'lukso-mainnet', chainId: 42, tokenStandard: 'LSP8', contractAddress, tokenId,
        name: 'Human Underneath', description: 'Resident Zero', collectionName: 'Human Underneath', creators: [], attributes: [],
        media: { url: 'https://api.universalprofile.cloud/image/QmTH388LwcRtQvB8eF6nL7cXZpsK4g5SuJAm5MBmB7D25i/images-9-female%201%20blue%20web.webp',
          type: 'image', width: 1200, height: 1000 } },
      crop: { x: 2 / 3, y: 0.6425916505567129, zoom: 1.5 },
      transform: { quarterTurns: 0, mirrorX: false, mirrorY: false },
    },
  }];
  return reception;
}
