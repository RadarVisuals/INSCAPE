export const PUBLIC_WINDOW_IDS = Object.freeze([
  'identity',
  'collection',
  'creations',
  'signals'
]);

export const initialWindowState = Object.freeze({
  openIds: Object.freeze([]),
  activeId: null
});

function isKnownWindow(id) {
  return PUBLIC_WINDOW_IDS.includes(id);
}

function bringToFront(openIds, id) {
  return [...openIds.filter((openId) => openId !== id), id];
}

export function publicWindowReducer(state, action) {
  switch (action.type) {
    case 'open':
    case 'focus': {
      if (!isKnownWindow(action.id)) return state;
      const openIds = bringToFront(state.openIds, action.id);
      return { openIds, activeId: action.id };
    }
    case 'close': {
      if (!state.openIds.includes(action.id)) return state;
      const openIds = state.openIds.filter((id) => id !== action.id);
      return {
        openIds,
        activeId: state.activeId === action.id
          ? openIds.at(-1) ?? null
          : state.activeId
      };
    }
    default:
      return state;
  }
}
