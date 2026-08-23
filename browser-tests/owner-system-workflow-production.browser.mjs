import assert from 'node:assert/strict';
import test from 'node:test';
import { runOwnerProductionPreviewGate } from './owner-production-preview-harness.mjs';

const LOCAL_PRODUCTION_PREVIEW = 'http://127.0.0.1:4173';

test('selected System Workflow owner shell passes the hardware production authority gate', async () => {
  const outcome = await runOwnerProductionPreviewGate(async ({ frame }) => {
    const runtime = frame.locator('main.system-workflow');
    await runtime.waitFor({ state: 'visible' });
    assert.equal(await frame.getByRole('navigation', { name: 'System Workflow', exact: true }).count(), 1);
    assert.equal(await frame.getByRole('button', { name: 'Publish', exact: true }).isVisible(), true);
    return { selectedRuntimeVisible: true };
  }, {
    label: 'owner-system-workflow-production',
    openModulatorForGate: false,
    ownerMainSelector: 'main.system-workflow',
    ownerNavigationName: 'System Workflow',
    previewUrl: LOCAL_PRODUCTION_PREVIEW,
    expectedControlledConsoleErrors: [
      '[wallet-permission-check] (intermediate value).getPermissions is not a function',
      '[wallet-permission-check] erc725.getPermissions is not a function',
    ],
    expectedControlledRpcAbortMethods: ['eth_chainId'],
  });
  assert.equal(outcome.result.selectedRuntimeVisible, true);
  assert.deepEqual(outcome.cleanup.remainingPids, []);
});
