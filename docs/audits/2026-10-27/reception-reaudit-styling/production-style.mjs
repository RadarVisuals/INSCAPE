import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { preview } from 'vite';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../../../../scripts/browserEnvironment.mjs';
const out=path.resolve(import.meta.dirname,'production-style');await fs.mkdir(out,{recursive:true});
const seed=JSON.parse(await fs.readFile(path.join(import.meta.dirname,'details/filled-seed.json')));
const manifest=JSON.parse(await fs.readFile('dist/.vite/manifest.json')),appFile=manifest['index.html'].file;
const server=await preview({preview:{host:'127.0.0.1',port:0,open:false}});
const origin='http://127.0.0.1:'+server.httpServer.address().port,browser=await chromium.launch({executablePath:browserExecutable,headless:true}),results=[];
const button=(p,name)=>p.getByRole('button',{name,exact:true});
async function shot(p,name,requests,errors) {
 await p.evaluate(async()=>{await document.fonts.ready;for(let i=0;i<6;i++)await new Promise(requestAnimationFrame);});
 const value=await p.evaluate(()=>{
 const css=n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n);return {text:n.getAttribute('aria-label')||n.textContent?.slice(0,100),class:String(n.className),fontSize:s.fontSize,lineHeight:s.lineHeight,border:s.border,padding:s.padding,display:s.display,position:s.position,clipPath:s.clipPath,color:s.color,background:s.backgroundColor,width:r.width,height:r.height,x:r.x,y:r.y,scrollWidth:n.scrollWidth,clientWidth:n.clientWidth};};
 return {elements:[...document.querySelectorAll('.reception-profile-copy p,.reception-profile-copy li,.reception-profile-links a,.reception-profile-details,.text-document-title,.ds-sr-only,.ds-studio-field-row,.identity-module__cell-actions button,.identity-module__inline,.identity-module__fields,.text-toolbar button,.text-tool-tabs button,.reception-tool-panel,.workbench-backup')].filter(n=>n.checkVisibility({checkVisibilityCSS:true})).map(css),
 stylesheets:[...document.querySelectorAll('link[rel=stylesheet]')].map(n=>new URL(n.href).pathname),bodyOverflow:document.documentElement.scrollWidth>innerWidth,focus:document.activeElement?.getAttribute('aria-label')};
 });
 results.push({name,...value,requests:[...requests],errors:[...errors]});await p.screenshot({path:path.join(out,name+'.png')});
 await fs.writeFile(path.join(out,'results.json'),JSON.stringify(results,null,2));
}
try{
for(const [width,owner] of [[1440,false],[1440,true],[390,true],[320,true]]){
 const ctx=await browser.newContext({viewport:{width,height:900},hasTouch:width<500,reducedMotion:'reduce'});
 await ctx.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
 await ctx.route('https://raw.githubusercontent.com/RadarVisuals/INSCAPE/**',async r=>{const file=new URL(r.request().url()).pathname.split('/public/')[1];if(file)await r.fulfill({response:await r.fetch({url:origin+'/'+file})});else await r.abort();});
 if(owner)await ctx.addInitScript(seed=>localStorage.setItem(seed.key,seed.raw),seed);
 const p=await ctx.newPage();p.setDefaultTimeout(15000);const requests=[],errors=[];
 p.on('request',r=>{if(/\.(css|js)(\?|$)/.test(r.url()))requests.push(new URL(r.url()).pathname);});p.on('pageerror',e=>errors.push(e.message));
 try{
 await p.goto(origin+'/?view='+seed.address+'&reception=1');
 if(!owner){await p.locator('.startveil').waitFor({state:'detached'});await shot(p,'visitor-unavailable-'+width,requests,errors);assert.ok(!requests.some(x=>/reception-editing/.test(x)));continue;}
 await p.evaluate(async({file,seed,owner})=>{
 const m=await import('/'+file);
 const wallet=Object.values(m).find(v=>v&&typeof v.getState==='function'&&'hostProfileAddress' in v.getState());
 if(!wallet)throw Error('known exported wallet store missing');
 wallet.getState().disposeWallet();
 if(owner){let enforcing=false;const patch={authorityLifecycleStatus:'complete',hostProfileAddress:seed.address,isWalletConnected:true,isHostProfileOwner:true};
 wallet.subscribe(state=>{if(enforcing||Object.entries(patch).every(([k,v])=>state[k]===v))return;enforcing=true;wallet.setState(patch);enforcing=false;});wallet.setState(patch);}
 },{file:appFile,seed,owner});
 await p.getByText('NOMAD',{exact:true}).waitFor();await p.locator('.startveil').waitFor({state:'detached'});
 assert.ok(!requests.some(x=>/reception-editing/.test(x)),'reader must not request editing chunk');
 await shot(p,(owner?'owner':'visitor')+'-cold-'+width,requests,errors);
 if(!owner){assert.equal(await button(p,'Edit Reception').count(),0);continue;}
 await button(p,'Edit Reception').click();await button(p,'Done').waitFor();
 await shot(p,'editor-'+width,requests,errors);
 await button(p,'Page settings').click();await button(p,'Edit profile details').click();
 await p.getByRole('textbox',{name:'Field 1 name',exact:true}).scrollIntoViewIfNeeded();
 await p.locator('.identity-module__cell-actions button').last().scrollIntoViewIfNeeded();
 await shot(p,'profile-'+width,requests,errors);
 await button(p,'Cancel profile edit').click();await button(p,'Close Page settings').click();
 await button(p,'Cell appearance').click();await p.getByRole('spinbutton',{name:'Color Lightness',exact:true}).scrollIntoViewIfNeeded();
 await shot(p,'color-'+width,requests,errors);await button(p,'Close Cell appearance').click();
 await button(p,'Text tools').click();await button(p,'Bold').scrollIntoViewIfNeeded();
 await shot(p,'text-'+width,requests,errors);await button(p,'Close Text tools').click();
 await button(p,'Preview').click();await shot(p,'preview-'+width,requests,errors);
 await button(p,'Back to editing').click();await button(p,'Done').click();await button(p,'Edit Reception').waitFor();await shot(p,'reader-after-edit-'+width,requests,errors);
 assert.deepEqual(errors,[]);
 console.log('PASS '+(owner?'owner':'visitor')+' '+width);
 }catch(e){results.push({name:'FAIL-'+width+'-'+owner,error:e.stack});await shot(p,'failure-'+width+'-'+owner,requests,errors);console.log('FAIL '+e.message);}
 finally{await ctx.close();}
}
}finally{await fs.writeFile(path.join(out,'results.json'),JSON.stringify(results,null,2));await browser.close();await new Promise(r=>server.httpServer.close(r));}
if(results.some(r=>r.name.startsWith('FAIL')))process.exitCode=1;

