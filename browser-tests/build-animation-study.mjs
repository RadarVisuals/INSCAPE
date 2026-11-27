// Reproducible, separate comparison asset; never an exported replacement Keeper.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
import { svgStudy, webpStudy, FRAME_TIMES, LOOP_MS } from './fixtures/animation-study.mjs';

const output = path.resolve(process.env.INSCAPE_ANIMATION_MEDIA || '.browser-test-runtime/svg-animation-study/media');
await mkdir(path.join(output, 'frames'), { recursive: true });
const source = await readFile('browser-tests/fixtures/keeper-layered.svg', 'utf8');
const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
  await page.setContent('<style>html,body{margin:0;background:transparent}svg{width:512px;height:512px}</style>' + svgStudy(source, { paused: true }).replace(/<\?xml[^>]*>/, ''));
  await page.waitForFunction(() => typeof perfPose === 'function');
  await page.evaluate(async () => Promise.all([...document.querySelectorAll('image')].map(node => new Promise((resolve, reject) => {
    const image = new Image(); image.onload = resolve; image.onerror = reject; image.src = node.href.baseVal;
  }))));
  for (let i = 0; !process.env.INSCAPE_REUSE_FRAMES && i < FRAME_TIMES.length; i++) {
    await page.evaluate(t => perfPose(t), FRAME_TIMES[i]);
    await page.screenshot({ path: path.join(output, 'frames', `${String(i).padStart(3, '0')}.png`), omitBackground: true });
    if (i % 40 === 0) console.log(`Captured ${i}/${FRAME_TIMES.length} frames`);
  }
} finally { await browser.close(); }
const config = { sourceSha256: createHash('sha256').update(source).digest('hex'), width: 512, height: 512,
  frames: FRAME_TIMES.length, frameTimes: FRAME_TIMES, loopMs: LOOP_MS, fps: 30, encoding: 'WebP quality 90, lossless alpha',
  note: 'Flattened comparison only. Native scene remains eight independent source layers.' };
await writeFile(path.join(output, 'manifest.json'), JSON.stringify(config, null, 2));
const encoded = spawnSync(process.env.PYTHON || 'python', ['browser-tests/encode-animation-study.py', output], { encoding: 'utf8' });
if (encoded.status !== 0) throw new Error(encoded.stderr || encoded.stdout);
console.log(encoded.stdout);
const bytes = await readFile(path.join(output, 'loop.webp')), poster = await readFile(path.join(output, 'poster.webp'));
const svg = webpStudy(bytes, poster);
if (Buffer.byteLength(svg) > 8 * 1024 * 1024) throw new Error('Comparison exceeds existing SVG host limit');
await writeFile(path.join(output, 'loop.svg'), svg);
for (const [name, options] of [['raf-uncapped', {}], ['raf-60', { fps: 60 }], ['raf-30', { fps: 30 }], ['css-30', { mode: 'css' }], ['css-60', { mode: 'css', fps: 60 }]])
  await writeFile(path.join(output, name + '.svg'), svgStudy(source, options));
console.log('Media ready: ' + output);
