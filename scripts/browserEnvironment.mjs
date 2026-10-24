import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

// One explicit override for every suite, including older direct launch calls.
const configured = process.env.INSCAPE_BROWSER_EXECUTABLE || process.env.BROWSER_PATH;
const candidates = configured ? [configured] : [
  chromium.executablePath(),
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
];
export const browserExecutable = candidates.find(candidate => existsSync(candidate));
if (!browserExecutable) throw new Error('Chromium not found. Set INSCAPE_BROWSER_EXECUTABLE to an installed Chrome, Edge or Chromium executable.');
process.env.INSCAPE_BROWSER_EXECUTABLE = browserExecutable;
process.env.BROWSER_PATH = browserExecutable;
const launch = chromium.launch.bind(chromium);
chromium.launch = options => launch({ ...options, executablePath: browserExecutable });
