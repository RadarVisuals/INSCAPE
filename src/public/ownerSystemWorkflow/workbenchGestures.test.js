import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkbenchGestures } from './workbenchGestures.js';
import { initialWorkbenchSelection, changeWorkbenchSelection, workbenchSelectionTarget } from './workbenchSelection.js';

class Events {
  listeners = new Map();
  addEventListener(type, callback) { if (!this.listeners.has(type)) this.listeners.set(type,new Set()); this.listeners.get(type).add(callback); }
  removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
  emit(type, props={}) {
    const event={button:0,pointerId:1,buttons:1,clientX:10,clientY:20,altKey:false,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},...props};
    for(const callback of [...(this.listeners.get(type)||[])])callback(event);
    return event;
  }
  count() { return [...this.listeners.values()].reduce((sum,list)=>sum+list.size,0); }
}
function fixture() {
  const events=new Events(),visibility=new Events(),host=new Events();
  let capture=null;host.focused=0;
  host.hasPointerCapture=id=>capture===id;
  host.setPointerCapture=id=>{capture=id;};
  host.releasePointerCapture=id=>{capture=null;host.emit('lostpointercapture',{pointerId:id});};
  host.forgetCapture=()=>{capture=null;};host.focus=()=>{host.focused++;};
  const original={a:{x:4,y:5,scale:1}},state={transforms:original,selection:['a'],marquee:null,saved:{left:4,top:5},history:[],attempts:0,finished:0,dropped:0};
  const node={isConnected:true};
  const gestures=createWorkbenchGestures({getHost:()=>host,events,visibility,
    restoreTransforms:value=>{state.transforms=value;},replaceSelection:value=>{state.selection=value;},
    restoreSelection:value=>{state.selection=value;},
    previewMarquee:value=>{state.marquee=value;},finishSnap:()=>{state.finished++;},cancelDrop:()=>{state.dropped++;},
  });
  const event={button:0,pointerId:1,clientX:10,clientY:20};
  const move=(extra={})=>gestures.beginMove(event,{nodes:[node],beforeTransforms:original,
    preview:(delta,bypass)=>{state.bypass=bypass;return state.transforms={a:{...original.a,x:original.a.x+delta.x,y:original.a.y+delta.y}};},
    commit:value=>{state.attempts++;if(state.fail)return false;state.saved={left:value.a.x,top:value.a.y};state.history.push(state.saved);return true;},
    previewDrop:()=>{},commitDrop:()=>false,...extra});
  const clean=()=>{assert.equal(events.count()+visibility.count()+host.count(),0);assert.equal(gestures.isActive(),false);assert.equal(host.hasPointerCapture(1),false);assert.equal(state.marquee,null);};
  return {events,visibility,host,state,original,node,gestures,event,move,clean};
}

test('marquee cancellation restores the selection owner meaning, including ordinary handles and Display tools', () => {
  const content = { grids: [{}], shapes: [{ id: 'shape:a' }], imageModules: [{ id: 'image:a' }] };
  const initial = initialWorkbenchSelection(content);
  const selections = ['shape:a', 'image:a', 'display:primary'].map(id => changeWorkbenchSelection(initial, { type: 'select', id }, content));
  selections.push(changeWorkbenchSelection(initial, { type: 'replace', ids: ['shape:a', 'image:a'] }, content));
  selections.push(changeWorkbenchSelection(initial, { type: 'arrive', id: 'image:a' }, content));
  for (const before of selections) for (const reason of ['Escape', 'pointercancel', 'capture loss', 'failed capture']) {
    const f = fixture(); let selection = before;
    const change = action => { selection = changeWorkbenchSelection(selection, action, content); };
    const gestures = createWorkbenchGestures({ getHost: () => f.host, events: f.events, visibility: f.visibility,
      restoreTransforms() {}, replaceSelection: ids => change({ type: 'replace', ids }),
      restoreSelection: state => change({ type: 'restore', state }), previewMarquee() {}, finishSnap() {}, cancelDrop() {},
    });
    if (reason === 'failed capture') f.host.setPointerCapture = () => { throw Error('Capture lost'); };
    gestures.beginMarquee(f.event, { beforeSelection: before, previousSelection: [], hits: () => ['shape:a', 'image:a'] });
    if (reason !== 'failed capture') {
      f.events.emit('pointermove'); assert.equal(selection.mode, 'explicit');
      if (reason === 'Escape') f.events.emit('keydown', { key: 'Escape' });
      else if (reason === 'pointercancel') f.events.emit('pointercancel');
      else { f.host.forgetCapture(); f.host.emit('lostpointercapture'); }
    }
    assert.deepEqual(selection, before, reason);
    assert.equal(workbenchSelectionTarget(selection, content), workbenchSelectionTarget(before, content), reason);
    assert.equal(gestures.isActive(), false);
  }
});
test('move previews independently, then retires ownership before exactly one authoring commit',()=>{
  const f=fixture();f.move();
  const lateFinish=[...f.events.listeners.get('pointerup')][0];
  f.events.emit('pointermove',{pointerId:2,clientX:100});assert.equal(f.state.transforms,f.original);
  f.events.emit('pointermove',{clientX:30,clientY:50,altKey:true});
  assert.deepEqual(f.state.saved,{left:4,top:5});assert.equal(f.state.bypass,true);
  f.events.emit('pointerup');lateFinish({pointerId:1});f.events.emit('pointerup');
  assert.equal(f.state.attempts,1);assert.deepEqual(f.state.saved,{left:24,top:35});assert.equal(f.state.history.length,1);
  assert.equal(f.state.finished,1);assert.equal(f.state.dropped,1);f.clean();
});
for(const reason of ['Escape','blur','hidden','capture loss','pointercancel','released buttons','preview lock','unmount']) {
  test(`${reason} cancels without authoring and releases every owned listener`,()=>{
    const f=fixture();f.move();const lateMove=[...f.events.listeners.get('pointermove')][0];
    f.events.emit('pointermove',{clientX:90});
    if(reason==='Escape')assert.equal(f.events.emit('keydown',{key:'Escape'}).prevented,true);
    else if(reason==='blur')f.events.emit('blur');
    else if(reason==='hidden'){f.visibility.hidden=true;f.visibility.emit('visibilitychange');}
    else if(reason==='capture loss'){f.host.forgetCapture();f.host.emit('lostpointercapture');}
    else if(reason==='pointercancel')f.events.emit('pointercancel');
    else if(reason==='released buttons')f.events.emit('pointermove',{buttons:0});
    else f.gestures.cancel(reason!=='unmount');
    const after=f.state.transforms;lateMove({pointerId:1,buttons:1,clientX:200});f.events.emit('pointerup');
    assert.equal(f.state.transforms,after);assert.equal(f.state.attempts,0);assert.deepEqual(f.state.history,[]);
    if(reason!=='unmount')assert.equal(after,f.original);
    assert.equal(f.state.finished,1);f.clean();
  });
}
test('a different pointer cannot cancel or finish the gesture',()=>{
  const f=fixture();f.move();f.events.emit('pointercancel',{pointerId:2});f.events.emit('pointerup',{pointerId:2});
  assert.equal(f.gestures.isActive(),true);assert.equal(f.gestures.ownsPointer(1),true);
  f.gestures.cancel();f.clean();
});
test('failed storage leaves accepted content/history unchanged and restores only the preview',()=>{
  const f=fixture();f.state.fail=true;f.move();f.events.emit('pointermove',{clientX:90});f.events.emit('pointerup');
  assert.equal(f.state.attempts,1);assert.deepEqual(f.state.saved,{left:4,top:5});assert.deepEqual(f.state.history,[]);assert.equal(f.state.transforms,f.original);f.clean();
});
test('a committed group drop owns completion instead of also moving its source',()=>{
  const f=fixture();let drops=0;f.move({commitDrop:()=>{drops++;return true;}});
  f.events.emit('pointermove',{clientX:40});f.events.emit('pointerup');
  assert.equal(drops,1);assert.equal(f.state.attempts,0);assert.equal(f.state.transforms,f.original);f.clean();
});
test('resize reports deltas to its geometry adapter and confirms once',()=>{
  const f=fixture();let preview,commits=0;
  f.gestures.beginResize(f.event,{beforeTransforms:f.original,valid:()=>true,
    preview:(delta,bypass)=>{preview={delta,bypass};},commit:()=>{commits++;return true;}});
  f.events.emit('pointermove',{clientX:22,clientY:15,altKey:true});f.events.emit('pointerup');f.events.emit('pointerup');
  assert.deepEqual(preview,{delta:{x:12,y:-5},bypass:true});assert.equal(commits,1);f.clean();
});
test('marquee combines hits with explicit additive selection; cancel restores its initial selection',()=>{
  const f=fixture();let rectangle;
  f.gestures.beginMarquee(f.event,{beforeSelection:['a'],previousSelection:['a'],hits:value=>{rectangle=value;return ['b','a'];}});
  f.events.emit('pointermove',{clientX:0,clientY:35});
  assert.deepEqual(rectangle,{left:0,top:20,width:10,height:15});assert.deepEqual(f.state.selection,['a','b']);
  f.gestures.cancel();assert.deepEqual(f.state.selection,['a']);assert.equal(f.state.attempts,0);f.clean();
  f.gestures.beginMarquee(f.event,{beforeSelection:['a'],previousSelection:[],hits:()=>['b']});
  f.events.emit('pointermove');f.events.emit('pointerup');assert.deepEqual(f.state.selection,['b']);f.clean();
});
test('removed target at pointer-up cancels instead of authoring stale geometry',()=>{
  const f=fixture();f.move();f.events.emit('pointermove',{clientX:30});f.node.isConnected=false;f.events.emit('pointerup');
  assert.equal(f.state.attempts,0);assert.equal(f.state.transforms,f.original);f.clean();
});
test('move adapter invalidation cancels before preview or completion while nodes remain connected', () => {
  for (const phase of ['preview', 'completion']) {
    const f = fixture(); let valid = true;
    f.move({ valid: () => valid });
    f.events.emit('pointermove', { clientX: 30 });
    valid = false;
    f.events.emit(phase === 'preview' ? 'pointermove' : 'pointerup', { clientX: 80 });
    assert.equal(f.state.attempts, 0);
    assert.equal(f.state.transforms, f.original);
    f.clean();
  }
});
test('failed capture and an abandoned capture both release ownership',()=>{
  const f=fixture();f.host.setPointerCapture=()=>{throw Error('Unmounted');};assert.equal(f.move(),false);f.clean();
  const g=fixture();g.move();assert.equal(g.gestures.releaseAbandoned(),null);g.host.forgetCapture();
  assert.equal(g.gestures.releaseAbandoned(),1);assert.equal(g.gestures.releaseAbandoned(),null);g.clean();
});
test('busy start is rejected; late callbacks of a cancelled gesture cannot affect its successor',()=>{
  const f=fixture();f.move();const stale=[...f.events.listeners.get('pointerup')][0];assert.equal(f.move(),false);
  f.gestures.cancel();f.move();stale({pointerId:1});assert.equal(f.gestures.isActive(),true);assert.equal(f.state.attempts,0);
  f.gestures.cancel();f.clean();
});
