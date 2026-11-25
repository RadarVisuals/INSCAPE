export const editorMenu = page => page.getByRole('button', { name: 'Inscape menu', exact: true });
export async function openEditorMenu(page, name) {
  const trigger = editorMenu(page);
  if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click();
  if (!name) return page.getByRole('menu', { name: 'Inscape menu', exact: true });
  if (name === 'Compositions') {
    const canvas = await openEditorMenu(page, 'Canvas');
    await canvas.getByRole('menuitem', { name, exact: true }).click();
    return page.getByRole('menu', { name: 'Compositions options', exact: true });
  }
  if (name === 'Bento') {
    await openEditorMenu(page, 'Tools');
    await page.getByRole('menu', { name: 'Tools options', exact: true }).getByRole('menuitem', { name: 'Bento settings', exact: true }).click();
    return trigger;
  }
  const root = page.getByRole('menu', { name: 'Inscape menu', exact: true });
  await root.getByRole('menuitem', { name, exact: true }).click();
  return ['Backup', 'Settings'].includes(name) ? trigger : page.getByRole('menu', { name: `${name} options`, exact: true });
}
export const activeEditorDocument = page => page.locator('.editor-menu-bar[data-document]').getAttribute('data-document');
export async function editorCommand(page, menu, name, role = 'menuitem') {
  if (menu === 'Studio') {
    await page.getByRole('button', { name: 'Studio', exact: true }).click();
    return page.getByRole('menu', { name: 'Studio', exact: true }).getByRole(role, { name, exact: true }).click();
  }
  if (menu === 'Inscape') return (await openEditorMenu(page)).getByRole(role, { name, exact: true }).click();
  if (name === 'Bento settings') return openEditorMenu(page, 'Bento');
  if (name === 'Settings') return openEditorMenu(page, 'Settings');
  if (name === 'Search commands') {
    const root = await openEditorMenu(page);
    return root.getByRole('menuitem', { name: 'Search commands...', exact: true }).click();
  }
  const panel = await openEditorMenu(page, menu);
  await panel.getByRole(role, { name, exact: true }).click();
}
export const editorDocumentTitle = page => page.locator('.editor-menu-bar .editor-workspace-name');
export async function workspaceDestination(page, name) {
  const panel = await openEditorMenu(page);
  await panel.getByRole('menuitemcheckbox', { name, exact: true }).click();
  return editorMenu(page);
}
export async function selectEditorDocument(page, id, { keyboard = false } = {}) {
  let menu;
  if (keyboard) {
    // Keep the mouse button held throughout an active artwork gesture.
    await editorMenu(page).press('ArrowDown');
    await page.getByRole('menuitem', { name: 'Canvas', exact: true }).press('Enter');
    await page.getByRole('menuitem', { name: 'Compositions', exact: true }).press('Enter');
    menu = page.getByRole('menu', { name: 'Compositions options', exact: true });
  } else {
    menu = await openEditorMenu(page, 'Compositions');
  }
  await (typeof id === 'object' ? menu.getByRole('menuitemcheckbox', { name: id.label, exact: true })
    : menu.locator(`[data-command-id="Canvas:compositions:${id}"]`)).press('Enter');
}
export async function editorDocumentNames(page) {
  const menu = await openEditorMenu(page, 'Compositions');
  const names = await menu.locator('[data-command-id^="Canvas:compositions:"] > span').allTextContents();
  await page.keyboard.press('Escape');
  return names;
}
export async function activeEditorDocumentName(page) {
  const menu = await openEditorMenu(page, 'Compositions');
  const name = await menu.getByRole('menuitemcheckbox', { checked: true }).locator('span').innerText();
  await page.keyboard.press('Escape');
  return name;
}
export async function setEditorSidebarOpen(page, open) {
  // Existing fixture callers use this to dismiss navigation before artwork input.
  const trigger = editorMenu(page);
  if (await trigger.getAttribute('aria-expanded') !== String(open)) await trigger.click();
}
export async function editorDestination(page, name) {
  if (['Profile', 'Gallery', 'Writing', 'Studio'].includes(name)) return workspaceDestination(page, name);
  const trigger = editorMenu(page);
  await trigger.waitFor();
  if (['Publish', 'Preview'].includes(name) && await page.locator('.editor-menu-bar:visible').count()) {
    const control = page.locator('.editor-menu-bar:visible').getByRole('button', { name, exact: true });
    await control.click(); return control;
  }
  if (['Library', 'Layers', 'Inspector'].includes(name) && await page.locator('.editor-menu-bar:visible').count()) {
    const menu = await openEditorMenu(page, 'Tools');
    await menu.getByRole('menuitemcheckbox', { name, exact: true }).click();
  } else {
    const menu = await openEditorMenu(page);
    await menu.getByRole('menuitem', { name, exact: true }).click();
  }
  return trigger;
}
export async function editorOverview(page) { await page.getByRole('button', { name: 'Back to Gallery', exact: true }).click(); }
export const editSelectedWork = page => page.getByRole('complementary', { name: 'Work details', exact: true }).getByRole('button', { name: /^Edit .+ in Studio$/ }).click();
export async function choosePointer(page, name, visitor = false) {
  if (visitor) return page.getByRole('button', { name: 'Hand tool', exact: true }).click();
  await page.getByRole('button', { name: 'Pointer tools', exact: true }).click();
  await page.getByRole('dialog', { name: 'Pointer tools' }).getByRole('button', { name: new RegExp(`^${name}\\b`) }).click();
}
