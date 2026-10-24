import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5225';
const output = (process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime') + '/interactions';
const executablePath = process.env.INSCAPE_BROWSER_EXECUTABLE || 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
async function mount(browser,width=1440,height=900) {
  const page=await browser.newPage({viewport:{width,height},hasTouch:width<520}), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/design-system.html#components');
  const studio=page.locator('.ds-studio');await studio.waitFor();
  await page.evaluate(()=>document.fonts.ready);
  return {page,studio,errors,tab: name=>name === 'Text' ? studio.getByRole('button',{name:'Text tools',exact:true}).click() : studio.getByRole('tab',{name,exact:true}).click()};
}
test('composition geometry and content survive every inspector tab and targeted edits', {timeout:60000},async()=>{
  const browser=await chromium.launch({executablePath,headless:true});
  try {
    for (const width of [1440,390]) {
      const {page,studio,errors,tab}=await mount(browser,width);
      for(const theme of ['carbon','mist']) {
        await page.getByLabel('Preview surface').selectOption(theme);
        await studio.getByLabel('Workspace selection').selectOption('foreground');
        assert.equal(await studio.locator('.ds-studio-canvas-scroll').evaluate(n=>n.scrollHeight>n.clientHeight),false,'composition fits at 100%');
        const scene=studio.locator('.ds-layer-scene');
        const geometry=()=>scene.locator('[data-layer-id]').evaluateAll(nodes=>nodes.map(n=>({id:n.dataset.layerId,style:n.getAttribute('style'),art:n.querySelector('svg')?.outerHTML})));
        const initial=await geometry();
        for(const name of ['Layers','Color','Shape','Image','Display','Transform','FX']) {
          await tab(name);assert.deepEqual(await geometry(),initial,name+' does not replace the canvas');
          assert.equal(await scene.locator('[data-layer-id]').count(),5);
          assert.equal(await studio.locator('.ds-studio-art').count(),0,'no rectangular fallback');
        }
        await tab('Color');await studio.getByLabel('Studio colour',{exact:true}).fill('#2277aa');
        assert.equal(await scene.locator('[data-layer-id="foreground"] path').getAttribute('fill'),'#2277aa');
        assert.notEqual(await scene.locator('[data-layer-id="artwork"] path').getAttribute('fill'),'#2277aa');
        await tab('Transform');await studio.getByLabel('Studio Width',{exact:true}).fill('140');await studio.getByLabel('Studio Width',{exact:true}).press('Tab');
        assert.ok(await scene.locator('[data-layer-id="foreground"] path').count());
        await tab('FX');
        assert.equal(await studio.getByLabel('Studio grain',{exact:true}).count(),0,'FX only offers the implemented Shape target');
        assert.ok(await scene.locator('[data-layer-id="foreground"] path').count());
        await tab('Color');await mkdir(output,{recursive:true});
        await studio.getByLabel('Studio colour',{exact:true}).click();
        await studio.locator('.ds-studio-layout').screenshot({path:`${output}/${theme}-${width}.png`});
      }
      assert.deepEqual(errors,[]);await page.close();
    }
  }finally{await browser.close()}
});
test('Color edits selected text while retaining title, mixed marks, history and composition', {timeout:60000},async()=>{
 const browser=await chromium.launch({executablePath,headless:true});
 try {
  const {page,studio,errors,tab}=await mount(browser);
  await studio.getByLabel('Workspace selection').selectOption('text');
  const body=studio.getByRole('textbox',{name:'Article text',exact:true});
  await body.fill('red blue green');
  await body.click();
  await body.press('Control+Home');for(let i=0;i<4;i++)await body.press('ArrowRight');for(let i=0;i<4;i++)await body.press('Shift+ArrowRight');
  await tab('Color');assert.equal(await studio.getByText('Selected text',{exact:true}).count(),1);
  const hex=studio.getByLabel('Studio colour',{exact:true});await hex.fill('#ff0000');
  assert.equal(await body.locator('span[style*="color"]').textContent(),'blue');
  assert.equal(await studio.locator('.ds-layer-scene [data-layer-id]').count(),5);
  await tab('Layers');await studio.locator('.ds-layer-select').filter({hasText:'Foreground'}).click();
  assert.equal(await studio.locator('.ds-layer-scene [data-layer-id="text"] span[style*="color"]').textContent(),'blue','read rendering retains inline marks');
  await studio.getByLabel('Workspace selection').selectOption('text');
  await body.focus();await body.press('Control+A');
  const original=await body.innerHTML();
  await tab('Color');
  const wheel=studio.locator('.ds-colour-controls');await wheel.scrollIntoViewIfNeeded();
  const r=await wheel.boundingBox();
  await page.mouse.move(r.x+r.width*.5,r.y+r.height*.045);await page.mouse.down();
  await page.mouse.move(r.x+r.width*.95,r.y+r.height*.5,{steps:4});
  assert.notEqual(await body.innerHTML(),original);
  await page.keyboard.press('Escape');await page.mouse.up();
  assert.equal(await body.innerHTML(),original,'cancel restores mixed colours exactly');
  await page.mouse.move(r.x+r.width*.5,r.y+r.height*.045);await page.mouse.down();await page.mouse.move(r.x+r.width*.95,r.y+r.height*.5,{steps:4});await page.mouse.up();
  const committed=await body.innerHTML();assert.notEqual(committed,original);
  await tab('Text');await studio.getByRole('button',{name:'Undo',exact:true}).click();assert.equal(await body.innerHTML(),original,'one undo restores a whole wheel gesture');
  await studio.getByRole('button',{name:'Redo',exact:true}).click();assert.equal(await body.innerHTML(),committed);
  await studio.getByRole('button',{name:'Undo',exact:true}).click();await studio.getByRole('button',{name:'Undo',exact:true}).click();
  assert.equal(await body.innerHTML(),'<p>red blue green</p>','earlier colour history survives live preview and cancellation');
  await studio.getByLabel('Text example',{exact:true}).selectOption('article');
  const title=studio.getByRole('textbox',{name:'Article title',exact:true});
  const titleColour=await title.evaluate(n=>getComputedStyle(n).color);
  await body.focus();await body.press('Control+Home');await body.press('Control+Shift+ArrowRight');
  await tab('Color');await hex.fill('#123abc');
  assert.equal(await title.evaluate(n=>getComputedStyle(n).color),titleColour,'body selection does not recolour the title');
  const bodyMarkup=await body.innerHTML();await title.focus();await title.press('Control+A');await hex.fill('#ff8800');
  assert.equal(await title.evaluate(n=>getComputedStyle(n).color),'rgb(255, 136, 0)');assert.equal(await body.innerHTML(),bodyMarkup,'title colour leaves body untouched');
  assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage)),[]);
 }finally{await browser.close()}
});
test('layer drop line follows the actual before/after insertion point', {timeout:60000},async()=>{
 const browser=await chromium.launch({executablePath,headless:true});
 try {
  const {page,studio,errors,tab}=await mount(browser);await tab('Layers');
  const row=id=>studio.locator(`.ds-layer-row[data-layer-id="${id}"]`);
  const order=()=>studio.locator('.ds-layer-row').evaluateAll(nodes=>nodes.map(n=>n.dataset.layerId));
  for(const edge of ['before','after']) {
   const source=row('moon'),target=row('artwork');await target.scrollIntoViewIfNeeded();
   const s=await source.boundingBox(),t=await target.boundingBox();
   await page.mouse.move(s.x+90,s.y+s.height/2);await page.mouse.down();await page.mouse.move(s.x+100,s.y+s.height/2+6,{steps:4});
   await page.mouse.move(t.x+100,t.y+(edge==='before'?5:t.height-5),{steps:6});
   await page.mouse.move(t.x+101,t.y+(edge==='before'?5:t.height-5));
   assert.equal(await target.getAttribute('data-drop'),edge);
   assert.equal(await target.evaluate(n=>getComputedStyle(n,'::after').height),'2px');
   await mkdir(output,{recursive:true});await studio.locator('.ds-studio-inspector').screenshot({path:`${output}/drop-${edge}.png`});
   await page.mouse.up();const ids=await order();
   assert.equal(ids.indexOf('moon'),ids.indexOf('artwork')+(edge==='before'?-1:1));
   assert.equal(await studio.locator('.ds-layer-row[data-drop]').count(),0);
  }
  await row('moon').getByRole('button',{name:'Lock Moon',exact:true}).click();
  assert.equal(await row('artwork').getAttribute('draggable'),'false');assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});
test('zoomed canvas and overflowing tools scroll without trapping the page', {timeout:60000},async()=>{
 const browser=await chromium.launch({executablePath,headless:true});
 try {
  for(const width of [1440,390,320]) {
   const {page,studio,errors,tab}=await mount(browser,width,720);
   await studio.getByLabel('Workspace selection').selectOption('foreground');
   await studio.getByLabel('Preview zoom',{exact:true}).fill('200');
   const viewport=studio.getByRole('region',{name:'Workbench viewport'});await viewport.scrollIntoViewIfNeeded();
   assert.ok(await viewport.evaluate(n=>n.scrollHeight>n.clientHeight));
   const bounds=await viewport.boundingBox();await viewport.hover({position:{x:8,y:bounds.height-8}});await page.mouse.wheel(0,120);await page.waitForTimeout(250);
   assert.ok(await viewport.evaluate(n=>n.scrollTop>0));
   if(width<520){await page.mouse.wheel(120,0);await page.waitForTimeout(150);assert.ok(await viewport.evaluate(n=>n.scrollLeft>0));}
   await studio.getByLabel('Workspace selection').selectOption('text');await tab('Text');
   await studio.getByLabel('Text example',{exact:true}).selectOption('article');
   await studio.locator('.text-tools-window .text-tools-content details').first().waitFor();
   await studio.locator('.text-tools-window .text-tools-content details').evaluateAll(nodes=>nodes.forEach(n=>n.open=true));
   const panel=studio.locator('.text-tools-content');assert.ok(await panel.evaluate(n=>n.scrollHeight>n.clientHeight));
   await panel.scrollIntoViewIfNeeded();await panel.hover();await page.mouse.wheel(0,250);await page.waitForTimeout(150);
   assert.ok(await panel.evaluate(n=>n.scrollTop>0));
   await panel.evaluate(n=>n.scrollTop=n.scrollHeight);const before=await page.evaluate(()=>scrollY);
   await page.mouse.wheel(0,500);await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>scrollY),before,'the floating tool contains scrolling at its edge');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);await page.close();
  }
 }finally{await browser.close()}
});

test('adding and editing text keeps frames separate and the selected text tool target stable', {timeout:60000},async()=>{
 const browser=await chromium.launch({executablePath,headless:true});
 try {
  for(const width of [1440,390]) {
   const {page,studio,errors,tab}=await mount(browser,width);
   await tab('Layers');
   const scene=studio.getByRole('group',{name:'Example Display composition'});
   const select=studio.getByLabel('Workspace selection');
   const initialCount=await select.locator('option').count();
   const original=scene.locator('[data-layer-id="text"]');
   await studio.getByRole('button',{name:'Add text',exact:true}).click();
   const id=await select.inputValue();assert.notEqual(id,'text');
   const added=scene.locator(`[data-layer-id="${id}"]`);
   const a=await original.boundingBox(),b=await added.boundingBox();
   assert.ok(b.y>=a.y+a.height || b.x>=a.x+a.width || b.y+b.height<=a.y || b.x+b.width<=a.x,'new text does not cover the existing text');
   assert.equal(await original.innerText(),'A quiet place');
   const body=studio.getByRole('textbox',{name:'Article text',exact:true});
   await body.fill('My own text');
   await studio.getByRole('button',{name:'Text tool',exact:true}).click();
   assert.equal(await select.inputValue(),id,'text tool keeps the selected new layer');
   assert.equal(await select.locator('option').count(),initialCount+1);
   assert.equal(await body.innerText(),'My own text');
   await tab('Color');
   await mkdir(output,{recursive:true});
   await studio.locator('.ds-studio-layout').screenshot({path:`${output}/text-separate-${width}.png`});
   await body.click();await body.press('Control+A');await body.press('Backspace');await tab('Text');
   assert.equal((await added.innerText()).trim(),'','empty text stays empty without a writing prompt');
   assert.equal(await added.locator('.text-editor-placeholder').isVisible(),false);
   await scene.screenshot({path:`${output}/text-empty-${width}.png`});
   await select.selectOption('text');await body.fill('Replaced original');
   await tab('Color');assert.equal(await scene.getByText('A quiet place',{exact:true}).count(),0);
   await body.click();await body.press('Control+A');await body.press('Backspace');await tab('Layers');
   assert.equal((await scene.innerText()).trim(),'');
   await studio.getByRole('button',{name:'Add text',exact:true}).click();
   const frames=await scene.locator('[data-layer-id]').evaluateAll(nodes=>nodes.filter(n=>n.dataset.layerId.startsWith('text')).map(n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}}));
   for(let i=0;i<frames.length;i++)for(let j=i+1;j<frames.length;j++){
    const a=frames[i],b=frames[j];assert.ok(b.y>=a.y+a.height-0.1 || b.x>=a.x+a.width-0.1 || b.y+b.height<=a.y+0.1 || b.x+b.width<=a.x+0.1);
   }
   assert.deepEqual(errors,[]);await page.close();
  }
 }finally{await browser.close()}
});
