import assert from 'node:assert/strict';
import test from 'node:test';
import { clientPointerToGridLocal, decodeGridRectRecord, directionalResizeCandidateFromPointer, encodeGridRectRecord, gridRectToPixelRect, launcherGeometryAvailable, movementCandidateFromPointer, normalizeGridRect, resizeCandidateFromPointer } from './gridGeometry.js';

const geometry={columns:24,rows:13,cellWidth:50,cellHeight:50};
const gridClientRect={left:100,top:60};
const origin={column:2,row:3,columnSpan:4,rowSpan:2};

test('client pointers convert to grid-local coordinates exactly',()=>assert.deepEqual(clientPointerToGridLocal({x:225,y:185},gridClientRect),{x:125,y:125}));
test('grid rectangles normalize and clamp complete geometry',()=>assert.deepEqual(normalizeGridRect({column:99,row:-2,columnSpan:6,rowSpan:4},geometry),{column:18,row:0,columnSpan:6,rowSpan:4}));
test('one grid-to-pixel conversion owns live and committed rendering',()=>assert.deepEqual(gridRectToPixelRect(origin,geometry,2),{left:102,top:152,width:196,height:96}));

test('movement preserves grab offset and spans',()=>{
  const input={gridClientRect,pointerGrabOffset:{x:37,y:21},originGeometry:origin,geometry};
  const candidate=movementCandidateFromPointer({...input,pointer:{x:100+2+6*50+37,y:60+2+7*50+21}});
  assert.deepEqual(candidate,{column:6,row:7,columnSpan:4,rowSpan:2});
});

test('movement is independent of event frequency and path',()=>{
  const input={gridClientRect,pointerGrabOffset:{x:10,y:14},originGeometry:origin,geometry};
  const destination={x:662,y:426};
  const direct=movementCandidateFromPointer({...input,pointer:destination});
  [150,240,399,511].forEach((x)=>movementCandidateFromPointer({...input,pointer:{x,y:300}}));
  assert.deepEqual(movementCandidateFromPointer({...input,pointer:destination}),direct);
});

test('resize preserves top-left, corner offset, and symmetric boundary snapping',()=>{
  const input={gridClientRect,pointerGrabOffset:{x:9,y:11},originGeometry:origin,geometry,minimumSpan:{columns:2,rows:1}};
  const grown=resizeCandidateFromPointer({...input,pointer:{x:100+(2+6)*50-2+9,y:60+(3+3)*50-2+11}});
  assert.deepEqual(grown,{column:2,row:3,columnSpan:6,rowSpan:3});
  const shrunk=resizeCandidateFromPointer({...input,pointer:{x:100+(2+2)*50-2+9,y:60+(3+1)*50-2+11}});
  assert.deepEqual(shrunk,{column:2,row:3,columnSpan:2,rowSpan:1});
});

test('directional resize keeps the opposite artwork corner anchored',()=>{
  const originGeometry={column:2,row:3,columnSpan:4,rowSpan:3};
  const geometry={columns:20,rows:20,minColumn:-5,minRow:-5,cellWidth:50,cellHeight:40};
  const northWest=directionalResizeCandidateFromPointer({pointer:{x:50,y:40},startPointer:{x:100,y:80},originGeometry,geometry,minimumSpan:{columns:2,rows:2},edges:{horizontal:'start',vertical:'start'}});
  assert.deepEqual(northWest,{column:1,row:2,columnSpan:5,rowSpan:4});
  const clamped=directionalResizeCandidateFromPointer({pointer:{x:500,y:400},startPointer:{x:100,y:80},originGeometry,geometry,minimumSpan:{columns:2,rows:2},edges:{horizontal:'start',vertical:'start'}});
  assert.deepEqual(clamped,{column:4,row:4,columnSpan:2,rowSpan:2});
  const maximum=directionalResizeCandidateFromPointer({pointer:{x:-1000,y:-1000},startPointer:{x:100,y:80},originGeometry,geometry,minimumSpan:{columns:2,rows:2},maximumSpan:{columns:12,rows:12},edges:{horizontal:'start',vertical:'start'}});
  assert.deepEqual(maximum,{column:-5,row:-5,columnSpan:12,rowSpan:12});
});

test('launcher collision rejects overlap while windows need no collision helper',()=>{
  const items=[{id:'a',geometry:origin},{id:'b',geometry:{column:8,row:3,columnSpan:2,rowSpan:2}}];
  assert.equal(launcherGeometryAvailable('a',{...origin,column:7},items,geometry),false);
  assert.equal(launcherGeometryAvailable('a',{...origin,column:4},items,geometry),true);
});

test('complete geometry persistence round trips and malformed records recover safely',()=>{
  assert.deepEqual(decodeGridRectRecord(encodeGridRectRecord({identity:origin}),geometry),{identity:origin});
  assert.deepEqual(decodeGridRectRecord('{bad',geometry),{});
});
