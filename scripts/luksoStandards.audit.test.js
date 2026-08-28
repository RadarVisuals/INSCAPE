import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const targetRoot = process.env.INSCAPE_LUKSO_AUDIT_TARGET
  ? resolve(projectRoot, process.env.INSCAPE_LUKSO_AUDIT_TARGET) : projectRoot;
const readProject = (relativePath) => readFileSync(resolve(projectRoot, relativePath), 'utf8');
const readTarget = (relativePath) => readFileSync(resolve(targetRoot, relativePath), 'utf8');

test('project instructions permanently route LUKSO work through the reviewed baseline', () => {
  const agents = readProject('AGENTS.md');
  const baseline = readProject('docs/standards/LUKSO_ENGINEERING_BASELINE.md');
  assert.match(agents, /LUKSO_ENGINEERING_BASELINE\.md/u);
  assert.match(agents, /creator attribution, LSP12 issuance, LSP5 receipt/u);
  assert.match(baseline, /Creator attribution[\s\S]*LSP4/u);
  assert.match(baseline, /Issued asset[\s\S]*LSP12/u);
  assert.match(baseline, /Current LSP7 holding[\s\S]*balanceOf/u);
  assert.match(baseline, /Current LSP8 holding[\s\S]*tokenIdsOf/u);
});

test('legacy ownership fallback discovers through LSP5 and then verifies each asset standard', () => {
  const source = readTarget('src/library/data/luksoRpcProfileRepository.js');
  assert.match(source, /LSP5ReceivedAssets\[\]/u);
  assert.match(source, /supportsInterface/u);
  assert.match(source, /name: 'balanceOf'/u);
  assert.match(source, /name: 'tokenIdsOf'/u);
  assert.doesNotMatch(source, /LSP5[\s\S]{0,160}ownershipVerified\s*:\s*true/u);
});

test('issued, creator-attributed and currently held relationships remain separate', () => {
  const facts = readTarget('src/profileIdentity/data/luksoProfileContractRepository.js');
  const creations = readTarget('src/creations/data/luksoCreationsRepository.js');
  const normalized = readTarget('src/creations/domain/normalizeCreation.js');
  const union = readTarget('src/lattice/browser/libraryAssetUnion.js');
  assert.match(facts, /LSP12IssuedAssets\.json/u);
  assert.match(facts, /readArrayLength\('LSP12IssuedAssets\[\]'\)/u);
  assert.match(creations, /AssetCreators/u);
  assert.match(creations, /TokenCreators/u);
  assert.doesNotMatch(creations, /\bHold\s*\(/u);
  for (const field of ['viewedProfileIsCreator', 'creatorAttributionLevel', 'ownershipKnown',
    'isOwnedByViewedProfile', 'currentOwnerAddress']) assert.match(normalized, new RegExp(`\\b${field}\\b`, 'u'));
  assert.match(union, /created:\s*true,\s*owned:\s*false/u);
  assert.match(union, /isOwnedByViewedProfile:\s*false/u);
});

test('metadata dossiers require provenance and do not convert creator evidence into owner authority', () => {
  const owned = readTarget('src/library/domain/normalizeProfileAsset.js');
  const created = readTarget('src/creations/domain/normalizeCreation.js');
  const publishedAsset = readTarget('src/profileDocument/domain/profileDocumentV9Asset.js');
  const dossier = readTarget('src/profileDocument/components/profileDocumentV9FocusViewModel.js');
  assert.match(owned, /fieldProvenance/u);
  assert.match(created, /fieldProvenance/u);
  assert.match(publishedAsset, /fieldProvenance\?\.creators/u);
  assert.match(publishedAsset, /canonicalCreatorProvenance\.source/u);
  assert.match(publishedAsset, /canonicalCreatorProvenance\.scope/u);
  assert.match(dossier, /creator\.source/u);
  assert.match(dossier, /creator\.scope/u);
  assert.doesNotMatch(dossier, /viewedProfileIsCreator[^\n]*isOwnedByViewedProfile\s*=\s*true/u);
});

test('mainnet identity remains explicit and HTTPS-only at the central Library boundary', () => {
  const config = readTarget('src/library/config.js');
  assert.match(config, /LUKSO_CHAIN_ID = 42/u);
  assert.match(config, /https:\/\/rpc\.mainnet\.lukso\.network/u);
  assert.doesNotMatch(config, /http:\/\//u);
});
