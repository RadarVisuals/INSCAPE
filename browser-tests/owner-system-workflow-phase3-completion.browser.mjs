import { editorMenu, editorCommand } from './fixtures/editor-menu.mjs';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { routeOfflineWorkflowReview } from './fixtures/legacy-workflow-artwork.mjs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = process.env.INSCAPE_SYSTEM_WORKFLOW_URL || 'http://127.0.0.1:5173/development/owner/system-workflow';
const SCREENSHOT_DIR = process.env.INSCAPE_SYSTEM_WORKFLOW_SCREENSHOT_DIR ? resolve(process.env.INSCAPE_SYSTEM_WORKFLOW_SCREENSHOT_DIR) : null;
const inViewport = (rect, width, height) => rect && rect.x >= 0 && rect.y >= 0
  && rect.x + rect.width <= width + 0.5 && rect.y + rect.height <= height + 0.5;
const routeFixtureMedia = page => routeOfflineWorkflowReview(page, new globalThis.URL(URL).origin);


test('Profile, Activity and Settings expose the promoted lifecycle and controls', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  try {
    if (SCREENSHOT_DIR) await mkdir(SCREENSHOT_DIR, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await routeFixtureMedia(page);
    await page.goto(URL, { waitUntil: 'networkidle' });

    const profileTrigger = page.getByRole('button', { name: 'Profile', exact: true });
    await profileTrigger.click();
    const profileCard = page.locator('.system-workflow__profile-card');
    await profileCard.waitFor();
    assert.deepEqual(await profileCard.locator('.system-workflow__profile-avatar').evaluate((node) => {
      const style = getComputedStyle(node); return [style.borderRadius, style.overflow];
    }), ['50%', 'hidden'], 'compact profile avatar is hard-clipped to one circle');
    assert.deepEqual(await profileCard.locator('.system-workflow__profile-avatar > svg:not(.inscape-profile-avatar-ring)').evaluate((node) => {
      const style = getComputedStyle(node); return [style.width, style.height];
    }), ['21px', '21px'], 'compact fallback avatar uses the same glyph scale as the expanded card');
    assert.equal(await profileCard.locator('.system-workflow__profile-avatar > .inscape-profile-avatar-ring').count(), 1, 'compact Profile uses one non-scaling vector ring');
    if (SCREENSHOT_DIR) await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'phase3-profile-compact-wide.png') });
    await profileCard.click();
    const dossier = page.locator('.identity-module aside');
    await dossier.waitFor();
    assert.match(await dossier.innerText(), /visual research practice/i);
    assert.match(await dossier.innerText(), /FIELD NOTES/);
    await page.getByRole('button', { name: 'Close Identity' }).click();
    await dossier.waitFor({ state: 'detached' });
    assert.equal(await profileTrigger.evaluate(node => node === document.activeElement), true);

    const activityTrigger = page.getByRole('button', { name: 'Activity', exact: true });
    assert.equal(await page.getByLabel('2 unread').count(), 1);
    await activityTrigger.click();
    const drawer = page.locator('.system-workflow__activity-drawer');
    await drawer.waitFor();
    if (SCREENSHOT_DIR) await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'phase3-activity-compact-wide.png') });
    await drawer.getByRole('button', { name: 'Assets', exact: true }).click();
    assert.equal(await drawer.locator('li').count(), 3);
    assert.equal(await drawer.getByRole('button', { name: 'Assets', exact: true }).getAttribute('aria-pressed'), 'true');
    const compactUnread = drawer.locator('li[data-unread]').first();
    assert.equal(await compactUnread.locator('i').evaluate(node => getComputedStyle(node).width), '2px');
    const compactBackground = await compactUnread.evaluate(node => getComputedStyle(node).backgroundColor);
    await compactUnread.hover();
    assert.notEqual(await compactUnread.evaluate(node => getComputedStyle(node).backgroundColor), compactBackground);
    const historyTrigger = drawer.getByRole('button', { name: 'Open full activity history' });
    await historyTrigger.click();
    const history = page.locator('.system-workflow__activity-history');
    await history.waitFor();
    if (SCREENSHOT_DIR) await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'phase3-activity-expanded-wide.png') });
    await history.getByRole('button', { name: 'Unread', exact: true }).click();
    assert.equal(await history.locator('li').count(), 2);
    assert.equal(await history.getByRole('button', { name: 'Unread', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(await history.locator('li[data-unread] i').first().evaluate(node => getComputedStyle(node).width), '2px');
    await page.setViewportSize({ width: 390, height: 720 });
    await page.waitForFunction(() => document.querySelector('.system-workflow')?.dataset.layout === 'narrow');
    assert.equal(await history.evaluate(node => node.scrollWidth === node.clientWidth), true);
    for (const control of await history.locator('header button, .activity-filters button, .activity-actions button, input').all()) {
      assert.equal(await control.evaluate(node => {
        const r = node.getBoundingClientRect();
        return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      }), true, 'history actions stay reachable while entries scroll independently');
    }
    if (SCREENSHOT_DIR) await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'phase3-activity-expanded-narrow.png') });
    await page.setViewportSize({ width: 1440, height: 900 });
    await history.getByRole('button', { name: 'Mark all activity read' }).click();
    assert.equal(await page.getByLabel(/unread/).count(), 0);
    await history.getByRole('button', { name: /Refresh activity|Syncing activity/ }).click();
    await page.keyboard.press('Escape');
    await history.waitFor({ state: 'detached' });
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Open full activity history');
    assert.equal(await historyTrigger.evaluate((node) => node === document.activeElement), true);
    await drawer.getByRole('button', { name: 'Close activity' }).click();
    await drawer.waitFor({ state: 'detached' });
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Activity');
    assert.equal(await activityTrigger.evaluate((node) => node === document.activeElement), true);

    const settingsTrigger = editorMenu(page);
    await page.evaluate(() => { window.__phase3PreferenceWrites = 0; addEventListener('inscape:review-storage-write', event => {
      if (event.detail.key.startsWith('inscape.system-workflow-draft.')) window.__phase3PreferenceWrites++;
    }); });
    await editorCommand(page, 'Edit', 'Settings');
    const settings = page.getByRole('dialog', { name: 'Settings' });
    await settings.waitFor();
    assert.deepEqual(await settings.locator('.system-workflow__settings-section > header strong').allTextContents(), ['Activity', 'Workbench', 'Interface', 'Workbench backup']);
    assert.equal(await settings.locator('select').count(), 0);
    await settings.getByRole('button', { name: 'DARK', exact: true }).click();
    assert.equal(await page.locator('html').getAttribute('data-interface-theme'), 'dark');
    await settings.getByRole('button', { name: /Workbench grid style/ }).click();
    await page.getByRole('option', { name: 'Dots' }).click();
    await settings.getByLabel('Workbench grid color').fill('#123456');
    assert.equal(await page.evaluate(() => window.__phase3PreferenceWrites), 0, 'Workbench preferences do not write the authored draft');
    assert.equal(await settings.locator('input[type="checkbox"]').count(), 7);
    assert.equal(await settings.getByText('VISITOR PRESENTATION').count(), 0);
    const closeSettings = settings.getByRole('button', { name: 'Close Settings' });
    assert.equal(await closeSettings.evaluate(node => {
      const box = node.getBoundingClientRect();
      return Boolean(node.closest('.workbench-tool-panel-header'))
        && node.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
    }), true, 'Settings close is reachable in the shared titlebar');
    await settings.locator('.system-workflow__settings-section').last().scrollIntoViewIfNeeded();
    assert.equal(await closeSettings.evaluate(node => {
      const box = node.getBoundingClientRect();
      return node.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
    }), true, 'Settings close remains reachable when its body scrolls');
    await closeSettings.hover();
    assert.equal(await closeSettings.evaluate((node) => getComputedStyle(node).backgroundColor.endsWith(', 0)')), false, 'Settings close hover stays opaque');
    if (SCREENSHOT_DIR) await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'phase3-settings-wide.png') });
    await closeSettings.click();
    await settings.waitFor({ state: 'detached' });
    assert.equal(await settingsTrigger.evaluate((node) => node === document.activeElement), true);
  } finally { await browser.close(); }
});

test('normal-motion Preview opens Identity directly and returns focus on closure', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
    await routeFixtureMedia(page);
    await page.goto(URL, { waitUntil: 'networkidle' });
    await editorCommand(page, 'Canvas', 'Preview');
    const preview = page.getByRole('main', { name: 'Published INSCAPE Grid visitor' });
    await preview.waitFor({ timeout: 10_000 });
    await preview.getByRole('button', { name: 'Profile', exact: true }).click();
    const dossier = page.locator('.identity-module aside');
    await dossier.waitFor();
    await page.getByRole('button', { name: 'Close Identity' }).click();
    await dossier.waitFor({ state: 'detached' });
    assert.equal(await preview.getByRole('button', { name: 'Profile', exact: true }).evaluate(node => node === document.activeElement), true);
  } finally {
    await browser.close();
  }
});
