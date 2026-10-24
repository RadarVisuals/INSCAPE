import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { preview } from 'vite';
import { chromium } from 'playwright-core';
import { analyzeProductionBuild } from '../scripts/productionBuild.js';
const root=resolve(import.meta.dirname,'..');
const output=resolve(process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime/production-startup');

test('built fresh entry stays below 1 MB JS without wallet/owner acquisition; built connector remains importable',{timeout:60000},async()=>{
  const report=await analyzeProductionBuild(resolve(root,'dist'));
  const server=await preview({root,preview:{host:'127.0.0.1',port:0,open:false}});
  let browser;
  try {
    browser=await chromium.launch({headless:true});
    const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
    const forbidden=new Set([...report.standaloneWalletJavaScript,...report.ownerJavaScript].map(x=>'/'+x.file));
    const rows=[];
    for(const width of [1440,390]) {
      const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
      const requests=[];
      page.on('request',r=>{if(new URL(r.url()).pathname.endsWith('.js')) requests.push(new URL(r.url()).pathname);});
      await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
      await page.goto(origin,{waitUntil:'networkidle'});
      await page.getByRole('button',{name:'Connect',exact:true}).waitFor();
      assert.deepEqual(requests.filter(p=>forbidden.has(p)),[]);
      const bytes=await page.evaluate(()=>performance.getEntriesByType('resource')
        .filter(x=>new URL(x.name).pathname.endsWith('.js')).reduce((sum,x)=>sum+x.decodedBodySize,0));
      assert.ok(bytes>0 && bytes<=1_000_000,`Fresh-entry JavaScript ${bytes} exceeds 1 MB`);
      // Preserve the fresh-visit requests before the deliberate connector import.
      rows.push({width,bytes,requests:[...requests]});
      await mkdir(output,{recursive:true});
      await page.screenshot({path:resolve(output,`entry-${width}.png`)});
      // Import only: never initialize a real connector or request wallet access.
      const wallet=report.standaloneWalletJavaScript.find(x=>x.file.includes('/standaloneWalletSession-'));
      assert.ok(wallet);
      assert.equal(await page.evaluate(async file=>{
        const exports=await import('/'+file);
        // Rollup may put the original module namespace in a shared chunk export.
        return [exports,...Object.values(exports)].some(value=>typeof value?.acquireStandaloneWalletSession==='function');
      },wallet.file),true);
      await page.close();
    }
    await writeFile(resolve(output,'results.json'),JSON.stringify(rows,null,2));
  } finally {await browser?.close();await new Promise(r=>server.httpServer.close(r));}
});
