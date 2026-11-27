import test from 'node:test';
import assert from 'node:assert/strict';
import { createSystemWorkflowDraftStore } from '../systemWorkflow/systemWorkflowDraftStore.js';
import { createCompositionEditorScope } from './compositionEditorScope.js';
import { COMPOSITION_LAYOUT_DEFAULTS } from './compositionLayoutGenerator.js';
import { compositionModuleWindow, reconcileCompositionCells } from './compositionEditorDocument.js';
import { compositionCellFrames } from './compositionBento.js';
import { placeCompositionBentoCells } from './compositionBentoInsertion.js';
import { createCompositionCellGesture } from './compositionCellGesture.js';
import { createCompositionCellDrawGesture, drawCompositionBentoCell } from './compositionCellDrawing.js';
import { addTextModule } from '../text/textSession.js';

const profile = '0x' + '8'.repeat(40);
function fixture() {
  const data = new Map(); let fail = false;
  const storage = { getItem: k => data.get(k) ?? null, setItem: (k,v) => { if (fail) throw Error('Full'); data.set(k,v); }, removeItem: k => data.delete(k) };
  const root = createSystemWorkflowDraftStore({ profileAddress: profile, storage }), scope = createCompositionEditorScope(root);
  scope.generateCellLayout({ ...COMPOSITION_LAYOUT_DEFAULTS, width: 1440, height: 900, columns: 3, rows: 1 }, 42, scope.getGeneration());
  const value = root.getDraft(), ids = value.cells.map(c => c.id);
  ids.forEach((id,i) => { value.workbench.shapes.find(s => s.id === id).window = { left: 24+i*344, top: 24, width: 320, height: 280 }; });
  assert.ok(root.commitCompletedOperation(value, { expectedGeneration: root.getGeneration() }));
  return { root, scope, storage, ids, fail: v => { fail=v; } };
}
const frame = compositionModuleWindow;
const positions = value => compositionCellFrames(value).map(({id,left,top}) => ({id,left,top}));
function save(f,p) { return f.scope.editBento(p.action,p.args,f.scope.getGeneration()); }

test('fast moves stop before occupied space, can retreat and go around it, and only Shift pushes', () => {
  const f=fixture(), [a,b]=f.ids, origin=f.scope.getComposition();
  const gesture=createCompositionCellGesture(origin,a,undefined,1);
  const stopped=gesture({x:1500,y:0},true);
  assert.deepEqual(compositionCellFrames(stopped.next),compositionCellFrames(origin));
  const retreat=gesture({x:-100,y:0},true);
  assert.equal(frame(retreat.next,a).left,-76);
  gesture({x:-100,y:400},true);
  const around=gesture({x:1000,y:400},true);
  assert.equal(frame(around.next,a).left,1024);
  assert.deepEqual(frame(around.next,b),frame(origin,b));
  const push=createCompositionCellGesture(origin,a,undefined,1)({x:100,y:0},true,true);
  assert.equal(frame(push.next,b).left,frame(origin,b).left+100);
  save(f,around); assert.ok(f.scope.undo()); assert.deepEqual(f.scope.getComposition(),origin); f.scope.release();
});

test('large corner resizes stop at neighbours and switching off Shift restores the undisturbed preview', () => {
  const f=fixture(), [a,b]=f.ids, origin=f.scope.getComposition();
  const gesture=createCompositionCellGesture(origin,a,'se',1);
  const stopped=gesture({x:100000,y:120},true);
  assert.equal(frame(stopped.next,a).width,frame(origin,a).width);
  assert.deepEqual(frame(stopped.next,b),frame(origin,b));
  const pushed=gesture({x:100,y:120},true,true);
  assert.ok(frame(pushed.next,b).left>frame(origin,b).left);
  const released=gesture({x:100,y:120},true,false);
  assert.deepEqual(frame(released.next,b),frame(origin,b));
  save(f,released); assert.deepEqual(frame(f.scope.getComposition(),b),frame(origin,b)); f.scope.release();
});

test('drawing stops at a neighbour and a draw starting in occupied space requires Shift', () => {
  const f=fixture(), origin=f.scope.getComposition(), id='shape:new';
  const gesture=createCompositionCellDrawGesture(origin,id,{x:-200,y:24},1);
  const stopped=gesture({x:500,y:120},true);
  assert.equal(frame(stopped.next,id).left+frame(stopped.next,id).width,0);
  assert.deepEqual(compositionCellFrames(stopped.next).slice(0,3),compositionCellFrames(origin));
  const occupied=createCompositionCellDrawGesture(origin,id,{x:24,y:24},1);
  assert.equal(occupied({x:200,y:120},true),null);
  assert.ok(occupied({x:200,y:120},true,true)); f.scope.release();
});

for (const bypass of [false,true]) test(`reversing a continuous drag pushes from the latest position (free=${bypass})`, () => {
  const f=fixture(), [a,b,c]=f.ids, origin=f.scope.getComposition(), original=structuredClone(origin);
  const gesture=createCompositionCellGesture(origin,a,undefined,1);
  gesture({x:0,y:400},bypass,true); gesture({x:1080,y:400},bypass,true); // travel around the row
  gesture({x:1080,y:0},bypass,true);
  const p=gesture({x:980,y:0},bypass,true);
  assert.ok(frame(p.next,a).left>frame(origin,a).left); // still right of the original start
  assert.ok(frame(p.next,c).left<frame(origin,c).left); // but currently approaching from the right
  assert.ok(frame(p.next,b).left<frame(origin,b).left); // leftward push propagates through neighbours
  for (const id of f.ids) {
    assert.equal(frame(p.next,id).width,frame(origin,id).width);
    assert.equal(frame(p.next,id).height,frame(origin,id).height);
  }
  assert.deepEqual(origin,original);
  save(f,p); assert.deepEqual(f.scope.getComposition(),reconcileCompositionCells(origin,p.next,{moveContents:true}));
  assert.ok(f.scope.undo()); assert.deepEqual(f.scope.getComposition(),origin); f.scope.release();
});

test('a light touch snaps to the gap; only Shift releases it and pushes', () => {
  const f=fixture(), [a,b]=f.ids, origin=f.scope.getComposition(), gesture=createCompositionCellGesture(origin,a,undefined,1);
  assert.equal(gesture({x:3,y:2}),null);
  const touch=gesture({x:7,y:0});
  assert.deepEqual(compositionCellFrames(touch.next),compositionCellFrames(origin));
  assert.equal(touch.guides[0].kind,'gap');
  assert.deepEqual(compositionCellFrames(gesture({x:17,y:0}).next),compositionCellFrames(origin));
  assert.deepEqual(compositionCellFrames(gesture({x:1000,y:0}).next),compositionCellFrames(origin));
  const push=gesture({x:35,y:0},false,true);
  assert.equal(frame(push.next,a).left,48); assert.equal(frame(push.next,b).left,392);
  assert.equal(frame(push.next,b).width,320);
  assert.deepEqual(f.scope.getComposition(),origin); f.scope.release();
});

for (const scale of [.25,1,2]) test(`placement snaps to a 24px world grid at zoom ${scale}`, () => {
  const f=fixture(), id=f.ids[0], origin=f.scope.getComposition(), gesture=createCompositionCellGesture(origin,id,undefined,scale);
  gesture({x:0,y:400*scale});
  const p=gesture({x:61*scale,y:450*scale});
  assert.equal(frame(p.next,id).left,96); assert.equal(frame(p.next,id).top,480);
  assert.equal(p.guides.length,2); assert.ok(p.guides.every(g=>g.kind==='grid'));
  assert.deepEqual(compositionCellFrames(p.next).slice(1),compositionCellFrames(origin).slice(1));
  f.scope.release();
});

test('cell edges take priority over the grid and Alt permits exact free positioning', () => {
  const f=fixture(), [a,b]=f.ids, origin=structuredClone(f.scope.getComposition());
  origin.workbench.shapes.find(s=>s.id===b).window.left=381;
  origin.workbench.shapes.find(s=>s.id===f.ids[2]).window.left=725;
  const gesture=createCompositionCellGesture(origin,a,undefined,1), p=gesture({x:15,y:0});
  assert.equal(frame(p.next,a).left,37); // right edge 357, 24px before the irregular neighbour
  assert.equal(p.guides[0].kind,'gap'); assert.equal(frame(p.next,b).left,381);
  const free=gesture({x:5,y:0},true);
  assert.equal(frame(free.next,a).left,29); assert.equal(free.guides.length,0);
  f.scope.release();
});

for (const edge of ['n','ne','e','se','s','sw','w','nw']) test(`${edge} resize snaps only moving edges and keeps the opposite edges fixed`, () => {
  const f=fixture(), id=f.ids[0], origin=structuredClone(f.scope.getComposition());
  // Move the other cells away, leaving all handles free.
  origin.workbench.shapes.filter(s=>s.id!==id).forEach(s=>{s.window.top=600;});
  const old=frame(origin,id), gesture=createCompositionCellGesture(origin,id,edge,1);
  const p=gesture({x:edge.includes('w')?-37:37,y:edge.includes('n')?-37:37}), next=frame(p.next,id);
  if (edge.includes('w')) { assert.equal(Math.abs((next.left-24)%24),0); assert.equal(next.left+next.width,old.left+old.width); }
  else assert.equal(next.left,old.left);
  if (edge.includes('e')) assert.equal((next.left+next.width-24)%24,0);
  if (edge.includes('n')) { assert.equal(Math.abs((next.top-24)%24),0); assert.equal(next.top+next.height,old.top+old.height); }
  else assert.equal(next.top,old.top);
  if (edge.includes('s')) assert.equal((next.top+next.height-24)%24,0);
  assert.deepEqual(compositionCellFrames(p.next).slice(1),compositionCellFrames(origin).slice(1));
  if (!edge.includes('w') && !edge.includes('e')) assert.equal(next.width,old.width);
  if (!edge.includes('n') && !edge.includes('s')) assert.equal(next.height,old.height);
  f.scope.release();
});

test('resize contact holds the gap, Alt bypasses snapping but only Shift pushes', () => {
  const f=fixture(), [a,b]=f.ids, origin=f.scope.getComposition(), gesture=createCompositionCellGesture(origin,a,'e',1);
  assert.deepEqual(compositionCellFrames(gesture({x:7,y:0}).next),compositionCellFrames(origin));
  assert.deepEqual(compositionCellFrames(gesture({x:1000,y:0},true).next),compositionCellFrames(origin));
  const free=gesture({x:7,y:0},true,true);
  assert.equal(frame(free.next,a).width,327); assert.equal(frame(free.next,b).left,375); assert.deepEqual(free.guides,[]);
  const limited=gesture({x:-10000,y:0});
  assert.ok(frame(limited.next,a).width>0); assert.deepEqual(limited.guides,[]); f.scope.release();
});

test('many previews commit once, carry native text unchanged, Undo/Redo and reload match', () => {
  const f=fixture(), [a,b]=f.ids, r=frame(f.scope.getComposition(),b);
  const target={...f.scope,commitCompletedOperation:(candidate,options)=>f.scope.commitInCell(b,candidate,options)};
  const text=addTextModule(target,profile,{window:{...r,width:200,height:100}});
  const origin=structuredClone(f.scope.getComposition()), generation=f.scope.getGeneration(), gesture=createCompositionCellGesture(origin,a,undefined,1);
  let p; for(const x of [7,17,35,60,90,120,150]) p=gesture({x,y:0},false,true);
  assert.equal(f.scope.getGeneration(),generation); assert.deepEqual(f.scope.getComposition(),origin);
  const expected=reconcileCompositionCells(origin,p.next,{moveContents:true}); save(f,p);
  const after=f.scope.getComposition(); assert.deepEqual(after,expected); assert.deepEqual(after.texts,origin.texts);
  const movement=frame(after,b).left-frame(origin,b).left;
  assert.deepEqual(frame(after,text),{...frame(origin,text),left:frame(origin,text).left+movement});
  assert.ok(f.scope.undo()); assert.deepEqual(f.scope.getComposition(),origin);
  assert.ok(f.scope.redo()); assert.deepEqual(f.scope.getComposition(),after);
  const reopened=createCompositionEditorScope(createSystemWorkflowDraftStore({ profileAddress:profile,storage:f.storage}));
  assert.deepEqual(reopened.getComposition(),after); reopened.release(); f.scope.release();
});

test('invalid, stale and failed position commits leave the saved document and history intact', () => {
  const f=fixture(), origin=structuredClone(f.scope.getComposition()), p=positions(origin), generation=f.scope.getGeneration();
  for (const bad of [null,p.slice(1),[p[0],p[0],p[2]],p.map((r,i)=>i? r:{...r,id:'unknown'}),
    p.map((r,i)=>i?r:{...r,width:123}),p.map((r,i)=>i?r:{...r,left:NaN}),
    p.map((r,i)=>i?r:{...r,left:p[1].left}),p.map((r,i)=>i?r:{...r,left:17000})]) {
    assert.throws(()=>f.scope.editBento('placeCells',[bad],generation));
    assert.deepEqual(f.scope.getComposition(),origin); assert.equal(f.scope.getGeneration(),generation);
  }
  const proposal=createCompositionCellGesture(origin,f.ids[0],undefined,1)({x:0,y:400});
  f.fail(true); assert.throws(()=>save(f,proposal),/saved/); f.fail(false);
  assert.deepEqual(f.scope.getComposition(),origin); assert.equal(f.scope.getGeneration(),generation);
  save(f,proposal); const after=f.scope.getComposition();
  assert.throws(()=>f.scope.editBento('placeCells',[p],generation),/changed/);
  assert.deepEqual(f.scope.getComposition(),after); assert.ok(f.scope.undo()); assert.deepEqual(f.scope.getComposition(),origin);
  f.scope.release(); assert.throws(()=>f.scope.editBento('placeCells',[p],generation),/active/);
});

test('abandoned gestures cannot alter the next gesture or the document', () => {
  const f=fixture(), origin=structuredClone(f.scope.getComposition()), id=f.ids[0];
  createCompositionCellGesture(origin,id,undefined,1)({x:200,y:0});
  const p=createCompositionCellGesture(origin,id,undefined,1)({x:7,y:0});
  assert.deepEqual(compositionCellFrames(p.next),compositionCellFrames(origin));
  assert.deepEqual(f.scope.getComposition(),origin);
  assert.deepEqual(placeCompositionBentoCells(origin,positions(origin)),origin); f.scope.release();
});

for (const scale of [.25,1,2]) test(`drawing a new cell uses world coordinates at zoom ${scale}`, () => {
  const f=fixture(), origin=structuredClone(f.scope.getComposition()), id='shape:drawn';
  const gesture=createCompositionCellDrawGesture(origin,id,{x:24,y:500},scale);
  assert.equal(gesture({x:2,y:2}),null);
  const p=gesture({x:317*scale,y:235*scale});
  assert.deepEqual(frame(p.next,id),{left:24,top:504,width:312,height:240});
  assert.deepEqual(compositionCellFrames(p.next).slice(0,3),compositionCellFrames(origin));
  assert.ok(p.guides.every(g=>g.rect.width===312*scale && g.rect.top===504*scale));
  assert.deepEqual(f.scope.getComposition(),origin);
  const free=gesture({x:317*scale,y:235*scale},true);
  assert.deepEqual(frame(free.next,id),{left:24,top:500,width:317,height:235});
  assert.deepEqual(free.guides,[]); f.scope.release();
});

for (const [dx,dy] of [[200,120],[-200,120],[200,-120],[-200,-120]]) test(`drawing ${dx},${dy} preserves its anchor and neighbouring sizes`, () => {
  const f=fixture(), origin=structuredClone(f.scope.getComposition()), id='shape:drawn';
  const p=createCompositionCellDrawGesture(origin,id,{x:24,y:24},1,f.ids[0])({x:dx,y:dy},true,true);
  assert.deepEqual(frame(p.next,id),{left:24+Math.min(0,dx),top:24+Math.min(0,dy),width:200,height:120});
  for (const old of compositionCellFrames(origin)) {
    assert.equal(frame(p.next,old.id).width,old.width); assert.equal(frame(p.next,old.id).height,old.height);
  }
  save(f,p); assert.equal(f.scope.getComposition().cells.length,4);
  assert.ok(f.scope.undo()); assert.deepEqual(f.scope.getComposition(),origin); f.scope.release();
});

test('drawing previews, native text movement, one Undo/Redo and reload share the same result', () => {
  const f=fixture(), a=f.ids[0], r=frame(f.scope.getComposition(),a);
  const target={...f.scope,commitCompletedOperation:(candidate,options)=>f.scope.commitInCell(a,candidate,options)};
  const text=addTextModule(target,profile,{window:{...r,width:200,height:100}});
  const origin=structuredClone(f.scope.getComposition()), generation=f.scope.getGeneration();
  const gesture=createCompositionCellDrawGesture(origin,'shape:drawn',{x:24,y:24},1,a);
  let p; for (const x of [30,60,120,200]) p=gesture({x,y:120},true,true);
  assert.equal(f.scope.getGeneration(),generation); assert.deepEqual(f.scope.getComposition(),origin);
  save(f,p); const after=f.scope.getComposition();
  assert.deepEqual(after,reconcileCompositionCells(origin,p.next,{moveContents:true}));
  assert.deepEqual(after.texts,origin.texts);
  assert.deepEqual(frame(after,text),{...frame(origin,text),left:frame(origin,text).left+frame(after,a).left-frame(origin,a).left});
  assert.ok(f.scope.undo()); assert.deepEqual(f.scope.getComposition(),origin);
  assert.ok(f.scope.redo()); assert.deepEqual(f.scope.getComposition(),after);
  const reopened=createCompositionEditorScope(createSystemWorkflowDraftStore({ profileAddress:profile,storage:f.storage}));
  assert.deepEqual(reopened.getComposition(),after); reopened.release(); f.scope.release();
});

test('invalid, stale, failed or abandoned drawing cannot save a partial cell or move its neighbours', () => {
  const f=fixture(), origin=structuredClone(f.scope.getComposition()), generation=f.scope.getGeneration();
  const args=['shape:drawn',{left:24,top:24,width:200,height:120},'right'];
  for (const bad of [[f.ids[0],args[1],'right'],['bad',args[1],'right'],[args[0],{...args[1],width:0},'right'],
    [args[0],{...args[1],left:NaN},'right'],[args[0],args[1],'unknown'],[args[0],{...args[1],left:17000},'right']]) {
    assert.throws(()=>f.scope.editBento('drawCell',bad,generation)); assert.deepEqual(f.scope.getComposition(),origin);
  }
  createCompositionCellDrawGesture(origin,args[0],{x:24,y:24},1)({x:200,y:120},false,true);
  const fresh=createCompositionCellDrawGesture(origin,args[0],{x:24,y:24},1);
  assert.equal(fresh({x:2,y:2}),null); assert.deepEqual(f.scope.getComposition(),origin);
  const p=fresh({x:200,y:120},false,true);
  f.fail(true); assert.throws(()=>save(f,p),/saved/); f.fail(false);
  assert.deepEqual(f.scope.getComposition(),origin); assert.equal(f.scope.getGeneration(),generation);
  save(f,p); const after=f.scope.getComposition();
  assert.throws(()=>f.scope.editBento('drawCell',args,generation),/changed/); assert.deepEqual(f.scope.getComposition(),after);
  assert.ok(f.scope.undo()); assert.deepEqual(f.scope.getComposition(),origin);
  f.scope.release(); assert.throws(()=>f.scope.editBento('drawCell',args,generation),/active/);
});

test('the first drawn cell gets normal spacing and writes to the same document and retains profile data', () => {
  const data=new Map(), storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
  const root=createSystemWorkflowDraftStore({ profileAddress:profile,storage}), scope=createCompositionEditorScope(root);
  const original=structuredClone(root.getDraft()), value=scope.getComposition();
  assert.equal(value.cells.length,0);
  const p=createCompositionCellDrawGesture(value,'shape:first',{x:24,y:24},1)({x:320,y:240},true);
  scope.editBento(p.action,p.args,scope.getGeneration());
  assert.deepEqual(scope.getComposition().bento,{gap:24,padding:24});
  const after=root.getSnapshot(); assert.equal(after, scope.getSnapshot());
  assert.deepEqual(after.identityPresentation, original.identityPresentation);
  assert.equal(after.profileAddress, original.profileAddress);
  assert.ok(scope.undo()); assert.deepEqual(scope.getComposition(),value); scope.release();
});

test('drawing retains minimum size when returning to its anchor and rejects full layouts', () => {
  const f=fixture(), value=f.scope.getComposition();
  const gesture=createCompositionCellDrawGesture(value,'shape:drawn',{x:24,y:500},1);
  gesture({x:200,y:120}); const p=gesture({x:0,y:0});
  assert.ok(frame(p.next,'shape:drawn').width>=80); assert.ok(frame(p.next,'shape:drawn').height>=24);
  assert.deepEqual(p.guides,[]);
  const full={...value,cells:Array.from({length:16},()=>value.cells[0])};
  assert.throws(()=>drawCompositionBentoCell(full,'shape:drawn',{left:24,top:500,width:200,height:120},'right'),/room/);
  f.scope.release();
});
