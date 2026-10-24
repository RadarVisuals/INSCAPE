import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
const origin = process.env.INSCAPE_TEST_ORIGIN || 'http://127.0.0.1:24970';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime/discover-style';
const hit = node => { const r = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(r.x + r.width/2, r.y + r.height/2)); };
async function open(browser, width, height, query) {
 const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
 page.setDefaultTimeout(12000);
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*', route => {
   const url = new URL(route.request().url());
   if (url.origin === origin) return route.continue();
   const source = url.hostname === 'raw.githubusercontent.com' && url.pathname.split('/public/')[1];
   return source ? route.fulfill({ path: 'public/' + source }) : route.abort();
 });
 await page.goto(origin + '/browser-tests/discover-style-fixture.html?' + query);
 await mkdir(output, { recursive: true });
 return { page, errors };
}
for (const theme of ['carbon','mist']) for (const [width,height] of [[1440,900],[390,844],[844,390],[320,320]]) {
 test('Discover flat ' + theme + ' ' + width + 'x' + height, { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
   const {page,errors} = await open(browser,width,height,'connected&theme='+theme);
   await page.getByRole('button',{name:'Open Discover'}).click();
   const portal=page.locator('.public-entry-portal'), search=page.getByRole('searchbox',{name:'Search published worlds'});
   await page.getByRole('status').filter({hasText:'12 of 25 worlds'}).waitFor();
   await page.locator('.public-entry-portal__world-card').first().locator('img.is-ready').first().waitFor();
   await page.evaluate(()=>document.fonts.ready);
   assert.equal(await search.evaluate(n=>n===document.activeElement),false,'pointer opening does not focus search');
   const restingBorder = await search.evaluate(n=>getComputedStyle(n.parentElement).borderColor);
   await search.click();
   assert.equal(await search.evaluate(n=>getComputedStyle(n).outlineStyle),'none','no pointer focus rectangle');
   assert.equal(await search.evaluate(hit),true);
   const header=portal.locator('.public-entry-portal__header'), bounds=await header.boundingBox();
   assert.equal(await header.evaluate(n=>n.scrollWidth<=n.clientWidth),true,'no header overflow');
   assert.ok((await search.boundingBox()).width>=100,'usable search width');
   assert.equal(await portal.evaluate(n=>n.scrollWidth<=n.clientWidth),true);
   const material=await portal.evaluate(n=>({face:getComputedStyle(n).backgroundColor,shadow:getComputedStyle(n.querySelector('article')).boxShadow}));
   assert.equal(material.face,theme==='carbon'?'rgb(25, 27, 27)':'rgb(235, 236, 231)');
   assert.equal(material.shadow,'none');
   await page.waitForFunction(() => [...document.querySelectorAll('.public-entry-portal__world-card')].filter(n=>n.getBoundingClientRect().top < n.parentElement.getBoundingClientRect().bottom).every(n=>n.querySelectorAll('img.is-ready').length===2));
   assert.equal(await page.locator('.public-entry-portal__world-card').first().evaluate(n=>n.querySelector('footer').getBoundingClientRect().bottom <= n.getBoundingClientRect().bottom),true,'publisher stays inside its card');
   await page.screenshot({path:output+'/'+theme+'-'+width+'x'+height+'.png'});
   const more=page.getByRole('button',{name:'Show more worlds'});
   assert.equal(await more.evaluate(hit),true,'pagination stays reachable');
   await more.click(); await page.getByRole('status').filter({hasText:'24 of 25 worlds'}).waitFor();
   await search.fill('World 25');
   await page.getByRole('button',{name:'Enter World 25',exact:true}).click();
   assert.deepEqual(await page.evaluate(()=>window.discoverReview.visits),['0x0000000000000000000000000000000000000019']);
   await search.fill('does-not-exist'); await page.getByRole('status').filter({hasText:'No worlds found'}).waitFor();
   await search.fill(''); await page.getByRole('status').filter({hasText:'12 of 25 worlds'}).waitFor();
   await portal.locator('.public-entry-portal__world-grid').evaluate(n=>n.scrollTop=n.scrollHeight);
   assert.equal((await header.boundingBox()).y,bounds.y,'scrolling retains header');
   await portal.locator('.public-entry-portal__world-grid').evaluate(n=>n.scrollTop=0);
   const account=page.getByRole('button',{name:'Artist with a long profile name'});
   await account.click();
   const disconnect=page.getByRole('button',{name:'Disconnect',exact:true});
   assert.equal(await disconnect.evaluate(hit),true,'account controls inside low viewport');
   await disconnect.focus(); await page.keyboard.press('Escape');
   assert.equal(await portal.count(),1,'Escape closes account menu before Discover');
   assert.equal(await account.evaluate(n=>n===document.activeElement),true);
   await page.keyboard.press('Escape'); await portal.waitFor({state:'detached'});
   await page.getByRole('button',{name:'Open Discover'}).focus(); await page.keyboard.press('Enter');
   await search.waitFor(); assert.equal(await search.evaluate(n=>n===document.activeElement),true,'keyboard opening focuses search');
   assert.notEqual(await search.evaluate(n=>getComputedStyle(n.parentElement).borderColor),restingBorder,'keyboard focus changes the search border');
   assert.deepEqual(errors,[]);
  } finally { await browser.close(); }
 });
}
test('Discover loading, retry, account actions and forced colors', {timeout:60000},async()=>{
 const browser=await chromium.launch({executablePath:browserExecutable,headless:true});
 try {
  const {page,errors}=await open(browser,390,600,'delay');
  await page.getByRole('button',{name:'Open Discover'}).click();
  await page.getByRole('status').filter({hasText:'Loading published worlds'}).waitFor();
  assert.equal(await page.getByText('Try another name or profile address.').count(),0);
  await page.evaluate(()=>window.resolveDirectory());
  await page.getByRole('status').filter({hasText:'12 of 25 worlds'}).waitFor();
  await page.goto(origin+'/browser-tests/discover-style-fixture.html?error&connected');
  await page.getByRole('button',{name:'Open Discover'}).click();
  await page.getByRole('alert').filter({hasText:'Public directory unavailable'}).waitFor();
  await page.screenshot({path:output+'/directory-error.png'});
  await page.getByRole('button',{name:'Retry Discover'}).click();
  await page.getByRole('status').filter({hasText:'12 of 25 worlds'}).waitFor();
  assert.equal(await page.evaluate(()=>window.discoverReview.requests),2);
  await page.getByRole('button',{name:'Artist with a long profile name'}).click();
  await page.getByRole('button',{name:'Enter my world',exact:true}).click();
  await page.getByRole('button',{name:'Artist with a long profile name'}).click();
  await page.getByRole('button',{name:'Disconnect',exact:true}).click();
  assert.deepEqual(await page.evaluate(()=>[window.discoverReview.entered,window.discoverReview.disconnects]),[1,1]);
  await page.emulateMedia({forcedColors:'active'});
  await page.getByRole('searchbox').focus(); await page.keyboard.press('Tab');
  assert.notEqual(await page.locator(':focus').evaluate(n=>getComputedStyle(n).outlineStyle),'none');
  await page.screenshot({path:output+'/forced-colors.png'});
  assert.deepEqual(errors,[]);
 } finally { await browser.close(); }
});
test('shared landing remains scrollable on low screens and connects without entering a card', {timeout:60000},async()=>{
 const browser=await chromium.launch({executablePath:browserExecutable,headless:true});
 try {
  const {page,errors}=await open(browser,390,320,'landing');
  const connect=page.getByRole('button',{name:'Connect profile',exact:true});
  await connect.click(); assert.equal(await page.evaluate(()=>window.discoverReview.connects),1);
  assert.equal(await page.locator('.public-entry-portal__header').evaluate(n=>n.getBoundingClientRect().y),0);
  await page.screenshot({path:output+'/landing-low.png'});
  await page.getByRole('button',{name:'Discover',exact:true}).first().click();
  await page.getByRole('searchbox').waitFor();
  await page.keyboard.press('Escape'); await page.getByRole('button',{name:'Connect profile',exact:true}).waitFor();
  assert.deepEqual(errors,[]);
 } finally { await browser.close(); }
});
