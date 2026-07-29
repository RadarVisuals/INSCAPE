import assert from 'node:assert/strict';
import test from 'node:test';
import { adaptLatticeProductionMedia, LATTICE_PRODUCTION_MEDIA_STATUS as STATUS } from './latticeProductionMedia.js';

const reference = (overrides = {}) => ({
  stableAssetId: '42:0x2222222222222222222222222222222222222222:0x01',
  network: 'lukso-mainnet', chainId: 42, tokenStandard: 'LSP8',
  contractAddress: '0x2222222222222222222222222222222222222222', tokenId: '0x01',
  name: 'Real work', description: '', collectionName: null,
  media: { url: 'ipfs://QmYwAPJzv5CZsnAzt8auVZRnGiRA7a4Hkvp9FzWb6gQd5K/work.webp', width: 1600, height: 900, type: 'image' },
  creators: [], attributes: [], ...overrides,
});

test('media adapter resolves validated IPFS and HTTPS sources without changing native dimensions', () => {
  const ipfs = adaptLatticeProductionMedia(reference(), { ipfsGateway: 'https://gateway.example/ipfs/' });
  assert.equal(ipfs.status, STATUS.READY);
  assert.equal(ipfs.src, 'https://gateway.example/ipfs/QmYwAPJzv5CZsnAzt8auVZRnGiRA7a4Hkvp9FzWb6gQd5K/work.webp');
  assert.deepEqual(ipfs.dimensions, { width: 1600, height: 900 });
  const https = adaptLatticeProductionMedia(reference({ media: { url: 'https://cdn.example/work.png', width: null, height: null, type: 'animation' } }));
  assert.equal(https.status, STATUS.READY);
  assert.equal(https.dimensions, null);
});

test('unknown, unresolved, and invalid media fail closed without inferred facts', () => {
  assert.equal(adaptLatticeProductionMedia(reference({ media: { url: 'https://cdn.example/work', width: null, height: null, type: 'unknown' } })).status, STATUS.UNSUPPORTED);
  assert.equal(adaptLatticeProductionMedia(reference(), { ipfsGateway: 'http://unsafe.example/ipfs/' }).status, STATUS.UNAVAILABLE);
  assert.deepEqual(adaptLatticeProductionMedia({ media: { url: 'javascript:alert(1)' } }), {
    status: STATUS.INVALID, label: 'Artwork unavailable',
  });
});

test('unnamed media uses its canonical stable identity as the accessible label', () => {
  const media = adaptLatticeProductionMedia(reference({ name: '' }), { ipfsGateway: 'https://gateway.example/ipfs/' });
  assert.equal(media.label, reference().stableAssetId);
});
