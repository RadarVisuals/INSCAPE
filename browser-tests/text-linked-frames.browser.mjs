import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { mountTextToolsFixture } from './fixtures/text-tools-fixture.mjs';
import { setWorkbenchZoom } from './fixtures/workbench-zoom.mjs';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5173';
const settle = page => page.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
const story = 'The keeper travels through the Underneath. Every creature carries a fragment of this world, and every fragment has a story that continues beyond the edge of its frame. ';
async function assertPainted(page, locator) {
  const png = await locator.screenshot();
  const ink = await page.evaluate(async data => {
    const image = new Image(); image.src = `data:image/png;base64,${data}`; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0; for (let i = 0; i < pixels.length; i += 4) if (pixels[i] > 200 && pixels[i + 1] > 200 && pixels[i + 2] > 200) count++;
    return count;
  }, png.toString('base64'));
  assert.ok(ink > 100, `visible article really paints its white ink: ${ink} pixels`);
}
const visibleText = locator => locator.evaluate(body => {
  const result = [], walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT), box = body.getBoundingClientRect();
  while (walker.nextNode()) {
    const node = walker.currentNode;
    for (let i = 0; i < node.length; i++) {
      const range = document.createRange(); range.setStart(node, i); range.setEnd(node, i + 1);
      const r = range.getBoundingClientRect();
      if (r.width && r.height && r.left >= box.left - 1 && r.right <= box.right + 1 && r.bottom <= box.bottom + 1 && r.top >= box.top - 1) result.push(node.textContent[i]);
    }
  }
  return result.join('');
});

test('typing crosses a frame boundary, cross-frame selection edits one range, and Focus writing preserves the story', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } }); page.setDefaultTimeout(12000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await seed(page);
    await page.getByRole('button', { name: 'Add linked Text frame', exact: true }).click(); await settle(page);
    await page.getByRole('button', { name: 'Close Text tools', exact: true }).click();
    await page.getByRole('button', { name: 'Add linked frame after 2', exact: true }).click(); await settle(page);
    const first = page.getByRole('textbox', { name: 'Article text', exact: true }), second = page.getByRole('textbox', { name: 'Article text in frame 2', exact: true });
    await clickLastCharacter(page, first);
    const insertion = ' Crossing into the next frame while continuing to write. ';
    await page.keyboard.type(insertion, { delay: 15 }); await settle(page);
    assert.equal(await second.evaluate(n => n === document.activeElement), true, 'caret follows newly typed text into the next frame');
    assert.ok(await first.evaluate(n => n.editor.state.doc.textContent.includes(' Crossing into the next frame while continuing to write. ')));
    const flowing = [];
    for (const name of ['Article text','Article text in frame 2','Article text in frame 3']) flowing.push(await visibleText(page.getByRole('textbox',{name,exact:true})));
    assert.equal(flowing.join(''),await first.evaluate(n=>n.editor.state.doc.textContent),'live reflow neither skips nor repeats characters after an insertion');
    await first.focus(); await page.keyboard.press('Control+Home');
    for (const character of 'abc') {
      await page.keyboard.type(character); await settle(page);
      const displayed=[]; for (const name of ['Article text','Article text in frame 2','Article text in frame 3']) displayed.push(await visibleText(page.getByRole('textbox',{name,exact:true})));
      assert.equal(displayed.join(''),await first.evaluate(n=>n.editor.state.doc.textContent),'inserting before stable line breaks preserves every displayed character');
    }
    const point = async (locator, last) => locator.evaluate((body, last) => {
      const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT), box = body.getBoundingClientRect(); let result;
      while (walker.nextNode()) for (let i = 0; i < walker.currentNode.length; i++) {
        const range = document.createRange(); range.setStart(walker.currentNode, i); range.setEnd(walker.currentNode, i + 1);
        const r = range.getBoundingClientRect();
        if (r.width && r.height && r.left >= box.left && r.right <= box.right && r.bottom <= box.bottom) {
          result = {x:r.left + r.width / 2,y:r.top + r.height / 2}; if (!last) return result;
        }
      } return result;
    }, last);
    const a = await point(first, true), b = await point(second, false);
    await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x + 85, b.y, {steps:12}); await page.mouse.up(); await settle(page);
    const selected = await first.evaluate(n => n.editor.state.selection.to - n.editor.state.selection.from);
    assert.ok(selected > 3, `drag selects across frame edges: ${selected} characters`);
    const before = await first.evaluate(n => n.editor.state.doc.textContent);
    await page.keyboard.insertText(' REPLACED '); await settle(page);
    assert.equal((await first.evaluate(n => n.editor.state.doc.textContent)).length, before.length - selected + 10);
    await page.keyboard.press('Control+z'); await settle(page);
    assert.equal(await first.evaluate(n => n.editor.state.doc.textContent), before);
    await first.focus(); await page.keyboard.press('Control+End'); await settle(page);
    assert.equal(await page.getByRole('textbox', { name: 'Article text in frame 3', exact: true }).evaluate(n => n === document.activeElement), true, 'keyboard end navigation follows the shared document');
    await page.keyboard.press('Backspace'); await settle(page);
    assert.equal(await first.evaluate(n => n.editor.state.doc.textContent), before.slice(0, -1), 'backspace removes exactly one character in a continuation');
    await page.keyboard.press('Control+z'); await settle(page);
    await page.getByRole('button', { name: 'Text tools for frame 2', exact: true }).focus(); await page.keyboard.press('Enter');
    await page.locator('.text-tools-window').getByRole('button', { name: 'Focus writing', exact: true }).click();
    const dialog = page.getByRole('dialog'); await dialog.waitFor();
    const full = dialog.getByRole('textbox', { name: 'Article text', exact: true });
    assert.equal(await visibleText(full), before);
    await full.press('Control+End'); await page.keyboard.type(' END.'); await page.keyboard.press('Escape'); await settle(page);
    assert.ok((await first.evaluate(n => n.editor.state.doc.textContent)).endsWith(' END.'));
    assert.equal(await page.locator('[data-text-flow-frame]').count(), 3); assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('different frame sizes retain lists, artwork and captions in Write, Read and narrow Visitor layouts', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 1000 }, reducedMotion: 'reduce' }); page.setDefaultTimeout(12000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await seed(page);
    await page.evaluate(async story => {
      const draft = window.savedDraft(), text = draft.texts[0], frame = draft.workbench.texts[0];
      const fixture = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
      const { createProfileDocumentV9AssetResolver } = await import('/src/profileDocument/domain/profileDocumentV9Asset.js');
      const asset = createProfileDocumentV9AssetResolver(fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS, {compactContentReference:false})(fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS[0].id);
      text.article.content.content = [
        {type:'paragraph',content:[{type:'text',text:story,marks:[{type:'italic'}]}]},
        {type:'orderedList',attrs:{start:4},content:['First creature watches.', 'Second creature listens.'].map(value=>({type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:value}]}]}))},
        {type:'artwork',attrs:{asset,caption:'The keeper / original artwork',alt:'Abyssal keeper'}},
        {type:'paragraph',attrs:{spaceBefore:30,spaceAfter:20},content:[{type:'text',text:story.repeat(2)}]},
      ];
      frame.window={left:24,top:100,width:340,height:300};
      frame.frames=[{id:'text-frame:two',window:{left:70,top:480,width:380,height:620}}, {id:'text-frame:three',window:{left:24,top:1190,width:340,height:420}}];
      const {systemWorkflowDraftKey}=await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
      localStorage.setItem(systemWorkflowDraftKey(draft.profileAddress),JSON.stringify(draft));
    }, story);
    await mountTextToolsFixture(page, origin); await setWorkbenchZoom(page, .5); await settle(page);
    await page.getByRole('button',{name:'Close Text tools',exact:true}).click(); await settle(page);
    await page.waitForFunction(()=>[...document.querySelectorAll('.text-flow-visible img')].some(n=>n.complete&&n.naturalWidth)); await settle(page);
    const write=[]; const editors=page.locator('.text-flow-visible [role="textbox"]');
    for(let i=0;i<3;i++)write.push(await visibleText(editors.nth(i)));
    await page.screenshot({path:'.browser-test-runtime/text-linked-rich-write-390.png'});
    const before=await page.evaluate(()=>window.savedDraft().texts[0].article);
    await page.getByRole('button',{name:'Read',exact:true}).focus(); await page.keyboard.press('Enter'); await settle(page);
    const bodies=page.locator('.text-flow-visible article > .text-document-body');
    for(let i=0;i<3;i++)assert.equal(await visibleText(bodies.nth(i)),write[i],`rich content matches in frame ${i+1}`);
    assert.equal(await page.locator('.text-flow-visible article img').count(),1,'artwork belongs to exactly one reading frame');
    await mountTextToolsFixture(page,origin,{visitor:true}); await setWorkbenchZoom(page,.5); await settle(page);
    await page.waitForFunction(()=>[...document.querySelectorAll('.text-flow-visible img')].some(n=>n.complete&&n.naturalWidth)); await settle(page);
    for(let i=0;i<3;i++)assert.equal(await visibleText(bodies.nth(i)),write[i],`Visitor retains frame ${i+1}`);
    await assertPainted(page,page.locator('.text-flow-visible .text-document-title'));
    await page.screenshot({path:'.browser-test-runtime/text-linked-rich-visitor-390.png'});
    assert.deepEqual(await page.evaluate(()=>window.savedDraft().texts[0].article),before); assert.deepEqual(errors,[]);
  } finally {await browser.close();}
});

test('a Library drop into a continuation uses that frame and preserves the complete shared writing', {timeout:90000}, async()=>{
  const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1700,height:1100}});page.setDefaultTimeout(12000);
    await seed(page);
    await page.evaluate(async()=>{
      const draft=window.savedDraft(), entry=draft.workbench.texts[0]; entry.window.left=600;
      entry.frames=[{id:'text-frame:two',window:{left:1004,top:100,width:380,height:750}}];
      const {systemWorkflowDraftKey}=await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
      localStorage.setItem(systemWorkflowDraftKey(draft.profileAddress),JSON.stringify(draft));
    });
    await mountTextToolsFixture(page,origin);await settle(page);
    await page.getByRole('button',{name:'Close Text tools',exact:true}).click();
    const editor=page.getByRole('textbox',{name:'Article text',exact:true}), second=page.getByRole('textbox',{name:'Article text in frame 2',exact:true});
    const firstText=await visibleText(editor), before=await editor.evaluate(n=>n.editor.state.doc.textContent);
    await page.getByRole('button',{name:'Library',exact:true}).click();
    const card=page.getByRole('region',{name:'Library workspace'}).getByRole('button',{name:'ABYSSAL STUDY / INSCAPE STUDIES',exact:true});
    await card.scrollIntoViewIfNeeded(); const source=await card.boundingBox(),target=await second.boundingBox();
    await page.mouse.move(source.x+source.width/2,source.y+35);await page.mouse.down();
    await page.mouse.move(target.x+12,target.y+12,{steps:12});await page.mouse.up();await settle(page);
    await page.waitForFunction(()=>window.savedDraft().texts[0].article.content.content.some(n=>n.type==='artwork'));
    assert.equal(await editor.evaluate(n=>n.editor.state.doc.textContent),before);
    const position=await editor.evaluate(n=>{let result;n.editor.state.doc.descendants((node,pos)=>{if(node.type.name==='artwork')result=pos;});return result;});
    assert.ok(position>=firstText.length && position<before.length,'artwork was inserted near the beginning of frame 2, not appended at the article end');
    await page.getByRole('button',{name:'Library',exact:true}).click();
    await second.focus();await page.keyboard.press('Control+z');await settle(page);
    assert.equal(await editor.evaluate(n=>n.editor.state.doc.textContent),before);
    assert.equal(await page.evaluate(()=>window.savedDraft().texts[0].article.content.content.some(n=>n.type==='artwork')),false);
  } finally {await browser.close();}
});

test('fixed-width text remeasures stable break positions after typing before the first frame boundary', {timeout:60000}, async()=>{
  const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1600,height:1000}});
    await seed(page);
    await page.evaluate(async()=>{
      const draft=window.savedDraft();draft.texts[0].article.font='mono';
      draft.texts[0].article.content.content=[{type:'paragraph',content:[{type:'text',text:'abcdefghij'.repeat(40)}]}];
      const {systemWorkflowDraftKey}=await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
      localStorage.setItem(systemWorkflowDraftKey(draft.profileAddress),JSON.stringify(draft));
    });
    await mountTextToolsFixture(page,origin);await page.getByRole('button',{name:'Add linked Text frame',exact:true}).click();await settle(page);
    await page.getByRole('button',{name:'Close Text tools',exact:true}).click();
    const first=page.getByRole('textbox',{name:'Article text',exact:true}),second=page.getByRole('textbox',{name:'Article text in frame 2',exact:true});
    await first.focus();await page.keyboard.press('Control+Home');await page.keyboard.type('X');await settle(page);
    assert.equal((await visibleText(first))+(await visibleText(second)),await first.evaluate(n=>n.editor.state.doc.textContent));
  } finally {await browser.close();}
});
async function seed(page) {
  await mountTextToolsFixture(page, origin);
  await page.evaluate(async story => {
    const draft = window.savedDraft(), article = draft.texts[0].article;
    article.title = 'The Underneath';
    article.content.content = [{ type: 'paragraph', content: [{ type: 'text', text: story.repeat(4) }] }];
    article.appearance.padding = { top: 16, bottom: 16, left: 20, right: 20 };
    draft.workbench.texts[0].window = { left: 24, top: 100, width: 380, height: 300 };
    const { systemWorkflowDraftKey } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
    localStorage.setItem(systemWorkflowDraftKey(draft.profileAddress), JSON.stringify(draft));
  }, story);
  await mountTextToolsFixture(page, origin); await settle(page);
}
async function clickLastCharacter(page, body) {
  const point = await body.evaluate(body => {
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT), box = body.getBoundingClientRect(); let result;
    while (walker.nextNode()) {
      const node = walker.currentNode;
      for (let i = 0; i < node.length; i++) {
        const range = document.createRange(); range.setStart(node, i); range.setEnd(node, i + 1);
        const r = range.getBoundingClientRect();
        if (r.width && r.height && r.right <= box.right + 1 && r.left >= box.left - 1 && r.bottom <= box.bottom + 1)
          result = { x: r.right - .1, y: r.top + r.height / 2 };
      }
    } return result;
  });
  assert.ok(point, 'continuation contains visible editable text');
  await page.mouse.click(point.x, point.y); await settle(page);
}

test('linked frames share live editing, formatting and one undo history, preserve text on removal, and survive publication', { timeout: 120000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } }); page.setDefaultTimeout(12000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await seed(page);
    const original = await page.getByRole('textbox', { name: 'Article text', exact: true }).elementHandle();
    const before = await page.evaluate(() => window.savedDraft().texts[0].article);
    await page.getByRole('button', { name: 'Add linked Text frame', exact: true }).click(); await settle(page);
    await page.getByRole('button', { name: 'Close Text tools', exact: true }).click();
    const second = page.getByRole('textbox', { name: 'Article text in frame 2', exact: true }); await second.waitFor(); await settle(page);
    assert.equal(await page.getByRole('textbox', { name: 'Article text', exact: true }).evaluate((node, old) => node === old, original), true);
    const firstText = await visibleText(page.getByRole('textbox', { name: 'Article text', exact: true }));
    const secondText = await visibleText(second);
    assert.ok(firstText.length > 20 && secondText.length > 20, `frames contain sequential text: ${firstText.length}, ${secondText.length}`);
    assert.ok(story.repeat(4).startsWith(firstText + secondText), 'second frame continues exactly after the first');
    assert.deepEqual(await page.evaluate(() => window.savedDraft().texts[0].article), before, 'adding a frame never copies or rewrites the article');
    await clickLastCharacter(page, second);
    await page.keyboard.type(' FOLLOW ME'); await settle(page);
    const changed = await page.evaluate(() => window.savedDraft().texts[0].article);
    assert.equal(await second.evaluate(node => node === document.activeElement), true, 'typing stays in the originating continuation');
    assert.ok(JSON.stringify(changed.content).includes('FOLLOW ME'), 'typing in frame 2 saves into the original article');
    await page.keyboard.press('Control+z'); await settle(page);
    assert.equal(await page.evaluate(() => document.querySelector('.tiptap').editor.state.doc.textContent), story.repeat(4), 'undo from frame 2 uses the shared history');
    await page.keyboard.press('Control+y'); await settle(page);
    assert.deepEqual(await page.evaluate(() => window.savedDraft().texts[0].article.content), changed.content);
    await second.focus(); await page.keyboard.press('Control+Shift+ArrowLeft');
    await page.getByRole('button', { name: 'Text tools for frame 2', exact: true }).click();
    await page.locator('.text-tools-window').getByRole('button', { name: 'Bold', exact: true }).click(); await settle(page);
    assert.equal(await second.evaluate(node => node === document.activeElement), true, 'formatting returns focus to frame 2');
    assert.ok(await page.evaluate(() => window.savedDraft().texts[0].article.content.content.some(p => p.content?.some(n => n.marks?.some(m => m.type === 'bold')))));
    await page.locator('.text-tools-window').getByRole('button', { name: 'Undo', exact: true }).click(); await settle(page);
    const size = page.getByRole('spinbutton', { name: 'Selected text size', exact: true });
    await size.fill('24'); await settle(page);
    assert.equal(await size.evaluate(node => node === document.activeElement), true, 'reflow never steals focus from the live size field');
    assert.ok(await second.locator('span').evaluateAll(nodes => nodes.some(node => node.textContent.includes('ME') && getComputedStyle(node).fontSize === '24px')), 'selected text in frame 2 changes before Enter or blur');
    assert.ok(await page.evaluate(() => window.savedDraft().texts[0].article.content.content.some(p => p.content?.some(n => n.marks?.some(m => m.type === 'textStyle' && m.attrs.fontSize === 24)))));
    await size.press('Escape'); await settle(page);
    assert.deepEqual(await page.evaluate(() => window.savedDraft().texts[0].article.content), changed.content, 'Escape in a continuation restores the shared article');
    await page.getByRole('button', { name: 'Close Text tools', exact: true }).click();
    await mkdir('.browser-test-runtime', { recursive: true });
    await page.screenshot({ path: '.browser-test-runtime/text-linked-write.png' });
    await page.getByRole('button', { name: 'Add linked frame after 2', exact: true }).click(); await settle(page);
    assert.equal(await page.locator('[data-text-flow-frame]').count(), 3);
    const initialFirst = await visibleText(page.getByRole('textbox', { name: 'Article text', exact: true }));
    const resize = page.getByRole('separator', { name: 'Resize Text from bottom', exact: true });
    await resize.focus(); await page.keyboard.down('Alt');
    for (let i = 0; i < 14; i++) await page.keyboard.press('ArrowDown');
    await page.keyboard.up('Alt'); await settle(page);
    const resizedFirst = await visibleText(page.getByRole('textbox', { name: 'Article text', exact: true }));
    assert.ok(resizedFirst.length > initialFirst.length, 'growing frame 1 draws text back from frame 2');
    assert.equal(await page.evaluate(() => window.savedDraft().workbench.texts[0].window.height), 412, 'keyboard resize keeps its focused handle across saves');
    await page.getByRole('button', { name: 'Remove frame 2, keep text', exact: true }).focus(); await page.keyboard.press('Enter'); await settle(page);
    assert.equal(await page.locator('[data-text-flow-frame]').count(), 2);
    assert.deepEqual(await page.evaluate(() => window.savedDraft().texts[0].article.content), changed.content, 'removing a frame preserves the complete article');
    await page.getByRole('button', { name: 'Add linked frame after 2', exact: true }).focus(); await page.keyboard.press('Enter'); await settle(page);
    const empty = page.getByRole('textbox', {name:'Article text in frame 3',exact:true});
    assert.equal(await visibleText(empty),'');
    await empty.click({position:{x:10,y:10}}); await page.keyboard.type(' TEST'); await settle(page);
    assert.equal(await page.getByRole('textbox',{name:'Article text',exact:true}).evaluate(n=>n.editor.state.doc.textContent),changed.content.content[0].content.map(n=>n.text).join('')+' TEST','clicking an empty continuation appends to the article without replacing hidden text');
    await page.keyboard.press('Control+z'); await settle(page);
    await page.getByRole('button', { name: 'Read', exact: true }).focus(); await page.keyboard.press('Enter'); await settle(page);
    const read = page.locator('.text-flow-visible article > .text-document-body');
    const reading = []; for (let i = 0; i < await read.count(); i++) reading.push(await visibleText(read.nth(i)));
    assert.equal(reading.join(''), changed.content.content[0].content.map(node => node.text).join(''), 'complete story flows through all frames once');
    await mountTextToolsFixture(page, origin, { visitor: true }); await settle(page);
    assert.equal(await page.locator('[data-text-flow-frame]').count(), 3, 'public Workbench retains frame membership and order');
    const publicBodies = page.locator('.text-flow-visible article > .text-document-body');
    for (let i = 0; i < 3; i++) assert.equal(await visibleText(publicBodies.nth(i)), reading[i]);
    await assertPainted(page, page.locator('.text-flow-visible .text-document-title'));
    await page.screenshot({ path: '.browser-test-runtime/text-linked-visitor.png' });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
