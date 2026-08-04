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
  task4bAssetId,
  task4bPlacement,
  task4bProfileSeed,
} from './owner-task4b-fixtures.mjs';

const previewUrl = 'https://deploy-preview-2--enterinscape.netlify.app';
const alphaPlacement = task4bPlacement('task4b-alpha-placement', task4bAssetId(TASK4B_CONTRACT_A));
const profileSeeds = [
  task4bProfileSeed({ contractAddress: TASK4B_CONTRACT_A, name: 'ALPHA ISOLATION ASSET', placements: [alphaPlacement], previewUrl, profileAddress: TASK4B_PROFILE_A }),
  task4bProfileSeed({ contractAddress: TASK4B_CONTRACT_B, name: 'BETA ISOLATION ASSET', placements: [], previewUrl, profileAddress: TASK4B_PROFILE_B }),
];

async function switchAuthority(page, profileAddress) {
  return page.evaluate((profile) => window.__task4OwnerApplyAuthority({
    enable: true, allowedAccounts: [profile], contextAccounts: [profile], chainId: 42,
  }), profileAddress);
}

async function selectWorkspaceTheme(frame, value) {
  await frame.getByRole('navigation', { name: 'Owner workspace tools' })
    .getByRole('button', { name: 'THEME', exact: true }).click({ timeout: 10_000 });
  const settings = frame.getByRole('dialog', { name: 'SETTINGS' });
  await settings.waitFor({ state: 'visible', timeout: 10_000 });
  await settings.getByRole('combobox', { name: 'WORKSPACE / SURFACE', exact: true }).selectOption(value, { timeout: 10_000 });
  await settings.getByRole('button', { name: 'Close Modulator settings' }).click({ timeout: 10_000 });
}

test('Task 4B production preview owner A to B isolation remains exact', async () => {
  const outcome = await runOwnerProductionPreviewGate(async ({ frame, ledger, page }) => {
    const owner = frame.locator('main.owner-lattice-shell');
    const draftsBefore = await frame.evaluate(({ profileA, profileB }) => ({
      profileA: localStorage.getItem(`inscape.lattice-production-draft.v1:${profileA}`),
      profileB: localStorage.getItem(`inscape.lattice-production-draft.v1:${profileB}`),
    }), { profileA: TASK4B_PROFILE_A, profileB: TASK4B_PROFILE_B });
    const alphaLibraryAsset = frame.locator('.lattice-browser-assets').getByRole('button', { name: /ALPHA ISOLATION ASSET/u });
    await alphaLibraryAsset.waitFor({ state: 'visible', timeout: 10_000 });
    await alphaLibraryAsset.click({ timeout: 10_000 });
    await frame.getByRole('navigation', { name: 'Owner workspace tools' })
      .getByRole('button', { name: 'ARRANGE', exact: true }).click({ timeout: 10_000 });
    const alphaPlacementControl = frame.getByRole('button', { name: /Move placement: ALPHA ISOLATION ASSET/u });
    await alphaPlacementControl.focus({ timeout: 10_000 });
    await alphaPlacementControl.press('Enter', { timeout: 10_000 });
    await selectWorkspaceTheme(frame, 'carbon');
    assert.equal(await owner.getAttribute('data-surface'), 'carbon');
    await frame.getByRole('navigation', { name: 'Owner workspace tools' })
      .getByRole('button', { name: 'PUBLISH', exact: true }).click({ timeout: 10_000 });
    await frame.getByRole('complementary', { name: 'Version 8 publication' }).waitFor({ state: 'visible', timeout: 10_000 });

    assert.equal((await switchAuthority(page, TASK4B_PROFILE_B)).ownerAllowed, true);
    const betaLibraryAsset = frame.locator('.lattice-browser-assets').getByRole('button', { name: /BETA ISOLATION ASSET/u });
    await betaLibraryAsset.waitFor({ state: 'visible', timeout: 10_000 });
    assert.equal(await frame.locator('[data-placement-id]').count(), 0, 'Owner A placement leaked into owner B');
    assert.equal(await owner.getAttribute('data-surface'), 'mist', 'Owner A Theme session leaked into owner B');
    assert.equal(await frame.getByRole('complementary', { name: 'Version 8 publication' }).count(), 0,
      'Owner A publication preparation surface leaked into owner B');
    assert.equal(await betaLibraryAsset.getAttribute('aria-pressed'), 'false',
      'Owner A Library selection leaked into owner B');
    assert.equal(await frame.locator('[data-placement-id="task4b-alpha-placement"]').count(), 0);
    ledger.record('task4b-profile-b-isolated', { profileAddress: TASK4B_PROFILE_B });

    assert.equal((await switchAuthority(page, TASK4B_PROFILE_A)).ownerAllowed, true);
    await alphaLibraryAsset.waitFor({ state: 'visible', timeout: 10_000 });
    await frame.locator('[data-placement-id="task4b-alpha-placement"]').waitFor({ state: 'attached', timeout: 10_000 });
    assert.equal(await owner.getAttribute('data-surface'), 'mist', 'Return to owner A retained a stale cross-profile Theme session');
    const draftsAfter = await frame.evaluate(({ profileA, profileB }) => ({
      profileA: localStorage.getItem(`inscape.lattice-production-draft.v1:${profileA}`),
      profileB: localStorage.getItem(`inscape.lattice-production-draft.v1:${profileB}`),
    }), { profileA: TASK4B_PROFILE_A, profileB: TASK4B_PROFILE_B });
    assert.deepEqual(draftsAfter, draftsBefore, 'Profile-isolation journey changed canonical draft bytes');
    return { isolated: true, returned: true };
  }, {
    authorityProfiles: [TASK4B_PROFILE_A, TASK4B_PROFILE_B],
    contextInitScript: installTask4BStorageFixture,
    contextInitScriptArg: { profiles: profileSeeds, seedDrafts: true },
    expectedControlledConsoleErrors: [
      '[wallet-permission-check] (intermediate value).getPermissions is not a function',
    ],
    graphFixtureResponse: createTask4BIndexerFixture(profileSeeds),
    label: 'owner-profile-isolation',
  });
  assert.equal(outcome.result.isolated, true);
  assert.deepEqual(outcome.cleanup.remainingPids, []);
});
