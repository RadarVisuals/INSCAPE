import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
const origin = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5173';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime/library-recovery';
for (const width of [1440,390]) for (const mode of ['metadata','outage','empty']) {
  test(`Library Retry recovers ${mode} without losing retained cards (${width}px)`, { timeout:30000 }, async () => {
    const browser = await chromium.launch({ executablePath:process.env.INSCAPE_BROWSER_EXECUTABLE || 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless:true });
    try {
      await mkdir(output,{recursive:true});
      const page = await browser.newPage({ viewport:{width,height:900} });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      await page.route('https://assets.example/library-recovery-art.svg', route => route.fulfill({ contentType:'image/svg+xml',
        body:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" fill="#6658a0"/><circle cx="80" cy="80" r="44" fill="#f5cb77"/></svg>' }));
      await page.goto(`${origin}/browser-tests/library-recovery-fixture.html?mode=${mode}`);
      const retry = page.getByRole('button',{name:'Retry assets',exact:true});
      await retry.waitFor();
      await page.waitForFunction(() => ['partial','error'].includes(window.libraryRecovery.store.getState().status));
      const initial = await page.evaluate(() => ({status:window.libraryRecovery.store.getState().status,
        cards:window.libraryRecovery.store.getState().assets.length,error:window.libraryRecovery.store.getState().liveError}));
      assert.equal(initial.cards,mode === 'empty' ? 0 : 1);
      assert.equal(initial.status,mode === 'empty' ? 'error' : 'partial');
      await page.screenshot({path:`${output}/${mode}-${width}-failed.jpg`});
      const search = page.getByRole('searchbox',{name:'Search',exact:true});
      await search.fill('artwork');
      await page.evaluate(() => { window.libraryRecovery.allowRecovery=true; });
      await retry.click();
      if (mode === 'metadata') {
        await page.waitForFunction(() => window.libraryRecovery.repairing);
        assert.equal(await page.evaluate(() => window.libraryRecovery.store.getState().assets.length),1);
        await page.evaluate(() => window.libraryRecovery.releaseRepair());
      }
      await retry.waitFor({state:'detached'});
      await page.waitForFunction(() => window.libraryRecovery.store.getState().status === 'ready');
      assert.equal(await search.inputValue(),'artwork');
      const result = await page.evaluate(() => {
        const state=window.libraryRecovery.store.getState();
        return {status:state.status,error:state.error,liveError:state.liveError,progress:state.progress,
          names:state.assets.map(asset=>asset.name),cache:window.libraryRecovery.cached().map(asset=>asset.name),
          loads:window.libraryRecovery.loads,workspaceUnchanged:JSON.stringify(state.workspace)===window.libraryRecovery.originalWorkspace};
      });
      assert.deepEqual(result.names,['Retained artwork','Recovered artwork']);
      assert.deepEqual(result.cache,result.names);
      assert.equal(result.error,null); assert.equal(result.liveError,null);
      assert.equal(result.progress.failures,0); assert.equal(result.loads,2);
      assert.equal(result.workspaceUnchanged,true); assert.deepEqual(errors,[]);
      assert.equal(await page.locator('.lattice-browser-asset').count(),2);
      await page.screenshot({path:`${output}/${mode}-${width}-recovered.jpg`});
      await writeFile(`${output}/${mode}-${width}.json`,JSON.stringify({initial,result,errors},null,2));
    } finally { await browser.close(); }
  });
}
