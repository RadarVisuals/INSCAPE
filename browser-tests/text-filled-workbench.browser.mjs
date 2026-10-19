import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { mountTextToolsFixture } from './fixtures/text-tools-fixture.mjs';
const origin=process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5173';
const settle=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const saved=page=>page.evaluate(()=>window.savedDraft());

test('active Text transfer destinations follow background Display availability without an article edit',{timeout:60000},async()=>{
  const browser=await chromium.launch({executablePath:process.env.INSCAPE_BROWSER_EXECUTABLE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(10000);
    await mountTextToolsFixture(page,origin);await page.waitForLoadState('networkidle');
    const body=page.getByRole('textbox',{name:'Article text',exact:true});await body.focus();
    const node=await body.elementHandle(),before=await saved(page);
    const menu=page.locator('.text-tools-transfer');assert.equal(await menu.count(),1);
    // Change background availability without pointer/focus activation of that
    // module. It is a temporary host input, not a new article prop or edit.
    await page.getByRole('button',{name:'Lock Display Module composition',exact:true}).evaluate(button=>button.click());
    await menu.waitFor({state:'detached'});
    assert.equal(await body.evaluate(node=>node===document.activeElement),true);
    await page.getByRole('button',{name:'Unlock Display Module composition',exact:true}).evaluate(button=>button.click());
    await menu.waitFor({state:'attached'});
    assert.equal(await menu.getByRole('option').count(),2);
    assert.equal(await body.evaluate((element,previous)=>element===previous,node),true);
    assert.deepEqual(await saved(page),before,'availability changes do not save or replace the article');
  } finally {await browser.close();}
});

for(const width of [1440,390]) test(`filled Workbench keeps Text targets, history and failed-save recovery separate at ${width}px`,{timeout:90000},async()=>{
  const browser=await chromium.launch({executablePath:process.env.INSCAPE_BROWSER_EXECUTABLE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  try {
    const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'}); page.setDefaultTimeout(12000);
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    await mountTextToolsFixture(page,origin,{textCount:12});
    await page.evaluate(async()=>{
      const draft=window.savedDraft();
      // Seed the editor's explicit defaults so undo can be compared byte-for-byte
      // with its initial schema, rather than with an unnormalized fixture.
      for(const [i,text] of draft.texts.entries()) text.article.content.content=Array.from({length:16},(_,j)=>({type:'paragraph',attrs:{textAlign:null,spaceBefore:null,spaceAfter:null,lineHeight:null},content:[{type:'text',text:`Article ${i+1}, paragraph ${j+1}. `+'The composition keeps its words and artwork together. '.repeat(24)}]}));
      const {systemWorkflowDraftKey}=await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
      localStorage.setItem(systemWorkflowDraftKey(draft.profileAddress),JSON.stringify(draft));
    });
    await mountTextToolsFixture(page,origin); await page.waitForLoadState('networkidle');
    const initial=await saved(page);
    const body=index=>page.locator(`[data-text-id="${initial.texts[index].id}"]`).getByRole('textbox',{name:'Article text',exact:true});
    const secondNode=await body(1).elementHandle();
    await body(0).focus(); await body(0).press('Control+End'); await page.keyboard.type(' First article edit.'); await settle(page);
    const firstSaved=await saved(page);
    assert.deepEqual(firstSaved.texts.slice(1),initial.texts.slice(1));
    assert.deepEqual(firstSaved.workbench,initial.workbench);
    assert.equal(await body(1).evaluate((node,previous)=>node===previous,secondNode),true,'sibling editor retains its DOM and history');
    await body(1).focus(); await body(1).press('Control+End');
    await page.evaluate(()=>{window.failSave=true;});
    await page.keyboard.type(' Recover the second article.'); await settle(page);
    assert.deepEqual(await saved(page),firstSaved,'failed input does not claim persistence');
    const tools=page.locator('.text-tools-window');
    await tools.getByRole('alert').waitFor();
    await page.evaluate(()=>{window.failSave=false;});
    // Keyboard access remains usable even when the target window is offscreen.
    await tools.getByRole('button',{name:'Retry local save',exact:true}).focus(); await page.keyboard.press('Enter'); await settle(page);
    const recovered=await saved(page);
    assert.deepEqual(recovered.texts[0],firstSaved.texts[0]);
    assert.deepEqual(recovered.texts.slice(2),initial.texts.slice(2));
    assert.match(await body(1).innerText(),/Recover the second article\.$/);
    await body(1).focus(); await body(1).press('Control+z'); await settle(page);
    assert.deepEqual((await saved(page)).texts[1],initial.texts[1]);
    await body(1).press('Control+Shift+z'); await settle(page);
    assert.deepEqual(await saved(page),recovered);
    await mountTextToolsFixture(page,origin); await settle(page);
    assert.deepEqual(await saved(page),recovered,'reload retains both saved edits and all sibling articles');
    const output=process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime'; await mkdir(output,{recursive:true});
    await page.screenshot({path:path.join(output,`filled-text-${width}.png`)});
    assert.deepEqual(errors,[]);
  } finally {await browser.close();}
});
