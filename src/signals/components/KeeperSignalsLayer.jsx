import { useEffect, useMemo, useRef } from 'react';
import { canBeginReaction, getReactionPresentation } from '../domain/reactionDirector.js';
import { useSignalStore } from '../state/useSignalStore.js';
import KeeperSpeechBubble from './KeeperSpeechBubble.jsx';
import '../keeperSignals.css';

export default function KeeperSignalsLayer({ interfaceReady, residentHandoffActive, reducedMotion, reactionBridge }) {
  const status = useSignalStore((state) => state.status);
  const queueLength = useSignalStore((state) => state.queue.length);
  const current = useSignalStore((state) => state.currentReaction);
  const cooldownUntil = useSignalStore((state) => state.cooldownUntil);
  const settings = useSignalStore((state) => state.settings);
  const synchronize = useSignalStore((state) => state.synchronize);
  const beginNextReaction = useSignalStore((state) => state.beginNextReaction);
  const finishReaction = useSignalStore((state) => state.finishReaction);
  const timerRef = useRef(null);
  const presentation = useMemo(() => getReactionPresentation(current), [current]);

  useEffect(() => { if (interfaceReady && status === 'idle') synchronize(); }, [interfaceReady, status, synchronize]);
  useEffect(() => {
    if (!interfaceReady || current || !queueLength || !settings.notifications) return undefined;
    const attempt = () => {
      const availability = reactionBridge?.getAvailability?.() || {};
      if (!canBeginReaction({ now: Date.now(), cooldownUntil, interfaceReady,
        residentHandoff: residentHandoffActive || availability.residentHandoff,
        actorMoving: availability.actorMoving, current })) return;
      beginNextReaction();
    };
    attempt(); const interval = window.setInterval(attempt, 300);
    return () => window.clearInterval(interval);
  }, [beginNextReaction, cooldownUntil, current, interfaceReady, queueLength, reactionBridge, residentHandoffActive, settings.notifications]);
  useEffect(() => {
    if (!current) return undefined;
    if (settings.visualEffects && !reducedMotion && presentation.actorReaction) reactionBridge?.trigger?.(presentation.actorReaction);
    timerRef.current = window.setTimeout(() => finishReaction(), presentation.duration);
    return () => { if (timerRef.current) window.clearTimeout(timerRef.current); timerRef.current = null; };
  }, [current, finishReaction, presentation.actorReaction, presentation.duration, reactionBridge, reducedMotion, settings.visualEffects]);

  if (!current) return null;
  return (
    <div className="keeper-signal-layer" data-accent={settings.visualEffects ? presentation.accent || undefined : undefined} data-reduced-motion={reducedMotion || undefined}>
      {settings.visualEffects && presentation.accent && <i className="keeper-signal-accent" aria-hidden="true" />}
      {settings.speech && <KeeperSpeechBubble signal={current} onDismiss={() => finishReaction()} />}
    </div>
  );
}
