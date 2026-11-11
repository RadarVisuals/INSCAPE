export const editorMenu = (page, name) => page.getByRole('menubar', { name: 'Editor commands' }).getByRole('menuitem', { name, exact: true });
export const activeEditorDocument = page => page.getByRole('menubar', { name: 'Editor commands' }).getAttribute('data-document');
export async function editorCommand(page, menu, name) {
  const trigger = editorMenu(page, menu);
  if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click();
  await page.getByRole('menu', { name: `${menu} menu` }).getByRole('menuitem', { name, exact: true }).click();
}
export const workspacePicker = page => page.locator('.workspace-switcher-trigger:visible');
export async function workspaceDestination(page, name) {
  const trigger = workspacePicker(page);
  await trigger.click();
  await page.getByRole('menu', { name: 'Workspace menu' }).getByRole('menuitemcheckbox', { name, exact: true }).click();
  return trigger;
}
export async function selectEditorDocument(page, id) {
  if (id === 'reception') return workspaceDestination(page, 'Reception Editor');
  const trigger = editorMenu(page, 'Canvas');
  if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.press('Enter');
  const menu = page.getByRole('menu', { name: 'Canvas menu' });
  await (typeof id === 'object' ? menu.getByRole('menuitemcheckbox', { name: id.label, exact: true })
    : menu.locator(`[data-command-id="canvas:${id}"]`)).press('Enter');
}
export async function editorDocumentNames(page) {
  const trigger = editorMenu(page, 'Canvas');
  if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click();
  const menu = page.getByRole('menu', { name: 'Canvas menu' });
  const names = await menu.locator('[data-command-id^="canvas:"] > span').allTextContents();
  await trigger.click();
  return names;
}
export async function activeEditorDocumentName(page) {
  const trigger = editorMenu(page, 'Canvas');
  if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click();
  const name = await page.getByRole('menu', { name: 'Canvas menu' }).getByRole('menuitemcheckbox', { checked: true }).locator('span').innerText();
  await trigger.click();
  return name;
}
export async function setEditorSidebarOpen(page, open) {
  const logo = page.getByRole('button', { name: 'Inscape sidebar' });
  if (await logo.getAttribute('aria-expanded') !== String(open)) await logo.click();
}
export async function editorDestination(page, name) {
  // Wait for the owner header before choosing a route. Immediately after a
  // reload, count() can see no switcher and incorrectly select the old sidebar.
  await page.getByRole('button', { name: 'Inscape sidebar', exact: true }).waitFor();
  if (await workspacePicker(page).count()) {
    if (['Reception', 'My Inscape'].includes(name)) return workspaceDestination(page, name);
    if (['Profile', 'Publish', 'Settings'].includes(name) && await page.locator('.editor-header-actions:visible').count()) {
      const trigger = page.locator('.editor-header-actions').getByRole('button', { name, exact: true });
      await trigger.click();
      return trigger;
    }
  }
  await setEditorSidebarOpen(page, true);
  const trigger = page.getByRole('complementary', { name: 'Workspace sidebar' }).getByRole('button', { name, exact: true });
  await trigger.click();
  return trigger;
}
export async function editorOverview(page) {
  await editorDestination(page, 'My Inscape');
}

export async function choosePointer(page, name, visitor = false) {
  if (visitor) return page.getByRole('button', { name: 'Hand tool', exact: true }).click();
  await page.getByRole('button', { name: 'Pointer tools', exact: true }).click();
  await page.getByRole('dialog', { name: 'Pointer tools' }).getByRole('button', { name: new RegExp(`^${name}\\b`) }).click();
}
