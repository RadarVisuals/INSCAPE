import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { preview } from 'vite';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../../../../scripts/browserEnvironment.mjs';
const root=process.cwd(),out=path.resolve(import.meta.dirname,process.argv[2]||'production');
await fs.mkdir(out,{recursive:true});
const seed=JSON.parse(await fs.readFile(path.join(import.meta.dirname,'probes-first/production-seed.json')));
const manifest=JSON.parse(await fs.readFile('dist/.vite/manifest.json'));
const appFile=manifest['index.html'].file;
const server=await preview({root,preview:{host:'127.0.0.1',port:0,open:false}});
const origin='http://127.0.0.1:'+server.httpServer.address().port;
const browser=await chromium.launch({executablePath:browserExecutable,headless:true});
const results=[];
async function record(p,name,requests,errors){
 await p.evaluate(async()=>{await document.fonts.ready;for(let i=0;i<4;i++)await new Promise(requestAnimationFrame);});
 const metrics=await p.evaluate(()=>{
 const css=n=>{const s=getComputedStyle(n),r=n.getBoundingClientRect();return {tag:n.tagName,text:n.getAttribute('aria-label')||n.textContent?.slice(0,80),class:String(n.className),font:s.font,fontSize:s.fontSize,color:s.color,background:s.backgroundColor,display:s.display,padding:s.padding,width:r.width,height:r.height,x:r.x,y:r.y,sw:n.scrollWidth,cw:n.clientWidth,sh:n.scrollHeight,ch:n.clientHeight,grid:s.gridTemplateColumns,position:s.position,transition:s.transitionDuration};};
 return {url:location.href,stylesheets:[...document.querySelectorAll('link[rel=stylesheet]')].map(n=>new URL(n.href).pathname),
elements:[...document.querySelectorAll('.reception-region-content,.reception-profile-copy p,.reception-profile-details,.text-document-title,.reception-tool-panel,.identity-module__fields,.identity-module__dividers,.identity-module__cell-actions button,.text-toolbar button,.text-tool-tabs button,.workbench-backup,.reception-library')].map(css),
 text:document.querySelector('main')?.innerText?.slice(0,2000),
 };
 });
 results.push({name,...metrics,requests:[...requests],errors:[...errors]});
 await p.screenshot({path:path.join(out,name+'.png')});
 await fs.writeFile(path.join(out,'results.json'),JSON.stringify(results,null,2));
}
try{
 for(const width of [1440,390,320]){
 const ctx=await browser.newContext({viewport:{width,height:900},hasTouch:width<500,reducedMotion:'reduce'});
 await ctx.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
 await ctx.addInitScript(seed=>localStorage.setItem(seed.key,seed.raw),seed);
 const p=await ctx.newPage();p.setDefaultTimeout(12000);const requests=[],errors=[];
 p.on('request',r=>{if(/\.(js|css)(\?|$)/.test(r.url()))requests.push(new URL(r.url()).pathname);});p.on('pageerror',e=>errors.push(e.message));
 try{
 await p.goto(origin+'/?view='+seed.address+'&reception=1');
 const candidates=await p.evaluate(async file=>{
 const m=await import('/'+file);
 return Object.entries(m).filter(([,v])=>v&&typeof v.getState==='function').map(([key,v])=>({key,keys:Object.keys(v.getState())}));
 },appFile);
 await fs.writeFile(path.join(out,'export-stores.json'),JSON.stringify(candidates,null,2));
 const walletExport=candidates.find(c=>c.keys.includes('hostProfileAddress'))?.key;
 assert.ok(walletExport,'built wallet store must be an existing exported dependency');
 await p.evaluate(async({file,key,address})=>{
 const store=(await import('/'+file))[key];store.getState().disposeWallet();
 const patch={authorityLifecycleStatus:'complete',hostProfileAddress:address,isWalletConnected:true,isHostProfileOwner:true};
 let enforcing=false;store.subscribe(state=>{if(enforcing||Object.entries(patch).every(([k,v])=>state[k]===v))return;enforcing=true;store.setState(patch);enforcing=false;});store.setState(patch);
 window.__auditWalletStore=store;window.__auditAuthorityPatch=patch;
 },{file:appFile,key:walletExport,address:seed.address});
 await p.getByText('LOCAL A',{exact:true}).waitFor();
 await p.locator('.startveil').waitFor({state:'detached',timeout:20000});
 await record(p,'owner-cold-'+width,requests,errors);
 await p.getByRole('button',{name:'Edit Reception',exact:true}).click();await p.getByRole('button',{name:'Done',exact:true}).waitFor();
 await record(p,'editor-cold-'+width,requests,errors);
 await p.getByRole('button',{name:'Page settings',exact:true}).click();await p.getByRole('button',{name:'Edit profile details',exact:true}).click();
 await p.getByRole('textbox',{name:'Custom title',exact:true}).waitFor();
 await p.getByRole('button',{name:'Add field',exact:true}).click();
 await p.getByRole('textbox',{name:'Field 1 name',exact:true}).fill('Audit field');
 await record(p,'profile-cold-'+width,requests,errors);
 await p.getByRole('button',{name:'Cancel profile edit',exact:true}).click();
 await p.getByRole('button',{name:'Close Page settings',exact:true}).click();
 await p.getByRole('region',{name:'Region 2 · text',exact:true}).click();
 await p.getByRole('textbox',{name:'Article title',exact:true}).waitFor();
 await p.getByRole('button',{name:'Text tools',exact:true}).click();
 await p.getByRole('button',{name:'Bold',exact:true}).scrollIntoViewIfNeeded();
 await record(p,'text-'+width,requests,errors);
 await p.getByRole('button',{name:'Close Text tools',exact:true}).click();
 await p.getByRole('button',{name:'Preview',exact:true}).click();await record(p,'preview-'+width,requests,errors);
 await p.getByRole('button',{name:'Back to editing',exact:true}).click();await p.getByRole('button',{name:'Done',exact:true}).click();await p.getByText('LOCAL A',{exact:true}).waitFor();
 await record(p,'reader-after-edit-'+width,requests,errors);
 await p.getByRole('button',{name:'Back to my Workbench',exact:true}).click();
 await p.locator('main.system-workflow').waitFor();await p.getByRole('button',{name:'Profile',exact:true}).click();
 await p.getByRole('button',{name:'View my reception',exact:true}).click();await p.getByText('LOCAL A',{exact:true}).waitFor();
 await record(p,'reader-after-workbench-'+width,requests,errors);
 await p.getByRole('button',{name:'Edit Reception',exact:true}).click();await p.getByRole('button',{name:'Page settings',exact:true}).click();await p.getByRole('button',{name:'Edit profile details',exact:true}).click();
 await p.getByRole('textbox',{name:'Custom title',exact:true}).waitFor();await p.getByRole('button',{name:'Add field',exact:true}).click();
 await record(p,'profile-after-workbench-'+width,requests,errors);
 console.log('production '+width+' complete');
 }catch(e){results.push({name:'failure-'+width,error:e.stack});await record(p,'failed-'+width,requests,errors);console.log('production '+width+' FAILED '+e.message);}
 finally{await ctx.close();}
 }
}finally{await fs.writeFile(path.join(out,'results.json'),JSON.stringify(results,null,2));await browser.close();await new Promise(r=>server.httpServer.close(r));}

