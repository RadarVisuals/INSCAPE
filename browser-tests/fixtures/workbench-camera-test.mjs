// Geometry/navigation fixtures deliberately use 100% and the world origin.
// Fit canvas is a different command: owner entry currently frames the canvas.
export async function resetCameraTestView(page) {
  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.getByRole('button', { name: 'Fit canvas in view', exact: true }).press('Enter');
  await settle();
  await page.getByRole('slider', { name: 'Workbench zoom', exact: true }).fill('100');
  await settle();
  const host = page.locator('main.system-workflow').first();
  const pan = await host.evaluate(node => ({ deltaX: Number(node.dataset.workbenchCameraX) || 0,
    deltaY: Number(node.dataset.workbenchCameraY) || 0, bubbles: true, cancelable: true }));
  await host.dispatchEvent('wheel', pan);
  await settle();
}

export const prepareCameraTestView = resetCameraTestView;
