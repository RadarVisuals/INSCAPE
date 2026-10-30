import test from 'node:test';
import assert from 'node:assert/strict';
import {dropLayer} from './workspaceLayers.js';
const item=id=>({id,parent:'display',locked:false});
const ids=items=>items.filter(i=>i.parent==='display').map(i=>i.id);
test('explicit drop edges match front-to-back rows while keeping groups intact',()=>{
 const items=[{id:'image'},...['a','b','c','d','e'].map(item)];
 const groups=[{id:'group',placementIds:['b','c']}];
 assert.deepEqual(ids(dropLayer(items,groups,'e','b','before')),['a','b','c','e','d']);
 assert.deepEqual(ids(dropLayer(items,groups,'e','c','after')),['a','e','b','c','d']);
 assert.deepEqual(ids(dropLayer(items,groups,'b','e','before')),['a','d','e','b','c']);
 assert.deepEqual(ids(dropLayer(items,groups,'b','a','after')),['b','c','a','d','e']);
 assert.equal(dropLayer(items,groups,'b','c','before'),items);
 assert.equal(dropLayer(items,groups,'missing','a','before'),items);
 assert.equal(dropLayer(items.map(i=>i.id==='a'?{...i,locked:true}:i),groups,'d','e').at(0),items[0]);
 assert.deepEqual(ids(dropLayer(items.map(i=>i.id==='a'?{...i,locked:true}:i),groups,'d','e')),ids(items));
 assert.deepEqual(ids(items),['a','b','c','d','e'],'input order is never mutated');
});
