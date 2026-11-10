import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
import { editorMenu, setEditorSidebarOpen } from './fixtures/editor-menu.mjs';
const origin = process.env.INSCAPE_TEST_ROOT || 'http://127.0.0.1:5217';
const output = process.env.INSCAPE_SCREENSHOT_DIR || '.browser-test-runtime/reception-gutter-pixels';
test('small positive Bento gutters retain fractional coverage at different zooms and camera phases', { timeout:90000 }, async () => {
  const browser = await chromium.launch({executablePath:browserExecutable,headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
    page.setDefaultTimeout(10000);
    await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    await page.goto(`${origin}/browser-tests/reception-native-editor-fixture.html?session=${crypto.randomUUID()}`,{waitUntil:'domcontentloaded',timeout:45000});
    await editorMenu(page,'Bento').click();
    const panel=page.getByRole('dialog',{name:'Bento settings',exact:true});
    await panel.getByRole('button',{name:'New layout',exact:true}).click();
    await panel.getByLabel('Columns',{exact:true}).fill('2'); await panel.getByLabel('Rows',{exact:true}).fill('1');
    await panel.getByRole('button',{name:/^(Create Bento|Replace layout)$/}).click();
    await panel.getByRole('button',{name:'Close Bento',exact:true}).click(); await setEditorSidebarOpen(page,false);
    const closes=page.locator('.workbench-tool-dock').getByRole('button',{name:/^Close /});
    while(await closes.count())await closes.first().click();
    const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await mkdir(output,{recursive:true});
    for(const mode of ['editor','reader']) for(const opacity of [1,.25]) for(const gap of [0,1,4]) {
      await page.evaluate(({gap,opacity})=>{
        const {root}=window.nativeReceptionFixture,draft=root.getDraft(),value=draft.reception;
        value.workbench.area={left:0,top:0,width:1000,height:600}; value.bento={gap,padding:0};
        value.cells.forEach((cell,i)=>{
          value.workbench.shapes.find(r=>r.id===cell.id).window={left:i*(400+gap),top:0,width:400,height:200};
          const shape=value.shapes.find(r=>r.id===cell.id); Object.assign(shape,{color:opacity===1?'#ffffff':'#808080',opacity,grain:0,blur:0,outline:{width:0,color:'#ffffff',opacity:1}});
          cell.radius=0;
        });
        if(!root.commitCompletedOperation(draft,{expectedGeneration:root.getGeneration()}))throw Error('Cannot seed gutter fixture');
      },{gap,opacity});
      for(const scale of [.25,.5,1]) {
        if(mode==='editor') { await page.getByRole('slider',{name:'Workbench zoom',exact:true}).fill(String(scale*100)); await settle(); }
        for(const phase of [0,.25,.5,.75]) {
          if(mode==='reader') await page.evaluate(({scale,phase})=>window.nativeReceptionFixture.showGutterReader(scale,phase),{scale,phase});
          const point=await page.evaluate(({scale,phase,mode})=>{
            const host=document.querySelector('main[data-reception-editor]');
            if(mode==='editor') host.dispatchEvent(new WheelEvent('wheel',{deltaX:Number(host.dataset.workbenchCameraX)-400-phase,
              deltaY:Number(host.dataset.workbenchCameraY)-250,bubbles:true,cancelable:true}));
            return {x:400+phase+400*scale,y:250+100*scale};
          },{scale,phase,mode});
          await settle();
          const edges=await page.evaluate(mode=>{
            const nodes=[...document.querySelectorAll(mode==='editor'?'.shape-instance[data-cell-owner] .shape-fill':'#gutter-reader .reception-document-cell .shape-fill')];
            const [a,b]=nodes.map(n=>n.getBoundingClientRect()).sort((a,b)=>a.left-b.left);
            return {right:a.right,left:b.left};
          },mode);
          assert.ok(Math.abs(edges.left-edges.right-gap*scale)<.025, 'layout retains the actual fractional gutter');
          const shot=await page.screenshot({path:`${output}/${mode}-opacity-${opacity}-gap-${gap}-zoom-${scale}-phase-${phase}.png`});
          const result=await page.evaluate(async({data,point})=>{
            const image=new Image();image.src=`data:image/png;base64,${data}`;await image.decode();
            const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
            const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
            const pixel=(x,y)=>ctx.getImageData(Math.floor(x*devicePixelRatio),Math.floor(y*devicePixelRatio),1,1).data[0];
            const bg=pixel(point.x,point.y+240),fill=pixel(point.x-5,point.y);
            let deficit=0;for(let x=Math.floor(point.x)-3;x<=Math.floor(point.x)+6;x++)deficit+=(fill-pixel(x,point.y))/(fill-bg);
            return {deficit,bg,fill};
          },{data:shot.toString('base64'),point});
          // Two separately antialiased surfaces compose with source-over alpha.
          // Compare their coverage, not an invented minimum one-pixel gap.
          let expected=0;
          for(let x=Math.floor(point.x)-3;x<=Math.floor(point.x)+6;x++) {
            const a=Math.max(0,Math.min(1,edges.right-x)), b=Math.max(0,Math.min(1,x+1-edges.left));
            expected+=(1-a)*(1-b);
          }
          if(gap===0)expected=0; // Shared zero-gap edges deliberately use the seamless raster policy.
          const minimum=gap*scale, maximum=Math.max(minimum,expected);
          assert.ok(result.deficit>=minimum-(opacity===1?.04:.08) && result.deficit<=maximum+(opacity===1?.04:.08),`${mode} opacity ${opacity} gap ${gap} zoom ${scale} phase ${phase}: visible coverage ${result.deficit}, expected ${expected}`);
          if(gap>0)assert.ok(result.deficit>0,'a positive gutter cannot disappear');
          else assert.ok(result.deficit<.04,'zero gutter stays seamless');
        }
      }
    }
    // Rounded corners and the existing opacity/grain group must survive the
    // rectangle renderer replacement in both hosts.
    await page.evaluate(()=>{
      const {root}=window.nativeReceptionFixture,draft=root.getDraft(),value=draft.reception;
      value.cells[0].radius=24;value.shapes.find(r=>r.id===value.cells[0].id).grain=.4;
      if(!root.commitCompletedOperation(draft,{expectedGeneration:root.getGeneration()}))throw Error('Cannot seed rounded fill');
      document.getElementById('gutter-reader').style.display='none';
    });
    for(const mode of ['editor','reader']){
      if(mode==='reader'){
        await page.evaluate(()=>{document.getElementById('gutter-reader').style.display='';return window.nativeReceptionFixture.showGutterReader(1,0);});
      }
      await settle();
      const info=await page.evaluate(mode=>{
        const fill=document.querySelector(mode==='editor'?'.shape-instance[data-cell-owner] .shape-fill':'#gutter-reader .reception-document-cell .shape-fill');
        const rect=fill.querySelector('.shape-rectangle-fill rect'),grain=fill.querySelector('.module-surface-grain'),r=fill.getBoundingClientRect();
        return {opacity:getComputedStyle(fill).opacity,radius:getComputedStyle(rect).rx,grain:getComputedStyle(grain).opacity,x:r.left,y:r.top};
      },mode);
      assert.equal(Number(info.opacity),.25);assert.equal(parseFloat(info.radius),24);assert.equal(Number(info.grain),.12);
      const shot=await page.screenshot({path:`${output}/${mode}-rounded-grain.png`});
      const corner=await page.evaluate(async({data,info})=>{
        const image=new Image();image.src=`data:image/png;base64,${data}`;await image.decode();
        const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
        return ctx.getImageData(Math.floor(info.x+4),Math.floor(info.y+4),1,1).data[0];
      },{data:shot.toString('base64'),info});
      assert.ok(corner<30,`${mode}: rounded corner stays transparent`);
    }
  }finally{await browser.close();}
});
