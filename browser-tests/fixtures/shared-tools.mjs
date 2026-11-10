import { editorMenu } from './editor-menu.mjs';
import { settlePlaywrightAnimationFrames } from '../playwright-browser-adapter.mjs';

const toolHost = tool => tool === 'Layers' ? 'Layers' : 'Inspector';
export const sharedToolTab = (page, tool) => page.locator(`[role="tab"][data-tool-tab="${toolHost(tool)}"]`);
export const sharedToolPanel = (page, tool = 'Inspector') => page.locator('.workbench-tool-dock').filter({ has: sharedToolTab(page, tool) });

export async function detachTool(page, tool) {
  const host = toolHost(tool), panel = sharedToolPanel(page, host);
  // A section travels with the complete Inspector; a standalone host is already detached.
  if (await panel.locator('[data-tool-tab]').count() < 2) return;
  await sharedToolTab(page, host).click({ button: 'right' });
  await page.getByRole('menuitem', { name: `Detach ${host}`, exact: true }).click();
}
export async function separateLayers(page) {
  await openSharedTool(page, 'Layers');
  await openSharedTool(page, 'Inspector');
  await detachTool(page, 'Layers');
}
export async function hideModuleTools(page) {
  const tab = sharedToolTab(page, 'Inspector');
  if (await tab.count()) {
    await tab.click();
    await closeSharedTool(page, 'Inspector');
  }
}
export async function closeSharedTool(page, tool) {
  const host = toolHost(tool);
  await sharedToolTab(page, host).click();
  await page.getByRole('button', { name: `Close ${host === 'Layers' ? 'Workbench Layers' : host}`, exact: true }).click();
}
export async function openSharedTool(page, tool) {
  const hostName = toolHost(tool), button = sharedToolTab(page, hostName);
  if (!await button.count()) {
    // The palette's Text action selects the drawing tool. Reopening Text
    // settings must restore the Inspector that owns the selected article.
    if (tool === hostName || tool === 'Text') {
      const trigger = editorMenu(page, 'Tools');
      if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click();
      const option = page.getByRole('menu', { name: 'Tools menu', exact: true }).getByRole('menuitemcheckbox', { name: hostName, exact: true });
      // The menu renders before the dock's portal is placed. An already-open
      // tool must finish mounting; toggling it here would close it.
      if (await option.getAttribute('aria-checked') !== 'true') await option.click();
      else await option.press('Escape');
      await button.waitFor();
    }
    else {
      const host = page.locator('main.system-workflow');
      // A preceding modal close must release the editor before its shortcut can
      // receive focus. Locator.focus alone can silently target an inert host.
      await page.waitForFunction(node => node.isConnected && !node.closest('[inert], [hidden], [aria-hidden="true"]'), await host.elementHandle());
      await host.focus();
      await page.waitForFunction(node => node === document.activeElement, await host.elementHandle());
      await page.keyboard.press('Control+k');
      const label = tool === 'Info' ? 'Artwork info' : ['Image', 'Shape'].includes(tool) ? `${tool} settings` : tool;
      await page.getByRole('dialog').getByRole('button', { name: label, exact: true }).click();
    }
  } else { await button.focus(); await button.press('Enter'); }
  const panel = sharedToolPanel(page, hostName);
  if (tool !== hostName) {
    const section = panel.locator(`[data-inspector-section="${tool}"]`);
    if (await section.count()) {
      if (!await section.evaluate(node => node.open)) await section.locator(':scope > summary').click();
      await section.locator(':scope > summary').scrollIntoViewIfNeeded();
    } else if (['Image', 'Shape'].includes(tool)) {
      const properties = panel.locator(tool === 'Image' ? '.workbench-image-inspector' : 'section.shape-inspector-properties');
      if (await properties.count()) await properties.evaluate(node => node.closest('.workbench-inspector').scrollTop = 0);
    }
  }
  if (tool === 'Color') await openSharedColorPicker(page);
  return panel;
}
export async function openSharedColorPicker(page, label) {
  const panel = sharedToolPanel(page);
  const target = label || (await panel.locator('[data-text-inspector]').count() ? /^(Text|Background)$/ : 'Fill');
  const picker = panel.locator('.workbench-inspector-colour').filter({ has: page.locator(':scope > summary > span:first-child').filter({ hasText: target instanceof RegExp ? target : new RegExp(`^${target}$`) }) });
  if (!await picker.count()) return panel;
  const ancestors = picker.locator('xpath=ancestor::details');
  for (let index = 0; index < await ancestors.count(); index++) {
    const details = ancestors.nth(index);
    if (!await details.evaluate(node => node.open)) await details.locator(':scope > summary').click();
  }
  if (!await picker.evaluate(node => node.open)) await picker.locator(':scope > summary').click();
  await picker.getByRole('textbox', { name: 'Color colour', exact: true }).waitFor();
  return picker;
}
export async function chooseSharedColorTarget(page, value) {
  const panel = sharedToolPanel(page);
  if (['fill', 'outline', 'inner-lines'].includes(value) && !await panel.locator('[data-text-inspector]').count()) {
    return openSharedColorPicker(page, { fill: 'Fill', outline: 'Outline', 'inner-lines': 'Inner lines' }[value]);
  } else {
    const labels = { fill: 'Fill', outline: 'Outline', body: /^(Selected text|Text at cursor)$/, default: 'Article default text', title: 'Article title', background: 'Text box background',
      h1: 'Heading 1 (all)', h2: 'Heading 2 (all)', h3: 'Heading 3 (all)', caption: 'Caption (all)' };
    const trigger = panel.getByRole('button', { name: /^Color target:/ });
    // Finish scrolling its owner before opening a menu that dismisses on an
    // outside scroll. Click's automatic scroll can otherwise close that menu.
    await trigger.scrollIntoViewIfNeeded();
    await settlePlaywrightAnimationFrames(page);
    await trigger.click();
    await page.getByRole('listbox', { name: 'Color target', exact: true }).getByRole('option', { name: labels[value] || value, exact: true }).click();
  }
  return openSharedColorPicker(page);
}
export async function chooseSharedShape(page, label) {
  await sharedToolPanel(page).getByRole('button', { name: /^Selected shape:/ }).click();
  await page.getByRole('listbox', { name: 'Selected shape', exact: true }).getByRole('option', { name: label, exact: true }).click();
}
export async function setSharedColor(page, value, target) {
  const panel = await openSharedTool(page, 'Color');
  const picker = target ? await chooseSharedColorTarget(page, target) : await openSharedColorPicker(page);
  const field = picker.getByRole('textbox', { name: 'Color colour', exact: true });
  await field.fill(value); await field.press('Tab');
  if (!await panel.locator('[data-text-inspector]').count()) await closeSharedTool(page, 'Color');
}
export async function setTransform(page, field, value) {
  const panel = await openSharedTool(page, 'Transform');
  const input = panel.getByRole('spinbutton', { name: `Transform ${field}`, exact: true });
  await input.fill(String(value)); await input.press('Enter');
  return panel;
}

export async function resetSharedColor(page, target) {
  const panel = await openSharedTool(page, 'Color');
  await chooseSharedColorTarget(page, target);
  await panel.getByRole('button', { name: 'Use default text color', exact: true }).click();
  if (!await panel.locator('[data-text-inspector]').count()) await closeSharedTool(page, 'Color');
}
export async function setTextBackground(page, value) {
  const panel = await openSharedTool(page, 'Color');
  await chooseSharedColorTarget(page, 'background');
  await panel.getByRole('button', { name: /^Text background:/ }).click();
  await page.getByRole('listbox', { name: 'Text background', exact: true }).getByRole('option', { name: value === 'none' ? 'None' : 'Color', exact: true }).click();
  if (!await panel.locator('[data-text-inspector]').count()) await closeSharedTool(page, 'Color');
}

export async function selectWorkbenchLayer(page, name, options) {
  const panel = await openSharedTool(page, 'Layers');
  await panel.getByRole('button', { name: `Select ${name}`, exact: true }).click(options);
}
