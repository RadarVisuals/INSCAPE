// Hold only the browser frame boundary. Callers still use native input/focus
// and the actual production handlers, then release all pending callbacks.
export async function holdFrames(page) {
  await page.evaluate(() => {
    const request = window.requestAnimationFrame, cancel = window.cancelAnimationFrame;
    const queue = new Map(); let id = 1000000;
    window.requestAnimationFrame = callback => { queue.set(++id, callback); return id; };
    window.cancelAnimationFrame = key => { if (!queue.delete(key)) cancel(key); };
    window.releaseHeldFrames = () => {
      window.requestAnimationFrame = request; window.cancelAnimationFrame = cancel;
      for (const callback of queue.values()) request(callback);
      queue.clear(); delete window.releaseHeldFrames;
      return new Promise(resolve => request(() => request(resolve)));
    };
  });
}
