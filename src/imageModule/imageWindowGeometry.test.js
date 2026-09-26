import test from 'node:test';
import assert from 'node:assert/strict';
import { imageWindowGeometry, imageWindowPosition } from './imageWindowGeometry.js';
import { modulePositionMatch } from '../public/ownerSystemWorkflow/workbenchEdgeSnap.js';

test('free movement never resizes the projected canvas; all four snapped edges survive round trip', () => {
  for (const density of [1,1.25,2]) for (const scale of [.25,.33,.67,.99,1,1.01,1.37,2]) {
    const camera={scale,x:7.31,y:-3.12},offset={x:13.79,y:5.83},size={width:317,height:193};
    const initial=imageWindowGeometry({left:100.3,top:100.7},size,camera,offset,density);
    for(let i=0;i<80;i++){
      const rect=imageWindowGeometry({left:100.3+i*.13,top:100.7+i*.17},size,camera,offset,density);
      assert.equal(rect.width,initial.width);assert.equal(rect.height,initial.height);
    }
    for(const [dx,dy] of [[initial.width,0],[-initial.width,0],[0,initial.height],[0,-initial.height]]){
      const candidate={...initial,left:initial.left+dx+.1,top:initial.top+dy+.1};
      const match=modulePositionMatch(candidate,[{id:'target',...initial}],0);
      const snapped={...candidate,...match.position};
      const painted=imageWindowGeometry(imageWindowPosition(snapped,camera,offset),size,camera,offset,density);
      assert.ok(Math.abs(painted.left-snapped.left)<1e-9);assert.ok(Math.abs(painted.top-snapped.top)<1e-9);
    }
  }
});
