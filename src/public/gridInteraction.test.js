import assert from 'node:assert/strict';
import test from 'node:test';
import { activateInteraction, createInteraction, effectiveGeometry, INTERACTION_KIND, interactionMatches } from './gridInteraction.js';

const origin={column:1,row:2,columnSpan:3,rowSpan:1};
const base={kind:INTERACTION_KIND.MOVE_LAUNCHER,targetId:'identity',pointerId:7,originGeometry:origin,gridBounds:{columns:24,rows:13},cellWidth:50,cellHeight:50,pointerGrabOffset:{x:9,y:7},startPointer:{x:20,y:30}};
test('state machine installs one explicit kind and candidate',()=>{const state=createInteraction(base);assert.equal(state.kind,INTERACTION_KIND.MOVE_LAUNCHER);assert.deepEqual(effectiveGeometry(origin,state,'identity'),origin);});
test('invalid launcher attempts retain the last visible valid rectangle',()=>{let state=createInteraction(base);state=activateInteraction(state,{...origin,column:4},true);state=activateInteraction(state,{...origin,column:9},false);assert.deepEqual(state.candidateGeometry,{...origin,column:4});assert.equal(state.valid,false);});
test('interaction tokens reject stale capture events',()=>{const first=createInteraction(base);const second=createInteraction({...base,pointerId:8});assert.equal(interactionMatches(second,{interactionId:first.interactionId,pointerId:8}),false);assert.equal(interactionMatches(second,{interactionId:second.interactionId,pointerId:8}),true);});
test('move and resize invariants retain untouched axes',()=>{const moved=activateInteraction(createInteraction(base),{...origin,column:5,row:6},true).candidateGeometry;assert.deepEqual([moved.columnSpan,moved.rowSpan],[3,1]);const resized=activateInteraction(createInteraction({...base,kind:INTERACTION_KIND.RESIZE_WINDOW}),{...origin,columnSpan:8,rowSpan:6},true).candidateGeometry;assert.deepEqual([resized.column,resized.row],[1,2]);});
