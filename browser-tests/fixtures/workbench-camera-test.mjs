// Interior-camera regressions deliberately use a large frame so their small
// gestures do not hit the separately tested frame limits.
export async function resetCameraTestView(page, visitor) {
  await page.getByRole('button', { name: 'Reset Workbench zoom to 100%', exact: true }).press('Enter');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  if (visitor) await page.getByRole('button', { name: 'Reset Workbench position', exact: true }).press('Enter');
  else {
    const host = page.locator('main.system-workflow').first();
    const offset = await host.evaluate(el => ({ x: parseFloat(el.style.getPropertyValue('--workbench-pan-x')) || 0,
      y: parseFloat(el.style.getPropertyValue('--workbench-pan-y')) || 0 }));
    await host.dispatchEvent('wheel', { deltaX: offset.x, deltaY: offset.y, bubbles: true, cancelable: true });
  }
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

export async function prepareCameraTestView(page, visitor) {
  if (!visitor) {
    await page.locator('.workbench-reference-frame').waitFor();
    await page.evaluate(() => {
      const key = Object.keys(localStorage).find(key => key.startsWith('inscape:workbench:preferences:'));
      const previous = JSON.parse(localStorage.getItem(key));
      localStorage.setItem(key, JSON.stringify({ ...previous, referenceFrameSize: { width: 4000, height: 4000 } }));
      window.__motionRemount();
    });
    await page.locator('.workbench-reference-frame').waitFor();
  }
  await resetCameraTestView(page, visitor);
}
