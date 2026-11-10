import { closeSharedTool, sharedToolTab } from './shared-tools.mjs';

// Leave the left-hand artwork probes exposed using the actual window controls.
export async function parkGeometryTools(page) {
  if (page.viewportSize().width < 700) return;
  for (const name of ['Inspector', 'Layers']) {
    if (await sharedToolTab(page, name).count()) await closeSharedTool(page, name);
  }
  const navigator = page.locator('.workbench-navigator');
  if (await navigator.getAttribute('data-dock-side') !== 'right') {
    const undock = navigator.getByRole('button', { name: 'Undock Navigator', exact: true });
    if (await undock.count()) await undock.click();
    await navigator.getByRole('button', { name: 'Dock Navigator on right', exact: true }).click();
  }
}
