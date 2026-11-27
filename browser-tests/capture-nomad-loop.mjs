import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
import { nomadExport } from './fixtures/nomad-exports.mjs';
import { pageFor, mount, snapshot, send } from './fixtures/nomad-export-harness.mjs';
const output = '.browser-test-runtime/nomad-export-study/loop';
await mkdir(output + '/frames30', { recursive: true });
let svg = await nomadExport('full', { active: false });
// Bake cloth only. Integer harmonics make an eight-second seam; flight remains live.
svg = svg.replaceAll('motion.x*2.2', 'motion.x*2.356194490192345').replaceAll('motion.x*3.7', 'motion.x*3.9269908169872414');
svg = svg.replace('gl.uniform4f(u.travel, state.rest ? 0 : state.x || 0, state.rest ? 0 : state.y || 0, angle, bob);',
  'gl.uniform4f(u.travel, 0, 0, 0, 0);');
const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
try {
  const page = await pageFor(browser), { host, runtime } = await mount(page, svg);
  await send(host, { type: 'inscape:artwork-density', scale: 512 / 720 / 1.5 });
  await page.waitForTimeout(100); const size = (await snapshot(runtime)).buffer;
  const frameTimes = Array.from({ length: 240 }, (_, i) => Math.round(i * 1000 / 30));
  for (let i = 0; i < frameTimes.length; i++) {
    const data = await runtime.evaluate(time => { nomadPerf.pose({ time, x: 0, y: 0, speed: 0 }); return nomadPerf.capture(); }, i / 30);
    await writeFile(`${output}/frames30/${String(i).padStart(4, '0')}.png`, Buffer.from(data.split(',')[1], 'base64'));
  }
  const seam = await runtime.evaluate(() => { nomadPerf.pose({ time: 8, x: 0, y: 0, speed: 0 }); return nomadPerf.capture(); });
  await writeFile(`${output}/seam.png`, Buffer.from(seam.split(',')[1], 'base64'));
  await writeFile(`${output}/manifest.json`, JSON.stringify({ width: size[0], height: size[1], frameTimes, loopMs: 8000,
    fps: 30, clothWind: .35, clothSpeed: 0, clothFrequencies: [2 * Math.PI * 3 / 8, 2 * Math.PI * 5 / 8],
    note: 'Cloth frequency changed slightly to close loop. Live flight retained; reactive cloth is lost.' }, null, 2));
  console.log('Captured ' + frameTimes.length + ' frames at ' + size);
} finally { await browser.close(); }
