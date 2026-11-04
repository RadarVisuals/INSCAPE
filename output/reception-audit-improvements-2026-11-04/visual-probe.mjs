import {chromium} from 'playwright-core';
import {createBrowserTestServer} from '../../scripts/runBrowserTests.mjs';
import {editorMenu,editorCommand,editorOverview,setEditorSidebarOpen} from '../../browser-tests/fixtures/editor-menu.mjs';
import {openSharedTool} from '../../browser-tests/fixtures/shared-tools.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const out=resolve('output/reception-audit-improvements-2026-11-04/visual');await mkdir(out,{recursive:true});
const server=await createBrowserTestServer(process.cwd(),15807);await server.listen();const origin='http://127.0.0.1:15807';
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',headless:true});
const results={errors:[],captures:[],browser:browser.version()};
try{for(const theme of ['DARK','LIGHT','LIGHT_DARK_CELL']){
 const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});page.setDefaultTimeout(15000);
 page.on('pageerror',e=>results.errors.push(e.message));
 await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
 await page.route('https://raw.githubusercontent.com/RadarVisuals/INSCAPE/**',r=>r.fulfill({path:'public/'+new URL(r.request().url()).pathname.split('/public/')[1]}));
 const state=()=>page.evaluate(()=>window.nativeReceptionFixture.root.getDraft().reception);
 const cell=id=>page.locator(`[data-editor-cell-surface="${id}"]`);
 const closeTools=async()=>{for(let i=0;i<12;i++){const x=page.locator('.workbench-tool-dock').getByRole('button',{name:/^Close /u});if(!await x.isVisible())break;await x.click();}};
 const capture=async name=>{await page.evaluate(()=>new Promise(r=>{let n=0;function f(){if(++n===8)r();else requestAnimationFrame(f)}requestAnimationFrame(f)}));await page.screenshot({path:resolve(out,name+'.png')});};
 await page.goto(origin+'/browser-tests/reception-native-editor-fixture.html?session=improved-'+crypto.randomUUID());await page.getByRole('toolbar',{name:'Creation tools',exact:true}).waitFor();await setEditorSidebarOpen(page,false);
 await editorCommand(page,'Edit','Settings');await page.getByRole('button',{name:theme.split('_')[0],exact:true}).click();await page.getByRole('button',{name:'Close Settings',exact:true}).click();await closeTools();
 await editorMenu(page,'Bento').click();const panel=page.getByRole('dialog',{name:'Bento settings',exact:true});await panel.getByLabel('Number of cells',{exact:true}).fill('1');await panel.getByRole('button',{name:'Create Bento',exact:true}).click();await panel.getByRole('button',{name:'Close Bento',exact:true}).click();
 const first=(await state()).cells[0].id;await cell(first).click({button:'right',position:{x:30,y:100}});await page.getByRole('menuitem',{name:'Split vertically',exact:true}).click();
 await cell(first).click({position:{x:30,y:100}});await page.getByRole('button',{name:'+ Image',exact:true}).click();const picker=page.locator('.reception-library-window');await picker.getByRole('button',{name:'ABYSSAL STUDY / INSCAPE STUDIES',exact:true}).click();await picker.getByRole('button',{name:'Use selected image',exact:true}).click();await picker.waitFor({state:'detached'});await page.getByRole('button',{name:'Back to cells',exact:true}).click();await closeTools();
 const second=(await state()).cells[1].id;if(theme==='LIGHT_DARK_CELL'){await page.evaluate(id=>{const root=window.nativeReceptionFixture.root,draft=root.getDraft();draft.reception.shapes=draft.reception.shapes.map(s=>s.id===id?{...s,color:'#101111',opacity:1}:s);if(!root.commitCompletedOperation(draft,{expectedGeneration:root.getGeneration()}))throw Error('Dark cell fixture rejected');},second);}await cell(second).click({position:{x:30,y:100}});await page.getByRole('button',{name:'+ Text',exact:true}).click();
 await page.getByRole('textbox',{name:'Article text',exact:true}).fill('A living archive\n\nI work with light, creatures and fragments of digital space. Every image keeps its source and enters a new relationship here.\n\nThis reception is an invitation to explore the work. Colour, texture and words share one composition.');
 await page.locator('main[data-reception-editor]').focus();await page.waitForFunction(()=>JSON.stringify(window.nativeReceptionFixture.root.getDraft().reception.texts).includes('A living archive'));
 await page.evaluate(id=>{const root=window.nativeReceptionFixture.root,draft=root.getDraft();draft.reception.shapes=draft.reception.shapes.map(s=>s.id===id?{...s,name:'Introduction'}:s);if(!root.commitCompletedOperation(draft,{expectedGeneration:root.getGeneration()}))throw Error('Cell rename rejected');},second);await page.getByText('Editing contents · Introduction',{exact:true}).waitFor();results.renamedCellNotice=true;await page.getByRole('button',{name:'Back to cells',exact:true}).click();await closeTools();await page.locator('svg.image-module__artwork[data-media-state="ready"]').waitFor();
 assert.equal((await state()).texts[0].article.appearance.color,theme==='LIGHT'?'#000000':'#ffffff');
 for(const width of [1440,900]){
  await page.setViewportSize({width,height:900});await page.getByRole('button',{name:'Reset Workbench view',exact:true}).click();await cell(second).focus();await capture(`editor-${width}-${theme.toLowerCase()}`);
  await editorMenu(page,'Bento').click();await capture(`bento-${width}-${theme.toLowerCase()}`);await panel.getByRole('button',{name:'Close Bento',exact:true}).click();
  await editorCommand(page,'Canvas','Preview');const preview=page.getByRole('region',{name:'Reception responsive preview',exact:true});await preview.getByText('A living archive',{exact:false}).first().waitFor();await capture(`preview-${width}-${theme.toLowerCase()}`);
  const canvas=await preview.locator('.reception-document-canvas').boundingBox(),mobile=await preview.locator('.reception-document-canvas').getAttribute('data-mobile');assert.equal(mobile,null);assert.ok(canvas.width>800);
  results.captures.push({theme,width,canvas,mobile,ink:(await state()).texts[0].article.appearance.color,label:await preview.locator('.reception-viewport-controls label span').innerText(),readyArtwork:await preview.locator('svg.image-module__artwork[data-media-state="ready"]').count()});
  await preview.getByRole('button',{name:'Back to editing',exact:true}).click();
 }
 if(theme==='DARK'){
  const before=await state(); await page.getByRole('button',{name:'Close Untitled article',exact:true}).focus();await page.keyboard.press('Enter');
  const shortcut=page.locator('.text-shortcut');await shortcut.waitFor();const originalBox=await shortcut.boundingBox();
  await page.getByRole('slider',{name:'Workbench zoom',exact:true}).fill('90');await page.getByRole('button',{name:'Navigate Workbench',exact:true}).focus();await page.keyboard.press('ArrowRight');
  assert.deepEqual(await shortcut.boundingBox(),originalBox);results.shortcutCameraStable=true;
  await editorCommand(page,'Canvas','Preview');assert.equal(await shortcut.isVisible(),false);await capture('closed-text-preview-hidden');
  await page.getByRole('button',{name:'Back to editing',exact:true}).click();await shortcut.waitFor();await shortcut.click();await page.locator('.text-window').waitFor();assert.deepEqual((await state()).texts,before.texts);results.shortcutReopenRetainsContent=true;
  await page.getByRole('button',{name:'Close Untitled article',exact:true}).focus();await page.keyboard.press('Enter');await editorOverview(page);assert.equal(await shortcut.isVisible(),false);results.shortcutOverviewHidden=true;
 }
 if(theme==='LIGHT'){
  await page.setViewportSize({width:1440,height:900});await cell(second).click({position:{x:30,y:100}});const shape=await openSharedTool(page,'Shape');await shape.getByLabel('Include in publication',{exact:true}).uncheck();await closeTools();
  await openSharedTool(page,'Layers');await page.getByRole('button',{name:`Delete ${(await state()).shapes.find(s=>s.id===second).name}`,exact:true}).click();await page.getByRole('button',{name:'Confirm layer deletion',exact:true}).click();
  const saved=await state();assert.equal(saved.texts[0].visibility,'PRIVATE');results.privacy={retained:saved.texts.length,visibility:saved.texts[0].visibility,publicTexts:await page.evaluate(async()=>{const {projectReception}=await import('/src/profileDocument/domain/receptionPresentation.js');return projectReception(window.nativeReceptionFixture.root.getDraft().reception).texts.length})};assert.equal(results.privacy.publicTexts,0);
  await editorCommand(page,'Canvas','Preview');await capture('private-cell-deleted-preview');
 }
 await page.close();
}}catch(e){results.failure={message:e.message,stack:e.stack};process.exitCode=1;}finally{await writeFile(resolve(out,'results.json'),JSON.stringify(results,null,2));await browser.close();await server.close();}console.log(JSON.stringify(results,null,2));
