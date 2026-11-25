// Sample every animation frame during real wheel/touch input, rather than
// waiting for IntersectionObserver to settle after each wrap.
export async function measureGalleryScroll(page, { touch = false, steps = 55 } = {}) {
  await page.mouse.move(1, 1);
  const horizontal = await page.locator('.workbench-overview-gallery').evaluate(node => node.scrollWidth > node.clientWidth + 1);
  await page.evaluate(horizontal => {
    const root = document.querySelector('.workbench-overview-gallery');
    window.galleryFrames = []; window.gallerySampling = true; window.galleryDirection = 1;
    const sample = time => {
      const bounds = root.getBoundingClientRect();
      const missing = [...root.querySelectorAll('.workbench-overview-card')].flatMap(card => {
        const box = card.getBoundingClientRect(), canvas = card.querySelector('.workbench-overview-canvas');
        if (box.right <= bounds.left + 1 || box.left >= bounds.right - 1 || box.bottom <= bounds.top + 1 || box.top >= bounds.bottom - 1) return [];
        return canvas?.getBoundingClientRect().width > 0 && canvas.querySelector('[data-navigator-object]') ? []
          : [{ id: card.dataset.cardId, cycle: card.parentElement.dataset.galleryCycle, top: box.top, bottom: box.bottom }];
      });
      window.galleryFrames.push({ time, direction: window.galleryDirection, scroll: horizontal ? root.scrollLeft : root.scrollTop, missing });
      if (window.gallerySampling) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }, horizontal);
  const cdp = touch ? await page.context().newCDPSession(page) : null;
  try {
    for (const direction of [1, -1]) {
      await page.evaluate(value => { window.galleryDirection = value; }, direction);
      if (touch) {
        const { width, height } = page.viewportSize();
        for (let swipe = 0; swipe < 7; swipe++) {
          const x = horizontal ? width * (direction === 1 ? .85 : .15) : width / 2, y = horizontal ? height / 2 : height * (direction === 1 ? .85 : .15);
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
          for (let i = 1; i <= 10; i++) {
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: horizontal ? x - direction * width * .07 * i : x, y: horizontal ? y : y - direction * height * .07 * i }] });
            await page.waitForTimeout(16);
          }
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          await page.waitForTimeout(100);
        }
      } else {
        const bounds = await page.locator('.workbench-overview-gallery').boundingBox();
        await page.mouse.move(bounds.x + bounds.width - 5, bounds.y + 10);
        for (let i = 0; i < steps; i++) { await page.mouse.wheel(horizontal ? direction * 100 : 0, horizontal ? 0 : direction * 100); await page.waitForTimeout(16); }
      }
      await page.waitForTimeout(200);
    }
    return await page.evaluate(() => window.galleryFrames);
  } finally {
    await page.evaluate(() => { window.gallerySampling = false; });
    await cdp?.detach();
  }
}
