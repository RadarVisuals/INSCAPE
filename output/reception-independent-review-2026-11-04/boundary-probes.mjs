import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createBrowserTestServer} from '../../scripts/runBrowserTests.mjs';
import {chromium} from 'playwright-core';
import {editorMenu,editorCommand,editorDestination,setEditorSidebarOpen} from '../../browser-tests/fixtures/editor-menu.mjs';
import {openSharedTool} from '../../browser-tests/fixtures/shared-tools.mjs';
const out=resolve('output/reception-independent-review-2026-11-04/boundary-probes');await mkdir(out,{recursive:true});
const server=await createBrowserTestServer(process.cwd(),15805);await server.listen();const origin='http://127.0.0.1:15805';
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',headless:true});
const result={errors:[]};
try{
  const ctx=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});await ctx.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  const page=await ctx.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>result.errors.push(e.message));
  await page.goto(origin+'/browser-tests/reception-native-editor-fixture.html?session=undo-'+crypto.randomUUID());await page.getByRole('toolbar',{name:'Creation tools',exact:true}).waitFor();await setEditorSidebarOpen(page,false);
  await editorMenu(page,'Bento').click();const panel=page.getByRole('dialog',{name:'Bento settings',exact:true});await panel.getByLabel('Number of cells',{exact:true}).fill('1');await panel.getByRole('button',{name:'Create Bento',exact:true}).click();await panel.getByRole('button',{name:'Close Bento',exact:true}).click();
  const state=()=>page.evaluate(()=>window.nativeReceptionFixture.root.getDraft().reception),initial=await state(),id=initial.cells[0].id;
  await page.locator(`[data-editor-cell-surface="${id}"]`).dblclick({position:{x:60,y:120}});await page.getByRole('button',{name:'Back to cells',exact:true}).waitFor();
  await openSharedTool(page,'Layers');await page.getByRole('button',{name:`Delete ${initial.shapes.find(s=>s.id===id).name}`,exact:true}).click();await page.getByRole('button',{name:'Confirm layer deletion',exact:true}).click();
  result.noticeAfterDelete=await page.getByRole('button',{name:'Back to cells',exact:true}).count();await editorCommand(page,'Edit','Undo');await page.getByRole('button',{name:'Back to cells',exact:true}).waitFor();
  await page.getByRole('button',{name:'Layers',exact:true}).click();await page.locator('main[data-reception-editor]').focus();await page.keyboard.press('r');
  await page.mouse.move(320,320);await page.mouse.down();await page.mouse.move(600,500,{steps:8});await page.mouse.up();
  await page.waitForFunction(()=>window.nativeReceptionFixture.root.getDraft().reception.shapes.length===2);
  const after=await state(),added=after.shapes.find(s=>s.id!==id);result.undoEditingCell={noticeAfterUndo:await page.getByRole('button',{name:'Back to cells',exact:true}).count(),addedId:added.id,members:after.cells[0].members,addedBelongs:after.cells[0].members.includes(added.id)};
  await page.screenshot({path:resolve(out,'undo-editing-cell-membership.png')});
  await page.getByRole('button',{name:'Back to cells',exact:true}).click();await page.locator(`[data-editor-cell-surface="${id}"]`).dblclick({position:{x:500,y:300}});
  await page.locator('main[data-reception-editor]').focus();await page.keyboard.press('r');await page.mouse.move(700,400);await page.mouse.down();await page.mouse.move(920,550,{steps:8});await page.mouse.up();
  await page.waitForFunction(()=>window.nativeReceptionFixture.root.getDraft().reception.shapes.length===3);const control=await state();result.undoEditingCell.explicitReentryRestoresMembership=control.cells[0].members.length===1;
  assert.equal(result.undoEditingCell.addedBelongs,false);assert.equal(result.undoEditingCell.explicitReentryRestoresMembership,true);await ctx.close();
  const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  const a=await context.newPage(),b=await context.newPage();a.setDefaultTimeout(10000);b.setDefaultTimeout(10000);
  for(const p of [a,b]){p.on('pageerror',e=>result.errors.push(e.message));await p.goto(origin+'/browser-tests/reception-boundaries-fixture.html');await p.getByText('LOCAL A',{exact:true}).waitFor();}
  await a.getByRole('button',{name:'Edit Reception',exact:true}).click();await editorMenu(a,'Canvas').waitFor();
  await b.getByRole('button',{name:'Edit Reception',exact:true}).click();await b.getByRole('heading',{name:'This tab is view-only',exact:true}).waitFor();result.leaseBlocksSecondEditor=true;
  await editorDestination(a,'Reception');await a.locator('.reception-page').waitFor();await b.getByRole('button',{name:'Try editing here',exact:true}).click();await editorMenu(b,'Canvas').waitFor();result.retryAfterRelease=true;
  const backup=await b.evaluate(()=>window.receptionBoundaryFixture.backup);await editorMenu(b,'Backup').click();await b.getByLabel('Open Workbench backup',{exact:true}).setInputFiles({name:'independent-fixture-backup.json',mimeType:'application/json',buffer:Buffer.from(backup)});
  await b.getByRole('button',{name:'Replace Workbench with backup',exact:true}).click();await editorMenu(b,'Canvas').waitFor();result.backupPreservesReception=await editorMenu(b,'Canvas').locator('..').getAttribute('data-document');
  await editorDestination(b,'Reception');await b.getByText('RESTORED LOCAL',{exact:true}).waitFor();result.backupReaderRestored=true;
  await b.getByRole('button',{name:'Edit Reception',exact:true}).click();await editorMenu(b,'Canvas').waitFor();await b.evaluate(()=>window.receptionBoundaryFixture.setOwner(false));await b.getByText('PUBLIC ONLY',{exact:true}).waitFor();assert.equal(await b.locator('[data-reception-editor]').count(),0);result.authorityLossUnmounts=true;
  await b.screenshot({path:resolve(out,'visitor-after-authority-loss.png')});await context.close();
}catch(e){result.failure={message:e.message,stack:e.stack};process.exitCode=1;}
finally{await writeFile(resolve(out,'results.json'),JSON.stringify(result,null,2));await browser.close();await server.close();}
console.log(JSON.stringify(result,null,2));
