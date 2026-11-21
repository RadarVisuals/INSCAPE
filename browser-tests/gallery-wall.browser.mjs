import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';

test('the wall scrolls freely and inspecting a composition moves the room and restores the browse position', async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const origin = process.env.INSCAPE_TEST_ORIGIN || 'http://127.0.0.1:5173';
    const page = await browser.newPage({ viewport: {width: 1440,height:900}, reducedMotion:'reduce', hasTouch:true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(origin + '/browser-tests/profile-overview-fixture.html?view=0x'+'1'.repeat(40)+'&canvas=1&collection=1&large-gallery=1');
    const wall = page.getByRole('region', {name:'Gallery wall'}), host = wall.locator('.wall-scroll');
    await host.waitFor();
    for (const width of [1440,820]) {
      await page.setViewportSize({width,height:800});
      const x = width/2;
      const before = await host.evaluate(el => el.scrollLeft);
      await page.mouse.move(x,350); await page.mouse.down(); await page.mouse.move(x-140,350,{steps:8}); await page.mouse.up();
      const offset = await host.evaluate(el => el.scrollLeft);
      assert.ok(offset >= before+135);
      assert.equal(await wall.getAttribute('data-inspecting'),null);
      const floor = wall.locator('.wall-floor');
      const floorBefore = await floor.boundingBox();
      await host.press('f');
      await wall.getByRole('button', {name:'Return to wall'}).waitFor();
      assert.ok((await floor.boundingBox()).height > floorBefore.height);
      await page.keyboard.press('Escape');
      assert.equal(await host.evaluate(el => el.scrollLeft),offset);
      assert.deepEqual(await floor.boundingBox(),floorBefore);
    }
    const session = await page.context().newCDPSession(page);
    const beforeSwipe = await host.evaluate(el => el.scrollLeft);
    for (const [type,x] of [['touchStart',600],['touchMove',520],['touchMove',420],['touchEnd',0]]) {
      await session.send('Input.dispatchTouchEvent',{type,touchPoints:type === 'touchEnd' ? [] : [{x,y:340}]});
    }
    await page.waitForFunction(offset => document.querySelector('.wall-scroll').scrollLeft > offset + 50,beforeSwipe);
    assert.equal(await wall.getAttribute('data-inspecting'),null);
    assert.deepEqual(errors,[]);
  } finally { await browser.close(); }
});
