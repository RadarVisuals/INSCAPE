import { normalizeProfileAddress } from '../library/config.js';

export const PROFILE_DISCOVERY_STATUS = {
  ERROR: 'error',
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
};

const searchable = (profile) => `${profile?.name || ''} ${profile?.address || ''}`.toLowerCase();
export const createInitialProfileDiscoveryState = () => ({
  active: false,
  activeIndex: 0,
  error: null,
  profiles: [],
  query: '',
  status: PROFILE_DISCOVERY_STATUS.IDLE,
});

export function filterProfileDiscoveryResults(profiles, query) {
  const normalized = String(query || '').trim().toLowerCase();
  return normalized ? profiles.filter((profile) => searchable(profile).includes(normalized)) : profiles;
}

export function createProfileDiscoveryController({ onChange = () => {}, repository } = {}) {
  if (typeof repository?.list !== 'function') throw new TypeError('A Profile Discovery repository is required');
  let state = createInitialProfileDiscoveryState();
  let requestController = null;
  let generation = 0;
  const publish = (patch) => {
    state = { ...state, ...patch };
    onChange(state);
  };
  const abort = () => { generation += 1; requestController?.abort(); requestController = null; };
  const results = () => filterProfileDiscoveryResults(state.profiles, state.query);
  const load = async () => {
    if (!state.active) return state;
    abort();
    const controller = new AbortController();
    const requestGeneration = generation;
    requestController = controller;
    publish({ error: null, status: PROFILE_DISCOVERY_STATUS.LOADING });
    try {
      const profiles = await repository.list({ signal: controller.signal });
      if (generation !== requestGeneration || controller.signal.aborted || !state.active) return state;
      publish({ activeIndex: 0, error: null, profiles: [...profiles], status: PROFILE_DISCOVERY_STATUS.READY });
    } catch (error) {
      if (generation !== requestGeneration || controller.signal.aborted || error?.name === 'AbortError' || !state.active) return state;
      publish({ activeIndex: 0, error: error instanceof Error ? error.message : String(error), profiles: [], status: PROFILE_DISCOVERY_STATUS.ERROR });
    } finally {
      if (requestController === controller) requestController = null;
    }
    return state;
  };
  return {
    activate() { if (!state.active) publish({ active: true }); void load(); },
    deactivate() { abort(); if (state.active) publish({ active: false }); },
    getActiveResult() { return results()[state.activeIndex] || null; },
    getResults: results,
    getSnapshot: () => state,
    moveActive(offset) {
      const available = results();
      if (!available.length) return null;
      const activeIndex = (state.activeIndex + offset + available.length) % available.length;
      publish({ activeIndex });
      return available[activeIndex];
    },
    resolveSelection(profile = null) {
      const selected = profile || results()[state.activeIndex];
      const address = normalizeProfileAddress(selected?.address);
      return address ? { ...selected, address } : null;
    },
    retry: load,
    setActiveIndex(activeIndex) {
      const available = results();
      if (!Number.isInteger(activeIndex) || activeIndex < 0 || activeIndex >= available.length) return;
      publish({ activeIndex });
    },
    setQuery(query) { publish({ activeIndex: 0, query: String(query || '') }); },
  };
}
