import { closeSharedTool, sharedToolTab } from './shared-tools.mjs';

// Leave the left-hand artwork probes exposed using the actual window controls.
export async function parkGeometryTools(page) {
  if (page.viewportSize().width < 700) return;
  for (const name of ['Inspector', 'Layers']) {
    if (await sharedToolTab(page, name).count()) await closeSharedTool(page, name);
  }
  const navigator = page.locator('.workbench-navigator');
  if (await navigator.getAttribute('data-dock-side') !== 'right') {
    await navigator.getByRole('button', { name: 'Navigator window options', exact: true }).click();
    await page.getByRole('menuitemcheckbox', { name: 'Dock on right', exact: true }).click();
  }
}
