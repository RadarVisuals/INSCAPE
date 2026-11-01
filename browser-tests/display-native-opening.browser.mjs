import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';

test('native Display openings preserve crop, transparency, mirrors, rotations and source picking', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 1500 } });
    await page.route('**/__opening__', route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    await page.goto(`${process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5194'}/__opening__`);
    await page.evaluate(async () => {
      const refresh = (await import('/@react-refresh')).default;
      refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
      const React = (await import('/@id/react')).default, { createRoot } = (await import('/@id/react-dom/client')).default;
      const Surface = (await import('/src/public/ownerSystemWorkflow/DisplayArtworkSurface.jsx')).default;
      const source = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><path fill="red" d="M0 0H200V150H0z"/><path fill="blue" d="M200 0H400V150H200z"/><path fill="green" fill-opacity=".5" d="M0 150H200V300H0z"/></svg>');
      window.cases = [];
      for (let turn=0;turn<4;turn++) for (const sx of [-1,1]) for (const sy of [-1,1]) for (const size of [65, 320]) {
        const index=window.cases.length;
        window.cases.push({ index, width:167.3, height:123.7, left:20+(index%4)*230, top:20+Math.floor(index/4)*175,
          rect: { left:size===65?40:-71.3, top:12.7, width:size, height:size*.75, transform:`scale(${sx}, ${sy}) rotate(${turn*90}deg)` } });
      }
      createRoot(document.getElementById('root')).render(React.createElement(React.Fragment, null, ...window.cases.map(item =>
        React.createElement('div', { key:item.index, id:`case-${item.index}`, style:{ position:'absolute',left:item.left,top:item.top,width:item.width,height:item.height,background:'white' } },
          React.createElement(Surface, { width:item.width,height:item.height,mediaStyle:item.rect },
            React.createElement('img', { src:source, style:{ ...item.rect,position:'absolute',maxWidth:'none',objectFit:'fill',transformOrigin:'center' } }))))));
    });
    await page.waitForFunction(() => document.images.length === 32 && [...document.images].every(image => image.complete && image.naturalWidth));
    const png = await page.screenshot({ path: '.browser-test-runtime/display-native-openings.png' });
    const result = await page.evaluate(async png => {
      const { artworkImageCoordinates } = await import('/src/public/ownerSystemWorkflow/artworkPicking.js');
      const screenshot = new Image(); screenshot.src=`data:image/png;base64,${png}`; await screenshot.decode();
      const screen=document.createElement('canvas');screen.width=screenshot.width;screen.height=screenshot.height;
      const sc=screen.getContext('2d');sc.drawImage(screenshot,0,0);
      let samples=0; const failures=[];
      for (const item of window.cases) {
        const image=document.querySelector(`#case-${item.index} img`), rect=item.rect;
        const expected=document.createElement('canvas');expected.width=168;expected.height=124;
        const ctx=expected.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,168,124);
        ctx.translate(rect.left+rect.width/2,rect.top+rect.height/2);
        const m=new DOMMatrix(rect.transform);ctx.transform(m.a,m.b,m.c,m.d,m.e,m.f);
        ctx.drawImage(image,-rect.width/2,-rect.height/2,rect.width,rect.height);
        for(let x=8;x<160;x+=13) for(let y=8;y<116;y+=13) {
          const expectedPixel=[...ctx.getImageData(x,y,1,1).data];
          const nearby=[...ctx.getImageData(x-1,y-1,3,3).data];
          if(nearby.some((value,i)=>Math.abs(value-expectedPixel[i%4])>3)) continue;
          const actual=[...sc.getImageData(item.left+x,item.top+y,1,1).data]; samples++;
          if(actual.some((value,i)=>Math.abs(value-expectedPixel[i])>4)) failures.push({ case:item.index,x,y,actual,expected:expectedPixel });
          const point=artworkImageCoordinates(image,item.left+x,item.top+y);
          const delta=new DOMPoint(x-rect.left-rect.width/2,y-rect.top-rect.height/2).matrixTransform(m.inverse());
          if(Math.abs(point.u-(delta.x/rect.width+.5))>.001 || Math.abs(point.v-(delta.y/rect.height+.5))>.001) failures.push({case:item.index,picking:point});
        }
      }
      return {samples, failures:failures.slice(0,10)};
    }, png.toString('base64'));
    assert.ok(result.samples > 2000);
    assert.deepEqual(result.failures, []);
    await page.evaluate(async () => {
      const image=document.querySelector('#case-0 img');
      image.src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="red"><animate attributeName="fill" values="red;blue;red" dur="0.4s" repeatCount="indefinite"/></rect></svg>');
      await image.decode();
    });
    const frames = new Set();
    for (let i=0;i<5;i++) {
      await page.waitForTimeout(85);
      const frame=await page.screenshot({clip:{x:92,y:57,width:1,height:1}});
      frames.add(frame.toString('base64'));
    }
    assert.ok(frames.size > 1, 'native cropping retains animated source frames');
  } finally { await browser.close(); }
});
