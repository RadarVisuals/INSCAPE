// Navigation tests start at the ordinary 100% camera and world origin in either
// mode. No custom frame or preference changes are needed to make panning work.
export async function resetCameraTestView(page) {
  await page.getByRole('slider', { name: 'Workbench zoom', exact: true }).fill('100');
  await page.getByRole('button', { name: 'Reset Workbench view', exact: true }).press('Enter');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

export const prepareCameraTestView = resetCameraTestView;
