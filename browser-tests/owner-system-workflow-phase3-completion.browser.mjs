import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { activate, openDisplayMenu, openDisplayTool } from './fixtures/display-controls.mjs';
import { routeOfflineWorkflowReview } from './fixtures/legacy-workflow-artwork.mjs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = process.env.INSCAPE_SYSTEM_WORKFLOW_URL || 'http://127.0.0.1:5173/development/owner/system-workflow';
const SCREENSHOT_DIR = process.env.INSCAPE_SYSTEM_WORKFLOW_SCREENSHOT_DIR ? resolve(process.env.INSCAPE_SYSTEM_WORKFLOW_SCREENSHOT_DIR) : null;
const inViewport = (rect, width, height) => rect && rect.x >= 0 && rect.y >= 0
  && rect.x + rect.width <= width + 0.5 && rect.y + rect.height <= height + 0.5;
const routeFixtureMedia = page => routeOfflineWorkflowReview(page, new globalThis.URL(URL).origin);


async function sourceMark(page, placement) {
  const png = await placement.screenshot();
  return page.evaluate(async base64 => {
    const image = new Image(); image.src = 'data:image/png;base64,' + base64; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, image.width, image.height).data;
    let left = Infinity, right = -1, top = Infinity, bottom = -1;
    for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
      const i = (y * image.width + x) * 4;
      if (pixels[i] > 200 && pixels[i + 1] < 65 && pixels[i + 2] < 65) {
        left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
    }
    return right < 0 ? null : { left, top, width: right - left + 1, height: bottom - top + 1 };
  }, png.toString('base64'));
}

async function openAppearance(page) {
  await openDisplayMenu(page, page.locator('.system-workflow__presentation-board'));
  await page.getByRole('menuitem', { name: 'APPEARANCE', exact: true }).click();
  return page.locator('[data-shared-tool="appearance"]');
}

async function openMetadata(page) {
  await openDisplayTool(page, page.getByRole('article', { name: 'Display Module', exact: true }), 'METADATA');
}

async function seedPublishedWorlds(page) {
  await page.evaluate(async () => {
    // A warm Vite server gives mounted modules timestamped URLs. Mutate those
    // exact instances, not a second untimestamped copy of the repositories.
    const loadedModule = path => performance.getEntriesByType('resource').map(({ name }) => name)
      .find(url => new globalThis.URL(url).pathname === path) || path;
    const { OWNER_SYSTEM_WORKFLOW_REVIEW_DISCOVERY: profiles } = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
    const { luksoProfileDiscoveryRepository } = await import(loadedModule('/src/profileDiscovery/data/luksoProfileDiscoveryRepository.js'));
    const { publishedProfileResolutionStore } = await import(loadedModule('/src/profileDocument/state/publishedProfileResolutionStore.js'));
    const { createEmptySystemWorkflowDraft } = await import('/src/systemWorkflow/domain/systemWorkflowDraft.js');
    const { buildProfileDocumentV9 } = await import('/src/profileDocument/domain/profileDocumentV9Builder.js');
    // Match the startup fixture's data boundary; the actual portal, discovery
    // controller, search and published-document renderer remain in use.
    luksoProfileDiscoveryRepository.list = async () => profiles;
    publishedProfileResolutionStore.repository = { resolve: async address => ({ address, status: 'RESOLVED',
      document: buildProfileDocumentV9({ profileAddress: address,
        profileIdentity: { name: profiles.find(profile => profile.address === address).name, avatarUrl: null },
        systemWorkflowDraft: createEmptySystemWorkflowDraft(address), assetRecords: [], createdAt: 1, exportedAt: 2 }),
    }) };
  });
}

test('crop pan follows the pointer through transforms while crop handles reshape only the crop area', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await routeFixtureMedia(page);
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.evaluate(() => { window.__workflowWrites = 0; addEventListener('inscape:review-storage-write', event => { if (event.detail.key.startsWith('inscape.system-workflow-draft.')) window.__workflowWrites += 1; }); });
    const placement = page.getByRole('button', { name: /Select ABYSSAL STUDY/ });
    await placement.click();
    await page.getByRole('button', { name: 'Rotate' }).click();
    await page.getByRole('button', { name: 'Mirror horizontal' }).click();
    await page.getByRole('button', { name: 'Mirror vertical' }).click();
    await page.getByRole('button', { name: 'Crop' }).click();
    await page.getByLabel('Crop zoom').fill('2');
    const imageBefore = await sourceMark(page, placement);
    const placementBefore = await placement.boundingBox();
    await page.mouse.move(placementBefore.x + placementBefore.width / 2, placementBefore.y + placementBefore.height / 2);
    await page.mouse.down();
    await page.mouse.move(placementBefore.x + placementBefore.width / 2 + 30, placementBefore.y + placementBefore.height / 2 + 20, { steps: 4 });
    await page.mouse.up();
    const imageAfter = await sourceMark(page, placement);
    assert.ok(imageBefore && imageAfter, 'controlled source mark is visibly painted');
    assert.ok(Math.abs(imageAfter.left - imageBefore.left - 30) <= 1, 'transformed source follows horizontal pointer delta');
    assert.ok(Math.abs(imageAfter.top - imageBefore.top - 20) <= 1, 'transformed source follows vertical pointer delta');
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

    const discoverTrigger = page.getByRole('button', { name: 'Discover', exact: true });
    await seedPublishedWorlds(page);
    await discoverTrigger.click();
    const discover = page.locator('.public-entry-portal');
    await discover.getByRole('region', { name: 'Published worlds' }).waitFor();
    const worlds = discover.getByRole('button', { name: /^Enter / });
    await worlds.nth(2).waitFor();
    assert.equal(await worlds.count(), 3);
    const search = discover.getByRole('searchbox', { name: 'Search published worlds' });
    await search.fill('surface');
    await worlds.first().waitFor();
    assert.deepEqual(await worlds.evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label'))), ['Enter SURFACE UNIT']);
    await search.fill('no matching published world');
    assert.equal(await worlds.count(), 0);
    assert.match(await discover.innerText(), /No worlds found/);
    await search.fill('');
    await worlds.nth(2).waitFor();
    if (SCREENSHOT_DIR) await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'phase3-discover-wide.png') });
    await discover.getByRole('button', { name: 'Return to workspace' }).click();
    await discover.waitFor({ state: 'detached' });
    assert.equal(await discoverTrigger.evaluate(node => node === document.activeElement), true);

    const settingsTrigger = page.getByRole('button', { name: 'Settings', exact: true });
    const displaySurface = page.locator('.system-workflow__stage-viewport');
    const originalDisplaySurface = await displaySurface.getAttribute('data-surface');
    const originalDisplayGuide = await page.locator('.system-workflow__canvas').getAttribute('data-guide');
    await page.evaluate(() => { window.__phase3PreferenceWrites = 0; addEventListener('inscape:review-storage-write', event => {
      if (event.detail.key.startsWith('inscape.system-workflow-draft.')) window.__phase3PreferenceWrites++;
    }); });
    await settingsTrigger.click();
    const settings = page.getByRole('dialog', { name: 'Settings' });
    await settings.waitFor();
    assert.deepEqual(await settings.locator('.system-workflow__settings-section > header strong').allTextContents(), ['Activity', 'Workbench', 'Interface', 'Workbench backup']);
    assert.equal(await settings.locator('select').count(), 0);
    const canvasTheme = settings.getByRole('button', { name: /Workbench background/ });
    assert.equal(await canvasTheme.locator('span').innerText(), 'Mist');
    await canvasTheme.click();
    assert.deepEqual(await page.getByRole('option').allTextContents(), ['Carbon', 'Graphite', 'Slate', 'Ash', 'Mist', 'Paper']);
    await page.getByRole('option', { name: 'Carbon' }).click();
    assert.equal(await page.locator('.system-workflow').getAttribute('data-surface'), 'carbon');
    assert.equal(await displaySurface.getAttribute('data-surface'), originalDisplaySurface, 'local Workbench background does not change Display appearance');
    await settings.getByRole('button', { name: /Workbench grid display/ }).click();
    await page.getByRole('option', { name: 'Dots' }).click();
    await settings.getByLabel('Workbench grid color').fill('#123456');
    assert.equal(await page.locator('.system-workflow__canvas').getAttribute('data-guide'), originalDisplayGuide, 'Workbench guide preferences do not edit the Display');
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
    const appearance = await openAppearance(page);
    await appearance.getByLabel('Grid style').selectOption('DOTS');
    await appearance.getByLabel('Grid spacing').fill('-8');
    await appearance.getByLabel('Grid colour', { exact: true }).fill('#123456');
    await page.getByRole('button', { name: 'Close Display appearance', exact: true }).click();
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    const visitorRenderer = page.locator('.visitor-grid-world__grid-plane--current .visitor-grid-renderer');
    await visitorRenderer.waitFor();
    assert.deepEqual(await visitorRenderer.evaluate(node => {
      const style = getComputedStyle(node), guide = node.querySelector('.lattice-pixel-grid');
      const cellSize = Number.parseFloat(style.getPropertyValue('--lattice-production-cell-size'));
      return [node.dataset.guideMode, style.getPropertyValue('--lattice-production-guide-color').trim(),
        style.backgroundImage, Boolean(guide?.querySelector('path[stroke-linecap="round"]')),
        Math.round((Number(guide?.dataset.guideSpacing) / cellSize) * 9)];
    }), ['DOTS', '#123456', 'none', true, 1]);
  } finally { await browser.close(); }
});

test('contained inspection and v9 Preview preserve source, metadata, navigation, privacy and focus', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  try {
    if (SCREENSHOT_DIR) await mkdir(SCREENSHOT_DIR, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await routeFixtureMedia(page);
    await page.goto(URL, { waitUntil: 'networkidle' });
    const placement = page.getByRole('button', { name: /Select ABYSSAL STUDY/ });
    const mountain = page.getByRole('button', { name: /Select MOUNTAIN SIGNAL II/ });
    const ownerProjection = { abyssal: await placement.boundingBox(), mountain: await mountain.boundingBox() };
    await placement.evaluate(node => { window.__phase3Source = node; });
    await placement.focus(); await page.keyboard.press('i');
    const inspection = page.getByRole('group', { name: 'Artwork inspection', exact: true });
    await inspection.waitFor();
    assert.equal(await page.evaluate(() => window.__phase3Source.dataset.inspectionContext), 'selected');
    assert.equal(await inspection.getByRole('button').count(), 1, 'contained inspection exposes Return to composition');
    assert.equal(await page.locator('.lattice-focus-viewer__rack').count(), 0, 'Metadata uses its shared tool host');
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => document.querySelector('.system-workflow__placement[data-inspection-context="selected"]')?.getAttribute('aria-label')?.includes('MOUNTAIN SIGNAL II'));
    await openMetadata(page);
    const metadata = page.locator('[data-shared-tool="metadata"]');
    await metadata.getByRole('heading', { name: 'MOUNTAIN SIGNAL II', exact: true }).waitFor();
    await metadata.getByText('Source details', { exact: true }).click();
    assert.match(await metadata.innerText(), /Description[\s\S]*Creator[\s\S]*RADAR VISUALS[\s\S]*Source details/);
    await page.getByRole('button', { name: 'Close Info', exact: true }).click();
    if (SCREENSHOT_DIR) await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'phase3-inspection-wide.png') });
    await activate(page, page.getByRole('button', { name: 'Close artwork viewer', exact: true }));
    await inspection.waitFor({ state: 'detached' });
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label')?.includes('Select MOUNTAIN SIGNAL II'));
    assert.equal(await placement.evaluate(node => node === window.__phase3Source), true, 'inspection retains the source DOM');
    assert.deepEqual(await placement.boundingBox(), ownerProjection.abyssal);
    assert.deepEqual(await mountain.boundingBox(), ownerProjection.mountain);
    const appearance = await openAppearance(page);
    const appearanceWindow = appearance.locator('xpath=ancestor::aside');
    const sidebarBox = await page.locator('.workbench-sidebar').boundingBox();
    assert.ok((await appearanceWindow.boundingBox()).x >= sidebarBox.x + sidebarBox.width, 'Display tools respect the sidebar clearance');
    await appearance.getByLabel('Show grid', { exact: true }).uncheck();
    await page.getByRole('button', { name: 'Close Display appearance', exact: true }).click();
    assert.equal(await page.locator('.system-workflow__canvas').getAttribute('data-guide'), 'NONE');
    await placement.focus(); await page.keyboard.press('i'); await inspection.waitFor();
    assert.equal(await page.locator('.system-workflow__canvas').getAttribute('data-guide'), 'NONE', 'inspection preserves the Display guide choice');
    await activate(page, page.getByRole('button', { name: 'Close artwork viewer', exact: true }));
    await inspection.waitFor({ state: 'detached' });
    const previewTrigger = page.getByRole('button', { name: 'Preview', exact: true });
    await previewTrigger.click();
    const preview = page.getByRole('main', { name: 'Published INSCAPE Grid visitor' });
    await preview.waitFor();
    const current = preview.locator('.visitor-grid-world__grid-plane--current');
    assert.equal(await current.locator('[data-placement-id]').count(), 2);
    const visitorPlacement = current.locator('[data-placement-id="placement-abyssal"]');
    assert.deepEqual(await visitorPlacement.boundingBox(), ownerProjection.abyssal, 'Owner and Visitor use the same artwork rectangle');
    assert.deepEqual(await current.locator('[data-placement-id="placement-mountain-ii"]').boundingBox(), ownerProjection.mountain);
    assert.equal(await preview.locator('[data-visibility="PRIVATE"]').count(), 0);
    assert.equal(await preview.locator('.lattice-production-table__label').count(), 0);
    assert.equal(await current.locator('.visitor-grid-renderer').getAttribute('data-guide-mode'), 'NONE');
    await visitorPlacement.focus(); await page.keyboard.press('i'); await inspection.waitFor();
    assert.equal(await current.locator('.visitor-grid-renderer').getAttribute('data-guide-mode'), 'NONE');
    await openMetadata(page);
    await metadata.getByRole('heading', { name: 'ABYSSAL STUDY', exact: true }).waitFor();
    await metadata.getByText('Source details', { exact: true }).click();
    assert.match(await metadata.innerText(), /Description[\s\S]*Creator[\s\S]*RADAR VISUALS[\s\S]*Source details/);
    assert.equal(await preview.getByRole('button', { name: 'Lock Display Module composition', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Close Artwork info', exact: true }).click();
    await activate(page, page.getByRole('button', { name: 'Close artwork viewer', exact: true }));
    await inspection.waitFor({ state: 'detached' });
    await preview.getByRole('button', { name: 'Profile', exact: true }).click();
    const dossier = page.locator('.identity-module aside');
    await dossier.waitFor();
    assert.equal(await dossier.getAttribute('aria-modal'), null);
    await page.getByRole('button', { name: 'Close Identity' }).click();
    await dossier.waitFor({ state: 'detached' });
    assert.equal(await preview.getByRole('button', { name: 'Profile', exact: true }).evaluate(node => node === document.activeElement), true);
    if (SCREENSHOT_DIR) await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'phase3-preview-wide.png') });
    await preview.getByRole('button', { name: 'EXIT' }).click();
    await page.locator('.workbench-sidebar').waitFor();
    assert.equal(await previewTrigger.evaluate(node => node === document.activeElement), true);
  } finally { await browser.close(); }
});

test('normal-motion Preview opens Identity directly and returns focus on closure', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
    await routeFixtureMedia(page);
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
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

test('narrow and reduced-motion state machines keep dock, overlays, crop, viewer, and Preview within one ownership layer', { timeout: 90_000 }, async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  try {
    if (SCREENSHOT_DIR) await mkdir(SCREENSHOT_DIR, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 720 }, reducedMotion: 'reduce' });
    await routeFixtureMedia(page);
    await page.goto(URL, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('.system-workflow').getAttribute('data-layout'), 'narrow');
    assert.equal(await page.locator('.system-workflow').getAttribute('data-reduced-motion'), 'true');
    const dock = await page.locator('.workbench-sidebar').boundingBox();
    assert.ok(inViewport(dock, 390, 720));
    const states = [
      ['Grids', '.system-workflow__grid-switcher'],
      ['Library', '.system-workflow__workspace-window'],
      ['Profile', '.system-workflow__profile'],
      ['Activity', '.system-workflow__activity-drawer'],
      ['Settings', '.system-workflow__settings'],
    ];
    for (const [label, selector] of states) {
      const trigger = page.getByRole('button', { name: label, exact: true });
      await trigger.click();
      const panel = page.locator(selector);
      await panel.waitFor();
      assert.ok(inViewport(await panel.boundingBox(), 390, 720), `${label} escaped the narrow viewport`);
      assert.equal(await page.locator('.system-workflow__inspector').count(), 0);
      assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
      await page.keyboard.press('Escape');
      await panel.waitFor({ state: label === 'Library' ? 'hidden' : 'detached' });
      await page.waitForFunction((name) => document.activeElement?.getAttribute('aria-label') === name, label);
      assert.equal(await trigger.evaluate((node) => node === document.activeElement), true);
    }

    await page.getByRole('button', { name: 'Discover', exact: true }).click();
    const directory = page.locator('.public-entry-portal');
    await directory.waitFor();
    assert.ok(inViewport(await directory.boundingBox(), 390, 720));
    await page.keyboard.press('Escape');
    await directory.waitFor({ state: 'detached' });
    const placement = page.getByRole('button', { name: /Select ABYSSAL STUDY/ });
    await placement.focus(); await page.keyboard.press('Space');
    await page.getByRole('button', { name: 'Crop', exact: true }).click();
    const cropControls = page.locator('.system-workflow__crop-controls');
    await cropControls.getByLabel('Crop zoom').waitFor();
    assert.ok(inViewport(await page.getByRole('toolbar', { name: 'Inspection and placement', exact: true }).boundingBox(), 390, 720));
    for (const control of await cropControls.locator('input, button').all()) {
      await control.scrollIntoViewIfNeeded();
      assert.equal(await control.evaluate(node => {
        const box = node.getBoundingClientRect();
        return node.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
      }), true, 'each crop control is reachable through the scrolling action row');
    }
    await page.getByRole('button', { name: 'Cancel' }).click();
    await placement.focus(); await page.keyboard.press('i');
    const viewer = page.getByRole('group', { name: 'Artwork inspection', exact: true });
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
