import test from 'node:test';
import assert from 'node:assert/strict';
import { keeperMetadataTool, requestKeeperMetadata, validateMetadataCall } from './metadata.js';
import { keeperMetadataReference } from '../../src/keeper/keeperMetadata.js';
import { readReply } from './responses.js';

const ref = keeperMetadataReference(`42:0x${'a'.repeat(40)}:0x${'0'.repeat(63)}4`, 'LSP8');
const scene = { artworks: [{ id: 'art-1', metadata: ref }, { id: 'art-2' }] };
const call = { type: 'function_call', id: 'fc_one', call_id: 'call_one', namespace: 'keeper', name: 'read_metadata', arguments: '{"targets":["art-1"]}' };
const event = value => `data: ${JSON.stringify(value)}\n\n`;

test('metadata tool accepts only known eligible targets and carries reasoning into continuation privately', async () => {
  assert.deepEqual(keeperMetadataTool(scene).parameters.properties.targets.items.enum, ['art-1']);
  assert.equal(keeperMetadataTool({ artworks: [] }), null);
  for (const targets of [['art-2'], ['art-1', 'art-1'], ['https://example.test'], []])
    assert.throws(() => validateMetadataCall({ ...call, arguments: JSON.stringify({ targets }) }, scene), /unavailable/);
  const reasoning = { type: 'reasoning', id: 'rs_one', summary: [], encrypted_content: 'opaque-reasoning' };
  const wire = event({ type: 'response.output_item.done', item: reasoning }) + event({ type: 'response.output_item.added', item: { ...call, arguments: '' } })
    + event({ type: 'response.output_item.done', item: call }) + event({ type: 'response.completed' });
  let text = '';
  const result = await readReply(new Response(wire), delta => { text += delta; }, scene, true);
  assert.equal(text, ''); assert.deepEqual(result.output, [reasoning, call]);
  assert.deepEqual(result.lookup, { targets: ['art-1'], callId: 'call_one' });
  await assert.rejects(readReply(new Response(wire), () => {}, scene, false), /metadata lookup/);
});

test('lookup tickets bind results to artwork, clean up on success, cancellation and timeout', async () => {
  const connection = {}, controller = new AbortController(); let packet;
  const promise = requestKeeperMetadata(connection, ['art-1'], scene, controller.signal, event => { packet = event; });
  assert.equal(packet.metadata.requestId, connection.lookup.requestId);
  assert.throws(() => connection.lookup.accept([{ id: 'art-2', ...ref, status: 'unavailable' }]), /target changed/);
  connection.lookup.accept([{ id: 'art-1', ...ref, status: 'unavailable' }]);
  assert.equal((await promise)[0].status, 'unavailable'); assert.equal(connection.lookup, null);
  const cancelled = requestKeeperMetadata(connection, ['art-1'], scene, controller.signal, () => {});
  controller.abort(); await assert.rejects(cancelled, { name: 'AbortError' }); assert.equal(connection.lookup, null);
  const timedOut = await requestKeeperMetadata(connection, ['art-1'], scene, new AbortController().signal, () => {}, 5);
  assert.equal(timedOut[0].status, 'failed'); assert.equal(connection.lookup, null);
});
