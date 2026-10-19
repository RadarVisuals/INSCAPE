import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const origin=process.env.INSCAPE_TEST_ORIGIN || 'http://127.0.0.1:5173';
const connected=JSON.stringify({state:{current:'test',connections:{__type:'Map',value:[['test',{}]]}}});
const disconnected=JSON.stringify({state:{current:null,connections:{__type:'Map',value:[]}}});

for (const [name,record,automatic] of [['fresh',null,false],['disconnected',disconnected,false],['returning',connected,true],['malformed','{broken',true]]) {
  test(`${name} entry loads the wallet at the correct boundary and Connect uses one acquisition`,{timeout:45000},async()=>{
    const browser=await chromium.launch({headless:true});
    try {
      const page=await browser.newPage({reducedMotion:'reduce'});
      const modules=[];
      page.on('request',request=>{if(request.url().includes('/src/wallet/standaloneWalletSession.js'))modules.push(request.url());});
      await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
      await page.route('**/src/wallet/standaloneWalletSession.js',r=>r.fulfill({contentType:'application/javascript',body:`
        export function acquireStandaloneWalletSession(options) {
          window.__walletAcquisitions=(window.__walletAcquisitions||0)+1;
          options.disposeWallet();
          return {release(){},session:{showSignIn(){window.__walletShows=(window.__walletShows||0)+1;options.onSignInClose();}}};
        }` }));
      await page.addInitScript(value=>{if(value!==null)localStorage.setItem('inscape-up.store',value);},record);
      await page.goto(origin,{waitUntil:'networkidle'});
      assert.equal(modules.length,automatic?1:0);
      assert.equal(await page.locator('main.system-workflow').count(),0,'persisted metadata grants no authoring access');
      const settled=await page.evaluate(async()=>{
        const {useWalletStore}=await import('/src/store/useWalletStore.js');
        return useWalletStore.getState().authorityLifecycleStatus;
      });
      assert.equal(settled,'complete');
      await page.getByRole('button',{name:'CONNECT',exact:true}).click();
      await page.waitForFunction(()=>window.__walletShows===1);
      await page.getByRole('button',{name:'CONNECT',exact:true}).click();
      await page.waitForFunction(()=>window.__walletShows===2);
      assert.equal(await page.evaluate(()=>window.__walletAcquisitions),1);
      assert.equal(modules.length,1);
    } finally {await browser.close();}
  });
}

test('a failed wallet setup leaves Connect usable for a successful retry',{timeout:45000},async()=>{
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage({reducedMotion:'reduce'});
    await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
    await page.route('**/src/wallet/standaloneWalletSession.js',r=>r.fulfill({contentType:'application/javascript',body:`
      export function acquireStandaloneWalletSession(options) {
        window.__attempts=(window.__attempts||0)+1;
        return {release(){},session:window.__attempts===1 ? Promise.reject(Error('test setup failure')) :
          Promise.resolve({showSignIn(){window.__shown=true;options.onSignInClose();}})};
      }` }));
    await page.goto(origin,{waitUntil:'networkidle'});
    await page.getByRole('button',{name:'CONNECT',exact:true}).click();
    await page.waitForFunction(()=>window.__attempts===1);
    await page.getByRole('button',{name:'CONNECT',exact:true}).click();
    await page.waitForFunction(()=>window.__shown===true);
    assert.equal(await page.evaluate(()=>window.__attempts),2);
  } finally {await browser.close();}
});
