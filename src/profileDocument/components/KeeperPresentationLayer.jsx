import { useEffect, useMemo, useRef, useState } from 'react';
import { createKeeperAudioOwner } from '../domain/keeperAudioOwner.js';
import { KEEPER_BUBBLE_MAX_WIDTH, resolveKeeperBubblePlacement } from '../domain/keeperPresentationLayout.js';
import { createKeeperPresentationDirector } from '../domain/keeperPresentationDirector.js';
import { KEEPER_PRESENTATION_V1, KEEPER_PRESENTATION_V1_AUDIO_SRC } from '../domain/keeperPresentationSequence.js';
import './keeperPresentation.css';

export default function KeeperPresentationLayer({ reactionBridge, positionTracker, reducedMotion = false, audioSrc = KEEPER_PRESENTATION_V1_AUDIO_SRC }) {
  const presentationRef = useRef(null);
  const audioAvailable = typeof audioSrc === 'string' && audioSrc.length > 0;
  const audio = useMemo(() => createKeeperAudioOwner({ src: audioSrc }), [audioSrc]);
  const director = useMemo(() => createKeeperPresentationDirector({
    sequence: KEEPER_PRESENTATION_V1,
    audio,
    reducedMotion,
    onCue: (cue) => reactionBridge?.trigger?.(cue)
  }), [audio, reactionBridge, reducedMotion]);
  const [presentation, setPresentation] = useState(director.getSnapshot);

  useEffect(() => {
    const unsubscribe = director.subscribe(setPresentation);
    const syncVisibility = () => director.setHidden(document.hidden);
    document.addEventListener('visibilitychange', syncVisibility);
    director.start();
    syncVisibility();
    return () => {
      document.removeEventListener('visibilitychange', syncVisibility);
      unsubscribe();
      director.stop();
    };
  }, [director]);

  useEffect(() => {
    positionTracker?.trackActorPosition?.(presentationRef.current);
    return () => positionTracker?.trackActorPosition?.(null);
  }, [positionTracker]);

  useEffect(() => {
    const root = presentationRef.current;
    if (!root || !presentation.currentLine) return undefined;
    let frame = null;
    const followKeeper = () => {
      if (window.innerWidth <= 719) {
        root.dataset.bubbleSide = 'docked';
        root.style.removeProperty('--keeper-bubble-left');
      } else {
        const actorX = Number.parseFloat(getComputedStyle(root).getPropertyValue('--actor-screen-x')) || window.innerWidth / 2;
        const bubbleWidth = Math.min(KEEPER_BUBBLE_MAX_WIDTH, window.innerWidth - 36);
        const placement = resolveKeeperBubblePlacement({ actorX, viewportWidth: window.innerWidth, bubbleWidth });
        root.dataset.bubbleSide = placement.side;
        root.style.setProperty('--keeper-bubble-left', `${placement.left}px`);
      }
      frame = window.requestAnimationFrame(followKeeper);
    };
    followKeeper();
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      root.removeAttribute('data-bubble-side');
      root.style.removeProperty('--keeper-bubble-left');
    };
  }, [presentation.currentLine]);

  const stopped = presentation.status === 'stopped' || presentation.status === 'complete';
  const togglePause = () => {
    if (presentation.userPaused) director.resume('user');
    else director.pause('user');
  };

  return <section ref={presentationRef} className="keeper-presentation" data-status={presentation.status} data-reduced-motion={reducedMotion || undefined} aria-label="Keeper presentation">
    {presentation.currentLine && <aside className="keeper-presentation__line" role="status" aria-live="polite" aria-atomic="true">
      <span>KEEPER</span>
      <p>{presentation.currentLine.text}</p>
      <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); director.dismiss(presentation.currentLine.id); }} aria-label="Dismiss Keeper line">×</button>
    </aside>}
    <div className="keeper-presentation__controls" role="group" aria-label="Keeper presentation controls">
      {stopped ? <button type="button" onClick={() => director.restart()}>[ REPLAY ]</button> : <>
        <button type="button" onClick={togglePause}>{presentation.userPaused ? '[ RESUME ]' : '[ PAUSE ]'}</button>
        <button type="button" onClick={() => director.stop()}>[ STOP ]</button>
      </>}
      <button type="button" disabled={!audioAvailable} aria-pressed={audioAvailable ? presentation.muted : false} onClick={() => director.setMuted(!presentation.muted)}>{audioAvailable ? presentation.muted ? '[ UNMUTE ]' : '[ MUTE ]' : '[ NO OST ]'}</button>
    </div>
  </section>;
}
