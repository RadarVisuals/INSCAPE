export const STARTVEIL_SESSION_KEY = 'inscape.startveil.seen.v1';

export const STARTVEIL_STATES = Object.freeze({
  LOADING: 'loading', DORMANT: 'dormant',
  REVEALING_INTERFACE: 'revealing-interface', COMPLETE: 'complete'
});

const NEXT_STATE = Object.freeze({
  [STARTVEIL_STATES.REVEALING_INTERFACE]: STARTVEIL_STATES.COMPLETE
});

export const STARTVEIL_REVEAL_MS = 200;
export const STARTVEIL_RETURN_REVEAL_MS = 120;

export function createStartveilState(ready = false) {
  return ready ? STARTVEIL_STATES.DORMANT : STARTVEIL_STATES.LOADING;
}

export function transitionStartveil(state, event) {
  if (event === 'READY' && state === STARTVEIL_STATES.LOADING) return STARTVEIL_STATES.DORMANT;
  if (event === 'ENTER' && state === STARTVEIL_STATES.DORMANT) return STARTVEIL_STATES.REVEALING_INTERFACE;
  if (event === 'ADVANCE') return NEXT_STATE[state] ?? state;
  return state;
}

export function getStartveilStateDuration(state, shortened = false, reducedMotion = false) {
  if (state !== STARTVEIL_STATES.REVEALING_INTERFACE) return null;
  return reducedMotion ? 0 : shortened ? STARTVEIL_RETURN_REVEAL_MS : STARTVEIL_REVEAL_MS;
}

export function isStartveilRunning(state) {
  return ![STARTVEIL_STATES.LOADING, STARTVEIL_STATES.DORMANT, STARTVEIL_STATES.COMPLETE].includes(state);
}
