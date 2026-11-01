import { basename } from 'node:path';
import { chromium } from 'playwright-core';
import { browserExecutable } from './browserEnvironment.mjs';
import { createRequire } from 'node:module';
const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
try {
  console.log(JSON.stringify({ version: browser.version(), playwright: createRequire(import.meta.url)('playwright-core/package.json').version,
    executable: basename(browserExecutable), variant: /headless/i.test(browserExecutable) ? 'headless-shell' : 'full-chromium' }));
} finally { await browser.close(); }
