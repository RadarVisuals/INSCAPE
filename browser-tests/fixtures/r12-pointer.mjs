import assert from 'node:assert/strict';

export const r12Viewports = [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 320, height: 320 },
];
export const r12Cases = ['carbon', 'mist'].flatMap(theme => r12Viewports.map(viewport => ({ theme, ...viewport })));

// Scroll only through the browser's normal containment, then inspect the actual
// hit target and send a native pointer click. No forced or DOM-dispatched click.
export async function pointerAction(page, locator) {
  await locator.waitFor({ state: 'visible' });
  assert.equal(await locator.isEnabled(), true, 'the action must be available');
  await locator.scrollIntoViewIfNeeded();
  const hit = await locator.evaluate(node => {
    const rect = node.getBoundingClientRect(), x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
    const target = document.elementFromPoint(x, y);
    return { x, y, width: rect.width, height: rect.height,
      bounded: rect.x >= 0 && rect.y >= 0 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1,
      receivesPointer: target === node || node.contains(target),
      obstruction: target?.outerHTML.slice(0, 240) };
  });
  assert.ok(hit.width > 0 && hit.height > 0 && hit.bounded && hit.receivesPointer, JSON.stringify(hit));
  await page.mouse.click(hit.x, hit.y);
  return hit;
}
