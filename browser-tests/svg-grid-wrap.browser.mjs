import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { writeFile } from 'node:fs/promises';
import { mountFilledDisplay } from './fixtures/display-filled-fixture.mjs';

for (const visitor of [false, true]) test(`SVG rail prepares incoming documents and releases old slots: ${visitor ? 'Visitor' : 'Owner'}`, { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await mountFilledDisplay(page, 'http://127.0.0.1:5173', { svg: true, visitor });
    const stageSelector = visitor ? '.visitor-grid-world__viewport' : '.system-workflow__canvas';
    const currentSelector = visitor ? '.visitor-grid-world__grid-plane--current' : '.system-workflow__grid-plane--current';
    if (!visitor) {
      const lock = page.getByRole('button', { name: 'Lock Display Module composition', exact: true });
      await lock.focus(); await page.keyboard.press('Enter');
    }
    await page.waitForFunction(() => document.querySelectorAll('.artwork-svg-document').length === 30 && !document.querySelector('.artwork-svg-status'));
    await page.waitForTimeout(300);
    await page.evaluate(stageSelector => {
      const probe = window.svgWrap = { loading: 0, maxDocuments: 0, gaps: [], previous: 0, running: true };
      const sample = now => {
        if (probe.previous) probe.gaps.push(now - probe.previous);
        probe.previous = now;
        probe.maxDocuments = Math.max(probe.maxDocuments, document.querySelectorAll('.artwork-svg-document').length);
        const stage = document.querySelector(stageSelector).getBoundingClientRect();
        for (const status of document.querySelectorAll('.artwork-svg-status')) {
          const r = status.getBoundingClientRect();
          if (r.right > stage.left && r.left < stage.right && r.bottom > stage.top && r.top < stage.bottom) probe.loading++;
        }
        if (probe.running) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    }, stageSelector);
    const startingDraft = await page.evaluate(() => JSON.stringify(filledDisplay.draft()));
    const visited = [];
    for (const direction of [1, 1, 1, 1, 1, 1, -1, -1, -1]) {
      const sourceSlot = Number(await page.locator(currentSelector).getAttribute('data-rail-slot'));
      const next = page.locator(`[data-rail-slot="${sourceSlot + direction}"]`);
      const prepared = await next.locator('.artwork-svg-document').first().elementHandle();
      assert.ok(prepared, 'incoming Grid already owns its live SVG');
      assert.equal(await next.locator('.artwork-svg-status').count(), 0, 'incoming SVG is ready before movement');
      const r = await page.locator(stageSelector).boundingBox();
      await page.mouse.move(r.x + r.width * (direction > 0 ? .8 : .2), r.y + r.height * .55);
      await page.mouse.down();
      await page.mouse.move(r.x + r.width * (direction > 0 ? .2 : .8), r.y + r.height * .55, { steps: 24 });
      await page.mouse.up();
      await page.waitForFunction(({ currentSelector, slot }) => Number(document.querySelector(currentSelector)?.dataset.railSlot) === slot,
        { currentSelector, slot: sourceSlot + direction });
      assert.equal(await page.locator(currentSelector).locator('.artwork-svg-document').first().evaluate((node, original) => node === original, prepared), true,
        'arrival retains the prepared document rather than mounting a replacement');
      visited.push(await page.locator(currentSelector).getAttribute('data-rendered-grid-id'));
      await page.waitForTimeout(350);
    }
    const report = await page.evaluate(() => {
      svgWrap.running = false;
      const gaps = svgWrap.gaps.sort((a,b) => a-b);
      return { loading: svgWrap.loading, maxDocuments: svgWrap.maxDocuments,
        p95: gaps[Math.floor(gaps.length * .95)], max: gaps.at(-1), over32ms: gaps.filter(gap => gap > 32).length };
    });
    assert.equal(report.loading, 0, 'no loading status exposed during either direction or wrap');
    assert.ok(report.maxDocuments <= 30, 'five slots bound live documents over repeated laps');
    assert.equal(visited.filter(id => id === 'grid:filled-0').length, 3, 'three full laps, including reverse');
    assert.equal(await page.evaluate(() => JSON.stringify(filledDisplay.draft())), startingDraft, 'navigation does not write authored state');
    await page.screenshot({ path: `output/svg-wrap-${visitor ? 'visitor' : 'owner'}.png` });
    await writeFile(`output/svg-wrap-${visitor ? 'visitor' : 'owner'}-timing.json`, JSON.stringify(report, null, 2));
    // A hidden viewport must release even its prepared, offscreen neighbors.
    await page.locator(stageSelector).evaluate(node => { node.style.visibility = 'hidden'; node.style.display = 'none'; });
    await page.waitForFunction(() => !document.querySelector('.artwork-svg-document'));
    await page.locator(stageSelector).evaluate(node => { node.style.removeProperty('visibility'); node.style.removeProperty('display'); });
    await page.waitForFunction(() => document.querySelectorAll('.artwork-svg-document').length === 30 && !document.querySelector('.artwork-svg-status'));
    console.log(JSON.stringify({ visitor, ...report }));
  } finally { await browser.close(); }
});
