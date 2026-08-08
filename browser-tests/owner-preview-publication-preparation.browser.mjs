import assert from 'node:assert/strict';
import test from 'node:test';
import { OWNER_PRODUCTION_PREVIEW_URL, runOwnerProductionPreviewGate } from './owner-production-preview-harness.mjs';
import {
  TASK4B_CONTRACT_A,
  TASK4B_CREATED_COLLECTION,
  TASK4B_CREATED_LSP7,
  TASK4B_CREATED_TOKEN_ID,
  TASK4B_PROFILE_A,
  createTask4BIndexerFixture,
  installTask4BStorageFixture,
  task4bAssetId,
  task4bCollectionTokenRow,
  task4bCreatedAssetRow,
  task4bPlacement,
  task4bProfileSeed,
} from './owner-task4b-fixtures.mjs';

const previewUrl = OWNER_PRODUCTION_PREVIEW_URL;
const publicPlacement = task4bPlacement('task4b-public-placement', task4bAssetId(TASK4B_CONTRACT_A));
const createdLsp7Placement = task4bPlacement('task4b-created-lsp7-placement', task4bAssetId(TASK4B_CREATED_LSP7), {
  column: 2, row: 2, navigationOrder: 1, layer: 1,
});
const createdLsp8Placement = task4bPlacement('task4b-created-lsp8-placement',
  `42:${TASK4B_CREATED_COLLECTION}:${TASK4B_CREATED_TOKEN_ID}`, {
    column: 20, row: 10, navigationOrder: 2, layer: 2,
  });
const privatePlacement = task4bPlacement('task4b-private-placement', task4bAssetId(TASK4B_CONTRACT_A), {
  column: 20, navigationOrder: 3, layer: 3, visibility: 'PRIVATE',
});
const profileSeeds = [task4bProfileSeed({
  contractAddress: TASK4B_CONTRACT_A,
  collectionTokensByContract: {
    [TASK4B_CREATED_COLLECTION]: [task4bCollectionTokenRow({
      collectionAddress: TASK4B_CREATED_COLLECTION, name: 'CREATED LSP8 TOKEN', previewUrl,
    })],
  },
  createdAssetRows: [
    task4bCreatedAssetRow({ contractAddress: TASK4B_CREATED_LSP7, name: 'CREATED LSP7', previewUrl,
      profileAddress: TASK4B_PROFILE_A }),
    task4bCreatedAssetRow({ contractAddress: TASK4B_CREATED_COLLECTION, isCollection: true,
      name: 'CREATED LSP8 COLLECTION', previewUrl, profileAddress: TASK4B_PROFILE_A }),
  ],
  name: 'ALPHA PUBLICATION ASSET',
  placements: [publicPlacement, createdLsp7Placement, createdLsp8Placement, privatePlacement],
  previewUrl,
  profileAddress: TASK4B_PROFILE_A,
})];
const graphRequests = [];

test('Task 4B production preview projection and publication preparation remain public-only and inert', async () => {
  const outcome = await runOwnerProductionPreviewGate(async ({ frame, ledger, page }) => {
    const requests = [];
    const recordRequest = (request) => requests.push({ method: request.method(), url: request.url() });
    page.on('request', recordRequest);
    const toolbar = frame.getByRole('navigation', { name: 'Owner workspace tools' });
    const previewTrigger = toolbar.getByRole('button', { name: 'PREVIEW', exact: true });
    assert.equal(await frame.getByRole('region', { name: 'Modulator' }).count(), 0,
      'Library unexpectedly covered the owner grid at startup');
    for (const placementId of ['task4b-created-lsp7-placement', 'task4b-created-lsp8-placement']) {
      await frame.locator(`.owner-lattice-runtime-placeholder[data-placement-id="${placementId}"]`)
        .waitFor({ state: 'detached', timeout: 15_000 });
      await frame.locator(`[data-placement-id="${placementId}"]`).waitFor({ state: 'attached', timeout: 10_000 });
    }
    assert.equal(graphRequests.filter(({ operation }) => operation === 'ReferencedCreations').length, 1,
      'Curated creator references did not resolve in one bounded request');
    assert.equal(graphRequests.filter(({ operation }) => operation === 'ProfileCreations').length, 0,
      'The full creations inventory loaded before the owner opened Library');
    assert.equal(graphRequests.filter(({ operation }) => operation === 'CollectionTokens').length, 0,
      'Curated LSP8 resolution enumerated the collection');
    const categoriesTrigger = frame.getByRole('button', { name: 'CATEGORIES', exact: true });
    const assertLibraryReady = async (phase) => {
      await frame.waitForFunction((expected) => {
        const cards = [...document.querySelectorAll('.modul8r-library .lattice-browser-asset')];
        return cards.length === expected && cards.every((card) => {
          const image = card.querySelector('img');
          return image?.complete && image.naturalWidth > 0;
        });
      }, 3, { timeout: 10_000 });
      assert.equal(await frame.locator('.modul8r-library .lattice-browser-asset').count(), 3,
        `${phase} did not expose the complete Library on one Categories request`);
    };
    await categoriesTrigger.click({ timeout: 10_000 });
    await assertLibraryReady('Initial open');
    assert.equal(graphRequests.filter(({ operation }) => operation === 'ProfileCreations').length, 1,
      'Opening Library did not request the full creations inventory exactly once');
    await frame.getByRole('button', { name: 'Close Modulator' }).click({ timeout: 10_000 });
    await frame.getByRole('region', { name: 'Modulator' }).waitFor({ state: 'detached', timeout: 10_000 });
    await categoriesTrigger.click({ timeout: 10_000 });
    await assertLibraryReady('Close and reopen');
    await frame.getByRole('button', { name: 'Close Modulator' }).click({ timeout: 10_000 });
    await frame.getByRole('region', { name: 'Modulator' }).waitFor({ state: 'detached', timeout: 10_000 });
    const graphRequestsBeforePreview = graphRequests.length;
    await previewTrigger.click({ timeout: 10_000 });
    const visitor = frame.getByRole('main', { name: 'Published lattice visitor world' });
    await visitor.waitFor({ state: 'visible', timeout: 15_000 });
    await visitor.locator('[data-placement-id="task4b-public-placement"]').waitFor({ state: 'attached', timeout: 10_000 });
    assert.equal(await visitor.locator('[data-placement-id]').count(), 3, 'Preview did not project all three public placements');
    assert.equal(await visitor.locator('[data-placement-id="task4b-private-placement"]').count(), 0,
      'Private placement leaked into Preview');
    await visitor.getByRole('button', { name: 'EXIT PREVIEW', exact: true }).click({ timeout: 10_000 });
    await toolbar.waitFor({ state: 'visible', timeout: 10_000 });
    await frame.waitForFunction((trigger) => document.activeElement === trigger, await previewTrigger.elementHandle(), { timeout: 10_000 });
    assert.equal(await frame.getByRole('region', { name: 'Modulator' }).count(), 0,
      'Returning from Preview opened Library without an owner request');
    for (const placementId of ['task4b-created-lsp7-placement', 'task4b-created-lsp8-placement']) {
      assert.equal(await frame.locator(`.owner-lattice-runtime-placeholder[data-placement-id="${placementId}"]`).count(), 0,
        `${placementId} lost its creator record after Preview`);
      await frame.locator(`[data-placement-id="${placementId}"]`).waitFor({ state: 'attached', timeout: 10_000 });
    }
    assert.equal(graphRequests.length, graphRequestsBeforePreview,
      'Preview or its owner return refetched an already accepted asset authority');
    await categoriesTrigger.click({ timeout: 10_000 });
    await assertLibraryReady('Preview return');
    await frame.getByRole('button', { name: 'Close Modulator' }).click({ timeout: 10_000 });
    await frame.getByRole('region', { name: 'Modulator' }).waitFor({ state: 'detached', timeout: 10_000 });

    await toolbar.getByRole('button', { name: 'PUBLISH', exact: true }).click({ timeout: 10_000 });
    const rack = frame.getByRole('complementary', { name: 'Version 8 publication' });
    await rack.waitFor({ state: 'visible', timeout: 10_000 });
    const publishButton = rack.getByRole('button', { name: 'PUBLISH VERSION 8', exact: true });
    assert.equal(await publishButton.isDisabled(), true, 'Wallet publication was enabled before CID verification');
    await rack.getByRole('button', { name: 'PREPARE SNAPSHOT', exact: true }).click({ timeout: 10_000 });
    await rack.getByText(/Version 8 revision 1 is frozen/u).waitFor({ state: 'visible', timeout: 10_000 });
    assert.equal(await publishButton.isDisabled(), true, 'Snapshot preparation incorrectly enabled wallet publication');
    const downloadPromise = page.waitForEvent('download', { timeout: 10_000 });
    await rack.getByRole('button', { name: 'DOWNLOAD', exact: true }).click({ timeout: 10_000 });
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const bytes = Buffer.concat(chunks).toString('utf8');
    const snapshot = JSON.parse(bytes);
    assert.equal(snapshot.version, 8);
    assert.equal(snapshot.profile.address, TASK4B_PROFILE_A);
    const publicationPlacements = snapshot.lattice.tables.flatMap(({ placements }) => placements);
    assert.deepEqual(publicationPlacements.map(({ id }) => id), [
      'task4b-public-placement', 'task4b-created-lsp7-placement', 'task4b-created-lsp8-placement',
    ],
      'Canonical publication snapshot did not exclude private placement state');
    assert.equal(bytes.includes('task4b-private-placement'), false, 'Canonical download contains private placement bytes');
    assert.equal(requests.some(({ method, url }) => method === 'POST' && new URL(url).pathname === '/api/profile-publications'), false,
      'Publication preparation performed an IPFS upload');
    const fixture = await page.evaluate(() => ({
      forbiddenRequests: [...window.__ownerPreviewFixture.forbiddenRequests],
      providerMethods: window.__ownerPreviewFixture.requests.map(({ method }) => method),
    }));
    assert.deepEqual(fixture.forbiddenRequests, [], 'Publication preparation invoked a signing or transaction provider method');
    ledger.record('task4b-publication-prepared', {
      bytes: Buffer.byteLength(bytes), filename: download.suggestedFilename(), placements: publicationPlacements.length,
    });
    page.off('request', recordRequest);
    return { bytes, filename: download.suggestedFilename() };
  }, {
    contextOptions: { acceptDownloads: true },
    contextInitScript: installTask4BStorageFixture,
    contextInitScriptArg: { profiles: profileSeeds, seedDrafts: true },
    graphFixtureResponse: createTask4BIndexerFixture(profileSeeds, (request) => graphRequests.push(request)),
    expectedControlledGraphAbortOperations: ['ReferencedCreations', 'ProfileCreations'],
    label: 'owner-preview-publication-preparation',
    openModulatorForGate: false,
  });
  assert.ok(outcome.result.bytes.length > 0);
  assert.deepEqual(outcome.cleanup.remainingPids, []);
});
