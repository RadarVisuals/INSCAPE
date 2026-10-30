import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditorPreferencesStore, editorPreferencesKey } from '../src/public/ownerSystemWorkflow/editorPreferencesStore.js';

test('Reception window preferences retain Workbench sections without entering content or publication', () => {
  const map = new Map(), storage = { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value) };
  const before = createEditorPreferencesStore({ profile: 'reception', storage, delay: 0 });
  before.section('textSection').update('article'); before.tools.change({ type: 'close', tab: 'FX' }); before.dispose();
  const saved = JSON.parse(map.get(editorPreferencesKey('reception')));
  delete saved.value.receptionFrames;
  map.set(editorPreferencesKey('reception'), JSON.stringify(saved));
  const preferences = createEditorPreferencesStore({ profile: 'reception', storage, delay: 0 });
  assert.equal(preferences.getError(), null); assert.equal(preferences.getSnapshot().textSection, 'article');
  const frames = { text: { left: 20, top: 40, width: 320, height: 400 } };
  preferences.section('receptionFrames').update(frames); preferences.dispose();
  const restored = createEditorPreferencesStore({ profile: 'reception', storage, delay: 0 });
  assert.deepEqual(restored.getSnapshot().receptionFrames, frames);
  assert.ok(restored.getSnapshot().docks.hidden.includes('FX'));
  restored.section('receptionFrames').update({ text: { ...frames.text, width: Infinity } });
  assert.deepEqual(restored.getSnapshot().receptionFrames, frames);
  assert.equal(map.size, 1); restored.dispose();
});
