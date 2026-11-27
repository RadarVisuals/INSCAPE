import { createCanonicalAssetId } from '../../src/profileDocument/domain/assetReference.js';

export function createCompositionExample() {
  const contractAddress = '0x611d3df50a3d930fba0a1f951e9d44bd9d3aea21';
  const tokenId = '0x' + '1'.padStart(64, '0');
  return { imageModules: [{
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
  }] };
}
