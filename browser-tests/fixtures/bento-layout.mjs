// Exercise the current columns/rows controls while keeping a requested total
// for scenarios whose content count matters more than its initial arrangement.
export async function setBentoCellCount(panel, count) {
  let columns = Math.ceil(Math.sqrt(Math.max(1, count)));
  while (count > 0 && count % columns) columns--;
  await panel.getByLabel('Columns', { exact: true }).fill(String(count === 0 ? 0 : columns));
  await panel.getByLabel('Rows', { exact: true }).fill(String(count === 0 ? 1 : count / columns));
}

export async function bentoCellCount(panel) {
  return Number(await panel.getByLabel('Columns', { exact: true }).inputValue())
    * Number(await panel.getByLabel('Rows', { exact: true }).inputValue());
}

export async function setBentoFormat(page, panel, format) {
  await panel.getByRole('button', { name: /^Format:/u }).click();
  await page.getByRole('listbox', { name: 'Format', exact: true }).getByRole('option', { name: format, exact: true }).click();
}

export async function addBentoCell(page, direction = 'Right of this row') {
  await page.getByRole('button', { name: 'Add cell', exact: true }).click();
  await page.getByRole('listbox', { name: 'Add cell', exact: true }).getByRole('option', { name: direction, exact: true }).click();
}

export async function setCurrentBentoField(panel, label, value) {
  const field = panel.getByLabel(label, { exact: true });
  await field.fill(String(value));
  await field.press('Enter');
}
