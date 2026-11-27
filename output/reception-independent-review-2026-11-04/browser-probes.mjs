import assert from 'node:assert/strict';
import {writeFile, mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createBrowserTestServer} from '../../scripts/runBrowserTests.mjs';
import {chromium} from 'playwright-core';
import {editorMenu,editorCommand,setEditorSidebarOpen} from '../../browser-tests/fixtures/editor-menu.mjs';
import {openSharedTool} from '../../browser-tests/fixtures/shared-tools.mjs';

const out=resolve('output/reception-independent-review-2026-11-04/independent-browser');await mkdir(out,{recursive:true});
const server=await createBrowserTestServer(process.cwd(),15804);await server.listen();
const origin='http://127.0.0.1:15804';
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});page.setDefaultTimeout(15000);
const result={errors:[],consoleErrors:[],captures:[],imageResponses:[],browser:await browser.version()};
page.on('pageerror',e=>result.errors.push(e.message));page.on('console',e=>{if(e.type()==='error')result.consoleErrors.push(e.text());});
page.on('response',r=>{if(/full.webp/.test(r.url()))result.imageResponses.push({url:r.url(),status:r.status()});});
await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
await page.route('https://raw.githubusercontent.com/RadarVisuals/INSCAPE/**',r=>r.fulfill({path:'public/'+new URL(r.request().url()).pathname.split('/public/')[1]}));
const state=()=>page.evaluate(()=>window.nativeReceptionFixture.root.getDraft().reception);
const cell=id=>page.locator(`[data-editor-cell-surface="${id}"]`);
const capture=async name=>{await page.evaluate(()=>new Promise(resolve=>{let n=0;function frame(){if(++n===8)resolve();else requestAnimationFrame(frame);}requestAnimationFrame(frame);}));await page.screenshot({path:resolve(out,name+'.png')});result.captures.push(name);};
const closeTools=async()=>{for(let i=0;i<12;i++){const x=page.locator('.workbench-tool-dock').getByRole('button',{name:/^Close /u});if(!await x.isVisible())break;await x.click();}};
try {
  await page.goto(`${origin}/browser-tests/reception-native-editor-fixture.html?session=independent-${crypto.randomUUID()}`);
  await page.getByRole('toolbar',{name:'Creation tools',exact:true}).waitFor();await page.evaluate(()=>document.fonts.ready);
  await setEditorSidebarOpen(page,false);
  await editorMenu(page,'Bento').click();
  const panel=page.getByRole('dialog',{name:'Bento settings',exact:true});
  await panel.getByLabel('Number of cells',{exact:true}).fill('1');await panel.getByRole('button',{name:'Create Bento',exact:true}).click();
  await panel.getByRole('button',{name:'Close Bento',exact:true}).click();await closeTools();
  const first=(await state()).cells[0].id;
  await cell(first).click({button:'right',position:{x:30,y:100}});await page.getByRole('menuitem',{name:'Split vertically',exact:true}).click();
  await cell(first).click({position:{x:30,y:100}});await page.getByRole('button',{name:'+ Image',exact:true}).click();
  const picker=page.locator('.reception-library-window');await picker.getByRole('button',{name:'ABYSSAL STUDY / INSCAPE STUDIES',exact:true}).click();
  await picker.getByRole('button',{name:'Use selected image',exact:true}).click();await picker.waitFor({state:'detached'});
  await page.getByRole('button',{name:'Back to cells',exact:true}).click();await closeTools();
  const second=(await state()).cells[1].id;await cell(second).click({position:{x:30,y:100}});await page.getByRole('button',{name:'+ Text',exact:true}).click();
  const text=page.getByRole('textbox',{name:'Article text',exact:true});
  const copy='A living archive\n\nI work with light, creatures and fragments of digital space. Every image keeps its source and enters a new relationship here.\n\nThis reception is an invitation to explore the work, not a catalogue. Colour, texture and words share one composition.';
  await text.fill(copy);await page.locator('main[data-reception-editor]').focus();await page.waitForFunction(()=>JSON.stringify(window.nativeReceptionFixture.root.getDraft().reception.texts).includes('A living archive'));
  await page.getByRole('button',{name:'Back to cells',exact:true}).click();await closeTools();
  await page.locator('svg.image-module__artwork[data-media-state="ready"]').first().waitFor();
  result.loadedImages=await page.locator('svg.image-module__artwork').evaluateAll(items=>items.map(i=>({state:i.dataset.mediaState,href:i.querySelector('image')?.getAttribute('href'),rect:i.getBoundingClientRect().toJSON()})));
  for(const width of [1440,900])for(const theme of ['DARK','LIGHT']) {
    await page.setViewportSize({width,height:900});await editorCommand(page,'Edit','Settings');await page.getByRole('button',{name:theme,exact:true}).click();await page.getByRole('button',{name:'Close Settings',exact:true}).click();await closeTools();
    await cell(second).focus();await capture(`editor-${width}-${theme.toLowerCase()}`);
    await editorMenu(page,'Bento').click();await capture(`bento-${width}-${theme.toLowerCase()}`);
    result.captures.push({name:`bento-${width}-${theme}`,footer:await panel.getByRole('button',{name:'Apply settings',exact:true}).boundingBox(),dialog:await panel.boundingBox()});
    await panel.getByRole('button',{name:'Close Bento',exact:true}).click();
    await editorCommand(page,'Canvas','Preview');const preview=page.getByRole('region',{name:'Reception responsive preview',exact:true});await preview.getByRole('button',{name:'Fit',exact:true}).click();
    await preview.getByText('A living archive',{exact:false}).first().waitFor();await capture(`preview-${width}-${theme.toLowerCase()}`);
    result.captures.push({name:`preview-${width}-${theme}`,mobile:await preview.locator('.reception-document-canvas').getAttribute('data-mobile'),canvas:await preview.locator('.reception-document-canvas').boundingBox()});
    await preview.getByRole('button',{name:'Back to editing',exact:true}).click();
  }
  await page.setViewportSize({width:1440,height:1000});await cell(second).click({position:{x:30,y:100}});const shape=await openSharedTool(page,'Shape');
  await shape.getByLabel('Include in publication',{exact:true}).uncheck();await closeTools();
  result.privateBefore=await page.evaluate(async()=>{const {projectReception}=await import('/src/profileDocument/domain/receptionPresentation.js');return projectReception(window.nativeReceptionFixture.root.getDraft().reception).texts.length;});
  await page.getByRole('button',{name:'Layers',exact:true}).click();const secondName=(await state()).shapes.find(s=>s.id===second).name;
  await page.getByRole('button',{name:`Delete ${secondName}`,exact:true}).click();result.deletionPrompt=await page.locator('.workbench-layer-confirm').allTextContents();await capture('private-cell-delete-confirmation');
  await page.getByRole('button',{name:'Confirm layer deletion',exact:true}).click();await closeTools();
  result.privateAfter=await page.evaluate(async()=>{const {projectReception}=await import('/src/profileDocument/domain/receptionPresentation.js');return projectReception(window.nativeReceptionFixture.root.getDraft().reception).texts.length;});
  assert.equal(result.privateBefore,0);assert.equal(result.privateAfter,1);
  await editorCommand(page,'Canvas','Preview');await capture('private-text-exposed-in-preview');
  await page.getByRole('button',{name:'Back to editing',exact:true}).click();await editorCommand(page,'Edit','Undo');
  result.finalState=await state();
  // A separate isolated render mounts the actual public Reception component.
  const publicDraft=await state();publicDraft.shapes.forEach(s=>s.visibility='PUBLIC');
  const publicPage=await browser.newPage({viewport:{width:900,height:900},reducedMotion:'reduce'});
  await publicPage.route('https://raw.githubusercontent.com/RadarVisuals/INSCAPE/**',r=>r.fulfill({path:'public/'+new URL(r.request().url()).pathname.split('/public/')[1]}));
  publicPage.on('pageerror',e=>result.errors.push('public:'+e.message));await publicPage.goto(origin+'/browser-tests/reception-native-editor-fixture.html?session=independent-public-'+crypto.randomUUID());
  await publicPage.getByRole('toolbar',{name:'Creation tools',exact:true}).waitFor();
  await publicPage.evaluate(async reception=>{
    const React=(await import('/@id/react')).default,{createRoot}=(await import('/@id/react-dom/client')).default;
    const {default:ReceptionOverview}=await import('/src/reception/ReceptionOverview.jsx'),{projectReception}=await import('/src/profileDocument/domain/receptionPresentation.js');
    const host=document.createElement('div');host.style.cssText='position:fixed;inset:0;z-index:9999';document.body.append(host);
    createRoot(host).render(React.createElement(ReceptionOverview,{reception:projectReception(reception),address:'0x3333333333333333333333333333333333333333',model:{profile:{displayName:'Independent Reception review'}}}));
  },publicDraft);
  await publicPage.locator('svg.image-module__artwork[data-media-state="ready"]').waitFor();
  result.public900={mobile:await publicPage.locator('.reception-document-canvas').getAttribute('data-mobile'),canvas:await publicPage.locator('.reception-document-canvas').boundingBox()};
  for(const theme of ['dark','light']){await publicPage.evaluate(async t=>(await import('/src/interfaceTheme.js')).interfaceTheme.setMode(t),theme);await publicPage.screenshot({path:resolve(out,`public-900-${theme}.png`)});}
  await publicPage.close();
  // Maximum supported native counts, evenly spaced for a reproducible load.
  await closeTools();await editorCommand(page,'Edit','Settings');await page.getByRole('button',{name:'DARK',exact:true}).click();await page.getByRole('button',{name:'Close Settings',exact:true}).click();
  result.performanceSetup=await page.evaluate(async()=>{
    const {createReceptionEditorDocument}=await import('/src/reception/receptionEditorDocument.js');
    const {createArticle}=await import('/src/text/domain/article.js');
    const {resolveImageLibrarySide}=await import('/src/imageModule/imageLibrarySide.js');
    const {OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS:assets}=await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
    const sides=await Promise.all(assets.map(a=>resolveImageLibrarySide(a,{width:a.width,height:a.height})));
    const reception=createReceptionEditorDocument();reception.bento={gap:16,padding:16};
    for(let i=0;i<16;i++){
      const frame={left:16+(i%4)*356,top:16+Math.floor(i/4)*221,width:340,height:205};const id=`shape:perf-${i}`,image=`image:perf-${i}`,text=`text:perf-${i}`;
      reception.shapes.push({id,name:`Cell ${i+1}`,color:'#303030',opacity:1,visibility:'PUBLIC'});reception.workbench.shapes.push({id,open:true,window:frame});
      reception.imageModules.push({id:image,name:`Artwork ${i+1}`,width:frame.width,height:frame.height,sides:[structuredClone(sides[i%sides.length])],visibility:'PUBLIC'});reception.workbench.imageModules.push({id:image,open:true,position:{left:frame.left,top:frame.top}});
      const article=createArticle(`Study ${i+1}`);article.content={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'A bounded living archive. Sixteen images, sixteen native Text layers and sixteen cell backgrounds.'}]}]};article.appearance={...article.appearance,background:null,fontSize:16,color:'#ffffff'};
      reception.texts.push({id:text,article,visibility:'PUBLIC'});reception.workbench.texts.push({id:text,open:true,window:frame});
      reception.cells.push({id,members:[image,text],radius:8,mobile:{columns:2,height:240}});reception.artworkLayers.push(id,image,text);
    }
    const root=window.nativeReceptionFixture.root,draft=root.getDraft(),start=performance.now();
    if(!root.commitCompletedOperation({...draft,reception},{expectedGeneration:root.getGeneration()}))throw Error('Performance fixture rejected');
    return {commitMs:performance.now()-start,cells:16,images:16,texts:16,distinctArtwork:sides.length};
  });
  await page.waitForFunction(()=>document.querySelectorAll('svg.image-module__artwork[data-media-state="ready"]').length===16);
  await capture('performance-filled-16');
  const sample=async()=>page.evaluate(()=>new Promise(resolve=>{const values=[];let prev;function tick(t){if(prev!=null)values.push(t-prev);prev=t;if(values.length<180)requestAnimationFrame(tick);else{const sorted=[...values].sort((a,b)=>a-b);resolve({frames:values.length,p50:sorted[90],p95:sorted[171],max:sorted.at(-1),over50ms:values.filter(v=>v>50).length});}}requestAnimationFrame(tick);}));
  result.performanceIdle=await sample();
  const divider=page.getByRole('separator',{name:'Resize adjacent columns',exact:true}).first();await divider.focus();
  const start=Date.now();const active=sample();for(let i=0;i<24;i++)await divider.press(i%2?'ArrowLeft':'ArrowRight');result.performanceActive=await active;result.performanceActive.commandTotalMs=Date.now()-start;
  result.performanceMedia=await page.locator('svg.image-module__artwork').evaluateAll(items=>({count:items.length,ready:items.filter(i=>i.dataset.mediaState==='ready').length}));
} catch(error){result.failure={message:error.message,stack:error.stack};await capture('failure');process.exitCode=1;}
finally{await writeFile(resolve(out,'results.json'),JSON.stringify(result,null,2));await browser.close();await server.close();}
console.log(JSON.stringify({failure:result.failure,errors:result.errors,captures:result.captures,privateBefore:result.privateBefore,privateAfter:result.privateAfter},null,2));
