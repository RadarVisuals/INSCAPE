import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { ARTWORK_DOCUMENT_HTML } from './artworkDocumentHost.js';

function host() {
  const listeners = {}, forwarded = [], upward = [], loads = [];
  const parent = { postMessage: data => upward.push(data) };
  const child = { postMessage: data => forwarded.push(JSON.parse(JSON.stringify(data))) };
  const svg = { createElementNS: () => ({}), documentElement: { append() {} } };
  const context = {
    parent, addEventListener: (name, callback) => { listeners[name] = callback; },
    document: { createElement: () => ({ contentWindow: child, addEventListener: (_, callback) => loads.push(callback) }), body: { append() {} } },
    DOMParser: class { parseFromString() { return svg; } },
    XMLSerializer: class { serializeToString() { return '<svg/>'; } },
    Blob, URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
  };
  vm.runInNewContext(ARTWORK_DOCUMENT_HTML.match(/<script>([\s\S]*)<\/script>/)[1], context);
  const send = (data, source = parent) => listeners.message({ source, data });
  const source = visible => send({ type: 'inscape:artwork-source', svg: '<svg/>', visible });
  return { send, source, load: () => loads[0](), forwarded, upward };
}
const visibility = visible => ({ type: 'inscape:html-artwork-visibility', visible });
test('the latest visibility survives source preparation and child navigation', () => {
  const h = host(); h.send(visibility(true)); h.source(true); h.send(visibility(false));
  h.forwarded.length = 0; h.load(); assert.deepEqual(h.forwarded, [visibility(false)]);
  assert.equal(h.upward[0].type, 'inscape:artwork-loaded');
  h.send(visibility(true)); assert.deepEqual(h.forwarded.at(-1), visibility(true));
});
test('an initially hidden source receives pause on its first load', () => {
  const h = host(); h.source(false); h.load(); assert.deepEqual(h.forwarded, [visibility(false)]);
});
test('only parent booleans can alter visibility, and unrelated fields are not relayed', () => {
  const h = host(); h.source(true); h.load(); h.forwarded.length = 0;
  h.send(visibility(false), {}); h.send(visibility('false')); h.send(visibility(null));
  assert.deepEqual(h.forwarded, []);
  h.send({ ...visibility(false), unrelated: 'ignored' }); assert.deepEqual(h.forwarded, [visibility(false)]);
});
test('density and inspection still reach the same document without reloading it', () => {
  const h = host(); h.source(true);
  h.send({ type: 'inscape:artwork-density', scale: 2 }); h.load();
  h.send({ type: 'inscape:inspect-artwork' }); h.send({ type: 'inscape:release-artwork' });
  assert.deepEqual(h.forwarded.slice(-4), [{ type: 'inscape:artwork-density', scale: 2 }, visibility(true),
    { type: 'inscape:inspect-artwork' }, { type: 'inscape:release-artwork' }]);
});
