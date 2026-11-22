import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizeProfileAddress } from '../library/config.js';
import { applicationRouteUrl, disconnectRoute, readApplicationRoute, resolveApplicationDestination, studioOrigin } from './applicationNavigation.js';
import { useGalleryStudioMotion } from './galleryStudioMotion.js';
import useDeferredFocusReturn from '../public/useDeferredFocusReturn.js';

export default function useApplicationNavigation(authority) {
  const [route, setRoute] = useState(() => readApplicationRoute(window.location, window.history.state));
  const current = useRef(route);
  const returnFocus = useRef(null);
  const previousAccount = useRef(null);
  const disconnecting = useRef(false);
  const signInOrigin = useRef(null);
  const { restoreFocus, cancelFocusReturn } = useDeferredFocusReturn();
  const motion = useGalleryStudioMotion(authority);
  const { changeRoute } = motion;
  const destination = resolveApplicationDestination(route, authority);
  const background = route.kind === 'discover' ? route.returnTo : route;
  const content = background ? resolveApplicationDestination(background, authority) : null;

  const navigate = useCallback((next, { replace = false, receptionParent = null, worksParent = null } = {}) => {
    cancelFocusReturn();
    const previous = current.current;
    const studioRoute = next.kind === 'discover' ? next.returnTo : next;
    const origin = studioRoute?.editor ? studioOrigin(previous, studioRoute.address, window.history.state?.inscapeStudioOrigin) : null;
    current.current = next;
    window.history[replace ? 'replaceState' : 'pushState'](
      { inscapeReturnRoute: next.kind === 'discover' ? next.returnTo : null, inscapeReceptionParent: receptionParent, inscapeWorksParent: worksParent, inscapeStudioOrigin: origin, ...(next.curation && { inscapeCurationParent: true }) }, '',
      applicationRouteUrl(window.location, next));
    changeRoute(previous, next, setRoute);
  }, [cancelFocusReturn, changeRoute]);
  useEffect(() => {
    const sync = () => {
      cancelFocusReturn();
      const previous = current.current, next = readApplicationRoute(window.location, window.history.state);
      current.current = next;
      changeRoute(previous, next, setRoute);
    };
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, [cancelFocusReturn, changeRoute]);

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
  const openReception = useCallback((address, reception = true) => {
    const normalized = normalizeProfileAddress(address);
    if (normalized) navigate({ kind: 'profile', address: normalized, reception });
  }, [navigate]);
  const editReception = useCallback((address, options) => {
    const normalized = normalizeProfileAddress(address);
    if (normalized) navigate({ kind: 'profile', address: normalized, editor: 'reception' },
      { replace: current.current.editor && current.current.address === normalized, ...options });
  }, [navigate]);
  const openStudio = useCallback((address, { create = false } = {}) => {
    const normalized = normalizeProfileAddress(address);
    if (normalized) navigate({ kind: 'profile', address: normalized, editor: 'studio', ...(create && { newComposition: true }) },
      { worksParent: current.current.address === normalized && current.current.canvas && current.current.reception === 'published' ? normalized : null });
  }, [navigate]);
  const consumeNewComposition = useCallback(() => {
    if (!current.current.newComposition) return;
    const { newComposition, ...next } = current.current;
    navigate(next, { replace: true, worksParent: window.history.state?.inscapeWorksParent });
  }, [navigate]);
  const manageCompositions = useCallback(address => {
    const normalized = normalizeProfileAddress(address);
    if (normalized) navigate({ kind: 'profile', address: normalized, canvas: true });
  }, [navigate]);
  const openCuration = useCallback(address => {
    const normalized = normalizeProfileAddress(address);
    if (normalized) navigate({ kind: 'profile', address: normalized, curation: true });
  }, [navigate]);
  const closeCuration = useCallback(() => {
    if (window.history.state?.inscapeCurationParent) window.history.back();
    else navigate({ kind: 'profile', address: current.current.address, reception: 'published' }, { replace: true });
  }, [navigate]);
  const openWriting = useCallback(address => {
    const normalized = normalizeProfileAddress(address);
    if (normalized) navigate({ kind: 'profile', address: normalized, writing: true });
  }, [navigate]);
  const openCanvas = useCallback((address, target) => {
    const normalized = normalizeProfileAddress(address);
    if (!normalized) return;
    navigate({ kind: 'profile', address: normalized, canvas: true, reception: 'published', ...(target ? { target } : {}) });
  }, [navigate]);
  const openWork = useCallback((address, target) => {
    const normalized = normalizeProfileAddress(address);
    if (!normalized || !target?.moduleId) return;
    navigate({ kind: 'profile', address: normalized, target, ...(current.current.reception ? { reception: current.current.reception } : {}) },
      { receptionParent: normalized });
  }, [navigate]);
  const editWork = useCallback((address, workId, { replace = false } = {}) => {
    const next = { kind: 'profile', address: normalizeProfileAddress(address), editor: 'canvas', workId };
    if (!workId || resolveApplicationDestination(next, authority).worksEditorId !== workId) return;
    const previous = current.current;
    const switching = Boolean(previous.editor) && previous.address === next.address;
    if (switching && previous.workId === workId) return;
    const fromWorks = previous.canvas && previous.reception === 'published' && !previous.target && previous.address === next.address;
    const hasWorksParent = (!replace && fromWorks) || (switching && window.history.state?.inscapeWorksParent === next.address);
    navigate(next, { replace: replace || switching, worksParent: hasWorksParent ? next.address : null });
  }, [authority, navigate]);
  const returnToWorks = useCallback(address => {
    const normalized = normalizeProfileAddress(address);
    if (!normalized || (current.current.canvas && current.current.reception === 'published' && !current.current.target && current.current.address === normalized)) return;
    if (current.current.editor && window.history.state?.inscapeWorksParent === normalized) window.history.back();
    else navigate({ kind: 'profile', address: normalized, canvas: true, reception: 'published' }, { replace: Boolean(current.current.editor) });
  }, [navigate]);
  const closeWork = useCallback((address) => {
    const normalized = normalizeProfileAddress(address);
    if (!normalized) return;
    if (window.history.state?.inscapeReceptionParent === normalized) window.history.back();
    else navigate({ kind: 'profile', address: normalized, ...(current.current.reception ? { reception: current.current.reception } : {}) }, { replace: true });
  }, [navigate]);
  const openOverview = useCallback((address) => {
    const normalized = normalizeProfileAddress(address);
    if (normalized) navigate({ kind: 'profile', address: normalized, reception: 'published' });
  }, [navigate]);
  const openDiscover = useCallback((trigger) => {
    returnFocus.current = trigger || document.activeElement;
    navigate({ kind: 'discover', returnTo: current.current.kind === 'discover' ? current.current.returnTo : current.current });
  }, [navigate]);
  const closeDiscover = useCallback(() => {
    navigate(current.current.returnTo || { kind: 'home', fallbackAddress: null }, { replace: true });
    restoreFocus(returnFocus.current);
  }, [navigate, restoreFocus]);
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
  const studioReturnLabel = window.history.state?.inscapeStudioOrigin || (background?.editor === 'reception' ? 'Profile' : 'Gallery');
  return { motion, route, destination, content, openCuration, closeCuration, studioReturnLabel, visitProfile, openReception, editReception, openCanvas, openStudio, openWriting, consumeNewComposition, manageCompositions, editWork, returnToWorks, openWork, closeWork, openOverview, openDiscover, closeDiscover, beginSignIn, completeSignIn, beginDisconnect };
}
