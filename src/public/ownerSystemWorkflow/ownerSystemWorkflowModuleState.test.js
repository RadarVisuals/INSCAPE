import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PRESENTATION_BOARD_INSTANCE_EVENT,
  PRESENTATION_BOARD_INSTANCE_STATE,
  presentationBoardInstanceStateFromShortcut,
  transitionPresentationBoardInstance,
} from './ownerSystemWorkflowModuleState.js';
import {
  DEFAULT_PRESENTATION_BOARD_SHORTCUT_ICON_PRESENTATION,
  loadPresentationBoardShortcut,
  normalizePresentationBoardShortcutIconPresentation,
  presentationBoardShortcutStorageKey,
} from './presentationBoardShortcutStorage.js';

test('Board lifecycle is singular and duplicate or out-of-order commands are inert', () => {
  let state = PRESENTATION_BOARD_INSTANCE_STATE.ABSENT;
  state = transitionPresentationBoardInstance(state, PRESENTATION_BOARD_INSTANCE_EVENT.ADD);
  assert.equal(state, PRESENTATION_BOARD_INSTANCE_STATE.WINDOW);
  assert.equal(transitionPresentationBoardInstance(state, PRESENTATION_BOARD_INSTANCE_EVENT.ADD), state);
  state = transitionPresentationBoardInstance(state, PRESENTATION_BOARD_INSTANCE_EVENT.MINIMIZE);
  assert.equal(state, PRESENTATION_BOARD_INSTANCE_STATE.MINIMIZED);
  assert.equal(transitionPresentationBoardInstance(state, PRESENTATION_BOARD_INSTANCE_EVENT.ADD), state);
  state = transitionPresentationBoardInstance(state, PRESENTATION_BOARD_INSTANCE_EVENT.RESTORE);
  assert.equal(state, PRESENTATION_BOARD_INSTANCE_STATE.WINDOW);
  assert.equal(transitionPresentationBoardInstance(state, PRESENTATION_BOARD_INSTANCE_EVENT.RESTORE), state);
});

test('legacy shortcut open-state restores safely and invalid storage fails closed to the current default', () => {
  assert.equal(presentationBoardInstanceStateFromShortcut({ open: false }), PRESENTATION_BOARD_INSTANCE_STATE.MINIMIZED);
  assert.equal(presentationBoardInstanceStateFromShortcut({ open: true }), PRESENTATION_BOARD_INSTANCE_STATE.WINDOW);
  assert.equal(presentationBoardInstanceStateFromShortcut(null), PRESENTATION_BOARD_INSTANCE_STATE.WINDOW);
  const values = new Map([[presentationBoardShortcutStorageKey('0xabc'), JSON.stringify({ name: 'BOARD', open: false })]]);
  const storage = { getItem: (key) => values.get(key) || null };
  assert.deepEqual(loadPresentationBoardShortcut('0xabc', storage), { name: 'BOARD', open: false });
  assert.equal(loadPresentationBoardShortcut('invalid', { getItem: () => '{' }), null);
});

test('shortcut icon presentation preserves alpha-safe framing controls within exact bounds', () => {
  assert.deepEqual(normalizePresentationBoardShortcutIconPresentation(null),
    DEFAULT_PRESENTATION_BOARD_SHORTCUT_ICON_PRESENTATION);
  assert.deepEqual(normalizePresentationBoardShortcutIconPresentation({ labelSize: 99, offsetX: 99, offsetY: -99, scale: 8, size: 999 }),
    { labelSize: 20, offsetX: 99, offsetY: -99, scale: 3, size: 150 });
  assert.deepEqual(normalizePresentationBoardShortcutIconPresentation({ labelSize: '10', offsetX: '7', offsetY: '-5', scale: '1.75', size: '126' }),
    { labelSize: 10, offsetX: 7, offsetY: -5, scale: 1.75, size: 126 });
  assert.deepEqual(normalizePresentationBoardShortcutIconPresentation({ offsetX: 'bad', offsetY: null, scale: Infinity }),
    DEFAULT_PRESENTATION_BOARD_SHORTCUT_ICON_PRESENTATION);
});
