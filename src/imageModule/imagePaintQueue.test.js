import test from 'node:test';
import assert from 'node:assert/strict';
import { createImagePaintQueue } from './imagePaintQueue.js';

const request = (source = 'https://fixture.test/a.webp', width = 256, height = 256) => ({ source, width, height });
function fixture(decode = async () => {}) {
  const workers = [], urls = [], revoked = [];
  const queue = createImagePaintQueue({
    createWorker() {
      const worker = { messages: [], terminated: 0,
        postMessage(message) { this.messages.push(message); }, terminate() { this.terminated++; } };
      workers.push(worker); return worker;
    },
    createURL(blob) { assert.ok(blob instanceof Blob); const url = 'blob:paint-' + (urls.length + 1); urls.push(url); return url; },
    revokeURL: url => revoked.push(url), decode,
  });
  const jobs = () => workers.flatMap(worker => worker.messages.filter(message => message.type === 'prepare'));
  const complete = async (job, blob = new Blob(['pixels'])) => {
    const worker = workers.find(worker => worker.messages.includes(job));
    await worker.onmessage({ data: { id: job.id, blob, width: job.width, height: job.height } });
  };
  return { queue, workers, urls, revoked, jobs, complete };
}

test('sixteen repeated Images and their Preview share pending work, decoded URLs and final cleanup', async () => {
  let decodes = 0;
  const f = fixture(async () => { decodes++; });
  const editor = Array.from({ length: 16 }, () => f.queue.client()), values = [];
  editor.forEach((client, index) => client.prepare(request('https://fixture.test/' + index % 2 + '.webp'), value => { values[index] = value; }));
  assert.equal(f.workers.length, 1); assert.equal(f.jobs().length, 1);
  await f.complete(f.jobs()[0]); await f.complete(f.jobs()[1]);
  assert.equal(f.jobs().length, 2); assert.equal(f.urls.length, 2); assert.equal(decodes, 2);
  assert.equal(new Set(values.map(value => value.url)).size, 2);
  const preview = Array.from({ length: 16 }, () => f.queue.client());
  preview.forEach((client, index) => client.prepare(request('https://fixture.test/' + index % 2 + '.webp'), value => assert.equal(value.url, values[index].url)));
  assert.equal(f.jobs().length, 2, 'Preview does not fetch/decode/resize the same sources again');
  preview.forEach(client => client.dispose());
  assert.deepEqual(f.revoked, [], 'closing Preview cannot revoke Editor sources');
  assert.equal(f.workers[0].terminated, 0);
  editor.forEach(client => client.dispose());
  assert.deepEqual(f.revoked.sort(), f.urls.sort()); assert.equal(f.workers[0].terminated, 1);
});

test('larger decoded detail can serve smaller views, while enlargement gets its own adequate source', async () => {
  const f = fixture(), large = f.queue.client(), small = f.queue.client(), larger = f.queue.client();
  let a, b, c;
  large.prepare(request(undefined, 512, 512), value => { a = value; }); await f.complete(f.jobs()[0]);
  small.prepare(request(), value => { b = value; }); assert.equal(b.url, a.url); assert.equal(f.jobs().length, 1);
  larger.prepare(request(undefined, 1024, 1024), value => { c = value; });
  assert.equal(c, undefined, 'an undersized prepared source never satisfies enlargement');
  await f.complete(f.jobs()[1]); assert.notEqual(c.url, a.url); assert.equal(c.width, 1024);
  large.dispose(); assert.deepEqual(f.revoked, []); small.dispose(); assert.deepEqual(f.revoked, [a.url]);
  larger.dispose(); assert.equal(f.revoked.length, 2);
});

test('a changed source cancels obsolete work without delivering it to the new artwork', async () => {
  const f = fixture(), client = f.queue.client(), results = [];
  client.prepare(request(), value => results.push(value)); const old = f.jobs()[0];
  client.prepare(request('https://fixture.test/new.webp'), value => results.push(value));
  assert.ok(f.workers[0].messages.some(message => message.type === 'cancel' && message.id === old.id));
  await f.complete(old); assert.equal(f.urls.length, 0); assert.equal(results.length, 0);
  await f.complete(f.jobs()[1]); assert.equal(results.length, 1);
  client.dispose(); assert.deepEqual(f.revoked, f.urls);
});

test('cancelling one subscriber does not abort another subscriber of the same image', async () => {
  const f = fixture(), first = f.queue.client(), second = f.queue.client();
  let calls = 0;
  first.prepare(request(), () => assert.fail('disposed subscriber')); second.prepare(request(), () => { calls++; });
  first.dispose(); assert.equal(f.workers[0].messages.filter(message => message.type === 'cancel').length, 0);
  await f.complete(f.jobs()[0]); assert.equal(calls, 1); second.dispose();
});

test('closing while decoding revokes once and ignores late completion and old worker messages', async () => {
  let finish;
  const f = fixture(() => new Promise(resolve => { finish = resolve; })), client = f.queue.client();
  client.prepare(request(), () => assert.fail('closed consumer')); const oldJob = f.jobs()[0];
  const decoding = f.complete(oldJob); assert.equal(f.urls.length, 1);
  client.dispose(); assert.deepEqual(f.revoked, f.urls); finish(); await decoding;
  assert.equal(f.revoked.length, 1);
  const next = f.queue.client(); next.prepare(request(), () => {});
  assert.equal(f.workers.length, 2);
  await f.complete(oldJob); assert.equal(f.urls.length, 1, 'old worker cannot publish into the new lifetime');
  next.dispose();
});

for (const failure of ['unsupported', 'decode', 'worker']) test(failure + ' failure preserves native fallback and allows a later retry', async () => {
  let badDecode = failure === 'decode';
  const f = fixture(async () => { if (badDecode) throw Error('decode failed'); });
  const client = f.queue.client(), values = [];
  client.prepare(request(), value => values.push(value));
  if (failure === 'worker') f.workers[0].onerror({ preventDefault() {} });
  else await f.complete(f.jobs()[0], failure === 'unsupported' ? null : new Blob(['pixels']));
  assert.equal(values[0].url, null); assert.equal(f.revoked.length, f.urls.length);
  badDecode = false; client.prepare(request(), value => values.push(value));
  await f.complete(f.jobs().at(-1)); assert.ok(values.at(-1).url);
  client.dispose(); assert.equal(f.revoked.length, f.urls.length);
});

test('failed worker creation and already disposed consumers cannot retain jobs or callbacks', () => {
  const queue = createImagePaintQueue({ createWorker() { throw Error('unavailable'); } });
  const client = queue.client(), results = [];
  client.prepare(request(), value => results.push(value)); assert.equal(results[0].url, null);
  client.dispose(); client.prepare(request(), () => assert.fail('disposed consumer'));
});

test('one hundred editor and preview lifetimes release every paint URL and worker', async () => {
  const f = fixture();
  for (let cycle = 0; cycle < 100; cycle++) {
    const editor = f.queue.client(), preview = f.queue.client();
    let editorResult, previewResult;
    editor.prepare(request(), value => { editorResult = value; });
    const job = f.jobs().at(-1);
    preview.prepare(request(), value => { previewResult = value; });
    await f.complete(job);
    assert.equal(previewResult.url, editorResult.url);
    preview.dispose();
    assert.equal(f.revoked.includes(editorResult.url), false, 'Editor still owns the shared source');
    editor.dispose();
    assert.deepEqual(f.revoked, f.urls, 'each closed lifetime leaves no live paint URL');
    assert.equal(f.workers.length, cycle + 1);
    assert.ok(f.workers.every(worker => worker.terminated === 1), 'no worker survives its final consumer');
    await f.complete(job);
    assert.equal(f.urls.length, cycle + 1, 'late messages cannot resurrect closed sources');
  }
});
