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

test('Image corners and edges preserve their opposite world anchors', () => {
  for (const edge of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) {
    const position = { left: 100.3, top: 100.7 }, size = { width: 720, height: 32 };
    const next = resizeImageGeometry(position, size, edge, { x: 17.37, y: -9.21 });
    assert.equal(Number.isInteger(next.size.width), true);
    assert.equal(Number.isInteger(next.size.height), true);
    for (const [key, start, reverse, forward] of [['width', 'left', 'w', 'e'], ['height', 'top', 'n', 's']]) {
      if (edge.includes(reverse)) assert.ok(Math.abs(next.position[start] + next.size[key] - position[start] - size[key]) < 1e-9);
      else assert.equal(next.position[start], position[start]);
      if (!edge.includes(reverse) && !edge.includes(forward)) assert.equal(next.size[key], size[key]);
      assert.ok(next.size[key] >= 32);
    }
  }
});

test('Image corner snapping treats both moving edges independently', () => {
  const position = { left: 100.5, top: 200.5 }, size = { width: 200, height: 80 };
  const edges = [];
  const next = resizeImageGeometry(position, size, 'nw', { x: -50, y: -50 }, (axis, edge, value) => {
    edges.push([axis, edge, value]); return edge === 'left' ? -30 : 180.5;
  });
  assert.deepEqual(edges, [['x', 'left', 50.5], ['y', 'top', 150.5]]);
  assert.deepEqual(next, { position: { left: 8.5, top: 180.5 }, size: { width: 292, height: 100 } });
  const horizontal = resizeImageGeometry(position, size, 'se', { x: 50, y: 0 }, () => 360.5);
  assert.equal(horizontal.size.height, 80, 'snapping cannot move the untouched axis');
  const side = resizeImageGeometry(position, size, 'w', { x: -50, y: -50 }, () => -30);
  assert.deepEqual(side, { position: { left: 8.5, top: 200.5 }, size: { width: 292, height: 80 } }, 'world boundary wins over side snapping');
  const large = resizeImageGeometry({ left: 1900, top: 3900 }, size, 'se', { x: 9999, y: 9999 });
  assert.ok(large.position.left + large.size.width <= 1992);
  assert.ok(large.position.top + large.size.height <= 3992);
});

test('every Image corner changes width and height independently across camera scales', () => {
  const bounds = { left: 0, top: 0, right: 10000, bottom: 10000 };
  for (const size of [{ width: 320, height: 240 }, { width: 193, height: 289 }]) {
    for (const scale of [1, .47]) for (const edge of ['nw', 'ne', 'sw', 'se']) {
      const sx = edge.includes('w') ? -1 : 1, sy = edge.includes('n') ? -1 : 1;
      for (const factor of [.5, 1.25, 2]) for (const axis of ['x', 'y', 'both']) {
        const position = { left: 3000.3, top: 3000.7 };
        const screenDelta = { x: axis === 'y' ? 0 : sx * size.width * scale * (factor - 1),
          y: axis === 'x' ? 0 : sy * size.height * scale * (factor - 1) };
        const next = resizeImageGeometry(position, size, edge, { x: screenDelta.x / scale, y: screenDelta.y / scale }, null, bounds);
        assert.deepEqual(next.size, { width: Math.round(size.width * (axis === 'y' ? 1 : factor)), height: Math.round(size.height * (axis === 'x' ? 1 : factor)) });
        assert.ok(Math.abs(next.position.left + (sx < 0 ? next.size.width : 0) - position.left - (sx < 0 ? size.width : 0)) < 1e-9);
        assert.ok(Math.abs(next.position.top + (sy < 0 ? next.size.height : 0) - position.top - (sy < 0 ? size.height : 0)) < 1e-9);
      }
    }
  }
});

test('corner limits affect only the dimension reaching its size or world boundary', () => {
  const position = { left: 100, top: 100 }, size = { width: 320, height: 240 };
  const bounds = { left: 0, top: 0, right: 10000, bottom: 700 };
  const grown = resizeImageGeometry(position, size, 'se', { x: 9000, y: 0 }, null, bounds);
  assert.deepEqual(grown, { position, size: { width: 4096, height: 240 } });
  const shrunk = resizeImageGeometry(position, size, 'se', { x: -9000, y: 0 }, null, bounds);
  assert.deepEqual(shrunk.size, { width: 32, height: 240 });
  const maximum = resizeImageGeometry(position, size, 'se', { x: 9000, y: 0 }, null, { ...bounds, bottom: 10000 });
  assert.deepEqual(maximum.size, { width: 4096, height: 240 });
  assert.deepEqual(resizeImageGeometry(position, size, 'se', { x: 20, y: 9000 }, null, bounds).size, { width: 340, height: 600 });
});

test('large Image resizing changes its visible size through the camera instead of fitting it back down', () => {
  const position = { left: 100, top: 160 }, size = { width: 239, height: 1053 };
  const next = resizeImageGeometry(position, size, 'se', { x: 100, y: 0 });
  assert.equal(next.size.width, 339);
  assert.equal(next.size.height, 1053);
  for (const scale of [.25, .9, 1, 2]) {
    const camera = { scale, x: 0, y: 0 }, offset = { x: 0, y: 0 };
    const before = imageWindowGeometry(position, size, camera, offset), after = imageWindowGeometry(next.position, next.size, camera, offset);
    assert.ok(Math.abs(after.width - before.width - 100 * scale) < 1e-9);
    assert.equal(after.height, before.height);
  }
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
