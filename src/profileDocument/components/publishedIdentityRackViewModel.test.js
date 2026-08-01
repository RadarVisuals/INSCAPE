import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyLatticeProductionDraft } from '../../lattice/domain/latticeProductionDraft.js';
import { projectLatticeProductionPublication } from '../../lattice/domain/latticeProductionAdapter.js';
import { createPublishedIdentityRackViewModel } from './publishedIdentityRackViewModel.js';

const PROFILE = '0x1111111111111111111111111111111111111111';
const CONTRACT = '0x2222222222222222222222222222222222222222';
const ASSET_ID = `42:${CONTRACT}:0x01`;

function documentFor() {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  draft.identityPresentation.alias = 'Resident Zero';
  draft.identityPresentation.avatar = { mode: 'inscape', stableAssetId: ASSET_ID, shape: 'square' };
  draft.identityPresentation.bio = { mode: 'inscape', customText: 'Published public identity.' };
  const asset = { id: ASSET_ID, chainId: 42, ownerAddress: PROFILE, contractAddress: CONTRACT, tokenId: '0x01', standard: 'LSP8',
    name: 'Avatar', description: '', imageUrl: 'https://assets.example/avatar.png', imageWidth: 800, imageHeight: 800, creators: [], attributes: [] };
  return {
    exportedAt: '2026-08-01T12:00:00.000Z',
    profile: { address: PROFILE, cachedIdentity: { address: PROFILE, name: 'Official cache', avatarUrl: 'https://assets.example/official.png' } },
    lattice: projectLatticeProductionPublication(draft, [asset], { lastPublished: '2026-08-01T12:00:00.000Z' }),
  };
}

test('published identity rack consumes only the validated public projection and embedded avatar asset', () => {
  const model = createPublishedIdentityRackViewModel({ document: documentFor(), identity: { address: PROFILE, status: 'IDLE' },
    contractFacts: {}, locationLike: 'https://inscape.example/?view=elsewhere' });
  assert.equal(model.profile.displayName, 'Resident Zero');
  assert.equal(model.profile.nameProvenance, 'INSCAPE_PUBLISHED_ALIAS');
  assert.equal(model.profile.avatarUrl, 'https://assets.example/avatar.png');
  assert.equal(model.profile.avatarProvenance, 'INSCAPE_PUBLISHED_ASSET');
  assert.equal(model.profile.description, 'Published public identity.');
  assert.equal(model.profile.descriptionProvenance, 'INSCAPE_PUBLISHED_BIO');
  assert.equal(model.technical.find(({ id }) => id === 'address').value, PROFILE);
  assert.equal(model.links.find(({ id }) => id === 'inscape-profile').url, `https://inscape.example/?view=${PROFILE}`);
});
