import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const origin = process.env.INSCAPE_IMAGE_ROOT || 'http://127.0.0.1:5197';

test('Image world joins survive repeated grabs, pan and continuous zoom', { timeout: 180000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    for (const density of [1, 1.25, 2]) {
      const page = await browser.newPage({ viewport: { width: 1500, height: 1400 }, deviceScaleFactor: density });
      await page.route(`${origin}/__alignment__`, route => route.fulfill({ contentType:'text/html', body:'<div id="root"></div>' }));
      await page.route('https://image.test/source.png', route => route.fulfill({ contentType:'image/jpeg', path:'browser-tests/fixtures/grid-landscape.jpg' }));
      await page.goto(`${origin}/__alignment__`);
      await page.evaluate(async () => {
        const refresh=(await import('/@react-refresh')).default; refresh.injectIntoGlobalHook(window);
        window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
        const React=(await import('/@id/react')).default, {createRoot}=(await import('/@id/react-dom/client')).default;
        const {WorkbenchViewProvider,useWorkbenchView}=await import('/src/public/ownerSystemWorkflow/WorkbenchView.jsx');
        const {useWorkbenchCamera}=await import('/src/public/ownerSystemWorkflow/WorkbenchCamera.jsx');
        const {WorkbenchPlacement}=await import('/src/public/ownerSystemWorkflow/WorkbenchPlacement.jsx');
        const ImageWindow=(await import('/src/imageModule/ImageWindow.jsx')).default;
        const ImageArtwork=(await import('/src/imageModule/ImageArtwork.jsx')).default;
        await import('/src/imageModule/imageModule.css');
        function Fixture(){
          const host=React.useRef(null), view=useWorkbenchView(), pan=useWorkbenchCamera();
          const [positions,setPositions]=React.useState([{left:100.3,top:100.7},{left:110.3,top:510.7}]);
          window.readPositions=()=>positions;
          window.camera=(zoom,x,y)=>{view.setScale(zoom);pan.setOffset({x,y});};
          window.configure=zoom=>{view.setScale(zoom);setPositions([{left:100.3,top:100.7},{left:110.3,top:510.7}]);};
          return React.createElement('div',{ref:host,style:{position:'fixed',inset:0}},React.createElement(WorkbenchPlacement,{enabled:true,gap:0,hostRef:host},
            positions.map((position,i)=>React.createElement(ImageWindow,{key:i,id:`image:${i}`,title:`Image ${i}`,position,size:{width:317,height:193},fitScale:1,editable:true,placementModule:true,
              onPosition:p=>setPositions(current=>current.map((v,j)=>i===j?p:v)),onResize:()=>{},onClose:()=>{}},rectangle=>React.createElement(ImageArtwork,{rectangle,
                side:{asset:{media:{url:'https://image.test/source.png',width:1920,height:1080}},crop:{x:.41,y:.53,zoom:1.4},transform:{quarterTurns:0,mirrorX:false,mirrorY:i===1}}})))));
        }
        createRoot(document.getElementById('root')).render(React.createElement(WorkbenchViewProvider,null,React.createElement(Fixture)));
        const image=new Image();image.src='https://image.test/source.png';await image.decode();
      });
      await page.addStyleTag({content:'body {background:#123456} .image-module__header {opacity:0 !important;outline:none !important} .image-module__resize {visibility:hidden}'});
      const windows=page.locator('.image-module__window'), moving=windows.nth(1), grip=moving.locator('header');
      const seamPixels = async () => {
        const png=await page.screenshot();
        return page.evaluate(async png=>{
          const image=new Image();image.src=`data:image/png;base64,${png}`;await image.decode();
          const [a,b]=[...document.querySelectorAll('.image-module__window')].map(node=>node.getBoundingClientRect());
          const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
          const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
          const left=Math.ceil(Math.max(a.left,b.left)*devicePixelRatio),right=Math.floor(Math.min(a.right,b.right)*devicePixelRatio);
          const seam=Math.round(b.top*devicePixelRatio);let bad=0;
          for(let x=left;x<right;x++)for(let y=seam-1;y<=seam;y++){
            const pixel=ctx.getImageData(x,y,1,1).data;
            if(pixel[0]<250||pixel[1]>4||pixel[2]>4)bad++;
          }
          return {bad, sample:[...ctx.getImageData(Math.round((left+right)/2),seam-2,1,4).data],a:{y:a.y,height:a.height},b:{y:b.y,height:b.height}};
        },png.toString('base64'));
      };
      await moving.waitFor();
      for(const zoom of [.25,.33,.67,.99,1,1.01,1.37,2]){
        await page.evaluate(zoom=>window.configure(zoom),zoom);
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        const a=await windows.first().boundingBox(), b=await moving.boundingBox();
        await page.mouse.move(b.x+10,b.y+10);await page.mouse.down();
        await page.mouse.move(a.x+11,a.y+a.height+11,{steps:6});
        const aligned=await moving.boundingBox();
        assert.ok(Math.abs(aligned.y-(a.y+a.height))<1/64,`flush ${density} / ${zoom}`);
        assert.ok(Math.abs(aligned.x-a.x)<1/64,`edge ${density} / ${zoom}`);
        await page.mouse.up();await page.mouse.move(1400,1300);
        const saved=await page.evaluate(()=>window.readPositions());
        assert.ok(Math.abs(saved[1].top-saved[0].top-193)<1e-8,'flush belongs to world geometry');
        assert.ok(Math.abs(saved[1].left-saved[0].left)<1e-8);
        const source=await moving.locator('image').evaluate(node => ['x','y','width','height'].map(key=>node.getAttribute(key)).join(','));
        // Re-grab and jitter without Alt: the captured edge cannot drift.
        for(let grab=0;grab<3;grab++){
          const r=await moving.boundingBox();
          await page.mouse.move(r.x+12,r.y+12);await page.mouse.down();
          for(const [dx,dy] of [[1,1],[-1,2],[2,-1],[0,0]]){
            await page.mouse.move(r.x+12+dx,r.y+12+dy);
            const current=await page.evaluate(()=>window.readPositions());
            assert.ok(Math.abs(current[1].left-saved[1].left)<1e-8);
            assert.ok(Math.abs(current[1].top-saved[1].top)<1e-8);
          }
          await page.mouse.up();
        }
        await page.locator('.image-module__artwork image').evaluateAll(nodes=>{
          const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;
          const context=canvas.getContext('2d');context.fillStyle='red';context.fillRect(0,0,1920,1080);
          const source=canvas.toDataURL();
          nodes.forEach(node=>node.setAttribute('href',source));
        });
        // Pan and zoom are view-only. Every shared edge must still paint once.
        for(const scale of [.25,.413,.671,.997,1,1.013,1.371,2]){
          await page.evaluate(scale=>window.camera(scale,13.37*scale,-7.23*scale),scale);
          await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
          const first=await windows.first().boundingBox(),second=await moving.boundingBox();
          assert.ok(Math.abs(second.y-first.y-first.height)<=1/64,'no gap after camera change');
          assert.ok(Math.abs(second.x-first.x)<1/64,'same left edge after camera change');
          const raster=await seamPixels();
          assert.equal(raster.bad,0,`opaque seam at density ${density}, zoom ${scale}: ${JSON.stringify(raster)}`);
          assert.deepEqual(await page.evaluate(()=>window.readPositions()),saved,'camera never writes positions');
          assert.equal(await moving.locator('image').evaluate(node => ['x','y','width','height'].map(key=>node.getAttribute(key)).join(',')),source,'camera never recomputes source crop');
        }
        await page.evaluate(zoom=>window.camera(zoom,0,0),zoom);
        await grip.focus();
        for(const key of ['ArrowRight','ArrowDown','ArrowLeft','ArrowUp']){
          await page.keyboard.press(`Alt+${key}`);
          assert.equal(await moving.locator('image').evaluate(node => ['x','y','width','height'].map(key=>node.getAttribute(key)).join(',')),source,'free movement never changes source projection');
        }
      }
      await page.close();
    }
  } finally {await browser.close();}
});
