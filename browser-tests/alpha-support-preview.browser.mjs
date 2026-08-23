import assert from 'node:assert/strict';
import test from 'node:test';
import { runOwnerProductionPreviewGate } from './owner-production-preview-harness.mjs';

const previewUrl = 'http://127.0.0.1:4173';
const expectedRelease = String(process.env.EXPECTED_RELEASE_COMMIT || '').toLowerCase();

test('canonical v9 publication rack exposes bounded local support evidence', async () => {
  const outcome = await runOwnerProductionPreviewGate(async ({ frame, page }) => {
    const requests = [];
    const recordRequest = (request) => requests.push({ method: request.method(), url: request.url() });
    page.on('request', recordRequest);
    const toolbar = frame.getByRole('navigation', { name: 'System Workflow', exact: true });
    const publishButton = toolbar.getByRole('button', { name: 'Publish', exact: true });
    await publishButton.waitFor({ state: 'visible', timeout: 10_000 });
    assert.equal(await publishButton.isEnabled(), true);
    await publishButton.evaluate((button) => button.click());
    const rack = frame.getByRole('complementary', { name: 'Version 9 publication' });
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
    const supportContrast = await support.evaluate((node) => {
      const rgb = (value) => (value.match(/[\d.]+/gu) || []).slice(0, 3).map(Number);
      const luminance = (value) => {
        const channels = rgb(value).map((channel) => {
          const normalized = channel / 255;
          return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
        });
        return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
      };
      const background = luminance(getComputedStyle(node).backgroundColor);
      return [...node.querySelectorAll('strong,button,summary,pre')].map((element) => {
        const foreground = luminance(getComputedStyle(element).color);
        return (Math.max(background, foreground) + 0.05) / (Math.min(background, foreground) + 0.05);
      });
    });
    assert.ok(supportContrast.every((ratio) => ratio >= 4.5),
      `Alpha support text contrast must remain at least 4.5:1; received ${supportContrast.join(', ')}`);
    assert.match(evidence, /release: [0-9a-f]{7,40}|release: (?:local|development)/u);
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
  if (expectedRelease) assert.match(outcome.result.evidence, new RegExp(expectedRelease, 'u'));
  assert.deepEqual(outcome.cleanup.remainingPids, []);
});
