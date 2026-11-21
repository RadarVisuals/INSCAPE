// Window placement is available from the title context menu or the options button. Exercise the keyboard path so pointer-only access cannot regress.
export async function undockWindow(page, target) {
  const panel = typeof target === 'string'
    ? page.locator('.workbench-tool-panel').filter({ has: page.locator(`.workbench-tool-panel-grip[aria-label^="Move ${target} "]`) })
    : target;
  if (!await panel.count() || !await panel.getAttribute('data-side-docked')) return false;
  await panel.locator('.workbench-tool-panel-grip').first().press('Shift+F10');
  await page.getByRole('menuitemcheckbox', { name: 'Floating', exact: true }).click();
  // Undocking returns focus on the next frame. Wait for that handoff before
  // sending a keyboard command to another panel.
  const grip = await panel.locator('.workbench-tool-panel-grip').first().elementHandle();
  await page.waitForFunction(node => document.activeElement === node, grip);
  await grip.dispose();
  return true;
}
