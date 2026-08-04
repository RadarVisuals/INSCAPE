import assert from 'node:assert/strict';
import test from 'node:test';
import { runOwnerProductionPreviewGate } from './owner-production-preview-harness.mjs';
import {
  TASK4B_CONTRACT_A,
  TASK4B_PROFILE_A,
  createTask4BIndexerFixture,
  installTask4BStorageFixture,
  task4bAssetId,
  task4bPlacement,
  task4bProfileSeed,
} from './owner-task4b-fixtures.mjs';

const previewUrl = 'https://deploy-preview-2--enterinscape.netlify.app';
const publicPlacement = task4bPlacement('task4b-public-placement', task4bAssetId(TASK4B_CONTRACT_A));
const privatePlacement = task4bPlacement('task4b-private-placement', task4bAssetId(TASK4B_CONTRACT_A), {
  column: 20, navigationOrder: 1, layer: 1, visibility: 'PRIVATE',
});
const profileSeeds = [task4bProfileSeed({
  contractAddress: TASK4B_CONTRACT_A,
  name: 'ALPHA PUBLICATION ASSET',
  placements: [publicPlacement, privatePlacement],
  previewUrl,
  profileAddress: TASK4B_PROFILE_A,
})];

test('Task 4B production preview projection and publication preparation remain public-only and inert', async () => {
  const outcome = await runOwnerProductionPreviewGate(async ({ frame, ledger, page }) => {
    const requests = [];
    const recordRequest = (request) => requests.push({ method: request.method(), url: request.url() });
    page.on('request', recordRequest);
    const toolbar = frame.getByRole('navigation', { name: 'Owner workspace tools' });
    const previewTrigger = toolbar.getByRole('button', { name: 'PREVIEW', exact: true });
    await previewTrigger.click({ timeout: 10_000 });
    const visitor = frame.getByRole('main', { name: 'Published lattice visitor world' });
    await visitor.waitFor({ state: 'visible', timeout: 15_000 });
    await visitor.locator('[data-placement-id="task4b-public-placement"]').waitFor({ state: 'attached', timeout: 10_000 });
    assert.equal(await visitor.locator('[data-placement-id]').count(), 1, 'Preview did not project exactly one public placement');
    assert.equal(await visitor.locator('[data-placement-id="task4b-private-placement"]').count(), 0,
      'Private placement leaked into Preview');
    await visitor.getByRole('button', { name: 'EXIT PREVIEW', exact: true }).click({ timeout: 10_000 });
    await toolbar.waitFor({ state: 'visible', timeout: 10_000 });
    await frame.waitForFunction((trigger) => document.activeElement === trigger, await previewTrigger.elementHandle(), { timeout: 10_000 });

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
    assert.deepEqual(publicationPlacements.map(({ id }) => id), ['task4b-public-placement'],
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
    graphFixtureResponse: createTask4BIndexerFixture(profileSeeds),
    label: 'owner-preview-publication-preparation',
  });
  assert.ok(outcome.result.bytes.length > 0);
  assert.deepEqual(outcome.cleanup.remainingPids, []);
});
