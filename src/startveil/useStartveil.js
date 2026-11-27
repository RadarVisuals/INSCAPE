import { useCallback, useEffect, useRef, useState } from 'react';
import { STARTVEIL_SESSION_KEY, STARTVEIL_STATES, createStartveilState, getStartveilStateDuration, isStartveilRunning, transitionStartveil } from './startveilMachine.js';

function readSessionSeen() {
  try { return window.sessionStorage.getItem(STARTVEIL_SESSION_KEY) === 'true'; } catch { return false; }
}

function readReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

export function useStartveil({ ready, entryReady = true, onRevealInterface, onComplete }) {
  const [state, setState] = useState(() => createStartveilState(ready));
  const [sessionSeen] = useState(readSessionSeen);
  const [reducedMotion] = useState(readReducedMotion);
  const activationRef = useRef(false);
  const callbacksRef = useRef({});
  callbacksRef.current = { onRevealInterface, onComplete };
  const shortened = sessionSeen || reducedMotion;

  useEffect(() => {
    if (ready) setState((current) => transitionStartveil(current, 'READY'));
  }, [ready]);

  useEffect(() => {
    if (!isStartveilRunning(state)) return undefined;
    const timer = window.setTimeout(() => {
      setState((current) => transitionStartveil(current, 'ADVANCE'));
    }, getStartveilStateDuration(state, shortened, reducedMotion));
    return () => window.clearTimeout(timer);
  }, [reducedMotion, shortened, state]);

  useEffect(() => {
    if (state === STARTVEIL_STATES.REVEALING_INTERFACE) callbacksRef.current.onRevealInterface?.();
    if (state === STARTVEIL_STATES.COMPLETE) callbacksRef.current.onComplete?.();
  }, [state]);

  const enter = useCallback(() => {
    if (state !== STARTVEIL_STATES.DORMANT || !entryReady || activationRef.current) return;
    activationRef.current = true;
    try { window.sessionStorage.setItem(STARTVEIL_SESSION_KEY, 'true'); } catch { /* entry remains available */ }
    setState(transitionStartveil(state, 'ENTER'));
  }, [entryReady, state]);

  return { state, enter, reducedMotion, shortened, canEnter: state === STARTVEIL_STATES.DORMANT && entryReady };
}
