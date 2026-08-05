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
const expectedRelease = String(process.env.EXPECTED_RELEASE_COMMIT || '').toLowerCase();
const profileSeeds = [task4bProfileSeed({
  contractAddress: TASK4B_CONTRACT_A,
  name: 'ALPHA SUPPORT ASSET',
  placements: [task4bPlacement('alpha-support-placement', task4bAssetId(TASK4B_CONTRACT_A))],
  previewUrl,
  profileAddress: TASK4B_PROFILE_A,
})];

test('Task 5 canonical publication rack exposes bounded local support evidence', async () => {
  assert.match(expectedRelease, /^[0-9a-f]{40}$/u, 'EXPECTED_RELEASE_COMMIT must be the exact deployed SHA');
  const outcome = await runOwnerProductionPreviewGate(async ({ frame, page }) => {
    const requests = [];
    const recordRequest = (request) => requests.push({ method: request.method(), url: request.url() });
    page.on('request', recordRequest);
    const toolbar = frame.getByRole('navigation', { name: 'Owner workspace tools' });
    await toolbar.getByRole('button', { name: 'PUBLISH', exact: true }).click({ timeout: 10_000 });
    const rack = frame.getByRole('complementary', { name: 'Version 8 publication' });
    await rack.waitFor({ state: 'visible', timeout: 10_000 });
    const support = rack.getByRole('region', { name: 'Alpha support' });
    await support.waitFor({ state: 'visible', timeout: 10_000 });
    await support.getByText('ALPHA SUPPORT', { exact: true }).waitFor({ state: 'visible' });
    const [supportBox, viewportHeight] = await Promise.all([
      support.boundingBox(),
      frame.evaluate(() => window.innerHeight),
    ]);
    assert.ok(supportBox, 'Alpha support must have a rendered bounding box');
    assert.ok(supportBox.y >= 0 && supportBox.y + supportBox.height <= viewportHeight,
      'Alpha support must be inside the visible owner viewport without scrolling');
    await support.getByText('REVIEW', { exact: true }).click();
    const evidence = await support.locator('pre').innerText();
    assert.match(evidence, new RegExp(`release: ${expectedRelease}`, 'u'));
    assert.match(evidence, /route: OWNER/u);
    assert.match(evidence, /code: ALPHA_SUPPORT_REQUEST/u);
    assert.doesNotMatch(evidence, /https?:|message:|localStorage|signature|calldata/iu);
    await support.getByRole('button', { name: 'COPY DETAILS', exact: true }).click();
    await support.getByText(/^(?:COPIED|COPY FAILED - select the details below)$/u).waitFor({ state: 'visible', timeout: 5_000 });
    assert.equal(requests.some(({ method }) => method !== 'GET'), false, 'Support evidence caused a non-GET request');
    const fixture = await page.evaluate(() => ({
      forbiddenRequests: [...window.__ownerPreviewFixture.forbiddenRequests],
      providerMethods: window.__ownerPreviewFixture.requests.map(({ method }) => method),
    }));
    assert.deepEqual(fixture.forbiddenRequests, []);
    page.off('request', recordRequest);
    return { evidence };
  }, {
    contextInitScript: installTask4BStorageFixture,
    contextInitScriptArg: { profiles: profileSeeds, seedDrafts: true },
    graphFixtureResponse: createTask4BIndexerFixture(profileSeeds),
    label: 'alpha-support-preview',
  });
  assert.match(outcome.result.evidence, new RegExp(expectedRelease, 'u'));
  assert.deepEqual(outcome.cleanup.remainingPids, []);
});
