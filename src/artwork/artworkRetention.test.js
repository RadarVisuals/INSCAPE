import test from 'node:test';
import assert from 'node:assert/strict';
import { createArtworkRetention, ARTWORK_RETENTION_MS, ARTWORK_RETENTION_LIMIT } from './artworkRetention.js';

function fixture() {
  const timers = new Map(); let id = 0;
  const pool = createArtworkRetention({ schedule: (run, delay) => { timers.set(++id, { run, delay }); return id; }, cancel: id => timers.delete(id) });
  return { pool, timers, expire: () => [...timers.values()].forEach(timer => timer.run()) };
}
test('returning before expiry cancels eviction; a later departure gets a fresh grace period', () => {
  const { pool, timers, expire } = fixture(); let evictions = 0;
  const returned = pool.retain(() => evictions++);
  assert.equal([...timers.values()][0].delay, ARTWORK_RETENTION_MS);
  returned(); expire(); assert.equal(evictions, 0); assert.equal(timers.size, 0);
  pool.retain(() => evictions++); expire(); assert.equal(evictions, 1); assert.equal(timers.size, 0);
});
test('only the four most recently departed documents survive capacity pressure', () => {
  const { pool, timers, expire } = fixture(); const evicted = [];
  for (let i = 0; i < 7; i++) pool.retain(() => evicted.push(i));
  assert.deepEqual(evicted, [0, 1, 2]); assert.equal(timers.size, ARTWORK_RETENTION_LIMIT);
  expire(); assert.deepEqual(evicted, [0, 1, 2, 3, 4, 5, 6]);
});
test('source replacement and owner disposal remove their pending evictions', () => {
  const { pool, timers, expire } = fixture(); let evictions = 0;
  const dispose = Array.from({ length: 4 }, () => pool.retain(() => evictions++));
  dispose.forEach(cleanup => { cleanup(); cleanup(); });
  expire(); assert.equal(evictions, 0); assert.equal(timers.size, 0);
});
test('a stale timer cannot evict an artwork that already resumed', () => {
  const { pool, timers } = fixture(); let evictions = 0;
  const resume = pool.retain(() => evictions++), late = [...timers.values()][0].run;
  resume(); late(); assert.equal(evictions, 0);
});
