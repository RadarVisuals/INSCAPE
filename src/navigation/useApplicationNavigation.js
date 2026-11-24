import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizeProfileAddress } from '../library/config.js';
import { applicationRouteUrl, disconnectRoute, readApplicationRoute, resolveApplicationDestination, studioOrigin } from './applicationNavigation.js';
import { useGalleryStudioMotion } from './galleryStudioMotion.js';

export default function useApplicationNavigation(authority) {
  const [route, setRoute] = useState(() => readApplicationRoute(window.location));
  const current = useRef(route);
  const disconnecting = useRef(false);
  const motion = useGalleryStudioMotion(authority);
  const { changeRoute } = motion;
  const destination = resolveApplicationDestination(route, authority);

  const navigate = useCallback((next, { replace = false, receptionParent = null, worksParent = null } = {}) => {
    const previous = current.current;
    const origin = next.editor ? studioOrigin(previous, next.address, window.history.state?.inscapeStudioOrigin) : null;
    current.current = next;
    window.history[replace ? 'replaceState' : 'pushState'](
      { inscapeReceptionParent: receptionParent, inscapeWorksParent: worksParent, inscapeStudioOrigin: origin, ...(next.curation && { inscapeCurationParent: true }) }, '',
      applicationRouteUrl(window.location, next));
    changeRoute(previous, next, setRoute);
  }, [changeRoute]);
  useEffect(() => {
    const sync = () => {
      const previous = current.current, next = readApplicationRoute(window.location);
      current.current = next;
      changeRoute(previous, next, setRoute);
    };
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, [changeRoute]);

  const visitProfile = useCallback((address, { returnToConnectedProfile = false } = {}) => {
    const normalized = normalizeProfileAddress(address);
    if (!normalized) return;
    navigate(returnToConnectedProfile && normalized === authority.profileAddress?.toLowerCase()
      ? { kind: 'home' } : { kind: 'profile', address: normalized });
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
  const openStudio = useCallback((address, { create = false, reviewPublication = false } = {}) => {
    const normalized = normalizeProfileAddress(address);
    if (normalized) navigate({ kind: 'profile', address: normalized, editor: 'studio', ...(create && { newComposition: true }), ...(reviewPublication && { reviewPublication: true }) },
      { worksParent: (current.current.kind === 'home' || current.current.address === normalized) && !current.current.editor && !current.current.target && !current.current.writing && !current.current.curation ? normalized : null });
  }, [navigate]);
  // The replacement review is a one-time action of the current owner, never a public URL.
  const consumePublicationReview = useCallback(() => {
    if (!current.current.reviewPublication) return;
    const { reviewPublication, ...next } = current.current;
    current.current = next;
    setRoute(next);
  }, []);
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
    else if (current.current.editor && window.history.state?.inscapeStudioOrigin === 'Profile') navigate({ kind: 'profile', address: normalized, reception: 'published' }, { replace: true });
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
  const beginDisconnect = useCallback(() => {
    if (disconnecting.current) return null;
    const origin = current.current;
    const next = disconnectRoute(origin, resolveApplicationDestination(origin, authority), authority.signedInAddress || authority.profileAddress);
    disconnecting.current = true;
    // Finish only the navigation that initiated this request. A late wallet
    // completion must not replace a profile the user visited in the meantime.
    return (success) => {
      disconnecting.current = false;
      if (success && current.current === origin && next !== origin) navigate(next, { replace: true });
    };
  }, [authority, navigate]);
  const studioReturnLabel = window.history.state?.inscapeStudioOrigin || (route.editor === 'reception' ? 'Profile' : 'Gallery');
  return { motion, route, destination, openCuration, closeCuration, studioReturnLabel, visitProfile, openReception, editReception, openCanvas, openStudio, openWriting, consumePublicationReview, consumeNewComposition, manageCompositions, editWork, returnToWorks, openWork, closeWork, openOverview, beginDisconnect };
}
