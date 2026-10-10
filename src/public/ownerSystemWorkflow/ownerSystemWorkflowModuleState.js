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
