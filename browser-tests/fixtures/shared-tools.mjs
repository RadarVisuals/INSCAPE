export async function detachTool(page, tab) {
  await page.getByRole('tab', { name: tab, exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: `Detach ${tab}`, exact: true }).click();
}
export async function separateLayers(page) {
  await page.getByRole('tab', { name: 'Layers', exact: true }).waitFor();
  await hideModuleTools(page);
  const combined = page.getByRole('region', { name: 'Layers, Transform and Color', exact: true });
  if (await combined.count()) await detachTool(page, 'Layers');
}
export async function hideModuleTools(page) {
  for (const name of ['Image', 'Shape', 'FX', 'Info']) {
    const tab = page.getByRole('tab', { name, exact: true });
    if (await tab.count()) {
      await tab.click();
      await page.getByRole('button', { name: `Close ${name}`, exact: true }).click();
    }
  }
}
export async function closeSharedTool(page, tab) {
  await page.getByRole('button', { name: `Close ${tab === 'Layers' ? 'Workbench Layers' : tab}`, exact: true }).click();
}
export async function openSharedTool(page, tab) {
  const button = page.getByRole('tab', { name: tab, exact: true });
  if (!await button.count()) {
    const host = page.locator('main.system-workflow');
    // A preceding modal close must release the editor before its shortcut can
    // receive focus. Locator.focus alone can silently target an inert host.
    await page.waitForFunction(node => node.isConnected && !node.closest('[inert], [hidden], [aria-hidden="true"]'), await host.elementHandle());
    await host.focus();
    await page.waitForFunction(node => node === document.activeElement, await host.elementHandle());
    await page.keyboard.press('Control+k');
    await page.getByRole('dialog').getByRole('button', { name: ['Image', 'Shape'].includes(tab) ? `${tab} settings` : tab, exact: true }).click();
  } else { await button.focus(); await button.press('Enter'); }
  return page.locator('.workbench-tool-panel').filter({ has: page.getByRole('tab', { name: tab, exact: true }) });
}
export async function setSharedColor(page, value, target) {
  const panel = await openSharedTool(page, 'Color');
  if (target) await panel.getByRole('combobox', { name: 'Color target', exact: true }).selectOption(target);
  const field = panel.getByRole('textbox', { name: 'Color colour', exact: true });
  await field.fill(value); await field.press('Tab');
  await closeSharedTool(page, 'Color');
}
export async function setTransform(page, field, value) {
  const panel = await openSharedTool(page, 'Transform');
  const input = panel.getByRole('spinbutton', { name: `Transform ${field}`, exact: true });
  await input.fill(String(value)); await input.press('Enter');
  return panel;
}

export async function resetSharedColor(page, target) {
  const panel = await openSharedTool(page, 'Color');
  await panel.getByRole('combobox', { name: 'Color target', exact: true }).selectOption(target);
  await panel.getByRole('button', { name: 'Use default text color', exact: true }).click();
  await closeSharedTool(page, 'Color');
}
export async function setTextBackground(page, value) {
  const panel = await openSharedTool(page, 'Color');
  await panel.getByRole('combobox', { name: 'Color target', exact: true }).selectOption('background');
  if (await panel.getByRole('combobox', { name: 'Text background', exact: true }).isDisabled()) throw Error(await panel.innerText());
  await panel.getByRole('combobox', { name: 'Text background', exact: true }).selectOption(value === 'none' ? 'none' : 'color');
  await closeSharedTool(page, 'Color');
}
