import test from 'node:test';
import assert from 'node:assert/strict';
import { readKeeperChatStream } from './keeperChatgptClient.js';

test('Keeper chat reads fragmented Unicode replies and requires confirmed completion', async () => {
  const bytes = new TextEncoder().encode('{"delta":"Hello 🐙"}\n{"done":true}\n');
  const response = new Response(new ReadableStream({ start(controller) {
    for (let i = 0; i < bytes.length; i += 2) controller.enqueue(bytes.slice(i, i + 2));
    controller.close();
  } }));
  let reply = '';
  await readKeeperChatStream(response, delta => { reply += delta; });
  assert.equal(reply, 'Hello 🐙');
  await assert.rejects(readKeeperChatStream(new Response('{"delta":"unfinished"}\n'), () => {}), /interrupted/);
});

test('Keeper chat surfaces stream failures and cancels the unread stream', async () => {
  let cancelled = false;
  const response = new Response(new ReadableStream({
    start(controller) { controller.enqueue(new TextEncoder().encode('{"error":"Please reconnect."}\n')); },
    cancel() { cancelled = true; },
  }));
  await assert.rejects(readKeeperChatStream(response, () => {}), /Please reconnect/);
  assert.equal(cancelled, true);
});

test('chat handles one metadata round trip before final text and rejects repeated tool requests', async () => {
  const request = { requestId: 'a'.repeat(32), targets: ['art-1'] };
  const metadata = JSON.stringify({ metadata: request }) + '\n';
  let handled = false, text = '';
  await readKeeperChatStream(new Response(metadata + '{"delta":"Read it."}\n{"done":true}\n'), delta => {
    assert.equal(handled, true); text += delta;
  }, async value => { assert.deepEqual(value, request); handled = true; });
  assert.equal(text, 'Read it.');
  await assert.rejects(readKeeperChatStream(new Response(metadata + metadata), () => {}, async () => {}), /Invalid/);
  await assert.rejects(readKeeperChatStream(new Response(metadata), () => {}), /Invalid/);
});
