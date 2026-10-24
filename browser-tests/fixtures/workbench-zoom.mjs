export async function setWorkbenchZoom(page, target) {
  const board = page.locator('.system-workflow__presentation-board').first();
  for (let step = 0; step < 20; step++) {
    const current = Number(await board.getAttribute('data-workbench-scale'));
    if (Math.abs(current - target) < 1e-7) return;
    const deltaY = Math.max(-100, Math.min(100, -Math.log(target / current) / .003));
    await board.dispatchEvent('wheel', { deltaY, ctrlKey: true, clientX: 0, clientY: 0, bubbles: true, cancelable: true });
    await page.waitForFunction(previous => Number(document.querySelector('.system-workflow__presentation-board').dataset.workbenchScale) !== previous, current);
  }
  throw new Error(`Workbench did not reach zoom ${target}`);
}
