import assert from 'node:assert/strict';
import test from 'node:test';
import { runOwnerProductionPreviewGate } from './owner-production-preview-harness.mjs';
import {
  TASK4B_PROFILE_A,
  TASK4B_PROFILE_B,
  installTask4BStorageFixture,
  task4bProfileSeed,
} from './owner-task4b-fixtures.mjs';

const previewUrl = 'https://deploy-preview-2--enterinscape.netlify.app';
const profileSeeds = [
  task4bProfileSeed({ contractAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', name: 'ALPHA AUTHORITY', previewUrl, profileAddress: TASK4B_PROFILE_A }),
  task4bProfileSeed({ contractAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', name: 'BETA AUTHORITY', previewUrl, profileAddress: TASK4B_PROFILE_B }),
];

async function applyAuthority(page, input) {
  return page.evaluate((authority) => window.__task4OwnerApplyAuthority(authority), input);
}

test('Task 4B production preview entry and authority fail closed and recover exactly', async () => {
  const outcome = await runOwnerProductionPreviewGate(async ({ frame, ledger, page }) => {
    const owner = frame.getByRole('navigation', { name: 'Owner workspace tools' });
    const modulator = frame.getByRole('region', { name: 'Modulator' });
    const initialDocumentId = await frame.evaluate(() => window.__task4OwnerHarness.documentId);
    const storageBefore = await frame.evaluate(() => Object.fromEntries(Object.keys(localStorage)
      .filter((key) => /^(?:inscape\.library-|inscape\.lattice-production-draft)/u.test(key))
      .sort().map((key) => [key, localStorage.getItem(key)])));

    const mismatch = await applyAuthority(page, {
      enable: true, allowedAccounts: [TASK4B_PROFILE_A], contextAccounts: [TASK4B_PROFILE_B], chainId: 42,
    });
    assert.equal(mismatch.ownerAllowed, false, 'Mismatched visitor/context authority was not rejected by the parent');
    await owner.waitFor({ state: 'detached', timeout: 10_000 });
    await modulator.waitFor({ state: 'detached', timeout: 10_000 });
    assert.equal(await frame.locator('main.owner-lattice-shell').count(), 0, 'Mismatched authority retained the owner shell');
    ledger.record('task4b-authority-mismatch-failed-closed', { allowed: TASK4B_PROFILE_A, context: TASK4B_PROFILE_B });

    const restored = await applyAuthority(page, {
      enable: true, allowedAccounts: [TASK4B_PROFILE_A], contextAccounts: [TASK4B_PROFILE_A], chainId: 42,
    });
    assert.equal(restored.ownerAllowed, true);
    await owner.waitFor({ state: 'visible', timeout: 10_000 });
    await modulator.waitFor({ state: 'visible', timeout: 10_000 });
    assert.equal(await frame.evaluate(() => window.__task4OwnerHarness.documentId), initialDocumentId,
      'Authority recovery reloaded or replaced the preview document');
    const storageAfter = await frame.evaluate(() => Object.fromEntries(Object.keys(localStorage)
      .filter((key) => /^(?:inscape\.library-|inscape\.lattice-production-draft)/u.test(key))
      .sort().map((key) => [key, localStorage.getItem(key)])));
    assert.deepEqual(storageAfter, storageBefore, 'Rejected/restored authority changed accepted owner storage bytes');
    return { mismatchFailedClosed: true, recovered: true };
  }, {
    authorityProfiles: [TASK4B_PROFILE_A, TASK4B_PROFILE_B],
    contextInitScript: installTask4BStorageFixture,
    contextInitScriptArg: { profiles: profileSeeds, seedDrafts: false },
    expectedControlledConsoleErrors: [
      '[wallet-permission-check] (intermediate value).getPermissions is not a function',
    ],
    label: 'owner-entry-authority',
  });
  assert.equal(outcome.result.mismatchFailedClosed, true);
  assert.deepEqual(outcome.cleanup.remainingPids, []);
});
