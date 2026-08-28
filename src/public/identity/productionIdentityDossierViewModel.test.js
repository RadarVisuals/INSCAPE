import assert from 'node:assert/strict';
import test from 'node:test';
import { createProfileContractFacts, errorContractFact, resolvedContractFact } from '../../profileIdentity/domain/profileContractFacts.js';
import { normalizeLsp3Identity } from '../../profileIdentity/domain/profileIdentity.js';
import { createProductionIdentityDossierViewModel } from './productionIdentityDossierViewModel.js';

const ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';
const createIdentityPresentation = () => ({
  alias: '',
  avatar: { mode: 'official', stableAssetId: null, shape: 'square' },
  bio: { mode: 'official', customText: '' },
  tags: { includeOfficial: true, additional: [] },
  dossierSurface: 'paper',
  visibility: { links: true, network: true, counts: true, publicationDate: true },
});
const facts = (overrides = {}) => createProfileContractFacts(ADDRESS, {
  chain: resolvedContractFact(42), isUniversalProfile: resolvedContractFact(true),
  receivedAssetContracts: resolvedContractFact(0), issuedAssetContracts: resolvedContractFact(3), ...overrides
});
const identity = () => normalizeLsp3Identity(ADDRESS, {
  name: 'OFFICIAL', description: 'First paragraph.\n\nSecond paragraph.', tags: ['official'],
  profileImage: [{ url: 'ipfs://official', width: 96 }, { address: ADDRESS, tokenId: '42' }],
  backgroundImage: [{ url: 'ipfs://background', width: 1600 }],
  links: [{ title: 'Authored site', url: 'https://example.com/profile' }]
}, { ipfsGateway: 'https://gw.test/ipfs/', source: 'LIVE' });

test('projects authoritative identity, canonical URLs, exact counts, and no social verification claim', () => {
  const model = createProductionIdentityDossierViewModel({
    identity: identity(), contractFacts: facts(), identityPresentation: createIdentityPresentation(),
    locationLike: { href: 'https://inscape.test/?profile=wallet#fragment' },
    publishedResolution: { status: 'RESOLVED', document: { exportedAt: '2026-07-29T12:00:00.000Z' } }
  });
  assert.equal(model.profile.displayName, 'OFFICIAL');
  assert.equal(model.profile.description, 'First paragraph.\n\nSecond paragraph.');
  assert.equal(model.profile.backgroundUrl, 'https://gw.test/ipfs/background');
  assert.equal(model.profile.profileImageTokenReference.tokenId, '42');
  assert.equal(model.links[0].verificationStatus, 'AUTHORED_NOT_VERIFIED');
  assert.equal(model.links[0].kind, 'AUTHORED');
  assert.equal(model.links.find((entry) => entry.id === 'universal-everything').kind, 'SYSTEM');
  assert.equal(model.links.find((entry) => entry.id === 'inscape-profile').url, `https://inscape.test/?view=${ADDRESS}`);
  assert.equal(model.links.find((entry) => entry.id === 'explorer').verificationStatus, 'CANONICAL_ROUTE');
  assert.equal(model.technical.find((entry) => entry.id === 'received').value, '0');
  assert.equal(model.technical.find((entry) => entry.id === 'issued').label, 'ISSUED ASSET CONTRACTS');
  assert.equal(model.technical.find((entry) => entry.id === 'network').value, 'LUKSO / CHAIN 42');
  assert.equal(model.technical.find((entry) => entry.id === 'metadata-integrity').value, 'VERIFIED');
  assert.equal(model.technical.some((entry) => entry.url), false);
  assert.equal(model.technical.some((entry) => /verified badge|followers|nft count/i.test(entry.label)), false);
});

test('applies active draft overlays with provenance and redacts every inactive private value', () => {
  const presentation = createIdentityPresentation();
  presentation.alias = 'DRAFT ALIAS';
  presentation.avatar = { mode: 'official', stableAssetId: '42:0xprivate:0x01', shape: 'round' };
  presentation.bio = { mode: 'official', customText: 'PRIVATE INACTIVE BIO' };
  presentation.tags = { includeOfficial: false, additional: ['draft'] };
  const serialized = JSON.stringify(createProductionIdentityDossierViewModel({
    identity: identity(), contractFacts: facts(), identityPresentation: presentation,
    assetRecords: [{ id: '42:0xprivate:0x01', imageUrl: 'https://private.test/avatar.png' }],
    locationLike: { href: 'https://inscape.test/' }
  }));
  const model = JSON.parse(serialized);
  assert.equal(model.profile.displayName, 'DRAFT ALIAS');
  assert.equal(model.profile.nameProvenance, 'INSCAPE_DRAFT_ALIAS');
  assert.equal(model.profile.avatarUrl, 'https://gw.test/ipfs/official');
  assert.equal(model.profile.description, 'First paragraph.\n\nSecond paragraph.');
  assert.deepEqual(model.profile.tags, ['draft']);
  assert.equal(serialized.includes('PRIVATE INACTIVE BIO'), false);
  assert.equal(serialized.includes('private.test'), false);
  assert.equal(serialized.includes('0xprivate'), false);
});

test('omits unresolved facts and the runtime epoch placeholder instead of emitting false zeroes', () => {
  const model = createProductionIdentityDossierViewModel({
    identity: identity(),
    contractFacts: facts({ chain: errorContractFact(), receivedAssetContracts: errorContractFact(), issuedAssetContracts: errorContractFact() }),
    identityPresentation: createIdentityPresentation(),
    publishedResolution: { status: 'RESOLVED', document: { exportedAt: '1970-01-01T00:00:00.000Z' } },
    locationLike: { href: 'https://inscape.test/' }
  });
  assert.equal(model.technical.some((entry) => entry.id === 'network'), false);
  assert.equal(model.technical.some((entry) => entry.id === 'received' || entry.id === 'issued'), false);
  assert.equal(model.technical.some((entry) => entry.id === 'last-published'), false);
  assert.equal(JSON.stringify(model).includes('1970-01-01'), false);
});

test('uses active INSCAPE avatar and bio while respecting visibility projections', () => {
  const presentation = createIdentityPresentation();
  presentation.avatar = { mode: 'inscape', stableAssetId: 'asset-1', shape: 'square' };
  presentation.bio = { mode: 'inscape', customText: 'Projected bio' };
  presentation.visibility = { links: false, network: false, counts: false, publicationDate: false };
  const model = createProductionIdentityDossierViewModel({
    identity: identity(), contractFacts: facts(), identityPresentation: presentation,
    assetRecords: new Map([['asset-1', { id: 'asset-1', imageUrl: 'https://assets.test/avatar.png' }]]),
    locationLike: { href: 'https://inscape.test/' }
  });
  assert.equal(model.profile.avatarUrl, 'https://assets.test/avatar.png');
  assert.equal(model.profile.avatarProvenance, 'INSCAPE_DRAFT_ASSET');
  assert.equal(model.profile.description, 'Projected bio');
  assert.deepEqual(model.links, []);
  assert.equal(model.technical.some((entry) => ['network', 'received', 'issued'].includes(entry.id)), false);
});
