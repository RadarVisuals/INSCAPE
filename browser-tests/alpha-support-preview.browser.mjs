import assert from 'node:assert/strict';
import test from 'node:test';
import { runOwnerProductionPreviewGate } from './owner-production-preview-harness.mjs';

const previewUrl = 'http://127.0.0.1:4173';
const expectedRelease = String(process.env.EXPECTED_RELEASE_COMMIT || '').toLowerCase();

test('publication rack keeps technical support evidence out of the normal path', async () => {
  const outcome = await runOwnerProductionPreviewGate(async ({ frame, page }) => {
    const requests = [];
    const recordRequest = (request) => requests.push({ method: request.method(), url: request.url() });
    page.on('request', recordRequest);
    const toolbar = frame.getByRole('navigation', { name: 'System Workflow', exact: true });
    const publishButton = toolbar.getByRole('button', { name: 'Publish', exact: true });
    await publishButton.waitFor({ state: 'visible', timeout: 10_000 });
    assert.equal(await publishButton.isEnabled(), true);
    await publishButton.evaluate((button) => button.click());
    const rack = frame.getByRole('complementary', { name: 'Publish profile' });
    await rack.waitFor({ state: 'visible', timeout: 10_000 });
    const support = rack.getByRole('region', { name: 'Alpha support' });
    assert.equal(await support.count(), 0, 'technical support detail appears only after a publication error');
    assert.equal(requests.some(({ method }) => method !== 'GET'), false, 'Support evidence caused a non-GET request');
    const fixture = await page.evaluate(() => ({
      forbiddenRequests: [...window.__ownerPreviewFixture.forbiddenRequests],
      providerMethods: window.__ownerPreviewFixture.requests.map(({ method }) => method),
    }));
    assert.deepEqual(fixture.forbiddenRequests, []);
    page.off('request', recordRequest);
    return { supportHidden: true };
  }, {
    label: 'alpha-support-preview',
    ownerMainSelector: 'main.system-workflow',
    ownerNavigationName: 'System Workflow',
    previewUrl,
    expectedControlledConsoleErrors: [
      '[wallet-permission-check] (intermediate value).getPermissions is not a function',
      '[wallet-permission-check] erc725.getPermissions is not a function',
    ],
    expectedControlledRpcAbortMethods: ['eth_chainId'],
  });
  if (expectedRelease) assert.equal(typeof expectedRelease, 'string');
  assert.deepEqual(outcome.cleanup.remainingPids, []);
});
