import { useCallback, useEffect, useRef, useState } from 'react';
import { STARTVEIL_SESSION_KEY, STARTVEIL_STATES, createStartveilState, getStartveilStateDuration, isStartveilRunning, transitionStartveil } from './startveilMachine.js';

function readSessionSeen() {
  try { return window.sessionStorage.getItem(STARTVEIL_SESSION_KEY) === 'true'; } catch { return false; }
}

function readReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

export function useStartveil({ ready, onUserGesture, onPresentationMode, onRevealWorld, onRevealActor, onRevealInterface, onComplete }) {
  const [state, setState] = useState(() => createStartveilState(ready));
  const [sessionSeen] = useState(readSessionSeen);
  const [reducedMotion] = useState(readReducedMotion);
  const activationRef = useRef(false);
  const callbacksRef = useRef({});
  callbacksRef.current = { onUserGesture, onPresentationMode, onRevealWorld, onRevealActor, onRevealInterface, onComplete };
  const shortened = sessionSeen || reducedMotion;

  useEffect(() => {
    callbacksRef.current.onPresentationMode?.({
      sequence: shortened ? 'short' : 'full',
      reducedMotion
    });
  }, [reducedMotion, shortened]);

  useEffect(() => {
    if (ready) setState((current) => transitionStartveil(current, 'READY'));
  }, [ready]);

  useEffect(() => {
    if (!isStartveilRunning(state)) return undefined;
    const timer = window.setTimeout(() => {
      setState((current) => transitionStartveil(current, 'ADVANCE'));
    }, getStartveilStateDuration(state, shortened));
    return () => window.clearTimeout(timer);
  }, [shortened, state]);

  useEffect(() => {
    if (state === STARTVEIL_STATES.REVEALING_WORLD) callbacksRef.current.onRevealWorld?.();
    if (state === STARTVEIL_STATES.REVEALING_RESIDENT) callbacksRef.current.onRevealActor?.();
    if (state === STARTVEIL_STATES.REVEALING_INTERFACE) callbacksRef.current.onRevealInterface?.();
    if (state === STARTVEIL_STATES.COMPLETE) callbacksRef.current.onComplete?.();
  }, [state]);

  const enter = useCallback(() => {
    if (state !== STARTVEIL_STATES.DORMANT || activationRef.current) return;
    activationRef.current = true;
    callbacksRef.current.onUserGesture?.();
    try { window.sessionStorage.setItem(STARTVEIL_SESSION_KEY, 'true'); } catch { /* entry remains available */ }
    setState(transitionStartveil(state, 'ENTER'));
  }, [state]);

  useEffect(() => {
    if (state !== STARTVEIL_STATES.DORMANT) return undefined;
    const handleEntryKey = (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      enter();
    };
    window.addEventListener('keydown', handleEntryKey);
    return () => window.removeEventListener('keydown', handleEntryKey);
  }, [enter, state]);

  return { state, enter, reducedMotion, shortened, canEnter: state === STARTVEIL_STATES.DORMANT };
}
