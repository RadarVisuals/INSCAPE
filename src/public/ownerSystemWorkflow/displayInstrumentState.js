export const initialDisplayInstruments = Object.freeze({
  active: 'layers', layers: 'attached', metadata: 'attached',
});

// Presentation only. Selection and authored data stay with the controller.
export function transitionDisplayInstruments(state, { type, instrument }) {
  if (!['layers', 'metadata'].includes(instrument)) return state;
  const other = instrument === 'layers' ? 'metadata' : 'layers';
  if (type === 'toggle') {
    if (state[instrument] === 'detached') return { ...state, [instrument]: 'closed' };
    return { ...state, [instrument]: 'attached', active: state.active === instrument ? null : instrument };
  }
  if (type === 'open' || type === 'attach') return { ...state, [instrument]: 'attached', active: instrument };
  if (type === 'detach' || type === 'close') return {
    ...state, [instrument]: type === 'detach' ? 'detached' : 'closed',
    active: state.active === instrument ? (state[other] === 'attached' ? other : null) : state.active,
  };
  return state;
}

export function displayInstrumentLayout(width, height) {
  return { attached: width >= 960 && height >= 460, width: 300 };
}
