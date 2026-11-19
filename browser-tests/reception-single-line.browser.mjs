import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
import { editorCommand, receptionPreviewControls } from './fixtures/editor-menu.mjs';
const origin = process.env.INSCAPE_TEST_ROOT, output = process.env.INSCAPE_BROWSER_OUTPUT;

test('one explicit cell choice preserves a shallow strip and fades long text horizontally at every width', {timeout:60000}, async()=>{
 const browser=await chromium.launch({executablePath:browserExecutable,headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}}), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://raw.githubusercontent.com/**',route=>route.fulfill({path:'public/assets/actors/skull_reaper/full.webp'}));
  await page.goto(origin+'/browser-tests/reception-inspect-fixture.html');
  await page.getByRole('button',{name:'Read full text'}).waitFor();
  await page.evaluate(()=>{
   const v=structuredClone(window.inspectionFixture.value), a=v.texts[1].article;
   v.cells[1].singleLine=true;
   Object.assign(v.workbench.shapes.find(s=>s.id==='shape:short').window,{height:38});
   Object.assign(v.workbench.texts.find(t=>t.id==='text:short').window,{left:24,top:404,width:950,height:30});
   Object.assign(a.appearance,{compact:true,fontSize:14,padding:{top:4,left:16,right:16,bottom:0}});
   a.content.content[0].content[0].text='CHAPTER ZERO // ARRIVAL — '+ 'A deliberately long heading without a reading action. '.repeat(4);
   window.inspectionFixture.replace(v);
  });
  const saved=await page.evaluate(()=>JSON.stringify(window.inspectionFixture.value));
  await mkdir(output,{recursive:true});
  for(const width of [1440,1100,900,700,440,390,320]) {
   await page.setViewportSize({width,height:1000});
   await page.locator('[data-layer-id="text:short"] [data-text-single-line][data-overflow]').waitFor();
   await page.evaluate(()=>document.fonts.ready);
   const geometry=await page.locator('[data-cell-group="shape:short"]').evaluate(n=>{
    const r=document.createRange();r.selectNodeContents(n.querySelector('p'));
    const excerpt=n.querySelector('.reception-text-excerpt'), text=n.querySelector('[data-layer-id="text:short"]');
    return {height:n.getBoundingClientRect().height,lines:r.getClientRects().length,textHeight:text.getBoundingClientRect().height,
      ink:r.getBoundingClientRect().height,mask:getComputedStyle(excerpt).maskImage,fade:parseFloat(excerpt.style.getPropertyValue('--reception-excerpt-fade')),buttons:n.querySelectorAll('button').length};
   });
   assert.ok(Math.abs(geometry.height-38)<1,JSON.stringify({width,...geometry}));
   assert.equal(geometry.lines,1);assert.ok(geometry.ink<=geometry.textHeight+1);
   assert.ok(geometry.mask.includes('to right'));assert.ok(geometry.fade>0);assert.equal(geometry.buttons,0);
   const dots=await page.locator('[data-cell-group="shape:mixed"]').evaluate(n=>{
    const c=n.getBoundingClientRect(),b=n.querySelector('.reception-read-text').getBoundingClientRect();
    return {bottom:c.bottom-b.bottom,right:c.right-b.right};
   });
   assert.ok(Math.abs(dots.bottom-16)<1&&Math.abs(dots.right-16)<1);
   if([1440,900,320].includes(width))await page.screenshot({path:`${output}/single-line-${width}.png`});
  }
  assert.equal(await page.evaluate(()=>JSON.stringify(window.inspectionFixture.value)),saved);
  await page.evaluate(()=>{const v=structuredClone(window.inspectionFixture.value);v.cells[1].singleLine=false;window.inspectionFixture.replace(v);});
  await page.waitForFunction(()=>!document.querySelector('[data-layer-id="text:short"] [data-text-single-line]'));
  assert.ok(await page.locator('[data-layer-id="text:short"] p').evaluate(n=>{const r=document.createRange();r.selectNodeContents(n);return r.getClientRects().length>1;}));
  assert.deepEqual(errors,[]);
 } finally {await browser.close();}
});

test('the single checkbox saves, undoes and reloads through the existing Reception history', {timeout:90000}, async()=>{
 const browser=await chromium.launch({executablePath:browserExecutable,headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  await page.route('https://raw.githubusercontent.com/**',route=>route.fulfill({path:'public/assets/actors/skull_reaper/full.webp'}));
  await page.goto(`${origin}/browser-tests/reception-native-editor-fixture.html?tiling=1&session=${crypto.randomUUID()}`);
  await page.getByRole('group',{name:'Upper text bento cell',exact:true}).waitFor();
  const before=await page.evaluate(()=>window.nativeReceptionFixture.root.getDraft().reception);
  const open=async()=>{
   await editorCommand(page,'Canvas','Preview');
   await (await receptionPreviewControls(page)).getByRole('button',{name:'Responsive layout settings',exact:true}).click();
   await page.getByRole('combobox',{name:'Preview cell',exact:true}).selectOption('shape:tiling-top');
  };
  await open(); const checkbox=page.getByRole('checkbox',{name:'Single-line text',exact:true});
  await checkbox.check();
  const after=await page.evaluate(()=>window.nativeReceptionFixture.root.getDraft().reception);
  assert.equal(after.cells.find(c=>c.id==='shape:tiling-top').singleLine,true);
  assert.deepEqual(after.workbench,before.workbench);assert.deepEqual(after.texts,before.texts);
  const history=page.getByRole('group',{name:'Studio edit history',exact:true});
  await history.getByRole('button',{name:'Undo',exact:true}).click();assert.equal(await checkbox.isChecked(),false);
  assert.deepEqual(await page.evaluate(()=>window.nativeReceptionFixture.root.getDraft().reception),before);
  await history.getByRole('button',{name:'Redo',exact:true}).click();assert.equal(await checkbox.isChecked(),true);
  await page.screenshot({path:`${output}/single-line-checkbox.png`});
  await page.reload();await page.getByRole('group',{name:'Upper text bento cell',exact:true}).waitFor();
  assert.deepEqual(await page.evaluate(()=>window.nativeReceptionFixture.root.getDraft().reception),after);
  await open();assert.equal(await checkbox.isChecked(),true);
 } finally {await browser.close();}
});
