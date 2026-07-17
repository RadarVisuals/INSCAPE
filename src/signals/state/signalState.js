import { enqueueReaction } from '../domain/reactionDirector.js';
import { SIGNAL_HISTORY_LIMIT, SIGNAL_KNOWN_IDS_LIMIT } from '../storage/signalStorage.js';
import { sortSignalsNewestFirst } from '../domain/keeperSignal.js';

export function mergeSignalSnapshot(document, incoming, { explicitReplay = false, maxAutomaticReactions = 2 } = {}) {
  const known = new Set(document.knownSignalIds); const unique = [...new Map(incoming.map((signal) => [signal.id, signal])).values()];
  const newSignals = unique.filter((signal) => !known.has(signal.id));
  const byId = new Map(document.history.map((signal) => [signal.id, signal]));
  unique.forEach((signal) => byId.set(signal.id, { ...signal, seen: byId.get(signal.id)?.seen || false, read: byId.get(signal.id)?.read || false }));
  const history = sortSignalsNewestFirst([...byId.values()]).slice(0, SIGNAL_HISTORY_LIMIT);
  const knownSignalIds = [...document.knownSignalIds, ...unique.map((signal) => signal.id)].slice(-SIGNAL_KNOWN_IDS_LIMIT);
  const shouldReact = explicitReplay || document.initialized;
  const reactions = shouldReact ? sortSignalsNewestFirst(newSignals).slice(0, explicitReplay ? 1 : maxAutomaticReactions) : [];
  return { document: { ...document, initialized: true, knownSignalIds: [...new Set(knownSignalIds)], history }, newSignals, reactions };
}
export function addReactionsToQueue(queue, signals) { return signals.reduce((next, signal) => enqueueReaction(next, signal), queue); }
