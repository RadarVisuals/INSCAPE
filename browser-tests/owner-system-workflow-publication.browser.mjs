import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { holdFrames } from './fixtures/deferred-focus.mjs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = process.env.INSCAPE_SYSTEM_WORKFLOW_URL || 'http://127.0.0.1:5173/development/owner/system-workflow';

const inViewport = (rect, width, height) => rect && rect.x >= 0 && rect.y >= 0
  && rect.x + rect.width <= width + 0.5 && rect.y + rect.height <= height + 0.5;

test('System Workflow publication opens the canonical v9 rack without external mutation', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
    let uploadRequests = 0;
    await page.route('**/api/profile-publications', (route) => {
      uploadRequests += 1;
      return route.abort('blockedbyclient');
    });
    await page.goto(URL, { waitUntil: 'networkidle' });

    const trigger = page.locator('button[aria-label="Publish"]');
    await trigger.click();
    const rack = page.getByRole('complementary', { name: 'Publish profile' });
    await rack.waitFor();
    await page.waitForFunction(() => document.querySelector('.owner-lattice-publication-rack')?.dataset.panelPhase === 'open');
    const presentation = await rack.evaluate((node) => {
      const style = getComputedStyle(node);
      const box = node.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + 24);
      return {
        backgroundColor: style.backgroundColor,
        color: style.color,
        actionFontSize: getComputedStyle(node.querySelector('.owner-lattice-publication-rack__publish')).fontSize,
        bodyFontSize: getComputedStyle(node.querySelector('p')).fontSize,
        headingFontSize: getComputedStyle(node.querySelector('h2')).fontSize,
        pointerEvents: style.pointerEvents,
        position: style.position,
        transitionDuration: style.transitionDuration,
        hitInsideRack: Boolean(hit?.closest('.owner-lattice-publication-rack') === node),
        left: box.left,
        windowInset: Math.max(12, Number.parseFloat(getComputedStyle(document.querySelector('.system-workflow')).getPropertyValue('--workspace-navigation-inset')) || 0),
      };
    });
    assert.equal(presentation.position, 'fixed');
    assert.match(presentation.transitionDuration, /0\.18s/);
    assert.equal(presentation.pointerEvents, 'auto');
    assert.equal(presentation.hitInsideRack, true, 'publication rack owns pointer hit-testing above the workspace');
    assert.ok(Math.abs(presentation.left - presentation.windowInset) < 0.5, 'publication rack uses the sidebar clearance');
    assert.notEqual(presentation.backgroundColor, 'rgba(0, 0, 0, 0)', 'publication rack has an opaque menu surface');
    assert.notEqual(presentation.color, presentation.backgroundColor, 'publication controls retain visible contrast');
    assert.doesNotMatch(await rack.innerText(), /PROFILE\s+PUBLISH/u);
    assert.match(await rack.innerText(), /What goes live[\s\S]+Public Grids[\s\S]+What stays private/u);
    assert.deepEqual([presentation.headingFontSize, presentation.bodyFontSize, presentation.actionFontSize], ['11px', '11px', '11px']);
    assert.equal(await trigger.getAttribute('aria-expanded'), 'true');

    await trigger.click();
    await page.waitForFunction(() => document.querySelector('.owner-lattice-publication-rack')?.dataset.panelPhase === 'closing');
    await rack.waitFor({ state: 'detached' });
    await trigger.click();
    await rack.waitFor();
    await page.waitForFunction(() => document.querySelector('.owner-lattice-publication-rack')?.dataset.panelPhase === 'open');
    await page.locator('[data-system-workflow-artboard]').click({ position: { x: 900, y: 300 } });
    await page.waitForFunction(() => document.querySelector('.owner-lattice-publication-rack')?.dataset.panelPhase === 'closing');
    await rack.waitFor({ state: 'detached' });
    await trigger.click();
    await rack.waitFor();
    await page.getByRole('button', { name: 'Docs' }).click();
    await rack.waitFor({ state: 'detached' });
    await page.getByRole('dialog', { name: 'Docs' }).waitFor();
    await page.getByRole('button', { name: 'Close Docs' }).click();
    await trigger.click();
    await rack.waitFor();

    await rack.getByRole('button', { name: 'Prepare publication' }).click();
    await rack.getByRole('status').filter({ hasText: /ready to be made public/u }).waitFor();
    assert.equal(await rack.getByRole('button', { name: 'Make presentation public' }).isEnabled(), true);
    assert.equal(await rack.getByRole('button', { name: 'Publish to profile' }).count(), 0,
      'the wallet action is not presented before exact-byte verification');
    assert.equal(uploadRequests, 0, 'opening and preparing publication performs no upload');

    await page.setViewportSize({ width: 390, height: 720 });
    assert.ok(inViewport(await rack.boundingBox(), 390, 720), 'publication rack stays inside the narrow viewport');
    await page.keyboard.press('Escape');
    await rack.waitFor({ state: 'detached' });
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Publish');
    assert.equal(await trigger.evaluate((node) => node === document.activeElement), true);
    assert.equal(uploadRequests, 0);

    // Closing must preserve a newer focus choice while the return frame waits.
    await trigger.click();
    await page.waitForFunction(() => document.querySelector('.owner-lattice-publication-rack')?.dataset.panelPhase === 'open');
    await rack.getByRole('button', { name: 'Close Publication', exact: true }).focus();
    await holdFrames(page);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.owner-lattice-publication-rack'), null, { polling: 20 });
    const canvas = page.locator('main.system-workflow');
    await canvas.focus();
    await page.evaluate(() => window.releaseHeldFrames());
    assert.equal(await canvas.evaluate(node => node === document.activeElement), true,
      'publication focus recovery respects a newer canvas focus');
    assert.equal(uploadRequests, 0);
  } finally {
    await browser.close();
  }
});
