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

// Draw explicit geometry for scenarios that need an extra column or row.
// These are fixture choices, not directional commands in the product.
export async function addBentoCell(page, side = 'right', sourceId) {
  const value = await page.evaluate(() => window.nativeReceptionFixture.root.getDraft().reception);
  const { area } = value.workbench, { gap, padding } = value.bento;
  const source = sourceId ? value.workbench.shapes.find(s => s.id === sourceId).window
    : { left: area.left + padding, top: area.top + padding, width: area.width - padding * 2, height: area.height - padding * 2 };
  const rect = side === 'right' ? { left: source.left + source.width + gap, top: source.top, width: 320, height: source.height }
    : { left: source.left, top: source.top + source.height + gap, width: source.width, height: 240 };
  for (const name of ['Close Inspector', 'Close Workbench Layers']) {
    const close = page.getByRole('button', { name, exact: true });
    if (await close.isVisible()) await close.click();
  }
  await page.getByRole('button', { name: 'Fit canvas in view', exact: true }).click();
  await page.getByRole('slider', { name: 'Workbench zoom', exact: true }).press('Home');
  const first = value.cells[0].id, world = value.workbench.shapes.find(s => s.id === first).window;
  await page.waitForFunction(id => Math.abs(parseFloat(document.querySelector(`[data-editor-cell-surface="${id}"]`).style.width)
    / window.nativeReceptionFixture.root.getDraft().reception.workbench.shapes.find(s => s.id === id).window.width - .25) < .001, first);
  const box = await page.locator(`[data-editor-cell-surface="${first}"]`).boundingBox(), scale = box.width / world.width;
  const start = { x: box.x + (rect.left - world.left) * scale, y: box.y + (rect.top - world.top) * scale };
  await page.getByRole('button', { name: 'Cell tool', exact: true }).click();
  await page.keyboard.down('Alt');
  try {
    await page.mouse.move(start.x, start.y); await page.mouse.down();
    await page.mouse.move(start.x + rect.width * scale, start.y + rect.height * scale, { steps: 8 }); await page.mouse.up();
  } finally { await page.keyboard.up('Alt'); }
  await page.waitForFunction(count => window.nativeReceptionFixture.root.getDraft().reception.cells.length === count, value.cells.length + 1);
  await page.getByRole('button', { name: 'Fit canvas in view', exact: true }).click();
}

export async function setCurrentBentoField(panel, label, value) {
  const field = panel.getByLabel(label, { exact: true });
  await field.fill(String(value));
  await field.press('Enter');
}

// Geometry-sensitive interaction tests need fixed cells rather than a random
// starting proposal. Seed an empty grid through the normal guarded fixture store.
export async function seedBentoGrid(page, columns, rows, unequal = false) {
  return page.evaluate(({ columns, rows, unequal }) => {
    const { root } = window.nativeReceptionFixture, draft = root.getDraft(), value = draft.reception;
    if (value.cells.length !== columns * rows || value.cells.some(cell => cell.members.length))
      throw Error('Seed an empty Bento with the requested cell count');
    const { width, height } = value.workbench.area, { gap, padding } = value.bento;
    const boundaries = (total, count) => Array.from({ length: count + 1 }, (_, index) =>
      Math.round(total * (unequal && count === 2 && index === 1 ? .6 : index / count)));
    const xs = boundaries(width - padding * 2 - gap * (columns - 1), columns);
    const ys = boundaries(height - padding * 2 - gap * (rows - 1), rows);
    value.cells.forEach((cell, index) => {
      const col = index % columns, row = Math.floor(index / columns);
      value.workbench.shapes.find(item => item.id === cell.id).window = {
        left: value.workbench.area.left + padding + xs[col] + gap * col,
        top: value.workbench.area.top + padding + ys[row] + gap * row,
        width: xs[col + 1] - xs[col], height: ys[row + 1] - ys[row],
      };
    });
    if (!root.commitCompletedOperation(draft, { expectedGeneration: root.getGeneration() }))
      throw Error('Could not seed the fixed grid');
    return value.cells.map(cell => cell.id);
  }, { columns, rows, unequal });
}
