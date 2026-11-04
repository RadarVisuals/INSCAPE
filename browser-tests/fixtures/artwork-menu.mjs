export async function artworkMenu(page, id) {
  const window = page.locator(`[data-workbench-view-id="${id}"]`).first();
  const target = id.startsWith('image:') ? window.locator('.image-module__canvas') : window.locator('header').first();
  await target.focus(); await target.press('Shift+F10');
  const menu = page.locator('.workbench-object-menu');
  await menu.waitFor();
  return menu;
}

export async function artworkCommand(page, id, label) {
  const menu = await artworkMenu(page, id);
  if (['Bring to front', 'Move forward', 'Move backward', 'Send to back'].includes(label))
    await menu.getByRole('menuitem', { name: 'Layer order', exact: true }).click();
  await menu.getByRole('menuitem', { name: label, exact: true }).click();
}
