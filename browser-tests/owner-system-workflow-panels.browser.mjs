import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = process.env.INSCAPE_SYSTEM_WORKFLOW_URL || 'http://127.0.0.1:5173/development/owner/system-workflow';

test('panel controller phases, dismisses and restores exact trigger focus', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Select ABYSSAL STUDY/ }).click();
    const gridsTrigger = page.getByRole('button', { name: /^Grids$/i });
    await gridsTrigger.click();
    const grids = page.locator('.system-workflow__grid-switcher');
    await grids.waitFor();
    await page.waitForFunction(() => document.querySelector('.system-workflow__grid-switcher')?.closest('[data-system-workflow-panel]')?.dataset.panelPhase === 'open');
    assert.equal(await page.locator('.system-workflow__inspector').count(), 0, 'inspector is structurally absent while Grid switcher owns the overlay layer');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelector('.system-workflow__grid-switcher')?.closest('[data-system-workflow-panel]')?.dataset.panelPhase === 'closing');
    assert.equal(await grids.locator('..').getAttribute('data-panel-phase'), 'closing');
    await grids.waitFor({ state: 'detached' });
    assert.equal(await gridsTrigger.evaluate((node) => node === document.activeElement), true);

    const settingsTrigger = page.getByRole('button', { name: /^Settings$/i });
    await settingsTrigger.click();
    await page.getByRole('dialog', { name: 'Settings' }).waitFor();
    await page.mouse.click(8, 300);
    await page.getByRole('dialog', { name: 'Settings' }).waitFor({ state: 'detached' });
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label')?.toLowerCase() === 'settings');
    assert.equal(await settingsTrigger.evaluate((node) => node === document.activeElement), true);

    const libraryTrigger = page.getByRole('button', { name: /^Library$/i });
    await libraryTrigger.click();
    const library = page.getByRole('region', { name: 'Library workspace' });
    await library.waitFor();
    await library.getByRole('button', { name: 'Close workspace' }).click();
    await library.waitFor({ state: 'detached' });
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label')?.toLowerCase() === 'library');
    assert.equal(await libraryTrigger.evaluate((node) => node === document.activeElement), true);

    await page.setViewportSize({ width: 390, height: 720 });
    await page.getByRole('button', { name: /Select ABYSSAL STUDY/ }).click();
    await gridsTrigger.click();
    await grids.waitFor();
    assert.equal(await page.locator('.system-workflow__inspector').count(), 0);
  } finally {
    await browser.close();
  }
});

test('reduced motion keeps lifecycle semantics without transition delay', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 720 }, reducedMotion: 'reduce' });
    await page.goto(URL, { waitUntil: 'networkidle' });
    const trigger = page.getByRole('button', { name: /^Grids$/i });
    await trigger.click();
    await page.locator('.system-workflow__grid-switcher').waitFor();
    await page.keyboard.press('Escape');
    await page.locator('.system-workflow__grid-switcher').waitFor({ state: 'detached' });
    assert.equal(await trigger.evaluate((node) => node === document.activeElement), true);
  } finally {
    await browser.close();
  }
});

test('normal motion preserves Profile, Activity, and focus-viewer source continuity', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
    await page.goto(URL, { waitUntil: 'networkidle' });

    const profileTrigger = page.getByRole('button', { name: /^Profile$/i });
    await profileTrigger.click();
    const profileCard = page.locator('.system-workflow__profile-card');
    await profileCard.click();
    const dossier = page.locator('#lattice-profile-dossier');
    await dossier.waitFor();
    assert.equal(await dossier.locator('.lattice-production-identity-dossier__shared-avatar').count(), 1);
    assert.equal(await profileCard.getAttribute('aria-expanded'), 'true');
    await dossier.click({ position: { x: 5, y: 5 } });
    await page.waitForFunction(() => document.querySelector('#lattice-profile-dossier')?.dataset.phase === 'closing');
    assert.equal(await dossier.count(), 1, 'expanded Profile remains mounted while it animates back to its source card');
    await page.locator('.system-workflow__profile').waitFor({ state: 'detached' });

    await profileTrigger.click();
    await profileCard.click();
    await dossier.waitFor();
    await page.getByRole('button', { name: 'Close profile' }).click();
    await page.waitForFunction(() => document.querySelector('#lattice-profile-dossier')?.dataset.phase === 'compact');
    assert.equal(await dossier.locator('.lattice-production-identity-dossier__shared-avatar').count(), 1, 'Profile keeps one identity source through its compact transition');
    await page.locator('.system-workflow__profile-layer').click({ position: { x: 700, y: 300 } });
    await page.locator('.system-workflow__profile').waitFor({ state: 'detached' });
    assert.equal(await profileTrigger.evaluate((node) => node === document.activeElement), true);

    const activityTrigger = page.getByRole('button', { name: /^Activity$/i });
    await activityTrigger.click();
    const drawer = page.locator('.system-workflow__activity-drawer');
    await drawer.waitFor();
    await drawer.getByRole('button', { name: 'Open full activity history' }).click();
    const history = page.locator('.system-workflow__activity-history');
    await history.waitFor();
    await page.keyboard.press('Escape');
    await history.waitFor({ state: 'detached' });
    assert.equal(await drawer.getByRole('button', { name: 'Open full activity history' }).evaluate((node) => node === document.activeElement), true);
    await drawer.getByRole('button', { name: 'Close activity' }).click();
    await drawer.waitFor({ state: 'detached' });
    assert.equal(await activityTrigger.evaluate((node) => node === document.activeElement), true);

    const placementTrigger = page.getByRole('button', { name: /Select ABYSSAL STUDY/ });
    const placement = page.locator('.system-workflow__placement').first();
    await placementTrigger.click();
    await placementTrigger.dblclick();
    const viewer = page.getByRole('dialog', { name: 'ABYSSAL STUDY focus viewer' });
    await viewer.waitFor();
    assert.equal(await placement.getAttribute('data-viewing'), 'true');
    await page.getByRole('button', { name: 'Close artwork viewer' }).click();
    await viewer.waitFor({ state: 'detached' });
    assert.equal(await placement.getAttribute('data-viewing'), null);
    assert.equal(await placementTrigger.evaluate((node) => node === document.activeElement), true);

  } finally {
    await browser.close();
  }
});

test('Layers remains mounted while artwork inspection is open', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
    await page.goto(URL, { waitUntil: 'networkidle' });
    const placement = page.locator('.system-workflow__placement').first();
    await placement.click();
    const inspector = page.getByRole('complementary', { name: 'Selection and layers inspector' });
    await inspector.waitFor();
    await placement.dblclick();
    await page.getByRole('dialog', { name: 'ABYSSAL STUDY focus viewer' }).waitFor();
    assert.equal(await inspector.isVisible(), true);
  } finally {
    await browser.close();
  }
});
