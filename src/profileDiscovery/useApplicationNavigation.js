import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizeProfileAddress } from '../library/config.js';
import { applicationRouteUrl, disconnectRoute, readApplicationRoute, resolveApplicationDestination } from './applicationNavigation.js';

export default function useApplicationNavigation(authority) {
  const [route, setRoute] = useState(() => readApplicationRoute(window.location, window.history.state));
  const current = useRef(route);
  current.current = route;
  const returnFocus = useRef(null);
  const previousAccount = useRef(null);
  const disconnecting = useRef(false);
  const signInOrigin = useRef(null);
  const destination = resolveApplicationDestination(route, authority);
  const background = route.kind === 'discover' ? route.returnTo : route;
  const content = background ? resolveApplicationDestination(background, authority) : null;

  const navigate = useCallback((next, { replace = false } = {}) => {
    current.current = next;
    window.history[replace ? 'replaceState' : 'pushState'](
      { inscapeReturnRoute: next.kind === 'discover' ? next.returnTo : null }, '',
      applicationRouteUrl(window.location, next));
    setRoute(next);
  }, []);
  useEffect(() => {
    const sync = () => { const next = readApplicationRoute(window.location, window.history.state); current.current = next; setRoute(next); };
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  // Preserve the existing implicit-owner fallback on an external wallet loss.
  // Explicit Disconnect follows disconnectRoute instead. No remembered account
  // participates in rendering or grants access to the owner runtime.
  useEffect(() => {
    if (authority.status !== 'complete') return;
    const previous = previousAccount.current;
    previousAccount.current = authority.profileAddress;
    if (previous && !authority.profileAddress && !disconnecting.current
      && route.kind === 'home' && !route.fallbackAddress) {
      navigate({ kind: 'profile', address: previous }, { replace: true });
    }
  }, [authority.status, authority.profileAddress, route, navigate]);

  const visitProfile = useCallback((address, { returnToConnectedProfile = false } = {}) => {
    const normalized = normalizeProfileAddress(address);
    if (!normalized) return;
    navigate(returnToConnectedProfile && normalized === authority.profileAddress?.toLowerCase()
      ? { kind: 'home', fallbackAddress: null } : { kind: 'profile', address: normalized });
  }, [authority.profileAddress, navigate]);
  const openDiscover = useCallback((trigger) => {
    returnFocus.current = trigger || document.activeElement;
    navigate({ kind: 'discover', returnTo: current.current.kind === 'discover' ? current.current.returnTo : current.current });
  }, [navigate]);
  const closeDiscover = useCallback(() => {
    navigate(current.current.returnTo || { kind: 'home', fallbackAddress: null }, { replace: true });
    requestAnimationFrame(() => { if (returnFocus.current?.isConnected) returnFocus.current.focus({ preventScroll: true }); });
  }, [navigate]);
  const beginSignIn = useCallback(() => { signInOrigin.current = current.current; }, []);
  const completeSignIn = useCallback(() => {
    const active = current.current;
    if (active === signInOrigin.current && active.kind === 'discover') navigate({ kind: 'home', fallbackAddress: null }, { replace: true });
    signInOrigin.current = null;
  }, [navigate]);
  const beginDisconnect = useCallback(() => {
    if (disconnecting.current) return null;
    const origin = current.current;
    const originContent = origin.kind === 'discover' ? origin.returnTo : origin;
    const next = disconnectRoute(origin, originContent ? resolveApplicationDestination(originContent, authority) : { kind: 'discover' });
    disconnecting.current = true;
    // Finish only the navigation that initiated this request. A late wallet
    // completion must not replace a profile the user visited in the meantime.
    return (success) => {
      disconnecting.current = false;
      if (success && current.current === origin && next !== origin) navigate(next, { replace: true });
    };
  }, [authority, navigate]);
  return { route, destination, content, visitProfile, openDiscover, closeDiscover, beginSignIn, completeSignIn, beginDisconnect };
}
