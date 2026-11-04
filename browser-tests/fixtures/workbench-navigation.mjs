import { editorMenu } from './editor-menu.mjs';

const commands = {
  focus: ['View', 'Focus selection', 'Focus selected Workbench modules'],
  back: ['View', 'Previous view', 'Back to previous Workbench view'],
  groups: ['Tools', 'Groups', 'Workbench groups'],
};

// The full Editor uses its menu. Public and isolated camera fixtures retain
// the navigation rail; exercise the real entry point in each host.
export async function workbenchCommand(page, action) {
  const [menu, name, railName] = commands[action];
  const trigger = editorMenu(page, menu);
  if (!await trigger.count()) return page.getByRole('button', { name: railName, exact: true });
  if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click();
  return page.getByRole('menu', { name: `${menu} menu` }).getByRole('menuitem', { name, exact: true });
}

export async function navigateWorkbench(page, action) {
  await (await workbenchCommand(page, action)).click();
}

export async function workbenchCommandDisabled(page, action) {
  const [, , railName] = commands[action];
  const menuBar = page.locator('[role="menubar"][aria-label="Editor commands"]');
  if (!await menuBar.count()) return page.getByRole('button', { name: railName, exact: true }).isDisabled();
  if (!await menuBar.isVisible()) return true; // Immersive inspection suspends Editor commands.
  const focused = await page.locator(':focus').elementHandle();
  try {
    const disabled = await (await workbenchCommand(page, action)).isDisabled();
    await page.keyboard.press('Escape');
    return disabled;
  } finally {
    await focused?.evaluate(node => { if (node.isConnected) node.focus({ preventScroll: true }); });
    await focused?.dispose();
  }
}
