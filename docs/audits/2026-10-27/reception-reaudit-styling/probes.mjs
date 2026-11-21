import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer, preview } from 'vite';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../../../../scripts/browserEnvironment.mjs';
const root = process.cwd(), out = path.resolve(import.meta.dirname, process.argv[2] || 'probes');
await fs.mkdir(out, { recursive: true });
const server = await createServer({ root, logLevel:'error', server:{host:'127.0.0.1',port:0,open:false} });
await server.listen();
const origin = 'http://127.0.0.1:' + server.httpServer.address().port;
const browser = await chromium.launch({executablePath:browserExecutable,headless:true});
const rows=[];
const button=(p,name)=>p.getByRole('button',{name,exact:true});
async function context(options={}) {
 const ctx=await browser.newContext({viewport:{width:1440,height:900},...options});
 await ctx.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
 return ctx;
}
async function shot(p,name){await p.screenshot({path:path.join(out,name+'.png')});}
async function measure(p,name,selector='main') {
 const result=await p.locator(selector).first().evaluate(el=>{
  const rect=n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};};
  const visible=n=>{const s=getComputedStyle(n),r=n.getBoundingClientRect();return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none';};
  const css=n=>{const s=getComputedStyle(n);return Object.fromEntries(['fontFamily','fontSize','lineHeight','color','backgroundColor','border','borderRadius','padding','gap','minHeight','width','display','overflowX','overflowY','zIndex','transitionDuration','animationName'].map(k=>[k,s[k]]));};
  return { viewport:{w:innerWidth,h:innerHeight,coarse:matchMedia('(pointer:coarse)').matches}, shell:rect(el), scroll:{w:el.scrollWidth,cw:el.clientWidth,h:el.scrollHeight,ch:el.clientHeight},styles:css(el),
   stylesheets:[...document.querySelectorAll('style[data-vite-dev-id],link[rel=stylesheet]')].map(n=>n.dataset.viteDevId||n.href),
   controls:[...el.querySelectorAll('button,input,select,textarea,summary,[role=tab],[role=slider]')].filter(visible).map(n=>({tag:n.tagName,type:n.type,name:n.getAttribute('aria-label')||n.innerText||n.closest('label')?.innerText||n.title,class:n.className,disabled:n.disabled,rect:rect(n),css:css(n)})),
   sections:[...el.querySelectorAll('.reception-region,.reception-tool-panel,.text-tools-content,.workbench-tool-panel-content,.identity-module__fields,.identity-module__dividers,.reception-library,.text-document-title,.ds-studio-colour-heading,.ds-studio-colour-wheel,.ds-studio-fields,.workbench-backup')].filter(visible).map(n=>({class:n.className,rect:rect(n),css:css(n),scroll:{w:n.scrollWidth,cw:n.clientWidth,h:n.scrollHeight,ch:n.clientHeight}}))
  };
 }); rows.push({name,...result}); await fs.writeFile(path.join(out,'metrics.json'),JSON.stringify(rows,null,2)); return result;
}
async function run(name,fn) {try {await fn(); console.log(name+' complete');}catch(e){rows.push({name,error:e.stack});await fs.writeFile(path.join(out,'metrics.json'),JSON.stringify(rows,null,2));console.log(name+' FAILED '+e.message);}}
try {
 for(const config of [{width:1440,height:900},{width:800,height:600},{width:640,height:480},{width:390,height:844,hasTouch:true},{width:320,height:568,hasTouch:true},{width:1280,height:720,hasTouch:true}]) {
 await run('nested-'+config.width,async()=>{
 const ctx=await context({viewport:{width:config.width,height:config.height},hasTouch:!!config.hasTouch}), p=await ctx.newPage();p.setDefaultTimeout(8000);
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(origin+'/browser-tests/reception-editor-fixture.html?sample=1&session=reaudit-'+config.width);
 await button(p,'Done').waitFor();await p.getByRole('textbox',{name:'Article title',exact:true}).waitFor();
 await measure(p,'editor-'+config.width);
 await button(p,'Text tools').click(); await p.getByRole('tab',{name:'Format text'}).waitFor();
 await measure(p,'text-format-'+config.width);await shot(p,'text-format-'+config.width);
 await p.getByRole('tab',{name:'Article settings'}).click();await p.getByText('Change default style',{exact:true}).click();
 await measure(p,'text-article-'+config.width);await shot(p,'text-article-'+config.width);
 await button(p,'Close Text tools').click();
 await button(p,'Cell appearance').click();await p.getByLabel('Color colour',{exact:true}).waitFor();
 await measure(p,'color-'+config.width);await shot(p,'color-'+config.width);
 await button(p,'Close Cell appearance').click();
 await button(p,'Page settings').click();await button(p,'Edit profile details').click();
 await p.getByRole('textbox',{name:'Custom title',exact:true}).waitFor();
 await measure(p,'profile-cold-'+config.width);await shot(p,'profile-cold-'+config.width);
 // Exact imported production module: tests the stylesheet retention after Workbench has loaded.
 await p.evaluate(()=>import('/src/public/identity/IdentityModule.jsx'));
 await measure(p,'profile-after-identity-'+config.width);await shot(p,'profile-after-identity-'+config.width);
 await button(p,'Cancel profile edit').click();await button(p,'Close Page settings').click();
 await p.getByRole('region',{name:'Region 4 · image',exact:true}).click();
 await button(p,'Artwork information').click();await measure(p,'metadata-'+config.width);await shot(p,'metadata-'+config.width);
 await button(p,'Close Artwork information').click();await button(p,'Replace image').click();
 await p.getByRole('region',{name:'Choose Reception image'}).waitFor();
 await measure(p,'library-'+config.width);await shot(p,'library-'+config.width);
 rows.push({name:'page-errors-'+config.width,errors});await ctx.close();
 });
 }
 await run('state-and-warm',async()=>{
 const ctx=await context(),p=await ctx.newPage();p.setDefaultTimeout(10000);
 await p.goto(origin+'/browser-tests/reception-editor-fixture.html?sample=1&session=reaudit-state');await button(p,'Done').waitFor();
 await button(p,'Page settings').click();await button(p,'Mist').click();await measure(p,'mist-settings');await shot(p,'mist-settings');
 await p.getByText('Private backup & recovery',{exact:true}).click();await measure(p,'backup-settings');await shot(p,'backup-settings');
 await button(p,'Close Page settings').click();
 await button(p,'Cell appearance').click();await measure(p,'mist-color');await shot(p,'mist-color');
 await button(p,'Close Cell appearance').click();await button(p,'Text tools').click();await measure(p,'mist-text');await shot(p,'mist-text');
 await button(p,'Close Text tools').click();await button(p,'Preview').click();await measure(p,'preview-before-warm');await shot(p,'preview-before-warm');
 await p.evaluate(()=>import('/src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx'));
 await measure(p,'preview-after-workbench');await shot(p,'preview-after-workbench');
 await button(p,'Back to editing').click();await button(p,'Page settings').click();await button(p,'Carbon').click();await button(p,'Close Page settings').click();
 await p.evaluate(()=>window.receptionFixture.fail(true));await button(p,'Cell options').click();await button(p,'Remove from cell').click();
 await measure(p,'failed-write');await shot(p,'failed-write');await ctx.close();
 });
 await run('seed-production',async()=>{
 const ctx=await context(),p=await ctx.newPage();
 await p.goto(origin+'/browser-tests/reception-boundaries-fixture.html');await p.getByText('LOCAL A',{exact:true}).waitFor();
 await fs.writeFile(path.join(out,'production-seed.json'),JSON.stringify(await p.evaluate(()=>({key:window.receptionBoundaryFixture.key,raw:localStorage.getItem(window.receptionBoundaryFixture.key),address:window.receptionBoundaryFixture.address,document:window.receptionBoundaryFixture.document})),null,2));
 await ctx.close();
 });
} finally {await fs.writeFile(path.join(out,'metrics.json'),JSON.stringify(rows,null,2));await browser.close();await server.close();}

