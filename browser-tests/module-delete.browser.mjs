import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const origin = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5173';
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('https://raw.githubusercontent.com/**', route => {
    const path = new URL(route.request().url()).pathname.split('/public/')[1];
    return route.fulfill({ path: `public/${path}` });
  });
  await page.route(`${origin}/__instances__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
  await page.goto(`${origin}/__instances__`);
  await page.evaluate(async () => {
    const refresh = (await import('/@react-refresh')).default;
    refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
    window.__vite_plugin_react_preamble_installed__ = true;
    const React = (await import('/@id/react')).default;
    const { createRoot } = (await import('/@id/react-dom/client')).default;
    const Runtime = (await import('/src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx')).default;
    const fixture = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
    const { systemWorkflowDraftKey } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
    await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css');
    await import('/src/lattice/rendering/latticeMenuSurface.css');
    const storage = fixture.createOwnerSystemWorkflowReviewStorage();
    const preferences = await import('/src/public/ownerSystemWorkflow/workbenchPreferences.js');
    preferences.saveWorkbenchPreferences(fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE,
      { ...preferences.DEFAULT_WORKBENCH_PREFERENCES, gridMode: 'DOTS' });
    const root = createRoot(document.getElementById('root'));
    window.instances = { root, storage, profile: fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE,
      getDraft: () => JSON.parse(storage.getItem(systemWorkflowDraftKey(fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE))) };
    const props = { profileAddress: fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE, reviewStorage: storage,
      reviewAssets: fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS, reviewCategories: [], reviewActivity: [], reviewDiscovery: [],
      reviewProfile: { name: 'Display review' } };
    instances.render = () => root.render(React.createElement(Runtime, props)); instances.render();
  });

  await page.locator('.system-workflow__presentation-board').waitFor();
  await page.getByRole('button', { name: 'Minimize Display Module to shortcut', exact: true }).click();
  await page.locator('.system-workflow__desktop-shortcut').click({button:'right'});
  await page.getByRole('menuitem',{name:'DELETE',exact:true}).click();
  await page.waitForFunction(() => instances.getDraft().grids.length === 0);
  assert.equal(await page.locator('.system-workflow__desktop-shortcut').count(),0);
  assert.equal(await page.locator('main.system-workflow > .lattice-pixel-grid').count(),1);
  await page.keyboard.press('Control+z');
  await page.waitForFunction(() => instances.getDraft().grids.length > 0);
  await page.keyboard.press('Control+Shift+z');
  await page.waitForFunction(() => instances.getDraft().grids.length === 0);
  await page.getByRole('button',{name:'Grids',exact:true}).click();
  await page.getByRole('button',{name:'Grids',exact:true}).click();
  await page.mouse.click(15,15,{button:'right'});
  await page.getByRole('menuitem',{name:'ADD',exact:true}).hover();
  assert.equal(await page.getByRole('menuitem', { name: 'MIRROR ANIMATION', exact: true }).count(), 0);
  await page.screenshot({ path: 'output/remove-mirror-add-menu.png' });
  await page.getByRole('menuitem',{name:'DISPLAY MODULE',exact:true}).hover();
  await page.getByRole('menuitem',{name:'HORIZONTAL 16:9',exact:true}).click();
  await page.locator('.system-workflow__presentation-board').waitFor();
  assert.equal(await page.evaluate(()=>instances.getDraft().grids[0].placements.length),0);
  await page.mouse.click(15,15,{button:'right'});
  await page.getByRole('menuitem',{name:'ADD',exact:true}).hover();
  await page.getByRole('menuitem',{name:'DISPLAY MODULE',exact:true}).hover();
  await page.getByRole('menuitem',{name:'HORIZONTAL 16:9',exact:true}).click();
  await page.waitForFunction(()=>instances.getDraft().displays.length===1);
  const second=page.locator('[data-display-instance]').nth(1);
  await second.getByRole('button',{name:'Minimize Display Module to shortcut',exact:true}).click();
  await second.locator('.system-workflow__desktop-shortcut').click({button:'right'});
  await page.getByRole('menuitem',{name:'DELETE',exact:true}).click();
  await page.waitForFunction(()=>instances.getDraft().displays.length===0);
  await page.getByRole('button',{name:'Minimize Display Module to shortcut',exact:true}).click();
  await page.locator('.system-workflow__desktop-shortcut').click({button:'right'});
  await page.getByRole('menuitem',{name:'DELETE',exact:true}).click();
  await page.waitForFunction(()=>instances.getDraft().grids.length===0);

  for (const [label,close,shortcut,key] of [
    ['MINI APP','Close Mini App','.mini-app-shortcut','miniApps'],
    ['MOBILE MODULE','Close Mobile editor','.mobile-editor-reopen','mobile']
  ]) {
    await page.mouse.click(15,15,{button:'right'});
    await page.getByRole('menuitem',{name:'ADD',exact:true}).hover();
    await page.getByRole('menuitem',{name:label,exact:true}).click();
    if(key==='miniApps') await page.locator('[data-mini-app-id] button[aria-label^="Close "]').click();
    else await page.getByRole('button',{name:close,exact:true}).click();
    if (key === 'mobile') await page.setViewportSize({width:390,height:844});
    await page.locator(shortcut).focus();
    await page.keyboard.press('Shift+F10');
    await page.screenshot({path:'output/module-delete-'+key+'-menu.png'});
    await page.getByRole('menuitem',{name:'DELETE',exact:true}).click();
    await page.waitForFunction(key=>key==='mobile'?!instances.getDraft().mobile:instances.getDraft()[key].length===0,key);
    await page.keyboard.press('Control+z');
    await page.waitForFunction(key=>key==='mobile'?!!instances.getDraft().mobile:instances.getDraft()[key].length===1,key);
    await page.locator('main.system-workflow').focus();
    await page.keyboard.press('Control+Shift+z');
    await page.waitForFunction(key=>key==='mobile'?!instances.getDraft().mobile:instances.getDraft()[key].length===0,key);
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.screenshot({path:'output/module-delete-empty-wide.png'});
  await page.evaluate(async()=>{
    const React=(await import('/@id/react')).default;
    const {buildProfileDocumentV9}=await import('/src/profileDocument/domain/profileDocumentV9Builder.js');
    const Visitor=(await import('/src/profileDocument/components/ProfileDocumentV9Visitor.jsx')).default;
    instances.root.render(React.createElement(Visitor,{document:buildProfileDocumentV9({profileAddress:instances.profile,systemWorkflowDraft:instances.getDraft(),assetRecords:[]})}));
  });
  await page.locator('.visitor-grid-world').waitFor();
  assert.equal(await page.locator('.system-workflow__presentation-board').count(),0);
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'output/module-delete-empty-visitor-narrow.png'});
  assert.deepEqual(errors,[]);
  console.log('Display delete, undo, redo, recreate, empty Grids and empty Visitor passed');
} finally {await browser.close();}
