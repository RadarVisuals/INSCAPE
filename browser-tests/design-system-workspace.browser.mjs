import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { openTextToolSection } from './fixtures/text-tool-sections.mjs';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5217';
const executablePath = process.env.INSCAPE_BROWSER_EXECUTABLE || [
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  chromium.executablePath(),
].find(existsSync);
const output = (process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime') + '/workspace';
async function mount(browser, width = 1440) {
  const page = await browser.newPage({ viewport: { width, height: 1000 }, hasTouch: width < 520 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.goto(origin + '/design-system.html#components');
  const studio = page.locator('.ds-studio');
  await studio.waitFor();
  await page.evaluate(() => document.fonts.ready);
  return { page, studio, errors };
}
test('workspace tabs preserve selection scope and local values across editing and reset', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const { page, studio, errors } = await mount(browser);
    const select = studio.getByLabel('Workspace selection');
    const initialCount = await select.locator('option').count();
    await studio.getByRole('tab', { name: 'Transform', exact: true }).click();
    await studio.getByRole('button', { name: 'Rotate', exact: true }).click();
    assert.equal(await studio.getByLabel('Studio Rotation', { exact: true }).count(), 0);
    assert.match(await studio.locator('.ds-studio-art').getAttribute('style'), /rotate\(90deg\)/);
    await studio.getByLabel('Studio Width', { exact: true }).fill('240');
    await studio.getByLabel('Studio Width', { exact: true }).press('Tab');
    await select.selectOption('shape');
    assert.equal(await studio.getByRole('tab', { name: 'Transform', exact: true }).getAttribute('aria-selected'), 'true');
    assert.equal(await studio.getByLabel('Studio Width', { exact: true }).inputValue(), '288');
    await select.selectOption('image');
    assert.equal(await studio.getByLabel('Studio Width', { exact: true }).inputValue(), '240');
    await studio.getByLabel('Studio Width', { exact: true }).fill('');
    await studio.getByLabel('Studio Width', { exact: true }).press('Tab');
    assert.equal(await studio.getByLabel('Studio Width', { exact: true }).inputValue(), '240');
    await studio.getByRole('button', { name: 'Studio crop', exact: true }).click();
    const crop = studio.getByLabel('Studio crop zoom');
    assert.ok(await crop.evaluate(n => n === document.activeElement));
    await crop.press('ArrowRight'); await crop.press('Escape');
    assert.ok(await studio.getByRole('button', { name: 'Studio crop', exact: true }).evaluate(n => n === document.activeElement));
    await studio.getByRole('button', { name: 'Studio crop', exact: true }).click();
    assert.equal(await crop.inputValue(), '100', 'cancel restores the crop');
    await crop.press('ArrowRight'); await studio.getByRole('button', { name: 'Done', exact: true }).click();
    assert.match(await studio.locator('.ds-studio-art > svg').getAttribute('style'), /1.05/);
    await studio.getByRole('tab', { name: 'Color', exact: true }).click();
    await studio.getByText('Images have no color settings.', { exact: true }).waitFor();
    assert.equal(await studio.getByLabel('Studio colour', { exact: true }).count(), 0);
    await studio.getByRole('tab', { name: 'FX', exact: true }).click();
    assert.equal(await studio.getByLabel('Studio blur', { exact: true }).count(), 0);
    await select.selectOption('shape');
    await studio.getByRole('tab', { name: 'Color', exact: true }).click();
    const initial = await studio.getByLabel('Studio colour', { exact: true }).inputValue();
    await studio.getByRole('slider', { name: 'Colour hue' }).focus();
    await page.keyboard.press('ArrowRight');
    assert.notEqual(await studio.getByLabel('Studio colour', { exact: true }).inputValue(), initial);
    await studio.getByLabel('Studio opacity', { exact: true }).fill('70');
    assert.equal(await studio.locator('.ds-studio-art').evaluate(n => getComputedStyle(n).opacity), '0.7');
    await studio.getByRole('tab', { name: 'FX', exact: true }).click();
    await studio.getByLabel('Studio blur', { exact: true }).fill('3');
    assert.equal(await studio.locator('.ds-studio-art').evaluate(n => getComputedStyle(n).filter), 'blur(3px)');
    await page.getByLabel('Preview surface').selectOption('mist');
    assert.equal(await studio.getByLabel('Studio blur', { exact: true }).inputValue(), '3');
    await studio.getByRole('button', { name: 'Studio duplicate', exact: true }).click();
    assert.equal(await select.locator('option').count(), initialCount + 1);
    await studio.getByRole('button', { name: /Delete .* copy from example/ }).click();
    assert.equal(await select.locator('option').count(), initialCount);
    await studio.getByRole('button', { name: 'Reset workspace' }).click();
    assert.equal(await select.inputValue(), 'image');
    assert.equal(await studio.getByRole('tab', { name: 'Image', exact: true }).getAttribute('aria-selected'), 'true');
    await studio.getByRole('tab', { name: 'Transform', exact: true }).click();
    assert.equal(await studio.getByLabel('Studio Width', { exact: true }).inputValue(), '288');
    assert.equal(await studio.getByLabel('Studio Rotation', { exact: true }).count(), 0);
    assert.match(await studio.locator('.ds-studio-art').getAttribute('style'), /rotate\(0deg\)/);
    await select.selectOption('shape');
    await studio.getByRole('tab', { name: 'Shape', exact: true }).click();
    assert.equal(await studio.getByRole('checkbox', { name: 'Show shape', exact: true }).count(), 0);
    await studio.getByLabel('Studio shape type', { exact: true }).selectOption('grid');
    await studio.getByRole('tab', { name: 'FX', exact: true }).click();
    assert.equal(await studio.getByLabel('Studio grain', { exact: true }).count(), 0);
    assert.equal(await studio.getByLabel('Studio blur', { exact: true }).count(), 1);
    assert.deepEqual(await page.evaluate(() => Object.keys(localStorage)), []);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
test('workspace locking, tab keyboard navigation and minimap keep independent state', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const { page, studio, errors } = await mount(browser, 390);
    await studio.getByRole('tab', { name: 'Layers', exact: true }).click();
    await studio.locator('.ds-studio-layer-list').getByRole('button', { name: 'Artwork', exact: true }).click();
    await studio.getByRole('button', { name: 'Lock Artwork · Display', exact: true }).click();
    assert.ok(await studio.getByRole('button', { name: 'Rotate', exact: true }).isDisabled());
    await studio.getByRole('tab', { name: 'Transform', exact: true }).click();
    assert.ok(await studio.getByLabel('Studio Width', { exact: true }).isDisabled());
    await studio.getByRole('tab', { name: 'Color', exact: true }).click();
    assert.equal(await studio.getByRole('slider', { name: 'Colour hue' }).getAttribute('aria-disabled'), 'true');
    await studio.getByRole('tab', { name: 'Layers', exact: true }).click();
    await studio.getByRole('button', { name: 'Unlock Artwork · Display', exact: true }).click();
    assert.ok(await studio.getByRole('button', { name: 'Rotate', exact: true }).isEnabled());
    await studio.locator('.ds-studio-layer-list').getByRole('button', { name: 'Text', exact: true }).click();
    await studio.getByRole('button', { name: 'Edit Text', exact: true }).click();
    await studio.getByRole('textbox', { name: 'Article text', exact: true }).fill('A different story');
    assert.equal(await studio.getByRole('textbox',{name:'Article text',exact:true}).textContent(), 'A different story');
    await studio.getByRole('tab', { name: 'FX', exact: true }).focus();
    await page.keyboard.press('Home');
    assert.ok(await studio.getByRole('tab', { name: 'Color', exact: true }).evaluate(n => n === document.activeElement));
    await page.keyboard.press('End');
    assert.equal(await studio.getByRole('tab', { name: 'Info', exact: true }).getAttribute('aria-selected'), 'true');
    const map = studio.getByRole('button', { name: 'Navigate example workbench' });
    await map.focus(); await map.press('ArrowRight');
    const moved = await studio.locator('.ds-studio-text-canvas').getAttribute('style');
    await map.press('Enter');
    assert.equal(await studio.locator('.ds-studio-text-canvas').getAttribute('style'), moved, 'Enter does not jump to pointer coordinates');
    await studio.getByLabel('Preview zoom', { exact: true }).fill('200');
    assert.match(await studio.locator('.ds-studio-text-canvas').getAttribute('style'), /scale\(2\)/);
    await studio.getByRole('button', { name: 'Reset preview view' }).click();
    assert.equal(await studio.getByLabel('Preview zoom', { exact: true }).inputValue(), '100');
    assert.equal(await studio.getByRole('textbox', { name: 'Article text', exact: true }).textContent(), 'A different story');
    assert.deepEqual(errors, []);
    assert.deepEqual(await page.evaluate(() => Object.keys(localStorage)), []);
  } finally { await browser.close(); }
});
test('workspace themes and tabs fit wide and narrow containers with legible toolbar labels', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  await mkdir(output, { recursive: true });
  try {
    for (const width of [1440, 390, 320]) {
      const { page, studio, errors } = await mount(browser, width);
      for (const theme of ['carbon', 'mist']) {
        await page.getByLabel('Preview surface').selectOption(theme);
        for (const name of ['Color','Layers','Shape','Image','Display','Transform','FX','Info']) {
          await studio.getByRole('tab', { name, exact: true }).click();
          assert.ok(await studio.getByRole('tabpanel', { name, exact: true }).isVisible());
        }
        await studio.getByRole('tab', { name: 'Image', exact: true }).click();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert.ok(overflow <= 1);
        if (width > 520) {
          const geometry = await studio.getByRole('button', { name: 'Select tool' }).evaluate(n => {
            const b=n.getBoundingClientRect(), l=n.querySelector('span').getBoundingClientRect();
            return { inside:l.left>=b.left && l.right<=b.right && l.top>=b.top && l.bottom<=b.bottom, height:b.height };
          });
          assert.ok(geometry.inside, 'selected tool label stays inside its background');
        }
        await studio.screenshot({ path: output + '/' + theme + '-' + width + '.png' });
      }
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});


test('Layers selection, grouping, visibility, ordering and confirmed removal stay coherent', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const { page, studio, errors } = await mount(browser);
    await studio.getByRole('tab', { name: 'Layers', exact: true }).click();
    const list = studio.getByRole('group', { name: 'Layers, front to back' });
    const row = name => list.getByRole('button', { name, exact: true });
    const order = () => list.locator('.ds-layer-row').evaluateAll(nodes=>nodes.map(n=>n.dataset.layerId));
    const original = await order();
    await row('Artwork').click(); await row('Moon').click({ modifiers: ['Shift'] });
    assert.equal(await list.locator('.ds-layer-row[data-selected]').count(), 2);
    await studio.getByRole('button', { name: 'Group layers', exact: true }).click();
    assert.deepEqual(await order(), original, 'grouping preserves front-to-back order');
    assert.equal(await list.locator('.ds-layer-row[data-group]').count(), 2);
    await studio.getByRole('button', { name: 'Clear layer selection' }).click();
    await row('Moon').click();
    assert.equal(await list.locator('.ds-layer-row[data-selected]').count(), 2, 'group selection is atomic');
    await studio.getByRole('button', { name: 'Lock Moon', exact: true }).click();
    assert.equal(await row('Artwork').isDisabled(), true);
    assert.equal(await row('Moon').isDisabled(), true);
    assert.equal(await studio.getByRole('button', { name: 'Rotate', exact: true }).isDisabled(), true);
    await studio.getByRole('button', { name: 'Unlock Moon', exact: true }).click();
    await studio.getByRole('button', { name: 'Hide Moon in editor', exact: true }).click();
    assert.equal(await list.locator('.ds-layer-row[data-hidden]').count(), 2);
    assert.equal(await list.locator('.ds-layer-row[data-selected]').count(), 0);
    assert.equal(await studio.locator('.ds-layer-scene [data-layer-id="moon"]').count(), 0);
    await studio.getByRole('button', { name: 'Show Moon in editor', exact: true }).click();
    await row('Moon').click(); await studio.getByRole('button', { name: 'Ungroup layers', exact: true }).click();
    assert.equal(await list.locator('.ds-layer-row[data-group]').count(), 0);
    await row('Moon').click(); await studio.getByRole('button', { name: 'Studio bring to front' }).click();
    assert.equal((await order())[0], 'moon');
    const source=list.locator('.ds-layer-row[data-layer-id="moon"]'), target=list.locator('.ds-layer-row[data-layer-id="artwork"]');
    await source.dragTo(target);
    assert.notEqual((await order())[0], 'moon', 'dragging changes the layer order');
    await row('Artwork').click(); await row('Moon').click({ modifiers: ['Shift'] });
    const remove = studio.getByRole('button', { name: 'Remove Moon from Grid', exact: true });
    const trashBounds=await remove.boundingBox(), listBounds=await list.boundingBox();
    await remove.click();
    const confirm=studio.getByRole('alertdialog',{name:'Remove layers from Grid'});
    assert.match(await confirm.innerText(),/Remove 2 layers\?/);
    assert.equal(await list.locator('.ds-layer-row[data-layer-id="moon"]').getByRole('alertdialog').count(),1);
    const affirmativeBounds=await confirm.getByRole('button',{name:'Remove',exact:true}).boundingBox();
    assert.ok(Math.abs(affirmativeBounds.x-trashBounds.x)<1 && Math.abs(affirmativeBounds.y-trashBounds.y)<1,'confirmation replaces the trash control in place');
    assert.equal((await list.boundingBox()).height,listBounds.height,'confirmation does not move neighbouring rows');
    await page.keyboard.press('Escape');
    assert.equal(await confirm.count(),0); assert.ok(await remove.evaluate(n=>n===document.activeElement));
    await remove.click(); await confirm.getByRole('button',{name:'Remove',exact:true}).click();
    assert.equal(await list.locator('.ds-layer-row').count(),3);
    assert.equal(await list.locator('.ds-layer-row[data-selected]').count(),0);
    await row('Text').click(); await row('Foreground').click({modifiers:['Shift']});
    assert.ok(await studio.getByRole('button',{name:'Group layers',exact:true}).isDisabled(),'Text cannot enter an artwork group');
    await row('Foreground').click();
    await studio.getByRole('tab',{name:'Color',exact:true}).click();
    const toolbarRemove=studio.getByRole('button',{name:'Delete Foreground from example',exact:true});
    await toolbarRemove.click();
    assert.ok(await confirm.isVisible(),'toolbar removal is available outside the Layers tab');
    await page.keyboard.press('Escape');
    assert.ok(await toolbarRemove.evaluate(n=>n===document.activeElement));
    await toolbarRemove.click(); await confirm.getByRole('button',{name:'Remove',exact:true}).click();
    await studio.getByRole('tab',{name:'Color',exact:true}).and(page.locator(':focus')).waitFor();
    assert.ok(await studio.getByRole('tab',{name:'Color',exact:true}).evaluate(n=>n===document.activeElement));
    await studio.getByRole('tab',{name:'Layers',exact:true}).click();
    assert.equal(await list.locator('.ds-layer-row').count(),2);
    assert.deepEqual(errors,[]); assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage)),[]);
  } finally { await browser.close(); }
});
test('Layers spacing uses real validation and empty/read-only examples preserve safe controls', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const { page, studio, errors } = await mount(browser,390);
    await studio.getByRole('tab',{name:'Layers',exact:true}).click();
    await studio.getByText('Composition spacing',{exact:true}).click();
    await studio.getByRole('button',{name:'Apply to all',exact:true}).click();
    assert.match(await studio.getByRole('alert').innerText(),/overlap/);
    await studio.getByLabel('Layer example',{exact:true}).selectOption('spacing');
    const gutter=studio.getByRole('spinbutton',{name:'Composition gutter',exact:true});
    await gutter.fill('33'); await studio.getByRole('button',{name:'Apply to all',exact:true}).click();
    assert.match(await studio.getByRole('alert').innerText(),/0 and 32/);
    await gutter.fill('2');
    const before=await studio.locator('.ds-layer-scene [data-layer-id="moon"]').getAttribute('style');
    await studio.getByRole('button',{name:'Apply to all',exact:true}).click();
    await studio.getByText('Spacing applied to this example.',{exact:true}).waitFor();
    assert.notEqual(await studio.locator('.ds-layer-scene [data-layer-id="moon"]').getAttribute('style'),before);
    await studio.getByLabel('Layer example',{exact:true}).selectOption('empty');
    assert.equal(await studio.locator('.ds-layer-row').count(),0);
    await studio.getByRole('button',{name:'Add text',exact:true}).click();
    assert.equal(await studio.locator('.ds-layer-row').count(),1);
    await studio.getByRole('button',{name:'Edit Text',exact:true}).click();
    await studio.getByRole('textbox',{name:'Article text',exact:true}).fill('A new layer');
    await studio.getByRole('tab',{name:'Layers',exact:true}).click();
    await studio.getByLabel('Layer example',{exact:true}).selectOption('readonly');
    assert.ok(await studio.getByRole('button',{name:'Add text',exact:true}).isDisabled());
    await studio.locator('.ds-studio-layer-list').getByRole('button',{name:'Artwork',exact:true}).click();
    assert.ok(await studio.getByRole('button',{name:'Studio duplicate',exact:true}).isDisabled());
    assert.ok(await studio.getByRole('button',{name:'Remove Artwork from Grid',exact:true}).isDisabled());
    await studio.getByRole('tab',{name:'Color',exact:true}).click();
    assert.ok(await studio.getByLabel('Studio colour',{exact:true}).isDisabled());
    assert.equal(await studio.getByRole('slider',{name:'Colour hue'}).getAttribute('aria-disabled'),'true');
    assert.deepEqual(errors,[]);
  } finally { await browser.close(); }
});
test('Layers long-list layout, touch selection and keyboard reach remain usable in both themes', { timeout: 90000 }, async () => {
  const browser=await chromium.launch({executablePath,headless:true});
  try {
    for(const width of [1440,390,320]){
      const {page,studio,errors}=await mount(browser,width);
      await studio.getByRole('tab',{name:'Layers',exact:true}).click();
      for(const theme of ['carbon','mist']){
        await page.getByLabel('Preview surface').selectOption(theme);
        await studio.getByLabel('Layer example',{exact:true}).selectOption('long');
        const list=studio.getByRole('group',{name:'Layers, front to back'});
        assert.equal(await list.locator('.ds-layer-row').count(),24);
        assert.ok(await list.evaluate(n=>n.scrollHeight>n.clientHeight));
        await list.getByRole('button',{name:'Study 24',exact:true}).focus(); await page.keyboard.press('End');
        assert.ok(await list.getByRole('button',{name:'Study 01',exact:true}).evaluate(n=>n===document.activeElement));
        await page.keyboard.press('Enter');
        await studio.getByRole('button',{name:'Select multiple layers'}).click();
        await list.getByRole('button',{name:'Study 02',exact:true}).click();
        assert.equal(await list.locator('[data-selected]').count(),2);
        await studio.getByRole('button',{name:'Select multiple layers'}).click();
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1));
        await studio.screenshot({path:output+'/layers-'+theme+'-'+width+'.png'});
      }
      assert.deepEqual(errors,[]);await page.close();
    }
  } finally {await browser.close();}
});


test('Navigator pans live while held and ends or cancels pointer gestures cleanly', { timeout: 60000 }, async () => {
  const browser=await chromium.launch({executablePath,headless:true});
  try {
    for(const width of [1440,390,320]) {
      const {page,studio,errors}=await mount(browser,width);
      const map=studio.getByRole('button',{name:'Navigate example workbench'}), frame=map.locator('.ds-studio-map-view');
      const position=()=>frame.evaluate(n=>({x:parseFloat(n.style.left),y:parseFloat(n.style.top)}));
      for(const theme of ['carbon','mist']) {
        await page.getByLabel('Preview surface').selectOption(theme);
        await studio.getByRole('button',{name:'Reset preview view'}).click();
        await studio.getByLabel('Workspace selection').selectOption(theme === 'carbon' ? 'image' : 'foreground');
        await studio.getByRole('tab',{name:theme==='carbon'?'Image':'Layers',exact:true}).click();
        await studio.getByLabel('Preview zoom',{exact:true}).fill('150');
        await map.scrollIntoViewIfNeeded();
        const bounds=await map.boundingBox(), start={x:bounds.x+bounds.width*.56,y:bounds.y+bounds.height*.5};
        const artwork=studio.locator(theme==='carbon'?'.ds-studio-art-position':'.ds-layer-scene');
        const initialArt=await artwork.getAttribute('style'), initial=await position();
        await page.mouse.move(start.x,start.y); await page.mouse.down();
        assert.deepEqual(await position(),initial,'grabbing inside the view does not jump its centre');
        await page.mouse.move(start.x+bounds.width*.15,start.y+bounds.height*.15,{steps:4});
        const moved=await position();
        assert.ok(moved.x>initial.x+10 && moved.y>initial.y+10,'view updates before mouseup');
        assert.notEqual(await artwork.getAttribute('style'),initialArt,'the canvas updates during the drag');
        assert.equal(await studio.getByLabel('Preview zoom',{exact:true}).inputValue(),'150');
        await page.mouse.move(bounds.x+bounds.width+30,bounds.y+bounds.height+30,{steps:3});
        assert.deepEqual(await position(),{x:90,y:90},'capture continues beyond the map and clamps to its existing limits');
        await page.mouse.up();
        await page.mouse.move(start.x,start.y,{steps:3});
        assert.deepEqual(await position(),{x:90,y:90},'release stops live updates');
        assert.equal(await map.getAttribute('data-dragging'),null);
        await page.mouse.click(bounds.x+bounds.width*.25,bounds.y+bounds.height*.25);
        const clicked=await position();
        assert.ok(Math.abs(clicked.x-25)<1 && Math.abs(clicked.y-25)<1,'clicking outside the frame still centres the view '+JSON.stringify({clicked,bounds,current:await map.boundingBox()}));
        await page.mouse.move(start.x,start.y);await page.mouse.down();
        await page.mouse.move(start.x+10,start.y+10);
        await page.keyboard.press('Escape');await page.mouse.up();
        assert.deepEqual(await position(),clicked,'Escape restores the pre-drag view');
        await page.mouse.down();await page.mouse.move(start.x+15,start.y+15);
        await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.mouse.up();
        assert.deepEqual(await position(),clicked,'losing window focus ends and cancels navigation');
        await map.evaluate(n=>n.addEventListener('pointerdown',e=>{n.dataset.testPointer=String(e.pointerId);},{once:true}));
        await page.mouse.down();await page.mouse.move(start.x+20,start.y+20);
        await map.evaluate(n=>n.releasePointerCapture(Number(n.dataset.testPointer)));
        await page.mouse.move(start.x+25,start.y+25);await page.mouse.up();
        assert.deepEqual(await position(),clicked,'lost capture restores the starting view');
        await map.focus();await page.keyboard.press('ArrowRight');
        assert.ok(Math.abs((await position()).x-clicked.x-5)<.01);
        const keyboard=await position();await page.keyboard.press('Enter');
        assert.deepEqual(await position(),keyboard,'keyboard activation does not use stale pointer coordinates');
        await page.mouse.click(start.x,start.y,{button:'right'});
        assert.deepEqual(await position(),keyboard,'secondary mouse button does not navigate');
        await page.keyboard.press('Escape');
      }
      if(width===390) {
        await studio.getByRole('button',{name:'Reset preview view'}).click();await map.scrollIntoViewIfNeeded();
        const bounds=await map.boundingBox(), x=bounds.x+bounds.width*.5,y=bounds.y+bounds.height*.5;
        const cdp=await page.context().newCDPSession(page), before=await position();
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+20,y:y+15}]});
        assert.ok((await position()).x>before.x+5,'touch also updates while held');
        await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
        assert.deepEqual(await position(),before,'cancelled touch restores the view');
        assert.equal(await map.getAttribute('data-dragging'),null);
        await cdp.detach();
      }
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1));
      assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage)),[]);
      await page.close();
    }
  } finally {await browser.close();}
});

test('Text preview reuses rich editing, selection history, focus writing and search without saving', { timeout: 90000 }, async () => {
  const browser=await chromium.launch({executablePath,headless:true});
  try {
    const {page,studio,errors}=await mount(browser);
    await studio.getByLabel('Workspace selection').selectOption('text');
    await studio.getByRole('button',{name:'Text tools',exact:true}).click();
    await studio.getByLabel('Text example',{exact:true}).selectOption('article');
    const tools=studio.locator('.text-tools-window'), body=page.getByRole('textbox',{name:'Article text',exact:true});
    await body.fill('Hello world. Hello light.');await body.press('Control+A');
    const original=await body.elementHandle();
    await tools.getByRole('button',{name:'Bold',exact:true}).click();
    assert.equal(await body.locator('strong').textContent(),'Hello world. Hello light.');
    await tools.getByLabel('Selected text font',{exact:true}).selectOption('Inscape Article Literata');
    const size=tools.getByLabel('Selected text size',{exact:true});await size.fill('24');await size.press('Enter');
    assert.ok(await body.locator('span').evaluateAll(nodes=>nodes.some(n=>n.style.fontSize==='24px')));
    await studio.getByRole('tab',{name:'Color',exact:true}).click();
    await studio.getByLabel('Studio colour',{exact:true}).fill('#243629');
    await studio.getByLabel('Workspace selection').selectOption('image');
    await studio.getByLabel('Workspace selection').selectOption('text');
    await studio.getByRole('button',{name:'Text tools',exact:true}).click();
    assert.ok(await body.evaluate((n,old)=>n===old,original),'tab/selection changes retain the editor DOM');
    assert.ok(await tools.getByRole('button',{name:'Undo',exact:true}).isEnabled());
    await tools.getByRole('button',{name:'Undo',exact:true}).click();
    assert.ok(await tools.getByRole('button',{name:'Redo',exact:true}).isEnabled());
    await tools.getByRole('button',{name:'Redo',exact:true}).click();
    await tools.getByRole('button',{name:'Focus writing',exact:true}).click();
    const focus=page.getByRole('dialog',{name:'Focus writing',exact:true});
    assert.ok(await focus.isVisible());
    assert.match(await focus.getByRole('status').innerText(),/not saved/);
    assert.ok(await body.evaluate((n,old)=>n===old,original),'focus writing relocates the same editor');
    await page.keyboard.press('Escape');
    assert.ok(await tools.getByRole('button',{name:'Focus writing',exact:true}).evaluate(n=>n===document.activeElement));
    await body.focus();await body.press('Control+f');
    const find=tools.getByLabel('Find in article',{exact:true});
    assert.ok(await find.evaluate(n=>n===document.activeElement));
    await find.fill('Hello');await tools.getByLabel('Replace with',{exact:true}).fill('Hi');
    await tools.getByRole('button',{name:'Replace all',exact:true}).click();
    assert.equal(await body.textContent(),'Hi world. Hi light.');
    await tools.getByRole('button',{name:'Close search',exact:true}).click();
    await body.focus();await body.press('Control+A');
    await tools.getByRole('button',{name:'Link',exact:true}).click();
    await tools.getByLabel('Link URL',{exact:true}).fill('javascript:alert(1)');
    await tools.getByRole('button',{name:'Apply link',exact:true}).click();
    assert.match(await tools.getByRole('alert').innerText(),/HTTPS/);
    await tools.getByLabel('Link URL',{exact:true}).fill('https://example.com/study');
    await tools.getByRole('button',{name:'Apply link',exact:true}).click();
    assert.equal(await body.locator('a').getAttribute('href'),'https://example.com/study');
    await body.focus();await body.press('Control+End');
    const pageBreak=tools.getByRole('button',{name:'Insert page break',exact:true});
    assert.ok(await pageBreak.isVisible(),'page break stays visible outside collapsed Writing tools');
    await pageBreak.click();
    assert.equal(await body.locator('[data-text-page-break]').count(),1);
    await tools.getByRole('button',{name:'Undo',exact:true}).click();
    assert.equal(await body.locator('[data-text-page-break]').count(),0);
    await tools.getByRole('button',{name:'Redo',exact:true}).click();
    assert.equal(await body.locator('[data-text-page-break]').count(),1);
    await openTextToolSection(tools, 'Default text style');
    assert.equal(await body.evaluate(node=>getComputedStyle(node).color),'rgb(35, 44, 38)','selected colour leaves the document default untouched');
    assert.ok(await body.locator('span[style*="color"]').count(), 'shared Color edits the selected text marks');
    assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage)),[]);
  } finally {await browser.close();}
});

test('Text examples retain appearance, artwork and validated backup controls with read-only states', { timeout: 90000 }, async () => {
  const browser=await chromium.launch({executablePath,headless:true});
  try {
    const {page,studio,errors}=await mount(browser,390);
    await studio.getByLabel('Workspace selection').selectOption('text');await studio.getByRole('button',{name:'Text tools',exact:true}).click();
    const scenario=studio.getByLabel('Text example',{exact:true}), tools=studio.locator('.text-tools-window');
    await scenario.selectOption('article');
    const open = name => openTextToolSection(tools, name);
    await open('Default text style');await tools.getByLabel('Default font',{exact:true}).selectOption('literata');
    await tools.getByLabel('Default text size',{exact:true}).fill('18');
    const line=tools.getByLabel('Default line spacing',{exact:true});await line.fill('2');await line.press('Escape');
    assert.equal(await line.inputValue(),'','Escape restores inherited numeric values');
    await open('Title');await tools.getByLabel('Title size',{exact:true}).fill('34');
    await tools.getByRole('button',{name:'Align title center',exact:true}).click();
    assert.equal(await page.getByLabel('Article title',{exact:true}).evaluate(n=>n.style.textAlign),'center');
    await open('Text box layout');await tools.getByLabel('Text columns',{exact:true}).selectOption('2');
    await tools.getByLabel('Text column gap',{exact:true}).fill('16');await tools.getByLabel('Text inner spacing',{exact:true}).selectOption('custom');
    await tools.getByLabel('Text padding left',{exact:true}).fill('10');
    const appearance=await studio.locator('.text-editor-page').evaluate(n=>({columns:n.style.getPropertyValue('--text-columns'),padding:n.style.paddingLeft}));
    assert.deepEqual(appearance,{columns:'2',padding:'10px'});
    await open('Background & edges');
    assert.equal(await tools.locator('input[type="color"]').count(),0,'Text colour belongs to the shared Color tool');
    await tools.getByLabel('Module corners',{exact:true}).selectOption('rounded');
    assert.match(await studio.locator('.ds-text-editor-sample').getAttribute('style'),/8px 8px 8px 8px/);
    await open('Article backup');
    await tools.getByLabel('Open article backup',{exact:true}).setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{}')});
    await tools.getByText('Unsupported article format. The source has not been changed.',{exact:true}).waitFor();
    const pendingDownload=page.waitForEvent('download');await tools.getByRole('button',{name:'Download article backup',exact:true}).click();
    const download=await pendingDownload;
    const {readFile}=await import('node:fs/promises'), saved=JSON.parse(await readFile(await download.path(),'utf8'));
    assert.equal(saved.appearance.columns,2);assert.equal(saved.appearance.fontSize,18);
    await scenario.selectOption('empty');await open('Article backup');
    await tools.getByLabel('Open article backup',{exact:true}).setInputFiles({name:'article.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});
    await tools.getByRole('button',{name:'Replace article with backup',exact:true}).click();
    assert.equal(await page.getByLabel('Article title',{exact:true}).inputValue(),'A quiet place');
    await scenario.selectOption('illustrated');
    await studio.locator('.text-artwork-editor img').click();
    await tools.getByRole('tab', { name: 'Format text', exact: true }).click();
    await tools.getByLabel('Caption',{exact:true}).fill('A changed caption');
    await tools.getByLabel('Alternative text',{exact:true}).fill('Two arches and a moon');
    assert.equal(await studio.locator('.text-artwork-editor img').getAttribute('alt'),'Two arches and a moon');
    await tools.getByRole('button',{name:'Move artwork down',exact:true}).click();
    await tools.getByRole('button',{name:'Remove artwork',exact:true}).click();
    assert.equal(await studio.locator('.text-artwork-editor').count(),0);
    await tools.getByRole('button',{name:'Undo',exact:true}).click();
    assert.equal(await studio.locator('.text-artwork-editor').count(),1);
    await scenario.selectOption('empty');await open('Title');
    assert.ok(await tools.getByLabel('Title size',{exact:true}).isDisabled());
    await scenario.selectOption('readonly');
    await tools.getByRole('tab', { name: 'Format text', exact: true }).click();
    assert.ok(await tools.getByRole('button',{name:'Bold',exact:true}).isDisabled());
    assert.equal(await page.getByRole('textbox',{name:'Article text',exact:true}).getAttribute('contenteditable'),'false');
    await open('Article backup');assert.ok(await tools.getByLabel('Open article backup',{exact:true}).isDisabled());
    assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage)),[]);
  } finally {await browser.close();}
});

test('Text examples keep articles and undo independent across duplicates and scene resets', { timeout: 60000 }, async () => {
  const browser=await chromium.launch({executablePath,headless:true});
  try {
    const {page,studio,errors}=await mount(browser);
    const selection=studio.getByLabel('Workspace selection');
    await selection.selectOption('text');await studio.getByRole('button',{name:'Text tools',exact:true}).click();
    await studio.getByLabel('Text example',{exact:true}).selectOption('article');
    const body=page.getByRole('textbox',{name:'Article text',exact:true});
    await body.fill('Original article');
    await studio.getByRole('button',{name:'Studio duplicate',exact:true}).click();
    const duplicate=await selection.inputValue();
    await body.fill('Independent copy');
    await selection.selectOption('text');
    assert.equal(await body.textContent(),'Original article');
    await selection.selectOption(duplicate);
    assert.equal(await body.textContent(),'Independent copy');
    await studio.getByRole('tab',{name:'Layers',exact:true}).click();
    await studio.getByLabel('Layer example',{exact:true}).selectOption('empty');
    await studio.getByLabel('Layer example',{exact:true}).selectOption('composition');
    const ids=await selection.locator('option').evaluateAll(nodes=>nodes.map(n=>n.value));
    assert.equal(new Set(ids).size,ids.length,'fresh Layers samples cannot collide with standalone article IDs');
    await selection.selectOption(duplicate);await studio.getByRole('button',{name:'Text tools',exact:true}).click();
    assert.equal(await body.textContent(),'Independent copy');
    await studio.getByRole('button',{name:'Undo',exact:true}).click();
    assert.equal(await body.textContent(),'Original article');
    await studio.getByLabel('Text example',{exact:true}).selectOption('readonly');
    await studio.getByRole('tab',{name:'Color',exact:true}).click();
    assert.ok(await studio.getByLabel('Studio colour',{exact:true}).isDisabled());
    await studio.getByRole('button',{name:'Reset workspace',exact:true}).click();
    await selection.selectOption('text');await studio.getByRole('button',{name:'Text tools',exact:true}).click();
    assert.equal(await body.textContent(),'A quiet place');
    assert.ok(await studio.getByRole('button',{name:'Undo',exact:true}).isDisabled());
    assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage)),[]);
  } finally {await browser.close();}
});
