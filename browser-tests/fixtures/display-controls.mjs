// Display chrome is revealed by keyboard focus, including on narrow screens.
export async function activate(page, control) {
  await control.focus(); await page.keyboard.press('Enter');
}

export async function openDisplayMenu(page, board) {
  await board.getByLabel(/Move Display Module:/).focus();
  await page.keyboard.press('Shift+F10');
}

export async function openDisplayTool(page, board, name) {
  await openDisplayMenu(page, board);
  await page.getByRole('menuitem', { name: 'TOOLS', exact: true }).click();
  await page.getByRole('menuitem', { name, exact: true }).click();
}
