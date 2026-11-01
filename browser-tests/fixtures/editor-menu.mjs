export const editorMenu = (page, name) => page.getByRole('menubar', { name: 'Editor commands' }).getByRole('menuitem', { name, exact: true });
export const activeEditorDocument = page => page.getByRole('menubar', { name: 'Editor commands' }).getAttribute('data-document');
export async function editorCommand(page, menu, name) {
  const trigger = editorMenu(page, menu);
  if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click();
  await page.getByRole('menu', { name: `${menu} menu` }).getByRole('menuitem', { name, exact: true }).click();
}
export async function selectEditorDocument(page, id) {
  const trigger = editorMenu(page, 'Canvas');
  if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.press('Enter');
  const menu = page.getByRole('menu', { name: 'Canvas menu' });
  await (typeof id === 'object' ? menu.getByRole('menuitemcheckbox', { name: id.label, exact: true })
    : menu.locator(`[data-command-id="${id === 'reception' ? id : `canvas:${id}`}"]`)).press('Enter');
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
export async function editorOverview(page) {
  const logo = page.getByRole('button', { name: 'Inscape sidebar' });
  if (await logo.getAttribute('aria-expanded') !== 'true') await logo.click();
  await page.getByRole('button', { name: 'My Inscape', exact: true }).click();
}
