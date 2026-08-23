import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = process.env.INSCAPE_SYSTEM_WORKFLOW_URL || 'http://127.0.0.1:5173/development/owner/system-workflow';
const SCREENSHOT_DIR = process.env.INSCAPE_SYSTEM_WORKFLOW_SCREENSHOT_DIR ? resolve(process.env.INSCAPE_SYSTEM_WORKFLOW_SCREENSHOT_DIR) : null;
const inViewport = (rect, width, height) => rect && rect.x >= 0 && rect.y >= 0
  && rect.x + rect.width <= width + 0.5 && rect.y + rect.height <= height + 0.5;
const expectPhase = (locator, phase) => locator.evaluate((node, expected) => new Promise((resolve) => {
  if (node.dataset.phase === expected) { resolve(); return; }
  new MutationObserver((records, observer) => {
    if (node.dataset.phase !== expected) return;
    observer.disconnect(); resolve();
  }).observe(node, { attributes: true, attributeFilter: ['data-phase'] });
}), phase);
const routeFixtureMedia = (page) => page.route('https://raw.githubusercontent.com/RadarVisuals/INSCAPE/**', async (route) => {
  const pathname = new globalThis.URL(route.request().url()).pathname;
  const publicIndex = pathname.indexOf('/public/');
  if (publicIndex < 0) return route.continue();
  const fixturePath = resolve('public', decodeURIComponent(pathname.slice(publicIndex + '/public/'.length)));
  return route.fulfill({ body: await readFile(fixturePath), contentType: 'image/webp' });
});

test('crop pan follows the pointer through transforms while crop handles reshape only the crop area', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.evaluate(() => { window.__workflowWrites = 0; addEventListener('inscape:review-storage-write', () => { window.__workflowWrites += 1; }); });
    const placement = page.getByRole('button', { name: /Select ABYSSAL STUDY/ });
    await placement.click();
    await page.getByRole('button', { name: 'Rotate' }).click();
    await page.getByRole('button', { name: 'Mirror horizontal' }).click();
    await page.getByRole('button', { name: 'Mirror vertical' }).click();
    await page.getByRole('button', { name: 'Crop' }).click();
    await page.getByLabel('Crop zoom').fill('2');
    const imageBefore = await placement.locator('img').boundingBox();
    const placementBefore = await placement.boundingBox();
    await page.mouse.move(placementBefore.x + placementBefore.width / 2, placementBefore.y + placementBefore.height / 2);
    await page.mouse.down();
    await page.mouse.move(placementBefore.x + placementBefore.width / 2 + 30, placementBefore.y + placementBefore.height / 2 + 20, { steps: 4 });
    await page.mouse.up();
    const imageAfter = await placement.locator('img').boundingBox();
    assert.equal(Math.round(imageAfter.x - imageBefore.x), 30);
    assert.equal(Math.round(imageAfter.y - imageBefore.y), 20);
    assert.equal(await page.evaluate(() => window.__workflowWrites), 3, 'pan remains preview-only after the three canonical transform commits');

    const handle = page.getByRole('button', { name: 'Resize selection from se' });
    const handleRect = await handle.boundingBox();
    await page.mouse.move(handleRect.x + 3, handleRect.y + 3);
    await page.mouse.down();
    await page.mouse.move(handleRect.x + 100, handleRect.y + 40, { steps: 4 });
    await page.mouse.up();
    const resized = await placement.boundingBox();
    assert.equal(Math.round(resized.x), Math.round(placementBefore.x));
    assert.equal(Math.round(resized.y), Math.round(placementBefore.y));
    assert.notEqual(Math.round(resized.width - placementBefore.width), Math.round(resized.height - placementBefore.height), 'crop handles do not force the crop area back to the artwork ratio');
    assert.equal(await page.getByLabel('Crop zoom').inputValue(), '2', 'crop handles do not operate the explicit image zoom control');
    assert.equal(await page.evaluate(() => window.__workflowWrites), 4, 'crop resize is one canonical completion');
    await page.getByRole('button', { name: 'Done' }).click();
    assert.equal(await page.evaluate(() => window.__workflowWrites), 5, 'crop completion remains a separate single commit');
  } finally {
    await browser.close();
  }
});

test('Profile, Activity, Discover, and Settings expose the promoted lifecycle and controls', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  try {
    if (SCREENSHOT_DIR) await mkdir(SCREENSHOT_DIR, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await routeFixtureMedia(page);
    await page.goto(URL, { waitUntil: 'networkidle' });

    const gridsTrigger = page.getByRole('button', { name: 'Grids', exact: true });
    await gridsTrigger.click();
    const gridSwitcher = page.locator('.system-workflow__grid-switcher');
    await gridSwitcher.waitFor();
    assert.equal(await gridSwitcher.locator('.system-workflow__grid-list').evaluate((node) => node.scrollWidth === node.clientWidth), true, 'Grid list has no horizontal overflow');
    if (SCREENSHOT_DIR) await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'phase3-grids-wide.png') });
    await page.keyboard.press('Escape');
    await gridSwitcher.waitFor({ state: 'detached' });
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Grids');

    const profileTrigger = page.getByRole('button', { name: 'Profile', exact: true });
    await profileTrigger.click();
    const profileCard = page.locator('.system-workflow__profile-card');
    await profileCard.waitFor();
    const compactProfileRectangle = await page.locator('.system-workflow__profile').boundingBox();
    assert.deepEqual(await profileCard.locator('.system-workflow__profile-avatar').evaluate((node) => {
      const style = getComputedStyle(node); return [style.borderRadius, style.clipPath];
    }), ['50%', 'circle(50% at 50% 50%)'], 'compact profile avatar is hard-clipped to one circle');
    assert.deepEqual(await profileCard.locator('.system-workflow__profile-avatar > svg:not(.inscape-profile-avatar-ring)').evaluate((node) => {
      const style = getComputedStyle(node); return [style.width, style.height];
    }), ['21px', '21px'], 'compact fallback avatar uses the same glyph scale as the expanded card');
    assert.equal(await profileCard.locator('.system-workflow__profile-avatar > .inscape-profile-avatar-ring').count(), 1, 'compact Profile uses one non-scaling vector ring');
    const compactIdentityText = (await profileCard.innerText()).replace(/\s+/gu, ' ').trim();
    if (SCREENSHOT_DIR) await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'phase3-profile-compact-wide.png') });
    await profileCard.click();
    const dossier = page.locator('#lattice-profile-dossier');
    await dossier.waitFor();
    assert.deepEqual(await dossier.locator('.lattice-production-identity-dossier__shared-avatar').evaluate((node) => {
      const style = getComputedStyle(node); return [style.borderRadius, style.clipPath];
    }), ['50%', 'circle(50% at 50% 50%)'], 'one shared profile avatar keeps the same hard-clipped circular silhouette');
    assert.deepEqual(await dossier.locator('.lattice-production-identity-dossier__shared-avatar > svg:not(.inscape-profile-avatar-ring)').evaluate((node) => {
      const style = getComputedStyle(node); return [style.width, style.height];
    }), ['21px', '21px'], 'expanded fallback avatar preserves the source glyph scale');
    assert.equal(await dossier.locator('.lattice-production-identity-dossier__shared-avatar > .inscape-profile-avatar-ring').count(), 1, 'animated Profile avatar keeps one non-scaling vector ring');
    assert.equal(await dossier.locator('.lattice-production-identity-dossier__shared-avatar').count(), 1, 'compact and expanded Profile share one animated dossier avatar');
    assert.equal((await dossier.locator('.lattice-production-identity-dossier__source-copy').innerText()).replace(/\s+/gu, ' ').trim(), compactIdentityText,
      'the animated source summary reuses the exact compact owner identity copy');
    if (SCREENSHOT_DIR) await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'phase3-profile-expanded-wide.png') });
    assert.match(await dossier.innerText(), /visual research practice/i);
    assert.match(await dossier.innerText(), /FIELD NOTES/);
    assert.equal(await dossier.getByRole('button', { name: /Profile/ }).getAttribute('aria-expanded'), 'true');
    await dossier.getByRole('button', { name: /Links/ }).click();
    assert.equal(await dossier.getByRole('button', { name: /Links/ }).getAttribute('aria-expanded'), 'true');
    await page.waitForTimeout(190);
    assert.equal(await dossier.locator('.lattice-production-identity-dossier__shared-avatar').evaluate((node) => getComputedStyle(node).opacity), '0', 'the Profile avatar clears the content track outside the Profile module');
    assert.equal(await dossier.locator('#identity-dossier-links-panel').evaluate((node) => getComputedStyle(node).opacity), '1', 'dossier module content transitions into the active track');
    await dossier.getByRole('button', { name: /Technical/ }).click();
    assert.match(await dossier.innerText(), /CANONICAL ADDRESS/);
    await page.getByRole('button', { name: 'Close profile' }).click();
    await page.waitForFunction(() => document.querySelector('#lattice-profile-dossier')?.dataset.phase === 'compact');
    assert.deepEqual(await dossier.locator('.lattice-production-identity-dossier').boundingBox(), compactProfileRectangle,
      'the same persistent Profile surface lands on the exact compact border-box');
    assert.equal(await dossier.locator('.lattice-production-identity-dossier__source-summary').evaluate((node) => node === document.activeElement), true,
      'the persistent compact Profile surface receives returned focus without a source handoff');
    assert.equal((await dossier.locator('.lattice-production-identity-dossier__source-summary').innerText()).replace(/\s+/gu, ' ').trim(), compactIdentityText,
      'the compact identity copy remains present after the closing motion');
    await page.keyboard.press('Escape');
    await page.locator('.system-workflow__profile').waitFor({ state: 'detached' });
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Profile');
    assert.equal(await profileTrigger.evaluate((node) => node === document.activeElement), true);

    const activityTrigger = page.getByRole('button', { name: 'Activity', exact: true });
    assert.equal(await page.getByLabel('2 unread').count(), 1);
    await activityTrigger.click();
    const drawer = page.locator('.system-workflow__activity-drawer');
    await drawer.waitFor();
    if (SCREENSHOT_DIR) await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'phase3-activity-compact-wide.png') });
    await drawer.getByRole('button', { name: 'Assets', exact: true }).click();
    assert.equal(await drawer.locator('li').count(), 3);
    assert.deepEqual(await drawer.getByRole('button', { name: 'Assets', exact: true }).evaluate((node) => {
      const indicator = getComputedStyle(node, '::before');
      return [indicator.top, indicator.height, indicator.backgroundColor];
    }), ['-1px', '4px', 'rgb(17, 19, 19)'], 'compact Activity covers the top boundary with the shared four-pixel selector');
    const compactUnread = drawer.locator('li[data-unread]').first();
    assert.equal(await compactUnread.evaluate((node) => {
      const stripe = node.querySelector('i')?.getBoundingClientRect();
      return Boolean(stripe && Math.abs(stripe.height - node.clientHeight) < 1 && Math.round(stripe.width) === 3);
    }), true, 'compact unread Activity uses a full-height vertical selector');
    const compactBackground = await compactUnread.evaluate((node) => getComputedStyle(node).backgroundColor);
    await compactUnread.hover();
    assert.notEqual(await compactUnread.evaluate((node) => getComputedStyle(node).backgroundColor), compactBackground, 'compact Activity rows expose pointer hover');
    const historyTrigger = drawer.getByRole('button', { name: 'Open full activity history' });
    await historyTrigger.click();
    const history = page.locator('.system-workflow__activity-history');
    await history.waitFor();
    if (SCREENSHOT_DIR) await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'phase3-activity-expanded-wide.png') });
    await history.getByRole('button', { name: 'Unread', exact: true }).click();
    assert.equal(await history.locator('li').count(), 2);
    assert.deepEqual(await history.getByRole('button', { name: 'Unread', exact: true }).evaluate((node) => {
      const indicator = getComputedStyle(node, '::before');
      return [indicator.top, indicator.height, indicator.backgroundColor];
    }), ['-1px', '4px', 'rgb(17, 19, 19)'], 'expanded Activity covers the top boundary with the shared four-pixel selector');
    assert.deepEqual(await history.getByLabel('Search activity').evaluate((node) => {
      const style = getComputedStyle(node); return [style.borderTopWidth, style.outlineStyle, style.boxShadow];
    }), ['0px', 'none', 'none'], 'expanded Activity search follows the borderless Library and Discover rail treatment');
    assert.equal(await history.locator('.system-workflow__activity-history-rail').evaluate((node) => node.scrollWidth === node.clientWidth), true, 'expanded Activity rail has no phantom horizontal remainder');
    assert.equal(await history.locator('.system-workflow__activity-history-rail nav button').evaluateAll((nodes) => new Set(nodes.map((node) => Math.round(node.getBoundingClientRect().width))).size), 1, 'expanded Activity filters use equal button widths');
    assert.equal(await history.locator('li[data-unread]').first().evaluate((node) => {
      const stripe = node.querySelector('i')?.getBoundingClientRect();
      const row = node.getBoundingClientRect();
      return Boolean(stripe && Math.abs(stripe.left - row.left) < 1 && Math.abs(stripe.height - node.clientHeight) < 1 && Math.round(stripe.width) === 3);
    }), true, 'expanded unread Activity uses a full-height selector on the outer left edge');
    await page.setViewportSize({ width: 390, height: 720 });
    await page.waitForFunction(() => document.querySelector('.system-workflow')?.dataset.layout === 'narrow');
    assert.equal(await history.locator('.system-workflow__activity-history-rail').evaluate((rail) => {
      const filters = rail.querySelector('nav').getBoundingClientRect();
      const search = rail.querySelector('label').getBoundingClientRect();
      return filters.top < search.top && Math.abs(filters.bottom - search.top) < 1
        && getComputedStyle(rail.querySelector('nav')).borderBottomWidth === '1px';
    }), true, 'narrow Activity separates filters above the search/action row with one border');
    assert.equal(await history.locator('.system-workflow__activity-history-rail').evaluate((rail) => {
      const refresh = rail.querySelector('.system-workflow__activity-refresh');
      const close = rail.querySelector('button[aria-label="Close full activity history"]');
      const railBox = rail.getBoundingClientRect();
      const closeBox = close.getBoundingClientRect();
      return Boolean(refresh && getComputedStyle(refresh.querySelector('span')).display === 'none'
        && Math.abs(closeBox.right - railBox.right) < 1
        && getComputedStyle(close).borderRightWidth === '0px');
    }), true, 'narrow Activity keeps icon-only Refresh before a flush single-edge close control');
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

    const discoverTrigger = page.getByRole('button', { name: 'Discover', exact: true });
    await discoverTrigger.click();
    const discover = page.locator('.system-workflow__discover');
    await discover.locator('.system-workflow__discover-grid').waitFor();
    if (SCREENSHOT_DIR) await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'phase3-discover-wide.png') });
    assert.equal(await discover.locator('.system-workflow__discover-grid > .system-workflow__discover-card').count(), 3);
    const discoverResize = discover.getByRole('button', { name: 'Resize Browser navigation' });
    assert.equal(await discoverResize.evaluate((node) => getComputedStyle(node, '::after').width), '1px');
    assert.equal(await discover.locator('.lattice-browser-sidebar').evaluate((node) => getComputedStyle(node).borderRightWidth), '0px');
    assert.deepEqual(await discover.locator('.lattice-browser-results').evaluate((node) => {
      const style = getComputedStyle(node); return [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft];
    }), ['10px', '10px', '10px', '10px']);
    assert.equal(await discover.locator('.lattice-browser-sidebar > button[aria-pressed="true"]').first().evaluate((node) => {
      const active = node.getBoundingClientRect(); const sidebar = node.parentElement.getBoundingClientRect();
      return Math.abs(active.right - sidebar.right) < 1;
    }), true, 'Discover selection reaches the sidebar divider');
    await discover.getByRole('button', { name: 'Create Group', exact: true }).click();
    const createGroup = page.locator('form[aria-label="Create people group"]');
    await createGroup.locator('input').fill('CURATED SIGNALS');
    await createGroup.locator('input').press('Enter');
    assert.equal(await discover.getByRole('button', { name: 'CURATED SIGNALS', exact: true }).count(), 1);
    await discover.getByRole('button', { name: 'CURATED SIGNALS', exact: true }).click({ button: 'right' });
    const groupMenu = page.getByRole('menu', { name: 'People group commands' });
    assert.deepEqual(await groupMenu.getByRole('menuitem').allTextContents(), ['Rename', 'Delete']);
    assert.equal(await groupMenu.getAttribute('data-menu-surface'), 'mist', 'Discover context menu inherits the active workflow theme');
    await groupMenu.getByRole('menuitem', { name: 'Rename' }).click();
    const renameGroup = page.locator('form[aria-label="Rename people group"]');
    await renameGroup.locator('input').fill('CURATED PATHS');
    await renameGroup.locator('input').press('Enter');
    assert.equal(await discover.getByRole('button', { name: 'CURATED PATHS', exact: true }).count(), 1);
    assert.equal(await discover.locator('.lattice-browser-sidebar').evaluate((node) => {
      const create = node.querySelector('.lattice-browser-sidebar__create');
      const created = [...node.querySelectorAll('button')].find((button) => button.getAttribute('aria-label') === 'CURATED PATHS');
      return Boolean(create && created && (create.compareDocumentPosition(created) & Node.DOCUMENT_POSITION_FOLLOWING));
    }), true, 'created Discover groups follow the Create action');
    await discover.getByLabel('Search profiles').fill('surface');
    assert.equal(await discover.locator('.system-workflow__discover-grid > .system-workflow__discover-card').count(), 1);
    await discover.getByLabel('Search profiles').fill('no match');
    assert.match(await discover.innerText(), /No people match/);
    await discover.getByLabel('Search profiles').fill('');
    await discover.getByRole('button', { name: /Sort profiles/ }).click();
    await page.getByRole('option', { name: 'Z–A', exact: true }).click();
    await discover.getByRole('button', { name: /Profile filters/ }).click();
    assert.ok(await page.getByRole('option').count() >= 3);
    await page.keyboard.press('Escape');
    await discover.getByRole('button', { name: 'Close Discover' }).click();
    await discover.waitFor({ state: 'detached' });
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Discover');
    assert.equal(await discoverTrigger.evaluate((node) => node === document.activeElement), true);

    const settingsTrigger = page.getByRole('button', { name: 'Settings', exact: true });
    await settingsTrigger.click();
    const settings = page.getByRole('dialog', { name: 'Settings' });
    await settings.waitFor();
    assert.equal(await settings.locator('.system-workflow__settings-section').count(), 2);
    assert.equal(await settings.locator('select').count(), 0);
    const canvasTheme = settings.getByRole('button', { name: /Canvas theme/ });
    assert.equal(await canvasTheme.locator('span').innerText(), 'Mist');
    await canvasTheme.click();
    assert.deepEqual(await page.getByRole('option').allTextContents(), ['Carbon', 'Graphite', 'Slate', 'Ash', 'Mist', 'Paper']);
    await page.getByRole('option', { name: 'Carbon' }).click();
    assert.equal(await page.locator('.system-workflow').getAttribute('data-surface'), 'carbon');
    await settings.getByRole('button', { name: /Grid display/ }).click();
    await page.getByRole('option', { name: 'Dots' }).click();
    assert.equal(await page.locator('.system-workflow__canvas').getAttribute('data-guide'), 'DOTS');
    await settings.getByLabel('Snap grid').fill('-8');
    await settings.getByLabel('Guide color').fill('#123456');
    assert.equal(await settings.locator('input[type="checkbox"]').count(), 4);
    assert.equal(await settings.getByText('VISITOR PRESENTATION').count(), 0);
    const closeSettings = settings.getByRole('button', { name: 'Close Settings' });
    assert.deepEqual(await closeSettings.evaluate((node) => {
      const style = getComputedStyle(node); return [Math.round(node.getBoundingClientRect().height), style.justifyContent, style.fontSize];
    }), [38, 'flex-end', '11px'], 'Settings close action follows the panel control geometry and readable control type');
    assert.equal(await settings.locator('.system-workflow__settings-section').last().evaluate((node) => {
      const section = node.getBoundingClientRect(); const close = node.nextElementSibling.getBoundingClientRect();
      return section.bottom <= close.top + 1;
    }), true, 'Settings close rail follows the final section without overlaying it');
    await closeSettings.hover();
    assert.equal(await closeSettings.evaluate((node) => getComputedStyle(node).backgroundColor.endsWith(', 0)')), false, 'Settings close hover stays opaque');
    if (SCREENSHOT_DIR) await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'phase3-settings-wide.png') });
    await closeSettings.click();
    await settings.waitFor({ state: 'detached' });
    assert.equal(await settingsTrigger.evaluate((node) => node === document.activeElement), true);
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    const visitorRenderer = page.locator('.visitor-grid-renderer');
    await visitorRenderer.waitFor();
    assert.deepEqual(await visitorRenderer.evaluate((node) => {
      const style = getComputedStyle(node);
      const guide = node.querySelector('.lattice-pixel-grid');
      const cellSize = Number.parseFloat(style.getPropertyValue('--lattice-production-cell-size'));
      return [node.dataset.guideMode, style.getPropertyValue('--lattice-production-guide-color').trim(),
        style.backgroundImage, Boolean(guide?.querySelector('path[stroke-linecap="round"]')),
        Math.round((Number(guide?.dataset.guideSpacing) / cellSize) * 9)];
    }), ['DOTS', '#123456', 'none', true, 1]);
  } finally {
    await browser.close();
  }
});

test('Focus viewer and v9 Preview preserve source, metadata, navigation, privacy, and focus roundtrips', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  try {
    if (SCREENSHOT_DIR) await mkdir(SCREENSHOT_DIR, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await routeFixtureMedia(page);
    await page.goto(URL, { waitUntil: 'networkidle' });
    const placement = page.getByRole('button', { name: /Select ABYSSAL STUDY/ });
    await placement.click();
    await placement.dblclick();
    const viewer = page.getByRole('dialog', { name: 'ABYSSAL STUDY focus viewer' });
    await viewer.waitFor();
    assert.equal(await page.locator('.system-workflow__placement').first().getAttribute('data-viewing'), 'true');
    assert.equal(await page.locator('.system-workflow__selection-chrome').getAttribute('aria-hidden'), 'true');
    const rack = viewer.getByLabel('Artwork metadata rack');
    assert.equal(await rack.getAttribute('data-open'), 'true');
    assert.equal(await rack.locator('.lattice-focus-viewer__rack-module').count(), 3);
    await viewer.locator('.lattice-focus-viewer__artwork').click();
    assert.equal(await rack.getAttribute('aria-hidden'), 'true');
    await viewer.locator('.lattice-focus-viewer__artwork').click();
    assert.equal(await rack.getAttribute('data-open'), 'true');
    await viewer.getByRole('button', { name: 'Next artwork' }).click();
    await page.getByRole('dialog', { name: 'MOUNTAIN SIGNAL II focus viewer' }).waitFor();
    assert.match(await page.getByRole('navigation', { name: 'Artwork viewer navigation' }).innerText(), /02 \/ 02/);
    if (SCREENSHOT_DIR) await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'phase3-focusviewer-wide.png') });
    await page.getByRole('button', { name: 'Close artwork viewer' }).click();
    await page.locator('[data-lattice-focus-viewer]').waitFor({ state: 'detached' });
    const mountain = page.getByRole('button', { name: /Select MOUNTAIN SIGNAL II/ });
    assert.equal(await mountain.evaluate((node) => node === document.activeElement), true);
    const ownerProjection = {
      abyssal: await page.getByRole('button', { name: /Select ABYSSAL STUDY/ }).boundingBox(),
      mountain: await mountain.boundingBox(),
    };

    const settingsTrigger = page.getByRole('button', { name: 'Settings', exact: true });
    await settingsTrigger.click();
    const settings = page.getByRole('dialog', { name: 'Settings' });
    await settings.getByRole('button', { name: /Grid display/ }).click();
    await page.getByRole('option', { name: 'None' }).click();
    await settings.getByRole('button', { name: 'Close Settings' }).click();
    await settings.waitFor({ state: 'detached' });

    const previewTrigger = page.getByRole('button', { name: 'Preview', exact: true });
    await previewTrigger.click();
    const preview = page.getByRole('main', { name: 'Published INSCAPE Grid visitor' });
    await preview.waitFor({ timeout: 10_000 });
    assert.equal(await preview.locator('[data-placement-id]').count(), 2);
    assert.equal(await preview.locator('[data-placement-id="placement-abyssal"]').count(), 1);
    assert.equal(await preview.locator('[data-placement-id="placement-mountain-ii"]').count(), 1);
    assert.deepEqual(await preview.locator('[data-placement-id="placement-abyssal"]').boundingBox(), ownerProjection.abyssal,
      'Owner and Visitor project ABYSSAL STUDY onto the exact same viewport rectangle');
    assert.deepEqual(await preview.locator('[data-placement-id="placement-mountain-ii"]').boundingBox(), ownerProjection.mountain,
      'Owner and Visitor project MOUNTAIN SIGNAL II onto the exact same viewport rectangle');
    assert.equal(await preview.locator('[data-visibility="PRIVATE"]').count(), 0);
    assert.equal(await preview.locator('.lattice-production-table__label').count(), 0, 'Visitor Grid has no duplicate in-canvas Grid label');
    await preview.getByRole('button', { name: 'Profile', exact: true }).click();
    const visitorIdentity = preview.locator('.lattice-profile-rail__identity');
    const visitorCompactAvatar = await visitorIdentity.locator('.lattice-profile-rail__avatar').evaluate((node) => {
      const style = getComputedStyle(node); const ring = node.querySelector(':scope > .inscape-profile-avatar-ring'); const circle = ring.querySelector('circle');
      return [style.borderRadius, style.overflow, getComputedStyle(ring).color, circle.getAttribute('stroke-width'), circle.getAttribute('vector-effect'), node.querySelectorAll(':scope > .inscape-profile-avatar-ring').length];
    });
    assert.deepEqual(visitorCompactAvatar.slice(0, 2), ['50%', 'hidden'], 'Visitor compact avatar keeps one circular silhouette');
    assert.deepEqual(visitorCompactAvatar.slice(3), ['1', 'non-scaling-stroke', 1], 'Visitor compact avatar uses exactly one non-scaling 1px vector ring');
    assert.equal(await visitorIdentity.evaluate((node) => getComputedStyle(node).backgroundColor), 'rgba(0, 0, 0, 0)',
      'Visitor compact identity has no transient selected tile before opening');
    const visitorCompactCard = await visitorIdentity.locator('..').boundingBox();
    const visitorCompactText = (await visitorIdentity.innerText()).replace(/\s+/gu, ' ').trim();
    await visitorIdentity.click();
    const visitorDossier = page.locator('#lattice-profile-dossier');
    await visitorDossier.waitFor();
    assert.equal(await visitorDossier.getAttribute('data-grid-visible'), 'false', 'Visitor Profile inherits the disabled Grid guide state');
    assert.equal(await visitorDossier.locator('.lattice-production-identity-viewer__veil').evaluate((node) => getComputedStyle(node).backgroundImage), 'none',
      'opening the Visitor Profile does not reintroduce a disabled Grid');
    assert.equal(await visitorIdentity.count(), 0,
      'Visitor removes the source card while the persistent dossier owns its pixels');
    assert.deepEqual(await visitorDossier.locator('.lattice-production-identity-dossier__shared-avatar').evaluate((node) => {
      const ring = node.querySelector(':scope > .inscape-profile-avatar-ring'); const circle = ring.querySelector('circle');
      return [getComputedStyle(ring).color, circle.getAttribute('stroke-width'), circle.getAttribute('vector-effect')];
    }), visitorCompactAvatar.slice(2, 5), 'Visitor compact and expanded avatars share the exact same non-scaling ring');
    await page.getByRole('button', { name: 'Close Identity Rack' }).click();
    await visitorDossier.evaluate((node) => new Promise((resolve) => {
      if (node.dataset.phase === 'compact') { resolve(); return; }
      new MutationObserver((records, observer) => {
        if (node.dataset.phase !== 'compact') return;
        observer.disconnect(); resolve();
      }).observe(node, { attributes: true, attributeFilter: ['data-phase'] });
    }));
    assert.equal(await visitorDossier.count(), 1, 'Visitor uses one persistent dossier surface instead of an avatar-only handoff');
    assert.deepEqual(await visitorDossier.locator('.lattice-production-identity-dossier').boundingBox(), visitorCompactCard,
      'Visitor dossier returns to the exact full compact-card rectangle');
    assert.equal((await visitorDossier.locator('.lattice-production-identity-dossier__source-summary').innerText()).replace(/\s+/gu, ' ').trim(), visitorCompactText,
      'Visitor compact card retains avatar, name, and address after closing');
    await visitorDossier.locator('.lattice-production-identity-dossier__source-summary').click();
    await expectPhase(visitorDossier, 'open');
    await page.getByRole('button', { name: 'Close Identity Rack' }).click();
    await expectPhase(visitorDossier, 'compact');
    if (SCREENSHOT_DIR) await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'phase3-preview-wide.png') });
    await preview.getByRole('button', { name: 'EXIT' }).click();
    await page.locator('.system-workflow').waitFor();
    assert.equal(await previewTrigger.evaluate((node) => node === document.activeElement), true);
  } finally {
    await browser.close();
  }
});

test('narrow and reduced-motion state machines keep dock, overlays, crop, viewer, and Preview within one ownership layer', { timeout: 90_000 }, async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  try {
    if (SCREENSHOT_DIR) await mkdir(SCREENSHOT_DIR, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 720 }, reducedMotion: 'reduce' });
    await routeFixtureMedia(page);
    await page.goto(URL, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('.system-workflow').getAttribute('data-layout'), 'narrow');
    assert.equal(await page.locator('.system-workflow').getAttribute('data-reduced-motion'), 'true');
    const dock = await page.locator('.system-workflow__global-bar').boundingBox();
    assert.ok(inViewport(dock, 390, 720));
    const states = [
      ['Grids', '.system-workflow__grid-switcher'],
      ['Library', '.system-workflow__workspace-window'],
      ['Profile', '.system-workflow__profile'],
      ['Activity', '.system-workflow__activity-drawer'],
      ['Discover', '.system-workflow__discover'],
      ['Settings', '.system-workflow__settings'],
    ];
    for (const [label, selector] of states) {
      const trigger = page.getByRole('button', { name: label, exact: true });
      await trigger.click();
      const panel = page.locator(selector);
      await panel.waitFor();
      assert.ok(inViewport(await panel.boundingBox(), 390, 720), `${label} escaped the narrow viewport`);
      assert.equal(await page.locator('.system-workflow__inspector').count(), 0);
      assert.equal(await page.locator('[data-system-workflow-panel]').count(), 1);
      if (label === 'Discover') {
        const localRail = await panel.locator('.system-workflow__local-rail').boundingBox();
        const discoverRail = await panel.locator('.system-workflow__workspace-rail-controls').boundingBox();
        assert.ok(inViewport(localRail, 390, 720), 'Discover local rail escaped the narrow viewport');
        assert.ok(inViewport(discoverRail, 390, 720), 'Discover controls escaped the narrow viewport');
        assert.equal(Math.round(discoverRail.height), 76);
        if (SCREENSHOT_DIR) await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'phase3-narrow-discover.png') });
      }
      await page.keyboard.press('Escape');
      await panel.waitFor({ state: 'detached' });
      await page.waitForFunction((name) => document.activeElement?.getAttribute('aria-label') === name, label);
      assert.equal(await trigger.evaluate((node) => node === document.activeElement), true);
    }

    const placement = page.getByRole('button', { name: /Select ABYSSAL STUDY/ });
    await placement.click();
    await page.getByRole('button', { name: 'Crop' }).click();
    const cropControls = page.getByRole('region', { name: 'Crop controls' });
    assert.ok(inViewport(await cropControls.boundingBox(), 390, 720));
    await page.getByRole('button', { name: 'Cancel' }).click();
    await placement.dblclick();
    const viewer = page.locator('[data-lattice-focus-viewer]');
    await viewer.waitFor();
    assert.ok(inViewport(await viewer.boundingBox(), 390, 720));
    await page.keyboard.press('Escape');
    await viewer.waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Preview' }).click();
    const preview = page.locator('.visitor-grid-world');
    await preview.waitFor({ timeout: 10_000 });
    assert.ok(inViewport(await preview.boundingBox(), 390, 720));
    if (SCREENSHOT_DIR) await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'phase3-preview-narrow-reduced.png') });
  } finally {
    await browser.close();
  }
});
