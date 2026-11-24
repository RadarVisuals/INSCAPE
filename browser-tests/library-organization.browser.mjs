import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';

for (const width of [1440, 700]) test(`Library creates categories in their section and keeps creation scopes separate (${width})`, { timeout: 45000 }, async () => {
  const browser = await chromium.launch({ executablePath: process.env.INSCAPE_BROWSER_EXECUTABLE || undefined, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5173'}/browser-tests/library-storage-fixture.html`);
    const addSection = page.getByRole('button', { name: 'New Library item', exact: true });
    await addSection.click(); await page.getByRole('menuitem', { name: 'Section', exact: true }).click();
    const sectionName = page.getByRole('textbox', { name: 'section name', exact: true });
    await sectionName.fill('Scenes'); await sectionName.press('Enter');
    const section = page.locator('.system-workflow__library-section').filter({ has: page.getByRole('button', { name: 'Add folder to Scenes', exact: true }) });
    const addCategory = section.getByRole('button', { name: 'Add folder to Scenes', exact: true });
    await addCategory.click();
    const name = page.getByRole('textbox', { name: 'folder name', exact: true });
    assert.equal(await section.getByRole('textbox', { name: 'folder name', exact: true }).count(), 1);
    await name.fill('Lunar Desert'); await name.press('Enter');
    await section.getByRole('button', { name: 'Lunar Desert', exact: true }).waitFor();
    const saved = await page.evaluate(() => JSON.parse(window.storageTest.saved()));
    assert.deepEqual(saved.categoryOrganization.rootCategoryIds, []);
    assert.deepEqual(saved.categoryOrganization.sections[0].categoryIds, [saved.folders[0].id]);
    assert.equal(await section.locator('header i').count(), 0, 'section headings do not look like counted folders');
    await addCategory.focus(); await page.keyboard.press('Enter'); await name.press('Escape');
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Add folder to Scenes');
    await addCategory.click(); await name.fill('Saved after retry');
    await page.evaluate(() => { window.storageTest.denied = true; });
    await name.press('Enter'); await page.getByRole('alert').first().waitFor();
    assert.equal(await name.inputValue(), 'Saved after retry');
    assert.equal(await page.evaluate(() => window.storageTest.store.getState().workspace.folders.length), 1);
    await page.evaluate(() => { window.storageTest.denied = false; }); await name.press('Enter');
    await section.getByRole('button', { name: 'Saved after retry', exact: true }).waitFor();
    await page.reload();
    await section.getByRole('button', { name: 'Saved after retry', exact: true }).waitFor();
    await addSection.click(); await page.getByRole('menuitem', { name: 'Folder', exact: true }).click();
    await name.fill('Outside sections'); await name.press('Enter');
    await page.getByRole('navigation', { name: 'Browser navigation' }).getByRole('button', { name: 'Outside sections', exact: true }).waitFor();
    const folder = section.getByRole('button', { name: 'Lunar Desert', exact: true });
    await folder.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'New subfolder', exact: true }).click();
    await name.fill('Characters'); await name.press('Enter');
    await section.getByRole('button', { name: 'Characters', exact: true }).waitFor();
    const nested = await page.evaluate(() => JSON.parse(window.storageTest.saved()));
    assert.equal(nested.folders.find(f => f.name === 'Characters').parentId, nested.folders.find(f => f.name === 'Lunar Desert').id);
    await page.reload();
    await section.getByRole('button', { name: 'Characters', exact: true }).waitFor();
    assert.equal(await section.getByRole('button', { name: 'Outside sections', exact: true }).count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('compact folder filing persists through the production Library store and reload', { timeout: 45000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const origin = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5173';
    await page.route('https://raw.githubusercontent.com/**', route => route.fulfill({ path: 'public/assets/actors/abyssal_eye/full.webp' }));
    await page.goto(origin + '/browser-tests/library-storage-fixture.html');
    const loadAsset = () => page.evaluate(async () => {
      const { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS } = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
      window.storageTest.store.setState({ assets: [{ ...OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS[0], ownerAddress: window.storageTest.store.getState().profileAddress }], status: 'ready' });
    });
    await loadAsset();
    await page.getByRole('button', { name: 'New Library item', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Folder', exact: true }).click();
    const input = page.getByRole('textbox', { name: 'folder name', exact: true });
    await input.fill('Filed artwork'); await input.press('Enter');
    await page.getByRole('button', { name: 'All Assets', exact: true }).click();
    await page.getByRole('button', { name: 'Library view options', exact: true }).click();
    await page.getByRole('button', { name: 'Icons', exact: true }).click(); await page.keyboard.press('Escape');
    const asset = page.locator('.lattice-browser-asset').first();
    await page.waitForFunction(() => document.querySelector('.lattice-browser-asset img')?.naturalWidth > 0);
    const source = await asset.boundingBox();
    const folders = page.getByRole('navigation', { name: 'Browser navigation' }).getByRole('button', { name: 'Folders', exact: true });
    const rail = await folders.boundingBox();
    await page.mouse.move(source.x + 40, source.y + 40); await page.mouse.down();
    await page.mouse.move(rail.x + rail.width / 2, rail.y + rail.height / 2, { steps: 12 });
    const target = page.getByRole('dialog', { name: 'File artwork into folder' }).getByRole('button', { name: 'Filed artwork', exact: true });
    await target.waitFor(); const destination = await target.boundingBox();
    await page.mouse.move(destination.x + 40, destination.y + destination.height / 2, { steps: 10 }); await page.mouse.up();
    await page.waitForFunction(() => JSON.parse(window.storageTest.saved()).folders[0].assetIds.length === 1);
    const saved = JSON.parse(await page.evaluate(() => window.storageTest.saved()));
    await page.reload(); await loadAsset();
    assert.deepEqual(JSON.parse(await page.evaluate(() => window.storageTest.saved())).folders, saved.folders);
    await page.getByRole('button', { name: 'Filed artwork', exact: true }).click();
    await asset.waitFor();
    assert.match(await asset.getAttribute('aria-label'), /ABYSSAL STUDY/);
  } finally { await browser.close(); }
});
