import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = process.env.INSCAPE_SYSTEM_WORKFLOW_URL || 'http://127.0.0.1:5173/development/owner/system-workflow';

const inViewport = (rect, width, height) => rect && rect.x >= 0 && rect.y >= 0
  && rect.x + rect.width <= width + 0.5 && rect.y + rect.height <= height + 0.5;

test('System Workflow publication opens the canonical v9 rack without external mutation', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    let uploadRequests = 0;
    await page.route('**/api/profile-publications', (route) => {
      uploadRequests += 1;
      return route.abort('blockedbyclient');
    });
    await page.goto(URL, { waitUntil: 'networkidle' });

    const trigger = page.locator('button[aria-label="Publish"]');
    await trigger.click();
    const rack = page.getByRole('complementary', { name: 'Version 9 publication' });
    await rack.waitFor();
    const presentation = await rack.evaluate((node) => {
      const style = getComputedStyle(node);
      const box = node.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + 24);
      return {
        backgroundColor: style.backgroundColor,
        color: style.color,
        pointerEvents: style.pointerEvents,
        position: style.position,
        hitInsideRack: Boolean(hit?.closest('.owner-lattice-publication-rack') === node),
      };
    });
    assert.equal(presentation.position, 'fixed');
    assert.equal(presentation.pointerEvents, 'auto');
    assert.equal(presentation.hitInsideRack, true, 'publication rack owns pointer hit-testing above the inert workspace');
    assert.notEqual(presentation.backgroundColor, 'rgba(0, 0, 0, 0)', 'publication rack has an opaque menu surface');
    assert.notEqual(presentation.color, presentation.backgroundColor, 'publication controls retain visible contrast');
    assert.match(await rack.innerText(), /PUBLICATION MODULE\s+VERSION 9/u);
    assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
    assert.equal(await rack.getByRole('button', { name: 'UPLOAD + VERIFY' }).isDisabled(), true);
    assert.equal(await rack.getByRole('button', { name: 'PUBLISH VERSION 9' }).isDisabled(), true);

    await rack.getByRole('button', { name: 'PREPARE SNAPSHOT' }).click();
    assert.match(await rack.getByRole('status').innerText(), /Version 9 revision 1 is frozen/u);
    assert.equal(await rack.getByRole('button', { name: 'UPLOAD + VERIFY' }).isEnabled(), true);
    assert.equal(await rack.getByRole('button', { name: 'PUBLISH VERSION 9' }).isDisabled(), true,
      'preparing a snapshot never fakes CID or wallet readiness');
    assert.equal(uploadRequests, 0, 'opening and preparing publication performs no upload');

    await page.setViewportSize({ width: 390, height: 720 });
    assert.ok(inViewport(await rack.boundingBox(), 390, 720), 'publication rack stays inside the narrow viewport');
    await page.keyboard.press('Escape');
    await rack.waitFor({ state: 'detached' });
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Publish');
    assert.equal(await trigger.evaluate((node) => node === document.activeElement), true);
    assert.equal(uploadRequests, 0);
  } finally {
    await browser.close();
  }
});
