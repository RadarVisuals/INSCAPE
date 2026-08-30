export const OWNER_METADATA_MODE = Object.freeze({
  CLOSED: 'closed',
  DETACHED: 'detached',
  DOCKED_CLOSED: 'docked-closed',
  INNER: 'inner',
  SIDECAR: 'sidecar',
});

export const OWNER_METADATA_EVENT = Object.freeze({
  ADD: 'add',
  ATTACH: 'attach',
  CLOSE: 'close',
  TOGGLE_INNER: 'toggle-inner',
  TOGGLE_SIDECAR: 'toggle-sidecar',
  UNDOCK: 'undock',
});

const DOCKED_METADATA_MODES = new Set([
  OWNER_METADATA_MODE.DOCKED_CLOSED,
  OWNER_METADATA_MODE.INNER,
  OWNER_METADATA_MODE.SIDECAR,
]);

export function transitionOwnerMetadataMode(mode, event) {
  switch (event) {
    case OWNER_METADATA_EVENT.ADD:
      return mode === OWNER_METADATA_MODE.CLOSED ? OWNER_METADATA_MODE.DETACHED : mode;
    case OWNER_METADATA_EVENT.ATTACH:
      return mode === OWNER_METADATA_MODE.DETACHED ? OWNER_METADATA_MODE.DOCKED_CLOSED : mode;
    case OWNER_METADATA_EVENT.CLOSE:
      return OWNER_METADATA_MODE.CLOSED;
    case OWNER_METADATA_EVENT.TOGGLE_INNER:
      if (!DOCKED_METADATA_MODES.has(mode)) return mode;
      return mode === OWNER_METADATA_MODE.INNER ? OWNER_METADATA_MODE.DOCKED_CLOSED : OWNER_METADATA_MODE.INNER;
    case OWNER_METADATA_EVENT.TOGGLE_SIDECAR:
      if (!DOCKED_METADATA_MODES.has(mode)) return mode;
      return mode === OWNER_METADATA_MODE.SIDECAR ? OWNER_METADATA_MODE.DOCKED_CLOSED : OWNER_METADATA_MODE.SIDECAR;
    case OWNER_METADATA_EVENT.UNDOCK:
      return DOCKED_METADATA_MODES.has(mode) ? OWNER_METADATA_MODE.DETACHED : mode;
    default:
      return mode;
  }
}

export function ownerMetadataModeView(mode) {
  return Object.freeze({
    docked: DOCKED_METADATA_MODES.has(mode),
    open: mode !== OWNER_METADATA_MODE.CLOSED,
    projection: mode === OWNER_METADATA_MODE.INNER ? 'down'
      : mode === OWNER_METADATA_MODE.SIDECAR ? 'side' : 'closed',
  });
}

export const PRESENTATION_BOARD_INSTANCE_STATE = Object.freeze({
  ABSENT: 'absent',
  MINIMIZED: 'minimized',
  WINDOW: 'window',
});

export const PRESENTATION_BOARD_INSTANCE_EVENT = Object.freeze({
  ADD: 'add',
  MINIMIZE: 'minimize',
  RESTORE: 'restore',
});

export function transitionPresentationBoardInstance(state, event) {
  if (event === PRESENTATION_BOARD_INSTANCE_EVENT.ADD) {
    return state === PRESENTATION_BOARD_INSTANCE_STATE.ABSENT ? PRESENTATION_BOARD_INSTANCE_STATE.WINDOW : state;
  }
  if (event === PRESENTATION_BOARD_INSTANCE_EVENT.MINIMIZE) {
    return state === PRESENTATION_BOARD_INSTANCE_STATE.WINDOW ? PRESENTATION_BOARD_INSTANCE_STATE.MINIMIZED : state;
  }
  if (event === PRESENTATION_BOARD_INSTANCE_EVENT.RESTORE) {
    return state === PRESENTATION_BOARD_INSTANCE_STATE.MINIMIZED ? PRESENTATION_BOARD_INSTANCE_STATE.WINDOW : state;
  }
  return state;
}

export function presentationBoardInstanceStateFromShortcut(shortcut) {
  return shortcut?.open === false
    ? PRESENTATION_BOARD_INSTANCE_STATE.MINIMIZED
    : PRESENTATION_BOARD_INSTANCE_STATE.WINDOW;
}

export function ownerWorkbenchModuleAvailability(metadataMode, boardInstanceState) {
  return Object.freeze({
    metadata: metadataMode === OWNER_METADATA_MODE.CLOSED,
    presentationBoard: boardInstanceState === PRESENTATION_BOARD_INSTANCE_STATE.ABSENT,
  });
}
