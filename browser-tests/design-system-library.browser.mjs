import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright-core';
const origin=process.env.INSCAPE_TEXT_ROOT||'http://127.0.0.1:5225';
const executablePath=process.env.INSCAPE_BROWSER_EXECUTABLE||['C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',chromium.executablePath()].find(existsSync);
async function mount(browser,width=1440){
 const page=await browser.newPage({viewport:{width,height:1100},hasTouch:width<520}),errors=[],remote=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin===origin)return route.continue();remote.push(url.href);return route.abort();});
 await page.goto(origin+'/design-system.html#components');const studio=page.locator('.ds-studio');
 await studio.getByRole('button',{name:'Artwork library',exact:true}).click();const library=page.locator('.ds-library-preview');await library.waitFor();
 const clean=async()=>{assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage)),[]);};
 return {page,studio,library,clean};
}

test('Library browsing preserves filters, attachments and selection when closed, without touching the canvas', {timeout:60000},async()=>{
 const browser=await chromium.launch({executablePath,headless:true});
 try{
  const {page,studio,library,clean}=await mount(browser),search=studio.getByRole('searchbox',{name:'Search',exact:true});
  const selection=await studio.getByLabel('Workspace selection').inputValue();
  assert.ok(await search.evaluate(n=>n===document.activeElement));
  assert.equal(await library.locator('.lattice-browser-asset').count(),7);
  await studio.getByRole('button',{name:'Show 3 images of Arch study',exact:true}).click();
  assert.equal(await library.locator('.lattice-browser-asset').count(),9);
  assert.match(await studio.getByRole('button',{name:'All Assets',exact:true}).innerText(),/7/);
  await studio.getByRole('button',{name:'Owned',exact:true}).click();assert.equal(await library.locator('.lattice-browser-asset').count(),7);
  await studio.getByRole('button',{name:'Created',exact:true}).click();assert.equal(await library.locator('.lattice-browser-asset').count(),2);
  await studio.getByRole('button',{name:'All Assets',exact:true}).click();await search.fill('moon');
  assert.equal(await library.locator('.lattice-browser-asset').count(),1);
  await studio.getByRole('button',{name:'Close workspace',exact:true}).click();assert.ok(await library.isHidden());
  const trigger=studio.getByRole('button',{name:'Artwork library',exact:true});assert.ok(await trigger.evaluate(n=>n===document.activeElement));
  await trigger.click();assert.equal(await search.inputValue(),'moon');await search.fill('');
  assert.ok(await studio.getByRole('button',{name:'Fold 3 images of Arch study',exact:true}).isVisible());
  await studio.getByRole('button',{name:'Filters: All',exact:true}).click();await page.getByRole('radio',{name:'Light studies',exact:true}).click();await page.keyboard.press('Escape');
  assert.equal(await library.locator('.lattice-browser-asset').count(),3);
  await studio.getByRole('button',{name:'Sort assets: A–Z',exact:true}).click();await page.getByRole('option',{name:'Z–A',exact:true}).click();
  assert.match(await library.locator('.lattice-browser-asset').first().getAttribute('aria-label'),/Studio collection/);
  await studio.getByLabel('Labels',{exact:true}).uncheck();assert.equal(await library.locator('.lattice-browser-asset__record').count(),0);
  await studio.getByLabel('Card size',{exact:true}).fill('90');
  await studio.getByRole('button',{name:'Studio collection / Light studies',exact:true}).click();
  await studio.getByRole('button',{name:'Back to Created',exact:true}).waitFor();await studio.getByRole('button',{name:'Back to Created',exact:true}).click();
  assert.equal(await studio.getByLabel('Workspace selection').inputValue(),selection);
  assert.equal(await studio.getByRole('tab',{name:'Image',exact:true}).getAttribute('aria-selected'),'true');
  await search.focus();await search.press('Escape');assert.ok(await library.isHidden());
  await studio.getByRole('button',{name:'Reset workspace',exact:true}).click();await trigger.click();
  assert.ok(await studio.getByLabel('Labels',{exact:true}).isChecked());
  assert.equal(await studio.getByLabel('Card size',{exact:true}).inputValue(),'150');
  assert.equal(await search.inputValue(),'');
  assert.equal(await library.locator('.lattice-browser-asset').count(),7);await clean();
 }finally{await browser.close();}
});

test('Library organization uses real category commands, inline confirmation and drag membership', {timeout:60000},async()=>{
 const browser=await chromium.launch({executablePath,headless:true});
 try{
  const {page,studio,library,clean}=await mount(browser);
  await studio.getByRole('button',{name:'Create Category',exact:true}).click();const name=studio.getByRole('textbox',{name:'category name',exact:true});
  await name.fill('New studies');await name.press('Enter');
  const category=studio.getByRole('button',{name:'New studies',exact:true});await category.waitFor();await category.click({button:'right'});
  await page.getByRole('menuitem',{name:'Rename',exact:true}).click();assert.equal(await name.inputValue(),'New studies');
  await name.fill('Renamed studies');await name.press('Enter');
  await studio.getByRole('button',{name:'All Assets',exact:true}).click();
  const moon=studio.getByRole('button',{name:'Moon garden / Shape studies',exact:true});await moon.click();await moon.press('Shift+F10');
  await page.getByRole('menuitemcheckbox',{name:'Renamed studies',exact:true}).click();
  await studio.getByRole('button',{name:'Renamed studies',exact:true}).click();assert.equal(await library.locator('.lattice-browser-asset').count(),1);
  await studio.getByRole('button',{name:'All Assets',exact:true}).click();
  const arch=studio.getByRole('button',{name:'Arch study / Shape studies',exact:true}),materials=studio.getByRole('button',{name:'Materials',exact:true});
  await materials.scrollIntoViewIfNeeded();
  const from=await arch.boundingBox(),to=await materials.boundingBox();
  await page.mouse.move(from.x+from.width/2,from.y+15);await page.mouse.down();await page.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:8});await page.mouse.up();
  await materials.click();assert.equal(await library.locator('.lattice-browser-asset').count(),2);
  const section=studio.getByRole('button',{name:'Current project',exact:false});await section.click({button:'right'});
  await page.getByRole('menuitem',{name:'Rename',exact:true}).click();const sectionName=studio.getByRole('textbox',{name:'section name',exact:true});assert.equal(await sectionName.inputValue(),'Current project');
  await sectionName.press('Escape');await section.click({button:'right'});await page.getByRole('menuitem',{name:'Delete section',exact:false}).click();
  // This command opens a submenu whose leaf retains the categories.
  const keep=page.getByRole('menuitem',{name:'keep categories',exact:false});if(await keep.count())await keep.click();
  await studio.getByRole('button',{name:'Delete Current project',exact:true}).click();assert.ok(await materials.isVisible());
  await studio.getByRole('button',{name:'Renamed studies',exact:true}).click({button:'right'});await page.getByRole('menuitem',{name:'Delete',exact:true}).click();
  await studio.getByRole('button',{name:'Cancel deleting Renamed studies',exact:true}).click();
  assert.ok(await studio.getByRole('button',{name:'Renamed studies',exact:true}).isVisible());await clean();
 }finally{await browser.close();}
});

test('Library empty, loading and recoverable failures fit both themes on wide and narrow screens', {timeout:90000},async()=>{
 const browser=await chromium.launch({executablePath,headless:true});
 try{for(const width of [1440,390,320])for(const theme of ['carbon','mist']){
  const {page,studio,library,clean}=await mount(browser,width);await page.getByLabel('Preview surface').selectOption(theme);
  const scenario=studio.getByLabel('Library example',{exact:true});
  await scenario.selectOption('loading');await studio.getByText('Loading assets',{exact:true}).waitFor();assert.equal(await library.locator('.lattice-browser-asset').count(),0);
  await scenario.selectOption('empty');await studio.getByText('No assets in this view',{exact:true}).waitFor();
  await scenario.selectOption('unavailable');await studio.getByRole('button',{name:'Retry assets',exact:true}).click();assert.equal(await scenario.inputValue(),'browse');
  await scenario.selectOption('retained');assert.equal(await library.locator('.lattice-browser-asset').count(),7);await studio.getByText(/Previous example results/).waitFor();
  await scenario.selectOption('created-error');await studio.getByRole('button',{name:'Retry created works',exact:true}).click();
  const create=studio.getByRole('button',{name:'Create Category',exact:true});
  assert.ok(await studio.evaluate(n=>{const row=n.querySelector('.system-workflow__library-create-row'),next=row.nextElementSibling;return row.getBoundingClientRect().bottom<=next.getBoundingClientRect().top+1 && [...row.children].every(c=>c.getBoundingClientRect().bottom<=row.getBoundingClientRect().bottom+1); }),'creation controls do not overlap categories');
  assert.ok(await create.evaluate(n=>{const s=n.querySelector('span'),r=s.getBoundingClientRect(),b=n.getBoundingClientRect();return r.width>=s.scrollWidth-1&&r.right<=b.right+1;}),'Create Category label fits');
  await create.click();await studio.getByLabel('category name',{exact:true}).fill('Touch sample');await studio.getByLabel('category name',{exact:true}).press('Enter');
  const geometry=await library.evaluate(n=>({width:n.clientWidth,scroll:n.scrollWidth,body:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth}));assert.ok(geometry.scroll<=geometry.width+1 && geometry.body<=geometry.viewport+1,JSON.stringify(geometry));
  await clean();await page.close();
 }}finally{await browser.close();}
});

test('Sidebar keeps one Library tree and preserves the canvas, camera and browsing state when collapsed', {timeout:60000}, async()=>{
 const browser=await chromium.launch({executablePath,headless:true});
 try {
  const {page,studio,library,clean}=await mount(browser);
  await studio.getByLabel('Workspace selection',{exact:true}).selectOption('foreground');
  await studio.getByRole('tab',{name:'Layers',exact:true}).click();
  await studio.getByLabel('Preview zoom',{exact:true}).fill('125');
  await studio.getByRole('button',{name:'Navigate example workbench',exact:true}).press('ArrowRight');
  const camera=await studio.locator('.ds-studio-map').innerHTML();
  assert.equal(await studio.getByRole('navigation',{name:'Browser navigation',exact:true}).count(),1);
  assert.equal(await library.getByRole('navigation',{name:'Browser navigation',exact:true}).count(),0);
  await studio.getByRole('button',{name:'Owned',exact:true}).click();
  await studio.getByRole('searchbox',{name:'Search',exact:true}).fill('moon');
  await studio.getByRole('button',{name:'Collapse sidebar',exact:true}).click();
  assert.ok(await studio.getByRole('button',{name:'Expand sidebar',exact:true}).isVisible());
  await studio.getByRole('button',{name:'Expand sidebar',exact:true}).click();
  assert.equal(await studio.getByRole('searchbox',{name:'Search',exact:true}).inputValue(),'moon');
  assert.equal(await studio.getByRole('button',{name:'Owned',exact:true}).getAttribute('aria-pressed'),'true');
  assert.equal(await studio.getByLabel('Workspace selection',{exact:true}).inputValue(),'foreground');
  assert.equal(await studio.getByRole('tab',{name:'Layers',exact:true}).getAttribute('aria-selected'),'true');
  assert.equal(await studio.getByLabel('Preview zoom',{exact:true}).inputValue(),'125');
  assert.equal(await studio.locator('.ds-studio-map').innerHTML(),camera);
  await studio.getByRole('button',{name:'Close workspace',exact:true}).click();
  await studio.getByRole('button',{name:'Library',exact:true}).click();
  assert.equal(await studio.getByRole('searchbox',{name:'Search',exact:true}).inputValue(),'moon');
  await studio.getByRole('button',{name:'Close workspace',exact:true}).click();
  assert.ok(await studio.getByRole('button',{name:'Library',exact:true}).evaluate(n=>n===document.activeElement));
  assert.equal(await studio.getByRole('searchbox',{name:'Filter navigation',exact:true}).count(),0);
  assert.equal(await studio.getByRole('button',{name:'Workbench',exact:true}).count(),1);
  await studio.getByRole('button',{name:'Reset preview view',exact:true}).click();
  const output=process.env.INSCAPE_BROWSER_OUTPUT;
  if(output){
   await mkdir(output,{recursive:true});
   for(const theme of ['carbon','mist']){
    await page.getByLabel('Preview surface').selectOption(theme);
    await studio.locator('.ds-studio-shell').screenshot({path:output+`/sidebar-${theme}.png`});
   }
   await studio.getByRole('button',{name:'Library',exact:true}).click();
   await studio.getByRole('searchbox',{name:'Search',exact:true}).fill('');
   await studio.getByRole('button',{name:'All Assets',exact:true}).click();
   await studio.locator('.ds-studio-shell').screenshot({path:output+'/sidebar-library.png'});
   await studio.getByRole('button',{name:'Collapse sidebar',exact:true}).click();
   await studio.locator('.ds-studio-shell').screenshot({path:output+'/sidebar-collapsed.png'});
   await page.setViewportSize({width:390,height:1000});
   await studio.locator('.ds-studio-shell').screenshot({path:output+'/sidebar-narrow.png'});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  await clean();
 } finally { await browser.close(); }
});
