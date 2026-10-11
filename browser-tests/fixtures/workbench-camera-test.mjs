// Navigation tests start at the ordinary 100% camera and world origin in either
// mode. No custom frame or preference changes are needed to make panning work.
export async function resetCameraTestView(page) {
  await page.getByRole('button', { name: 'Reset Workbench zoom to 100%', exact: true }).press('Enter');
  await page.getByRole('button', { name: 'Reset Workbench position', exact: true }).press('Enter');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

export const prepareCameraTestView = resetCameraTestView;
