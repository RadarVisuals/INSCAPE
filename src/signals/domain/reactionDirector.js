export const REACTION_QUEUE_LIMIT = 6; export const REACTION_COOLDOWN_MS = 5000; export const MANUAL_REPLAY_COOLDOWN_MS = 600;
export function enqueueReaction(queue, signal, { limit = REACTION_QUEUE_LIMIT } = {}) {
  if (!signal || queue.some((entry) => entry.id === signal.id)) return queue;
  return [...queue, signal].sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
}
export function enqueueManualReplay(queue, signal, { limit = REACTION_QUEUE_LIMIT } = {}) {
  if (!signal || queue.some((entry) => entry.id === signal.id)) return queue;
  const manualSignal = { ...signal, manualReplay: true };
  const manual = queue.filter((entry) => entry.manualReplay === true);
  const automatic = queue.filter((entry) => entry.manualReplay !== true);
  return [...manual, manualSignal, ...automatic].slice(0, limit);
}
export function canBeginReaction({ now, cooldownUntil = 0, interfaceReady, residentHandoff, actorMoving, current }) {
  return !current && interfaceReady === true && residentHandoff !== true && actorMoving !== true && now >= cooldownUntil;
}
export function completeReaction(now, cooldownMs = REACTION_COOLDOWN_MS) { return { currentReaction: null, cooldownUntil: now + cooldownMs }; }
export function getCompletionCooldown(queue) { return queue[0]?.manualReplay === true ? MANUAL_REPLAY_COOLDOWN_MS : REACTION_COOLDOWN_MS; }
