import assert from 'node:assert/strict';
import test from 'node:test';
import { runOwnerProductionPreviewGate } from './owner-production-preview-harness.mjs';
import {
  TASK4B_CONTRACT_A,
  TASK4B_CONTRACT_B,
  TASK4B_PROFILE_A,
  TASK4B_PROFILE_B,
  createTask4BIndexerFixture,
  installTask4BStorageFixture,
  task4bDraftKey,
  task4bProfileSeed,
} from './owner-task4b-fixtures.mjs';

const previewUrl = 'https://deploy-preview-2--enterinscape.netlify.app';
const profileSeeds = [
  task4bProfileSeed({ contractAddress: TASK4B_CONTRACT_A, name: 'ALPHA AUTHORING ASSET', previewUrl, profileAddress: TASK4B_PROFILE_A }),
  task4bProfileSeed({ contractAddress: TASK4B_CONTRACT_B, name: 'BETA AUTHORING ASSET', previewUrl, profileAddress: TASK4B_PROFILE_B }),
];

async function switchAuthority(page, profileAddress) {
  return page.evaluate((profile) => window.__task4OwnerApplyAuthority({
    enable: true, allowedAccounts: [profile], contextAccounts: [profile], chainId: 42,
  }), profileAddress);
}

test('Task 4B production preview authoring persists one exact canonical placement across remount', async () => {
  const outcome = await runOwnerProductionPreviewGate(async ({ frame, ledger, page }) => {
    const draftKey = task4bDraftKey(TASK4B_PROFILE_A);
    assert.equal(await frame.evaluate((key) => localStorage.getItem(key), draftKey), null,
      'Authoring fixture unexpectedly started with a canonical draft');
    const arrange = frame.getByRole('button', { name: 'ARRANGE', exact: true });
    await arrange.click({ timeout: 10_000 });
    assert.equal(await arrange.getAttribute('aria-pressed'), 'true');
    const asset = frame.locator('.lattice-browser-assets').getByRole('button', { name: /ALPHA AUTHORING ASSET/u });
    await asset.waitFor({ state: 'visible', timeout: 10_000 });
    const assetBox = await asset.boundingBox();
    const iframeBox = await page.getByTitle('INSCAPE production preview').boundingBox();
    const targetInFrame = await frame.evaluate(() => {
      const table = document.querySelector('.owner-lattice-table[data-active]');
      const rectangle = table?.getBoundingClientRect();
      if (!rectangle) return null;
      const left = Math.max(0, rectangle.left); const right = Math.min(innerWidth, rectangle.right);
      const top = Math.max(0, rectangle.top); const bottom = Math.min(innerHeight, rectangle.bottom);
      for (let yRatio = 0.05; yRatio < 1; yRatio += 0.05) for (let xRatio = 0.05; xRatio < 1; xRatio += 0.05) {
        const x = left + (right - left) * xRatio;
        const y = top + (bottom - top) * yRatio;
        if (!document.elementFromPoint(x, y)?.closest?.('[data-lattice-chrome]')) return { x, y };
      }
      return null;
    });
    assert.ok(assetBox && iframeBox && targetInFrame, 'Library asset or unobstructed active-table drop point has no geometry');
    const target = { x: iframeBox.x + targetInFrame.x, y: iframeBox.y + targetInFrame.y };
    await page.mouse.move(assetBox.x + assetBox.width / 2, assetBox.y + assetBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 8 });
    await page.mouse.up();
    const placement = frame.locator('button.lattice-production-movement-control[data-placement-id]').first();
    await placement.waitFor({ state: 'attached', timeout: 10_000 });
    const placementId = await placement.getAttribute('data-placement-id');
    assert.ok(placementId, 'ARRANGE drop did not create a canonical placement ID');

    const move = frame.getByRole('button', { name: /Move placement: ALPHA AUTHORING ASSET/u });
    await move.focus({ timeout: 10_000 });
    await move.press('Enter', { timeout: 10_000 });
    await move.press('ArrowRight', { timeout: 10_000 });
    const resize = frame.getByRole('button', { name: /Resize placement from south-east corner: ALPHA AUTHORING ASSET/u });
    await resize.press('ArrowRight', { timeout: 10_000 });
    await move.press('Shift+F10', { timeout: 10_000 });
    await frame.getByRole('menu', { name: new RegExp(`Placement actions: ${placementId}`) })
      .getByRole('menuitem', { name: /Frame & mat/u }).click({ timeout: 10_000 });
    const inspector = frame.getByRole('dialog', { name: /FRAME & MAT/u });
    await inspector.waitFor({ state: 'visible', timeout: 10_000 });
    await inspector.getByRole('combobox', { name: 'FRAME', exact: true }).selectOption('DOSSIER', { timeout: 10_000 });
    await inspector.getByRole('combobox', { name: 'MAT PRESET', exact: true }).selectOption('DOSSIER', { timeout: 10_000 });
    await inspector.getByRole('button', { name: 'APPLY', exact: true }).click({ timeout: 10_000 });

    const persistedBytes = await frame.evaluate((key) => localStorage.getItem(key), draftKey);
    assert.ok(persistedBytes, 'Completed authoring did not persist canonical bytes');
    const persisted = JSON.parse(persistedBytes);
    const accepted = persisted.tables[4].placements;
    assert.equal(accepted.length, 1, 'Completed authoring persisted duplicate placements');
    assert.equal(accepted[0].id, placementId);
    assert.equal(accepted[0].frameId, 'DOSSIER');
    assert.equal(accepted[0].mat.enabled, true);
    ledger.record('task4b-authoring-accepted', {
      placementId, column: accepted[0].column, columnSpan: accepted[0].columnSpan, frameId: accepted[0].frameId,
    });

    await switchAuthority(page, TASK4B_PROFILE_B);
    await frame.getByRole('button', { name: /BETA AUTHORING ASSET/u }).waitFor({ state: 'visible', timeout: 10_000 });
    assert.equal(await frame.locator('button.lattice-production-movement-control[data-placement-id]').count(), 0,
      'Owner A placement leaked into owner B during remount');
    await switchAuthority(page, TASK4B_PROFILE_A);
    await frame.getByRole('button', { name: /ALPHA AUTHORING ASSET/u }).waitFor({ state: 'visible', timeout: 10_000 });
    await frame.locator(`[data-placement-id="${placementId}"]`).waitFor({ state: 'attached', timeout: 10_000 });
    const remountedBytes = await frame.evaluate((key) => localStorage.getItem(key), draftKey);
    assert.equal(remountedBytes, persistedBytes,
      'Profile remount changed accepted canonical bytes');
    assert.equal(JSON.parse(remountedBytes).tables[4].placements.length, 1,
      'Profile remount duplicated the canonical placement record');
    return { placementId, persistedBytes };
  }, {
    authorityProfiles: [TASK4B_PROFILE_A, TASK4B_PROFILE_B],
    contextInitScript: installTask4BStorageFixture,
    contextInitScriptArg: { profiles: profileSeeds, seedDrafts: false },
    expectedControlledConsoleErrors: [
      '[wallet-permission-check] (intermediate value).getPermissions is not a function',
    ],
    graphFixtureResponse: createTask4BIndexerFixture(profileSeeds),
    label: 'owner-authoring-persistence',
  });
  assert.ok(outcome.result.persistedBytes);
  assert.deepEqual(outcome.cleanup.remainingPids, []);
});
