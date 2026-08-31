import assert from 'node:assert/strict';
import test from 'node:test';
import {
  OWNER_METADATA_EVENT,
  OWNER_METADATA_MODE,
  PRESENTATION_BOARD_INSTANCE_EVENT,
  PRESENTATION_BOARD_INSTANCE_STATE,
  ownerMetadataModeView,
  ownerWorkbenchModuleAvailability,
  presentationBoardInstanceStateFromShortcut,
  transitionOwnerMetadataMode,
  transitionPresentationBoardInstance,
} from './ownerSystemWorkflowModuleState.js';
import {
  DEFAULT_PRESENTATION_BOARD_SHORTCUT_ICON_PRESENTATION,
  loadPresentationBoardShortcut,
  normalizePresentationBoardShortcutIconPresentation,
  presentationBoardShortcutStorageKey,
} from './presentationBoardShortcutStorage.js';

const metadataModes = Object.values(OWNER_METADATA_MODE);

test('Metadata transitions always produce one valid, exclusive mode', () => {
  for (const mode of metadataModes) {
    for (const event of Object.values(OWNER_METADATA_EVENT)) {
      const next = transitionOwnerMetadataMode(mode, event);
      assert.ok(metadataModes.includes(next), `${mode} + ${event} produced ${next}`);
      const view = ownerMetadataModeView(next);
      assert.equal(view.projection === 'side' && !view.docked, false);
      assert.equal(view.projection === 'down' && !view.docked, false);
      assert.equal(view.projection === 'side' && view.projection === 'down', false);
    }
  }
});

test('Metadata lifecycle follows the accepted add, attach, projection, detach, and close contract', () => {
  let mode = OWNER_METADATA_MODE.CLOSED;
  mode = transitionOwnerMetadataMode(mode, OWNER_METADATA_EVENT.ADD);
  assert.equal(mode, OWNER_METADATA_MODE.DETACHED);
  assert.equal(transitionOwnerMetadataMode(mode, OWNER_METADATA_EVENT.ADD), OWNER_METADATA_MODE.DETACHED);
  mode = transitionOwnerMetadataMode(mode, OWNER_METADATA_EVENT.ATTACH);
  assert.equal(mode, OWNER_METADATA_MODE.DOCKED_CLOSED);
  mode = transitionOwnerMetadataMode(mode, OWNER_METADATA_EVENT.TOGGLE_INNER);
  assert.equal(mode, OWNER_METADATA_MODE.INNER);
  mode = transitionOwnerMetadataMode(mode, OWNER_METADATA_EVENT.TOGGLE_SIDECAR);
  assert.equal(mode, OWNER_METADATA_MODE.SIDECAR);
  mode = transitionOwnerMetadataMode(mode, OWNER_METADATA_EVENT.UNDOCK);
  assert.equal(mode, OWNER_METADATA_MODE.DETACHED);
  mode = transitionOwnerMetadataMode(mode, OWNER_METADATA_EVENT.CLOSE);
  assert.equal(mode, OWNER_METADATA_MODE.CLOSED);
});

test('repeated Metadata toggles and closing from every open mode are deterministic', () => {
  assert.equal(transitionOwnerMetadataMode(OWNER_METADATA_MODE.INNER, OWNER_METADATA_EVENT.TOGGLE_INNER),
    OWNER_METADATA_MODE.DOCKED_CLOSED);
  assert.equal(transitionOwnerMetadataMode(OWNER_METADATA_MODE.SIDECAR, OWNER_METADATA_EVENT.TOGGLE_SIDECAR),
    OWNER_METADATA_MODE.DOCKED_CLOSED);
  for (const mode of metadataModes.filter((candidate) => candidate !== OWNER_METADATA_MODE.CLOSED)) {
    assert.equal(transitionOwnerMetadataMode(mode, OWNER_METADATA_EVENT.CLOSE), OWNER_METADATA_MODE.CLOSED);
  }
});

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
    { labelSize: 12, offsetX: 24, offsetY: -24, scale: 3, size: 150 });
  assert.deepEqual(normalizePresentationBoardShortcutIconPresentation({ labelSize: '10', offsetX: '7', offsetY: '-5', scale: '1.75', size: '126' }),
    { labelSize: 10, offsetX: 7, offsetY: -5, scale: 1.75, size: 126 });
  assert.deepEqual(normalizePresentationBoardShortcutIconPresentation({ offsetX: 'bad', offsetY: null, scale: Infinity }),
    DEFAULT_PRESENTATION_BOARD_SHORTCUT_ICON_PRESENTATION);
});

test('Workbench ADD availability is derived only from canonical lifecycle states', () => {
  assert.deepEqual(ownerWorkbenchModuleAvailability(OWNER_METADATA_MODE.CLOSED, PRESENTATION_BOARD_INSTANCE_STATE.ABSENT),
    { metadata: true, presentationBoard: true });
  assert.deepEqual(ownerWorkbenchModuleAvailability(OWNER_METADATA_MODE.DETACHED, PRESENTATION_BOARD_INSTANCE_STATE.WINDOW),
    { metadata: false, presentationBoard: false });
  assert.deepEqual(ownerWorkbenchModuleAvailability(OWNER_METADATA_MODE.SIDECAR, PRESENTATION_BOARD_INSTANCE_STATE.MINIMIZED),
    { metadata: false, presentationBoard: false });
});
