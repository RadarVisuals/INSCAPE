import test from 'node:test';
import assert from 'node:assert/strict';
import { imageWindowGeometry, imageWindowPosition, resizeImageGeometry } from './imageWindowGeometry.js';
import { workbenchResizeControl } from '../public/ownerSystemWorkflow/ownerSystemWorkflowWindowGeometry.js';
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

test('Image corners and edges preserve their opposite anchors through viewport fitting', () => {
  for (const fitScale of [1, .47]) for (const edge of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) {
    const position = { left: 100.3, top: 100.7 }, size = { width: 720, height: 32 };
    const next = resizeImageGeometry(position, size, fitScale, edge, { x: 17.37, y: -9.21 });
    assert.equal(Number.isInteger(next.size.width), true);
    assert.equal(Number.isInteger(next.size.height), true);
    for (const [key, start, reverse, forward] of [['width', 'left', 'w', 'e'], ['height', 'top', 'n', 's']]) {
      if (edge.includes(reverse)) assert.ok(Math.abs(next.position[start] + next.size[key] * fitScale - position[start] - size[key] * fitScale) < 1e-9);
      else assert.equal(next.position[start], position[start]);
      if (!edge.includes(reverse) && !edge.includes(forward)) assert.equal(next.size[key], size[key]);
      assert.ok(next.size[key] >= 32);
    }
  }
});

test('Image resize snapping uses the moving edge, with bounds winning over a snapped target', () => {
  const position = { left: 100.5, top: 200.5 }, size = { width: 200, height: 80 };
  const edges = [];
  const next = resizeImageGeometry(position, size, 1, 'nw', { x: -50, y: -50 }, (axis, edge, value) => {
    edges.push([axis, edge, value]); return edge === 'left' ? -30 : 180.5;
  });
  assert.deepEqual(edges, [['x', 'left', 50.5], ['y', 'top', 150.5]]);
  assert.deepEqual(next, { position: { left: 8.5, top: 180.5 }, size: { width: 292, height: 100 } });
  const large = resizeImageGeometry({ left: 7900, top: 7900 }, size, .47, 'se', { x: 9999, y: 9999 });
  assert.ok(large.position.left + large.size.width * .47 <= 7992);
  assert.ok(large.position.top + large.size.height * .47 <= 7992);
});

test('a viewport-fitted Image previews the committed fit without moving its opposite corner', () => {
  const fitSize = size => Math.min(1, 374 / size.width, 774 / size.height);
  const position = { left: 8, top: 160 }, size = { width: 720, height: 240 }, fit = fitSize(size);
  const next = resizeImageGeometry(position, size, fit, 'nw', { x: 40, y: 30 }, null, fitSize);
  assert.ok(Math.abs(next.position.left + next.size.width * fitSize(next.size) - position.left - size.width * fit) < 1e-9);
  assert.ok(Math.abs(next.position.top + next.size.height * fitSize(next.size) - position.top - size.height * fit) < 1e-9);
});

test('Image resize targets fit inside the viewport without moving their marks or bringing offscreen controls into view', () => {
  const viewport = { width: 390, height: 844 }, screen = { left: 8, top: 8, width: 374, height: 120 };
  for (const edge of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) {
    const control = workbenchResizeControl(edge, screen, viewport);
    assert.ok(screen.left + control.left >= 0 && screen.left + control.left + 28 <= 390);
    assert.ok(screen.top + control.top >= 0 && screen.top + control.top + 28 <= 844);
    const x = edge.includes('w') ? 0 : edge.includes('e') ? screen.width : screen.width / 2;
    const y = edge.includes('n') ? 0 : edge.includes('s') ? screen.height : screen.height / 2;
    assert.equal(control.left + parseFloat(control['--resize-mark-x']) + 4, x);
    assert.equal(control.top + parseFloat(control['--resize-mark-y']) + 4, y);
  }
  const offscreen = { ...screen, left: -1000, top: -1000 };
  const control = workbenchResizeControl('se', offscreen, viewport);
  assert.ok(offscreen.left + control.left + 28 < 0);
  assert.ok(offscreen.top + control.top + 28 < 0);
});
