import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
const origin=process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:24970';
const output=process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime/sidebar';
const settle=p=>p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const hit=n=>{const r=n.getBoundingClientRect();return n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));};
const interactionState = page => page.locator('main.system-workflow').evaluate(node => ({
  camera: { zoom: node.querySelector('.navigator-zoom output')?.textContent,
    frames: [...node.querySelectorAll('[data-workbench-view-id]')].map(module => ({ id: module.dataset.workbenchViewId, rect: module.getBoundingClientRect().toJSON() })) },
  selection: node.querySelector('.workbench-view-controls__selection-count')?.textContent,
  activeTargets: [...node.querySelectorAll('[data-workbench-view-id][data-window-active]')].map(module => module.dataset.workbenchViewId),
}));
async function mount(browser,width=1440,height=900,theme='mist') {
 const page=await browser.newPage({viewport:{width,height},hasTouch:width<900,reducedMotion:'reduce'});
 page.setDefaultTimeout(12000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin===origin)return route.continue();if(u.hostname==='raw.githubusercontent.com'&&u.pathname.includes('/public/'))return route.fulfill({path:'public/'+u.pathname.split('/public/')[1]});return route.abort();});
 await page.goto(`${origin}/browser-tests/tool-chrome-fixture.html?sample=navigator&theme=${theme}`);
 await page.locator('.keeper-dock-window').waitFor();await page.locator('.workbench-sidebar').waitFor();
 await page.locator('[data-navigator-object^="image:"] image').waitFor();await settle(page);
 const sidebar=page.getByRole('complementary',{name:'Workspace sidebar'});
 const button=name=>sidebar.getByRole('button',{name,exact:true,includeHidden:true});
 const activate = async name => { if (!await button(name).isVisible()) await button('Expand sidebar').click(); await button(name).click(); };
 return {page,sidebar,button,activate,errors};
}
for(const theme of ['carbon','mist']) for(const [width,height] of [[1440,900],[390,900],[320,568],[844,390]]) test(`Sidebar routes and chrome stay reachable (${theme} ${width}x${height})`,{timeout:60000},async()=>{
 const browser=await chromium.launch({executablePath:browserExecutable,headless:true});
 try {
  const {page,sidebar,button,activate,errors}=await mount(browser,width,height,theme);
  const initial=await page.evaluate(()=>window.readToolChromeDraft());
  await mkdir(output,{recursive:true});await page.screenshot({path:`${output}/${theme}-${width}.png`});
  assert.equal(await page.locator('.system-workflow__global-bar').count(),0);
  const camera = () => page.locator('main.system-workflow').evaluate(n => [n.dataset.workbenchCameraX,n.dataset.workbenchCameraY,n.dataset.workbenchCameraScale]);
  const beforeCamera = await camera();
  await sidebar.dispatchEvent('wheel',{deltaY:90,bubbles:true,cancelable:true});await settle(page);
  assert.deepEqual(await camera(),beforeCamera,'sidebar scrolling does not move the canvas');
  const home=page.getByRole('button',{name:'Reset Workbench view',exact:true});
  assert.equal(await home.evaluate(hit),true,'Navigator Home is not covered');
  assert.equal(await page.getByRole('button',{name:'Keeper settings',exact:true}).evaluate(hit),true,'Keeper remains reachable');
  if(await button('Expand sidebar').isVisible()) await button('Expand sidebar').click();
  await page.screenshot({path:`${output}/${theme}-${width}-expanded.png`});
  await sidebar.screenshot({path:`${output}/${theme}-${width}-navigation.png`});
  assert.equal(await sidebar.getByRole('searchbox',{name:'Filter navigation'}).count(),0);
  await button('Collapse sidebar').click();
  assert.equal(await button('Expand sidebar').evaluate(n=>getComputedStyle(n).outlineStyle),'none','pointer does not leave focus border');
  await button('Expand sidebar').press('Tab');await page.keyboard.press('Shift+Tab');
  assert.notEqual(await button('Expand sidebar').evaluate(n=>getComputedStyle(n).outlineStyle),'none','keyboard focus stays visible');
  await activate('Docs');await page.getByRole('dialog',{name:'Docs',exact:true}).waitFor();
  await page.getByRole('button',{name:'Close Docs'}).click();
  await page.waitForFunction(node=>node===document.activeElement,await button(width===320 ? 'Expand sidebar' : 'Docs').elementHandle());
  assert.equal(await button(width===320 ? 'Expand sidebar' : 'Docs').evaluate(n=>document.activeElement===n),true,'panel close returns focus');
  for(const [label,id] of [['Settings','settings'],['Activity','activity'],['Grids','grids'],['Profile','profile']]) {
   await activate(label);await page.locator(`[data-system-workflow-panel="${id}"] aside`).first().waitFor();
   assert.equal(await button(label).getAttribute('aria-expanded'),'true');
   await activate('Editor');await settle(page);
   assert.equal(await page.locator(`[data-system-workflow-panel="${id}"]`).count(),0);
  }
  await activate('Discover');
  const discover=page.locator('[data-system-workflow-panel="discover"] .public-entry-portal');await discover.waitFor();await settle(page);
  const search=discover.getByRole('searchbox',{name:'Search published worlds'}),back=discover.getByRole('button',{name:'Return to workspace'});
  assert.equal(await back.evaluate(hit),true,'Discover return stays clear of sidebar');
  assert.equal(await search.evaluate(hit),true,'Discover search is reachable');
  assert.ok((await search.boundingBox()).width>=80,'search retains usable typing space');
  assert.equal(await discover.locator('.public-entry-portal__header').evaluate(n=>n.scrollWidth<=n.clientWidth),true,'header has no horizontal overflow');
  assert.equal(await discover.getAttribute('data-menu-surface'),theme,'Discover follows the editor theme');
  assert.equal(await search.evaluate(n=>getComputedStyle(n).borderRadius),'5px','Workbench reset does not override the field recipe');
  assert.ok((await search.boundingBox()).height >= (width < 900 ? 44 : 28),'field retains the shared pointer target');
  await discover.locator('.public-entry-portal__account-trigger').click();
   const beforeAccountEscape = await interactionState(page);
   assert.equal(beforeAccountEscape.selection, '1 selected', 'account Escape starts with selected artwork');
   assert.deepEqual(beforeAccountEscape.activeTargets, [await page.evaluate(() => window.readToolChromeDraft().texts[0].id)], 'account cancellation retains the original Text target');
  await discover.getByRole('button',{name:'Disconnect',exact:true}).focus();await page.keyboard.press('Escape');
  assert.equal(await discover.isVisible(),true,'account Escape does not close the owner panel');
  assert.equal(await discover.locator('.public-entry-portal__account-menu').count(),0);
   const afterAccountEscape = await interactionState(page);
   assert.deepEqual(afterAccountEscape, beforeAccountEscape, 'account Escape preserves selected artwork and camera');
   const trigger = discover.locator('.public-entry-portal__account-trigger');
   assert.equal(await trigger.evaluate(node => node === document.activeElement), true, 'account Escape restores trigger focus');
   await trigger.click();
   // Discovery is asynchronous. Native Tab can only reach the next portal
   // action after a result or retry button has become available.
   await discover.locator('main button:enabled').first().waitFor();
   await discover.getByRole('button',{name:'Disconnect',exact:true}).focus();
   await page.keyboard.press('Tab');
   const outsideAccount = await discover.evaluate(node => ({
     valid: node.contains(document.activeElement) && document.activeElement?.matches('button') && !document.activeElement.closest('.public-entry-portal__account'),
     label: document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent,
   }));
   assert.equal(outsideAccount.valid, true, 'native Tab reaches another portal button outside the account group');
   assert.equal(await discover.locator('.public-entry-portal__account-menu').count(), 1, 'Tab keeps the account menu open');
   await page.keyboard.press('Escape');
   assert.equal(await discover.locator('.public-entry-portal__account-menu').count(), 0, 'Escape outside account group still closes its open menu');
   assert.equal(await discover.isVisible(), true, 'outside-group Escape keeps Discover open');
   const afterTabEscape = await interactionState(page);
   assert.deepEqual(afterTabEscape, beforeAccountEscape, 'outside-group Escape preserves selected artwork and camera');
   assert.equal(await trigger.evaluate(node => node === document.activeElement), true, 'outside-group Escape restores account trigger focus');
   await writeFile(`${output}/account-escape-${theme}-${width}.json`, JSON.stringify({ beforeAccountEscape, afterAccountEscape, outsideAccount, afterTabEscape, triggerFocused: true }, null, 2));
  await search.fill('Surface');assert.equal(await search.inputValue(),'Surface');
  await page.screenshot({path:`${output}/discover-${theme}-${width}.png`});
  await back.click();await discover.waitFor({state:'detached'});
  await page.waitForFunction(node=>node===document.activeElement,await button(width===320?'Expand sidebar':'Discover').elementHandle());
  assert.equal(await button(width===320?'Expand sidebar':'Discover').evaluate(n=>document.activeElement===n),true,'Discover restores its visible navigation trigger');
  await activate('Discover');await discover.waitFor();await activate('Editor');await settle(page);
  assert.equal(await discover.count(),0,'sidebar remains usable from Discover');
  if(width===1440 || width===390) {
   await button('Publish').click();await page.getByRole('complementary',{name:'Publish profile'}).waitFor();
   await page.getByRole('button',{name:'Close Publication',exact:true}).click();await settle(page);
  }
  await activate('Library');await page.getByRole('region',{name:'Library workspace'}).waitFor();await settle(page);
  const tree=page.locator('.lattice-browser-sidebar');assert.equal(await tree.count(),1,'one Library tree');
  assert.equal(await tree.isVisible(),true);
  if(width===1440) {
   await button('Expand sidebar').click();await settle(page);
   assert.equal(await sidebar.locator('.lattice-browser-sidebar').count(),1);
   const s=await sidebar.boundingBox(),l=await page.getByRole('region',{name:'Library workspace'}).boundingBox();
   assert.ok(l.x>=s.x+s.width,JSON.stringify({s,l}));
   await page.screenshot({path:`${output}/library-${theme}.png`});
   await button('Collapse sidebar').click();await settle(page);
   assert.equal(await page.getByRole('region',{name:'Library workspace'}).locator('.lattice-browser-sidebar').count(),1,'collapsing returns categories to Library');
  }
  await activate('Editor');await settle(page);
  assert.deepEqual(await page.evaluate(()=>window.readToolChromeDraft()),initial,'navigation does not edit the composition');
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
test('Sidebar collapse follows Workbench switches, preview and explicit hide/reopen',{timeout:60000},async()=>{
 const browser=await chromium.launch({executablePath:browserExecutable,headless:true});
 try {
  const {page,button,errors}=await mount(browser);
  await button('Collapse sidebar').click();
  await page.getByRole('button',{name:'New',exact:true}).click();await page.getByLabel('New Workbench name',{exact:true}).fill('Sidebar check');
  await page.getByRole('button',{name:'Create Workbench',exact:true}).click();await button('Expand sidebar').waitFor();
  await page.getByRole('combobox',{name:'Active Workbench'}).selectOption({label:'Workbench 1'});await button('Expand sidebar').waitFor();
  await button('Preview').click();await page.getByRole('button',{name:'EXIT',exact:true}).waitFor();
  assert.equal(await page.locator('.workbench-sidebar').isVisible(),false);assert.equal(await page.getByRole('complementary',{name:'Workspace sidebar'}).count(),0,'hidden navigation is absent from accessibility');
  await page.getByRole('button',{name:'EXIT',exact:true}).click();await button('Expand sidebar').waitFor();
  await page.waitForFunction(node=>node===document.activeElement,await button('Preview').elementHandle());
  assert.equal(await button('Preview').evaluate(n=>n===document.activeElement),true,'Preview returns focus to its retained sidebar trigger');
  const host=page.locator('main.system-workflow').first();await host.focus();await page.keyboard.press('Shift+F10');
  await page.getByRole('menuitem',{name:'HIDE SIDEBAR',exact:true}).click();assert.equal(await page.locator('.workbench-sidebar').count(),0);
  await host.focus();await page.keyboard.press('Shift+F10');await page.getByRole('menuitem',{name:'SHOW SIDEBAR',exact:true}).click();await button('Expand sidebar').waitFor();
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
