import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultBrowserPreferences, libraryOpeningPreferences } from './browserPreferences.js';
import { createEditorPreferencesStore } from '../../public/ownerSystemWorkflow/editorPreferencesStore.js';

test('chosen opening category survives storage, resets hiding filters, and remains profile-local', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const profile = '0x1111111111111111111111111111111111111111';
  const first = createEditorPreferencesStore({ profile, storage });
  first.update('library', value => ({ ...value, startCategoryId: 'curated', query: 'unrelated', relationshipView: 'owned' }));
  first.flush();
  const second = createEditorPreferencesStore({ profile, storage });
  const opened = libraryOpeningPreferences(second.section('library').getSnapshot(), [{ id: 'curated' }]);
  assert.deepEqual(opened.view, { kind: 'category', id: 'curated' });
  assert.equal(opened.query, ''); assert.equal(opened.relationshipView, 'all');
  const other = createEditorPreferencesStore({ profile: '0x2222222222222222222222222222222222222222', storage });
  assert.equal(other.section('library').getSnapshot().startCategoryId, null);
});

test('deleted opening category falls back to All; no chosen category preserves the existing browsing preference', () => {
  const saved = { ...defaultBrowserPreferences(), startCategoryId: 'deleted', view: { kind: 'category', id: 'deleted' } };
  assert.equal(libraryOpeningPreferences(saved, []).startCategoryId, null);
  assert.deepEqual(libraryOpeningPreferences(saved, []).view, { kind: 'all', id: null });
  const ordinary = { ...defaultBrowserPreferences(), query: 'dragon', relationshipView: 'created' };
  assert.equal(libraryOpeningPreferences(ordinary, []), ordinary);
});
