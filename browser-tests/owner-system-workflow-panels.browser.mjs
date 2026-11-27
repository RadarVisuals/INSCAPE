import assert from 'node:assert/strict';
import test from 'node:test';
import { editorDestination, editorMenu } from './fixtures/editor-menu.mjs';
import { chromium } from 'playwright-core';
import { routeOfflineWorkflowReview } from './fixtures/legacy-workflow-artwork.mjs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = process.env.INSCAPE_SYSTEM_WORKFLOW_URL || 'http://127.0.0.1:5173/development/owner/system-workflow';
const prepare = page => routeOfflineWorkflowReview(page, new globalThis.URL(URL).origin);

test('panel controller phases, dismisses and restores exact trigger focus', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
    await prepare(page);
    await page.goto(URL, { waitUntil: 'networkidle' });
    const settingsTrigger = await editorDestination(page, 'Settings');
    await page.getByRole('dialog', { name: 'Settings' }).waitFor();
    await page.mouse.click(8, 300);
    await page.getByRole('dialog', { name: 'Settings' }).waitFor({ state: 'detached' });
    assert.equal(await settingsTrigger.evaluate((node) => node === document.activeElement), true);

    const libraryTrigger = await editorDestination(page, 'Library');
    const library = page.getByRole('region', { name: 'Library workspace' });
    await library.waitFor();
    await library.getByRole('button', { name: 'Close workspace' }).click();
    await library.waitFor({ state: 'detached' });
    assert.equal(await libraryTrigger.evaluate((node) => node === document.activeElement), true);

  } finally {
    await browser.close();
  }
});

test('reduced motion keeps lifecycle semantics without transition delay', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 720 }, reducedMotion: 'reduce' });
    await prepare(page);
    await page.goto(URL, { waitUntil: 'networkidle' });
    const trigger = editorMenu(page);
    await editorDestination(page, 'Settings');
    const settings = page.getByRole('dialog', { name: 'Settings' });
    await settings.waitFor();
    await settings.getByRole('button', { name: 'Close Settings' }).click();
    await settings.waitFor({ state: 'detached' });
    assert.equal(await trigger.evaluate((node) => node === document.activeElement), true);
  } finally {
    await browser.close();
  }
});

test('normal motion preserves Profile and Activity focus continuity', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
    await prepare(page);
    await page.goto(URL, { waitUntil: 'networkidle' });

    const profileTrigger = page.getByRole('button', { name: /^Profile$/i });
    await profileTrigger.click();
    const profileCard = page.locator('.system-workflow__profile-card');
    await profileCard.click();
    const dossier = page.locator('.identity-module aside');
    await dossier.waitFor();
    await page.getByRole('button', { name: 'Close Identity' }).click();
    await dossier.waitFor({ state: 'detached' });
    assert.equal(await profileTrigger.evaluate(node => node === document.activeElement), true);

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

  } finally {
    await browser.close();
  }
});
