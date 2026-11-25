export async function dropLibraryArtwork(page, card) {
  await card.scrollIntoViewIfNeeded();
  const from = await card.boundingBox();
  const to = await page.locator('main.system-workflow').evaluate(host => {
    const library = host.querySelector('.system-workflow__library') || document.querySelector('.system-workflow__library');
    const bounds = library.getBoundingClientRect();
    const frame = host.getBoundingClientRect();
    const rows = [frame.top + frame.height * 0.6, frame.top + frame.height * 0.45, frame.top + frame.height * 0.75];
    for (const y of rows) {
      for (let x = Math.max(frame.left + frame.width * 0.55, bounds.right + 40); x < frame.right - 20; x += 24) {
        const hit = document.elementFromPoint(x, y);
        if (hit === host || hit?.matches('.system-workflow__workbench, [data-workbench-pan-surface]')) {
          return { x, y };
        }
      }
    }
    throw new Error('No exposed canvas point for a Library drop.');
  });
  await page.mouse.move(from.x + from.width / 2, from.y + Math.min(35, from.height / 2));
  await page.mouse.down();
  try {
    await page.mouse.move(to.x, to.y, { steps: 12 });
    await page.getByText('Release to place Image', { exact: true }).waitFor();
  } finally {
    await page.mouse.up();
  }
}
