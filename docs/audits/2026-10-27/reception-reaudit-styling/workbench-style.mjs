import fs from 'node:fs/promises';
import path from 'node:path';
import {createServer} from 'vite';
import {chromium} from 'playwright-core';
import {browserExecutable} from '../../../../scripts/browserEnvironment.mjs';
import {separateLayers} from '../../../../browser-tests/fixtures/shared-tools.mjs';
const out=path.join(import.meta.dirname,'workbench-style');await fs.mkdir(out,{recursive:true});
const server=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0,open:false}});await server.listen();
const origin='http://127.0.0.1:'+server.httpServer.address().port,browser=await chromium.launch({executablePath:browserExecutable,headless:true}),ctx=await browser.newContext({viewport:{width:1280,height:900},hasTouch:true}),p=await ctx.newPage(),results=[];
await ctx.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
p.setDefaultTimeout(12000);
async function shot(name){await p.evaluate(async()=>{await document.fonts.ready;for(let i=0;i<4;i++)await new Promise(requestAnimationFrame);});const values=await p.evaluate(()=>[...document.querySelectorAll('.ds-sr-only,.ds-studio-field-row,.text-toolbar button')].filter(n=>n.checkVisibility({checkVisibilityCSS:true})).map(n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n);return {text:n.getAttribute('aria-label')||n.textContent,class:n.className,display:s.display,clipPath:s.clipPath,position:s.position,width:r.width,height:r.height,fontSize:s.fontSize};}));results.push({name,values});await p.screenshot({path:path.join(out,name+'.png')});}
try{
await p.goto(origin+'/browser-tests/workbench-storage-fixture.html');await p.getByRole('combobox',{name:'Active Workbench'}).waitFor();
await p.evaluate(async()=>{const {layersDraft}=await import('/browser-tests/fixtures/artwork-layers.js');const {systemWorkflowDraftKey}=await import('/src/systemWorkflow/systemWorkflowDraftStore.js');window.leaveEditor();localStorage.setItem(systemWorkflowDraftKey(window.fixtureProfile),JSON.stringify(layersDraft()));});
await p.reload();await separateLayers(p);
await p.getByRole('button',{name:'Select Landscape',exact:true}).click();await p.getByRole('tab',{name:'Color',exact:true}).click();await p.getByRole('spinbutton',{name:'Color Lightness',exact:true}).scrollIntoViewIfNeeded();await shot('color');
await p.getByRole('button',{name:'Select Mist',exact:true}).click();
const textTab=p.getByRole('tab',{name:'Text',exact:true});if(await textTab.count())await textTab.click();
await p.getByRole('button',{name:'Bold',exact:true}).scrollIntoViewIfNeeded();await shot('text');
console.log('Workbench colour and Text comparison complete');
}catch(e){results.push({error:e.stack});console.log(e.stack);process.exitCode=1;}
finally{await fs.writeFile(path.join(out,'results.json'),JSON.stringify(results,null,2));await browser.close();await server.close();}

