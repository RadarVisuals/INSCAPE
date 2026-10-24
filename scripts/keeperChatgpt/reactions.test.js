import test from 'node:test';
import assert from 'node:assert/strict';
import { readReply } from './responses.js';
import { keeperReplyTool, partialKeeperReply, validateKeeperReply } from './reactions.js';

const scene = { gestures: true, layered: true, pointer: true, artworks: [{ id: 'art-1', title: 'Night visitor' }] };
const item = args => ({ id: 'fc_one', type: 'function_call', namespace: 'keeper', name: 'respond', arguments: JSON.stringify(args) });
const event = data => `data: ${JSON.stringify(data)}\n\n`;
const response = (args, ending = 'response.completed') => {
  const call = item(args);
  return new Response(event({ type: 'response.output_item.added', item: { ...call, arguments: '' } })
    + [...call.arguments].map(delta => event({ type: 'response.function_call_arguments.delta', item_id: call.id, delta })).join('')
    + event({ type: 'response.output_item.done', item: call }) + event({ type: ending }));
};

test('namespaced reply tool bounds its gestures and targets, including reduced motion', () => {
  const tool = keeperReplyTool(scene);
  assert.equal(tool.type, 'namespace'); assert.equal(tool.tools[0].strict, true);
  assert.deepEqual(tool.tools[0].parameters.properties.target.enum, ['none', 'pointer', 'art-1']);
  assert.deepEqual(keeperReplyTool({ ...scene, reducedMotion: true }).tools[0].parameters.properties.gesture.enum, ['none']);
});

test('structured reply streams escaped text but releases gestures only after completed inference', async () => {
  const args = { reply: 'Oh. "Friendly".\nVery 🐙.', gesture: 'retreat', target: 'art-1' };
  let text = '';
  const result = await readReply(response(args), delta => { text += delta; }, scene);
  assert.equal(text, args.reply); assert.equal(result.text, args.reply);
  assert.deepEqual(result.action, { gesture: 'retreat', target: 'art-1' });
  await assert.rejects(readReply(response(args, 'response.failed'), () => {}, scene), /could not finish/);
  await assert.rejects(readReply(response({ ...args, gesture: 'execute_code' }), () => {}, scene), /invalid reply/);
  assert.throws(() => validateKeeperReply({ ...item(args), namespace: 'shell' }, scene), /unknown action/);
  assert.throws(() => validateKeeperReply(item({ ...args, target: 'art-99' }), scene), /invalid reply/);
});

test('partial JSON never leaks control fields or incomplete escapes into the bubble', () => {
  assert.equal(partialKeeperReply('{"reply":"hello\\u'), 'hello');
  assert.equal(partialKeeperReply('{"reply":"hello\\u00'), 'hello');
  assert.equal(partialKeeperReply('{"reply":"hello","gesture":"startled"}'), 'hello');
  assert.equal(partialKeeperReply('{"gesture":"startled","reply":"hello"}'), '');
});
