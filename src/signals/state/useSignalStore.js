import { create } from 'zustand';
import { resolveLibraryProfile } from '../../library/config.js';
import { fixtureActivityRepository } from '../data/fixtureActivityRepository.js';
import { luksoActivityRepository } from '../data/luksoActivityRepository.js';
import { completeReaction, enqueueManualReplay, getCompletionCooldown } from '../domain/reactionDirector.js';
import { addReactionsToQueue, mergeSignalSnapshot } from './signalState.js';
import { loadSignalDocument, saveSignalDocument } from '../storage/signalStorage.js';

const profileAddress = resolveLibraryProfile();
let signalStorage = typeof window === 'undefined' ? null : window.localStorage;
let saveTimer = null;
function persist(document) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveSignalDocument(signalStorage, document), 100);
}
function initialDocument(profile) { return loadSignalDocument(signalStorage, profile); }

export const useSignalStore = create((set, get) => {
  const document = initialDocument(profileAddress);
  return {
    profileAddress, document, history: document.history, settings: document.settings,
    status: 'idle', sourceMode: null, error: null, partialError: null, syncGeneration: 0,
    queue: [], currentReaction: null, cooldownUntil: 0,

    async synchronize({ mode = 'LIVE', explicitReplay = false } = {}) {
      if (get().status === 'loading') return;
      const generation = get().syncGeneration + 1;
      set({ syncGeneration: generation, status: 'loading', sourceMode: mode, error: null, partialError: null });
      const repository = mode === 'FIXTURE' ? fixtureActivityRepository : luksoActivityRepository;
      try {
        const result = await repository.loadRecentActivity(get().profileAddress);
        if (get().syncGeneration !== generation) return;
        const merged = mergeSignalSnapshot(get().document, result.signals, { explicitReplay });
        const notifications = merged.document.settings.notifications;
        const queue = notifications ? addReactionsToQueue(get().queue, merged.reactions) : get().queue;
        set({ document: merged.document, history: merged.document.history, settings: merged.document.settings,
          queue, status: result.partialError ? 'partial' : 'ready', sourceMode: repository.source,
          partialError: result.partialError || null, error: null });
        persist(merged.document);
      } catch (error) {
        if (get().syncGeneration === generation) set({ status: 'error', error: error instanceof Error ? error.message : String(error) });
      }
    },
    markSeen(id = null) {
      const history = get().history.map((signal) => !id || signal.id === id ? { ...signal, seen: true, read: true } : signal);
      const document = { ...get().document, history }; set({ history, document }); persist(document);
    },
    updateSetting(key, value) {
      if (!Object.hasOwn(get().settings, key) || typeof value !== 'boolean') return;
      const settings = { ...get().settings, [key]: value }; const document = { ...get().document, settings };
      set({ settings, document, queue: key === 'notifications' && !value ? [] : get().queue,
        currentReaction: key === 'notifications' && !value ? null : get().currentReaction }); persist(document);
    },
    replay(signal) {
      if (!signal || !get().settings.notifications) return;
      set({ queue: enqueueManualReplay(get().queue, signal), cooldownUntil: 0 });
    },
    beginNextReaction() {
      if (get().currentReaction || !get().queue.length) return null;
      const [currentReaction, ...queue] = get().queue; set({ currentReaction, queue }); return currentReaction;
    },
    finishReaction(now = Date.now()) { set(completeReaction(now, getCompletionCooldown(get().queue))); },
    clearReaction() { set({ currentReaction: null }); }
  };
});

export function resetSignalStoreForTests(nextProfileAddress, nextStorage) {
  signalStorage = nextStorage; if (saveTimer) clearTimeout(saveTimer); saveTimer = null;
  const document = loadSignalDocument(nextStorage, nextProfileAddress);
  useSignalStore.setState({ profileAddress: nextProfileAddress, document, history: document.history, settings: document.settings,
    status: 'idle', sourceMode: null, error: null, partialError: null, queue: [], currentReaction: null, cooldownUntil: 0 });
}
