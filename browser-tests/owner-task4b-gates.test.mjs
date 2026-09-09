import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { validateLatticeProductionDraft } from '../src/lattice/domain/latticeProductionDraft.js';
import { createOwnerProductionPreviewFixtureHtml } from './owner-production-preview-harness.mjs';
import {
  TASK4B_CONTRACT_A,
  TASK4B_PROFILE_A,
  TASK4B_PROFILE_B,
  createTask4BIndexerFixture,
  task4bAssetId,
  task4bPlacement,
  task4bProfileSeed,
} from './owner-task4b-fixtures.mjs';

const previewUrl = 'https://deploy-preview-2--enterinscape.netlify.app';

test('Task 4B fixture authority switching is allowlisted and retains the official channel contract', () => {
  const html = createOwnerProductionPreviewFixtureHtml({
    authorityProfiles: [TASK4B_PROFILE_A, TASK4B_PROFILE_B], previewUrl, profileAddress: TASK4B_PROFILE_A,
  });
  assert.match(html, /new Set\(\["0x1111[^"]+","0x2222[^"]+"\]\)/u);
  assert.match(html, /await connector\.setContextAccounts\(contextAccounts\)/u);
  assert.match(html, /await clientChannel\.setupChannel\(enable, allowedAccounts, contextAccounts, chainId\)/u);
  assert.match(html, /__task4OwnerApplyAuthority/u);
  assert.match(html, /outside its explicit allowlist/u);
});

test('Task 4B seeded production drafts remain canonical Version 2 records', () => {
  const placement = task4bPlacement('task4b-validation-placement', task4bAssetId(TASK4B_CONTRACT_A));
  const seed = task4bProfileSeed({
    contractAddress: TASK4B_CONTRACT_A, name: 'VALIDATION ASSET', placements: [placement], previewUrl,
    profileAddress: TASK4B_PROFILE_A,
  });
  const validation = validateLatticeProductionDraft(seed.draft);
  assert.equal(validation.valid, true, JSON.stringify(validation.errors));
  assert.equal(validation.value.tables[4].placements.length, 1);
});

test('Task 4B indexer fixture remains profile-scoped and canonical', () => {
  const profiles = [
    task4bProfileSeed({ contractAddress: TASK4B_CONTRACT_A, name: 'ALPHA', previewUrl, profileAddress: TASK4B_PROFILE_A }),
  ];
  const respond = createTask4BIndexerFixture(profiles);
  const known = respond({ postData: JSON.stringify({ variables: { owner: TASK4B_PROFILE_A } }) });
  const unknown = respond({ postData: JSON.stringify({ variables: { owner: TASK4B_PROFILE_B } }) });
  assert.equal(known.data.owned_asset.length, 1);
  assert.equal(known.data.owned_asset[0].address, TASK4B_CONTRACT_A);
  assert.equal(unknown.data.owned_asset.length, 0);
});

test('Task 4B gates are independent production-preview journeys with no automated publication', async () => {
  const names = [
    'owner-entry-authority.browser.mjs',
    'owner-authoring-persistence-preview.browser.mjs',
    'owner-profile-isolation-preview.browser.mjs',
    'owner-preview-publication-preparation.browser.mjs',
  ];
  const sources = await Promise.all(names.map((name) => readFile(new URL(name, import.meta.url), 'utf8')));
  for (const [index, source] of sources.entries()) {
    assert.match(source, /runOwnerProductionPreviewGate/u, `${names[index]} does not own production-preview setup/cleanup`);
    assert.doesNotMatch(source, /waitForTimeout|setTimeout\(/u, `${names[index]} uses a fixed sleep`);
  }
  const publication = sources.at(-1);
  assert.match(publication, /PREPARE SNAPSHOT/u);
  assert.match(publication, /DOWNLOAD/u);
  assert.doesNotMatch(publication, /getByRole\('button', \{ name: 'UPLOAD \+ VERIFY'[^\n]+\.click/u);
  assert.doesNotMatch(publication, /await publishButton\.click/u);
  assert.match(publication, /profile-publications/u);
  assert.match(publication, /forbiddenRequests/u);
  assert.match(publication, /contextOptions: \{ acceptDownloads: true \}/u);
  for (const source of sources.slice(1)) assert.match(source, /graphFixtureResponse: createTask4BIndexerFixture/u);
  assert.match(sources[0], /expectedControlledConsoleErrors:[\s\S]*\[wallet-permission-check\] \(intermediate value\)\.getPermissions is not a function/u,
    'Authority gate must classify only the exact controlled mismatch diagnostic');
});
