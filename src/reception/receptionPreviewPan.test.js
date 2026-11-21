import test from 'node:test';
import assert from 'node:assert/strict';
import { createReceptionPreviewPan } from './receptionPreviewPan.js';

function fixture() {
  const jobs = new Map(); let id = 0;
  const plane = { style: { removeProperty(key) { delete this[key]; } } };
  const pan = createReceptionPreviewPan({ getPlane: () => plane,
    schedule: run => { jobs.set(++id,run); return id; }, cancel: id => jobs.delete(id) });
  const paint = () => { const callbacks=[...jobs.values()]; jobs.clear(); callbacks.forEach(run=>run()); };
  return {pan,plane,jobs,paint};
}
test('preview pans freely in every direction and coalesces pointer samples into one paint', () => {
  const f=fixture();
  f.pan.update({x:10000,y:-9000}); f.pan.update({x:-12000.2,y:8000.7});
  assert.equal(f.jobs.size,1); assert.deepEqual(f.pan.getOffset(),{x:-12000.2,y:8000.7});
  f.paint(); assert.equal(f.plane.style.translate,'-12000px 8001px');
  const snapshot=f.pan.getOffset(); snapshot.x=0;
  assert.equal(f.pan.getOffset().x,-12000.2);
  f.pan.update({x:NaN,y:0}); assert.equal(f.jobs.size,0);
});
test('Escape can restore the gesture origin and Reset cancels pending movement immediately', () => {
  const f=fixture(); f.pan.update({x:40,y:-70}); f.paint();
  const start=f.pan.getOffset();
  f.pan.update({x:300,y:-600}); f.paint();
  f.pan.update(start); f.paint(); assert.equal(f.plane.style.translate,'40px -70px');
  f.pan.update({x:100,y:200}); f.pan.reset();
  assert.equal(f.jobs.size,0); assert.equal(f.plane.style.translate,'0px 0px');
  assert.deepEqual(f.pan.getOffset(),{x:0,y:0});
});
test('closing Preview cancels its paint and removes the temporary transform', () => {
  const f=fixture(); f.pan.update({x:40,y:50}); f.paint();
  f.pan.update({x:80,y:90}); f.pan.dispose();
  assert.equal(f.jobs.size,0); assert.equal(f.plane.style.translate,undefined);
});
