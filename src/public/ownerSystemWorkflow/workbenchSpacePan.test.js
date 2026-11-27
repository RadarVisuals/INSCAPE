import test from 'node:test';
import assert from 'node:assert/strict';
import { workbenchSpacePanIntent } from './useWorkbenchPan.js';

function fixture() {
  const body = {}, control = { closest: () => null, matches: () => false };
  const canvas = { closest: () => null, matches: selector => selector.includes('.system-workflow__workbench') };
  let hovered = canvas;
  const host = {
    ownerDocument: { body }, contains: node => [canvas, host].includes(node),
    querySelectorAll: () => hovered ? [hovered] : [], matches: () => hovered === host,
  };
  const intent = (target = control, extra = {}) => workbenchSpacePanIntent({ code: 'Space', target, ...extra }, host);
  return { body, canvas, host, control, intent, hover: node => { hovered = node; } };
}

test('Space starts canvas navigation after toolbar focus without activating that toolbar button', () => {
  const f = fixture();
  assert.deepEqual(f.intent(), { preventDefault: true });
  assert.deepEqual(f.intent(f.body), { preventDefault: true });
});

test('canvas background retains Space navigation after the composition leaves the viewport', () => {
  const f = fixture(); f.hover(f.host);
  assert.deepEqual(f.intent(f.host), { preventDefault: true });
});

test('typing, sliders, dialogs, menus and modified Space never arm camera navigation', () => {
  const f = fixture();
  for (const blocked of ['input', 'textarea', 'select', '[role="textbox"]', '[role="slider"]', '[role="dialog"]', '[role="menu"]']) {
    assert.equal(f.intent({ closest: selector => selector.includes(blocked) ? {} : null }), null, blocked);
  }
  assert.equal(f.intent({ isContentEditable: true }), null);
  for (const key of ['ctrlKey', 'metaKey', 'altKey', 'isComposing']) assert.equal(f.intent(f.control, { [key]: true }), null);
  assert.equal(f.intent(f.control, { code: 'KeyC' }), null);
});

test('Space on interface controls remains native when the pointer is outside the canvas', () => {
  const f = fixture(); f.hover(f.control);
  assert.equal(f.intent(), null);
  f.hover(null);
  assert.equal(f.intent(), null);
  assert.deepEqual(f.intent(f.host), { preventDefault: true });
});
