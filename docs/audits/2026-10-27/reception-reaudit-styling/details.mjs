import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../../../../scripts/browserEnvironment.mjs';
const out=path.resolve(import.meta.dirname,'details'),root=process.cwd();await fs.mkdir(out,{recursive:true});
const server=await createServer({root,logLevel:'error',server:{host:'127.0.0.1',port:0,open:false}});await server.listen();
const origin='http://127.0.0.1:'+server.httpServer.address().port;
const browser=await chromium.launch({executablePath:browserExecutable,headless:true});const rows=[];
async function setup(width=1440,height=900,touch=false) {
 const ctx=await browser.newContext({viewport:{width,height},hasTouch:touch});const p=await ctx.newPage();p.setDefaultTimeout(12000);
 await ctx.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
 await ctx.route('https://raw.githubusercontent.com/RadarVisuals/INSCAPE/**',async r=>{const file=new URL(r.request().url()).pathname.split('/public/')[1];if(file)await r.fulfill({response:await r.fetch({url:origin+'/'+file})});else await r.abort();});
 return {ctx,p};
}
const b=(p,n)=>p.getByRole('button',{name:n,exact:true});
async function info(p,name,selector='main') {
 await p.evaluate(async()=>{await document.fonts.ready;for(let i=0;i<4;i++)await new Promise(requestAnimationFrame);});
 const data=await p.locator(selector).first().evaluate(el=>{
 const css=n=>{const s=getComputedStyle(n),r=n.getBoundingClientRect();return {tag:n.tagName,name:n.getAttribute('aria-label')||n.innerText?.slice(0,80),class:String(n.className),x:r.x,y:r.y,w:r.width,h:r.height,font:s.font,fontSize:s.fontSize,lineHeight:s.lineHeight,padding:s.padding,color:s.color,bg:s.backgroundColor,border:s.border,display:s.display,position:s.position,clipPath:s.clipPath,grid:s.gridTemplateColumns,transition:s.transitionDuration,animation:s.animationName,sw:n.scrollWidth,cw:n.clientWidth,sh:n.scrollHeight,ch:n.clientHeight};};
 const candidates=[...el.querySelectorAll('button,input,select,summary,.ds-sr-only,.ds-colour-swatch,.ds-studio-field-row,.reception-profile-copy p,.reception-profile-details,.reception-profile-links a,.text-document-title,.identity-module__fields')].filter(n=>n.checkVisibility({checkVisibilityCSS:true}));
 return {elements:candidates.map(css),stylesheets:[...document.querySelectorAll('style[data-vite-dev-id],link[rel=stylesheet]')].map(n=>n.dataset.viteDevId||n.href),focus:document.activeElement?.getAttribute('aria-label'),title:document.title};
 });rows.push({name,...data});await p.screenshot({path:path.join(out,name+'.png')});await fs.writeFile(path.join(out,'results.json'),JSON.stringify(rows,null,2));
}
async function run(name,fn){try{await fn();console.log(name+' complete');}catch(e){console.log(name+' FAILED '+e.message);rows.push({name,error:e.stack});}}
try{
await run('filled-seed-and-parity',async()=>{
 const {ctx,p}=await setup();
 await p.goto(origin+'/browser-tests/reception-editor-fixture.html?sample&session=reaudit-filled');await b(p,'Done').waitFor();
 await p.evaluate(()=>{const root=window.receptionFixture.root,d=root.getDraft();d.identityPresentation.bio={mode:'inscape',customText:'A long, readable introduction to this artist, with a second sentence that should occupy the same typographic scale in the editor and saved Reception.'};d.reception.regions[1].content='introduction';if(!root.commitCompletedOperation(d,{expectedGeneration:root.getGeneration()}))throw Error('seed');});
 await info(p,'editor-authored-copy');
 await b(p,'Preview').click();await info(p,'preview-authored-copy');
 await b(p,'Back to editing').click();await b(p,'Done').click();await info(p,'public-authored-copy');
 const data=await p.evaluate(()=>({document:window.receptionFixture.publish(),raw:JSON.stringify(window.receptionFixture.root.getDraft()),address:window.receptionFixture.root.getProfileAddress(),key:'inscape.system-workflow-draft.v1:'+window.receptionFixture.root.getProfileAddress()}));
 await fs.writeFile(path.join(out,'filled-seed.json'),JSON.stringify(data,null,2));
 await ctx.close();
});
for(const theme of ['carbon','mist'])await run('nested-'+theme,async()=>{
 const {ctx,p}=await setup(390,844,true);
 await p.goto(origin+'/browser-tests/reception-editor-fixture.html?sample&session=reaudit-details-'+theme);await b(p,'Done').waitFor();
 if(theme==='mist'){await b(p,'Page settings').click();await b(p,'Mist').click();await b(p,'Close Page settings').click();}
 await b(p,'Cell appearance').click();
 await p.getByRole('textbox',{name:'Color colour',exact:true}).scrollIntoViewIfNeeded();
 await info(p,theme+'-color');
 await p.getByRole('spinbutton',{name:'Color Lightness',exact:true}).scrollIntoViewIfNeeded();await info(p,theme+'-color-bottom');
 await p.getByRole('textbox',{name:'Color colour',exact:true}).fill('INVALID');await p.getByRole('textbox',{name:'Color colour',exact:true}).press('Tab');await info(p,theme+'-color-invalid');
 await b(p,'Close Cell appearance').click();await b(p,'Page settings').click();await b(p,'Edit profile details').click();
 await p.getByRole('textbox',{name:'Field 1 name',exact:true}).scrollIntoViewIfNeeded();await info(p,theme+'-profile-cold');
 await p.evaluate(()=>import('/src/public/identity/IdentityModule.jsx'));
 await p.getByRole('textbox',{name:'Field 1 name',exact:true}).scrollIntoViewIfNeeded();await info(p,theme+'-profile-warm');
 await b(p,'Cancel profile edit').click();await p.getByText('Private backup & recovery',{exact:true}).click();await p.getByLabel('Open Workbench backup',{exact:true}).scrollIntoViewIfNeeded();
 await info(p,theme+'-backup');
 await b(p,'Close Page settings').click();await b(p,'Text tools').click();await b(p,'Bold').scrollIntoViewIfNeeded();await info(p,theme+'-text-targets');
 await ctx.close();
});
await run('workbench-controls',async()=>{
 const {ctx,p}=await setup(390,844,true);
 await p.goto(origin+'/browser-tests/workbench-storage-fixture.html');await p.getByRole('combobox',{name:'Active Workbench'}).waitFor();
 await p.evaluate(async()=>{
 const {layersDraft}=await import('/browser-tests/fixtures/artwork-layers.js');const {systemWorkflowDraftKey}=await import('/src/systemWorkflow/systemWorkflowDraftStore.js');const d=layersDraft();d.appearance.menuSurfaceId='carbon';window.leaveEditor();localStorage.setItem(systemWorkflowDraftKey(window.fixtureProfile),JSON.stringify(d));});
 await p.reload();await b(p,'Select Landscape').waitFor();await b(p,'Select Landscape').click();
 await p.getByRole('tab',{name:'Color',exact:true}).click();await p.getByRole('textbox',{name:'Color colour',exact:true}).scrollIntoViewIfNeeded();await info(p,'workbench-color');
 await b(p,'Select Mist',{exact:true}).click();
 await info(p,'workbench-text-selection');
 await ctx.close();
});
await run('states-focus-motion',async()=>{
 const {ctx,p}=await setup(800,480);
 await p.goto(origin+'/browser-tests/reception-editor-fixture.html?sample&session=reaudit-motion');await b(p,'Done').waitFor();
 await p.evaluate(()=>{window.__auditFrames=[];window.__captureUntil=performance.now()+1200;const f=t=>{const e=document.querySelector('.reception-tool-panel');window.__auditFrames.push({t,exists:!!e,focus:document.activeElement?.getAttribute('aria-label'),...(e?{x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y,h:e.getBoundingClientRect().height,opacity:getComputedStyle(e).opacity,transform:getComputedStyle(e).transform}:{})});if(t<window.__captureUntil)requestAnimationFrame(f);};requestAnimationFrame(f);});
 await b(p,'Page settings').focus();await p.keyboard.press('Enter');await b(p,'Close Page settings').focus();await p.keyboard.press('Enter');
 await p.waitForFunction(()=>performance.now()>window.__captureUntil);
 rows.push({name:'close-frames',frames:await p.evaluate(()=>window.__auditFrames)});
 await info(p,'focus-return');
 await b(p,'Page settings').click();await b(p,'Close Page settings').focus();
 await p.evaluate(()=>{document.querySelector('[aria-label="Close Page settings"]').click();document.querySelector('[aria-label="Preview"]').focus();});
 await info(p,'new-focus-choice');
 await p.emulateMedia({reducedMotion:'reduce',forcedColors:'active'});await b(p,'Page settings').click();await info(p,'forced-colors-reduced');
 await ctx.close();
});
}finally{await fs.writeFile(path.join(out,'results.json'),JSON.stringify(rows,null,2));await browser.close();await server.close();}

