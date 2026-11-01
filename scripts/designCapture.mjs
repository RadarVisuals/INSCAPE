import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { browserExecutable } from './browserEnvironment.mjs';

const root = resolve(import.meta.dirname, '..');
let browser;
try {
  const [input, name = 'capture', ...extra] = process.argv.slice(2);
  const url = new URL(input || 'http://127.0.0.1:5179/design-lab.html');
  if (extra.length || !/^[a-z][a-z0-9-]{0,47}$/u.test(name)) throw Error('Usage: npm run design:capture -- <lab-url> [name]');
  if (url.origin !== 'http://127.0.0.1:5179' || url.pathname !== '/design-lab.html') throw Error('Capture only the dedicated local lab at http://127.0.0.1:5179/design-lab.html');
  const width = Number(url.searchParams.get('width')) || 1440;
  if (!Number.isInteger(width) || width < 320 || width > 1920) throw Error('Width must be 320–1920.');
  const output = resolve(root, 'output/design-lab', `${name}-${Date.now()}`);
  await mkdir(output, { recursive: true });
  browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(15000); page.setDefaultNavigationTimeout(30000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(url.href);
  await page.locator('[data-lab-ready="true"]').waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => [...document.querySelectorAll('[data-media-state]')].every(node => node.dataset.mediaState === 'ready'));
  await page.locator('[data-lab-artboard] img').evaluateAll(images => Promise.all(images.map(image => image.decode().catch(() => {}))));
  if (await page.locator('[data-lab-artboard] [role="alert"]').count() || errors.length) throw Error(`Artboard has errors: ${errors.join('; ') || await page.locator('[data-lab-artboard] [role="alert"]').first().textContent()}`);
  const nodes = await page.evaluate(async () => {
    const { describeElement } = await import('/design-system/lab/context.js');
    return [...document.querySelectorAll('[data-lab-artboard] [data-inscape-source]')].map(describeElement)
      .filter(node => node.bounds.width > 0 && node.bounds.height > 0);
  });
  if (!nodes.length) throw Error('No source metadata. Start the server with npm run design:lab.');
  const controls = await page.locator('[data-lab-artboard] :is(input, select, textarea)').evaluateAll(nodes => nodes.map(node => ({
    source: node.dataset.inscapeSource, label: node.getAttribute('aria-label') || node.labels?.[0]?.textContent?.trim(), value: node.value, checked: node.checked,
  })));
  const screenshot = resolve(output, 'artboard.png');
  await page.locator('[data-lab-artboard]').screenshot({ path: screenshot });
  const paths = [...new Set(nodes.map(node => node.source.replace(/:\d+$/u, '')))];
  const sourceHashes = Object.fromEntries(await Promise.all(paths.map(async path => {
    if (!/^(src|design-system)\/[a-zA-Z0-9_./-]+$/u.test(path) || path.split('/').includes('..')) throw Error('Invalid source path in capture.');
    return [path, createHash('sha256').update(await readFile(resolve(root, path))).digest('hex')];
  })));
  await writeFile(resolve(output, 'context.json'), JSON.stringify({ version: 1, url: page.url(), viewport: { width, height: 1000 },
    capturedAt: new Date().toISOString(), commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    trackedChanges: execFileSync('git', ['diff', '--name-only'], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean),
    theme: await page.evaluate(() => document.documentElement.dataset.interfaceTheme),
    state: 'Fresh sample with reduced motion; this command does not capture an already-open tab.', sourceHashes, controls, layers: nodes }, null, 2) + '\n');
  console.log(`Saved ${screenshot}\nSaved ${resolve(output, 'context.json')}`);
} catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
finally { await browser?.close(); }
