// Geometry fixtures may place artwork beneath the owner's screen sidebar.
// Use its ordinary visibility command before testing those canvas coordinates.
export async function hideWorkspaceSidebar(page) {
  if (!await page.getByRole('complementary', { name: 'Workspace sidebar', exact: true }).count()) return;
  await page.locator('main.system-workflow').first().focus();
  await page.keyboard.press('Shift+F10');
  await page.getByRole('menuitem', { name: 'HIDE SIDEBAR', exact: true }).click();
}
