import { normalizeProfileAddress } from '../../library/config.js';

export const ACTIVITY_CONTROLLER_STATUS = {
  ERROR: 'error',
  IDLE: 'idle',
  LOADING: 'loading',
  PARTIAL: 'partial',
  READY: 'ready',
};

export const ACTIVITY_REQUEST_TIMEOUT_MS = 15_000;

export const createInitialActivityState = () => ({
  active: false,
  complete: null,
  error: null,
  partialError: null,
  profileAddress: null,
  signals: [],
  status: ACTIVITY_CONTROLLER_STATUS.IDLE,
  totals: null,
});

const errorMessage = (error) => error instanceof Error ? error.message : String(error);

export function createActivityController({
  clearTimeoutImpl = globalThis.clearTimeout,
  onChange = () => {},
  repository,
  setTimeoutImpl = globalThis.setTimeout,
  timeoutMs = ACTIVITY_REQUEST_TIMEOUT_MS,
} = {}) {
  if (typeof repository?.loadRecentActivity !== 'function') {
    throw new TypeError('An Activity repository is required');
  }

  let state = createInitialActivityState();
  let request = null;
  let generation = 0;
  const publish = (patch) => {
    state = { ...state, ...patch };
    onChange(state);
  };

  const abort = () => {
    generation += 1;
    request?.controller.abort();
    if (request?.timeoutId != null) clearTimeoutImpl(request.timeoutId);
    request = null;
  };

  const load = async () => {
    if (!state.active || !state.profileAddress) return state;
    abort();
    const controller = new AbortController();
    const requestGeneration = generation;
    let timedOut = false;
    let rejectTimeout;
    const timeoutPromise = new Promise((_, reject) => { rejectTimeout = reject; });
    const timeoutId = setTimeoutImpl(() => {
      timedOut = true;
      controller.abort();
      rejectTimeout(new Error('ACTIVITY SOURCE DID NOT RESPOND'));
    }, timeoutMs);
    request = { controller, generation: requestGeneration, timeoutId };
    publish({ error: null, partialError: null, status: ACTIVITY_CONTROLLER_STATUS.LOADING });

    try {
      const result = await Promise.race([
        repository.loadRecentActivity(state.profileAddress, { signal: controller.signal }),
        timeoutPromise,
      ]);
      if (generation !== requestGeneration || controller.signal.aborted || !state.active) return state;
      const signals = Array.isArray(result?.signals) ? [...result.signals] : [];
      publish({
        complete: typeof result?.complete === 'boolean' ? result.complete : null,
        error: null,
        partialError: result?.partialError || null,
        signals,
        status: result?.partialError ? ACTIVITY_CONTROLLER_STATUS.PARTIAL : ACTIVITY_CONTROLLER_STATUS.READY,
        totals: result?.totals || null,
      });
    } catch (error) {
      if (generation !== requestGeneration || (!timedOut && controller.signal.aborted) || !state.active) return state;
      publish({
        error: timedOut ? 'ACTIVITY SOURCE DID NOT RESPOND' : errorMessage(error),
        status: ACTIVITY_CONTROLLER_STATUS.ERROR,
      });
    } finally {
      clearTimeoutImpl(timeoutId);
      if (request?.generation === requestGeneration) request = null;
    }
    return state;
  };

  return {
    activate(profileAddress) {
      const profile = normalizeProfileAddress(profileAddress);
      if (profile !== state.profileAddress) {
        abort();
        state = createInitialActivityState();
        publish({ active: Boolean(profile), profileAddress: profile });
      } else if (!state.active) publish({ active: Boolean(profile) });
      if (profile) void load();
    },
    deactivate() {
      abort();
      if (state.active) publish({ active: false });
    },
    getSnapshot: () => state,
    refresh: load,
    retry: load,
  };
}
