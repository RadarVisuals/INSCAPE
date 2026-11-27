import { createContext, startTransition, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { resolveApplicationDestination } from './applicationNavigation.js';

export const GalleryStudioMotion = createContext(null);

export function useGalleryStudioMotion(authority) {
  const endpoints = useRef({});
  const surface = useRef(null);
  const [destination, setDestination] = useState(null);
  const galleryMemory = useRef(null);
  const account = useRef(authority);
  account.current = authority;
  const chrome = useRef(null);
  const [journey, setJourney] = useState(null);
  const finish = useCallback(trip => setJourney(current => current === trip ? null : current), []);
  const changeRoute = useCallback((previous, next, setRoute) => {
    const pending = chrome.current;
    // Studio replaces its generic URL with the active document during mount.
    if (pending?.route === previous && previous.editor && !previous.workId && next.workId
      && next.editor && next.address === previous.address) {
      pending.route = next; setRoute(next); return;
    }
    pending?.cancel();
    chrome.current = null;
    const from = resolveApplicationDestination(previous, account.current);
    const to = resolveApplicationDestination(next, account.current);
    const gallery = page => page.kind === 'public' && page.canvas && !page.target;
    const studio = page => page.kind === 'workbench' && !page.canvas && !page.newComposition;
    let trip = null;
    if (from.address && from.address === to.address) {
      const entering = gallery(from) && studio(to) && to.worksEditorId;
      const leaving = studio(from) && gallery(to);
      const origin = entering ? endpoints.current.gallery : leaving ? endpoints.current.editor : null;
      if (origin?.address === from.address) {
        const editor = entering ? to : from;
        const source = origin.capture(editor.worksEditorId || null);
        if (source && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
          trip = { source, Renderer: origin.Renderer, direction: entering ? 'editor' : 'overview', address: from.address };
        }
      }
    }
    if (from.address !== to.address || to.kind === 'entry') galleryMemory.current = null;
    const commit = () => { setJourney(trip); setRoute(next); };
    const snapshots = document.startViewTransition && globalThis.ViewTransition?.prototype
      && 'types' in ViewTransition.prototype;
    const publicTabChange = from.kind === 'public' && to.kind === 'public'
      && (Boolean(from.canvas) !== Boolean(to.canvas) || Boolean(from.writing) !== Boolean(to.writing)
        || from.target?.moduleId !== to.target?.moduleId);
    const managerChange = from.kind === 'workbench' && to.kind === 'workbench'
      && Boolean(from.canvas) !== Boolean(to.canvas);
    const handoff = !trip && snapshots && from.address && from.address === to.address && (from.kind !== to.kind || publicTabChange || managerChange)
      && ![from.kind, to.kind].includes('pending');
    if (!trip && !handoff) {
      // Keep the mounted public page and its background while the next tab loads.
      if (from.kind === 'public' && to.kind === 'public' && from.address === to.address) startTransition(commit);
      else commit();
      return;
    }
    if (!snapshots) {
      const host = trip.direction === 'overview' && endpoints.current.editor?.hostRef?.current;
      const artwork = host && (surface.current || host.querySelector('.workbench-canvas-content:not([data-suspended])'));
      if (!artwork) { commit(); return; }
      // Without browser snapshots, finish fading the live Studio before releasing it.
      // No draft model or DOM is retained by Gallery.
      trip.source = { ...trip.source, fadeIn: true };
      const studioScreen = host.closest('.system-workflow') || host;
      const fade = studioScreen.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: 'ease-in-out', fill: 'forwards' });
      const preference = matchMedia('(prefers-reduced-motion: reduce)');
      const finishFade = () => fade.finish();
      preference.addEventListener('change', finishFade);
      const inert = host.inert;
      host.inert = true;
      const release = () => { host.inert = inert; preference.removeEventListener('change', finishFade); };
      const ticket = { cancel: () => { release(); fade.cancel(); } };
      chrome.current = ticket;
      fade.finished.then(() => {
        if (chrome.current !== ticket) return;
        chrome.current = null;
        release();
        commit();
        requestAnimationFrame(() => fade.cancel());
      }, () => {});
      return;
    }
    // On return the browser can dissolve Studio's outgoing pixels over the verified Gallery.
    let ready;
    const mounted = new Promise(resolve => { ready = resolve; });
    const ticket = handoff ? { ready, route: next, authority: account.current } : { ready, trip };
    let releaseMissingEndpoint = ready;
    if (trip?.direction === 'editor') {
      let editorMounted = false, sourcePainted = false;
      ticket.ready = () => { editorMounted = true; if (sourcePainted) ready(); };
      ticket.sourceReady = () => { sourcePainted = true; if (editorMounted) ready(); };
      releaseMissingEndpoint = () => { if (!editorMounted) ready(); };
    }
    const resumeStudio = from.kind === 'public' && !from.target && studio(to) && !to.worksEditorId && !next.reviewPublication;
    const returnToProfile = studio(from) && to.kind === 'public' && !to.canvas && !to.writing && !to.target;
    const types = handoff ? [resumeStudio || returnToProfile ? 'studio-page' : 'destination-handoff'] : trip.direction === 'overview' ? ['gallery-studio', 'studio-to-gallery'] : ['gallery-studio'];
    if (handoff && publicTabChange && !from.target && !to.target) types.push('public-tabs');
    const transition = document.startViewTransition({ types, update: () => {
      if (chrome.current !== ticket) return;
      commit();
      return mounted;
    } });
    // A superseding navigation legitimately skips the snapshot before it is ready.
    transition.ready.catch(() => {});
    ticket.cancel = () => { ready(); transition.skipTransition(); };
    chrome.current = ticket;
    // An ordinary route swaps as soon as its destination (or recovery UI) is laid out.
    const timeout = trip ? setTimeout(releaseMissingEndpoint, 1000) : undefined;
    transition.finished.finally(() => {
      clearTimeout(timeout);
      if (chrome.current === ticket) chrome.current = null;
    }).catch(() => {});
  }, []);
  useLayoutEffect(() => {
    const ticket = chrome.current;
    if (ticket?.authority && (ticket.authority.status !== authority.status
      || ticket.authority.profileAddress !== authority.profileAddress
      || ticket.authority.ownershipVerified !== authority.ownershipVerified)) ticket.cancel();
  }, [authority.status, authority.profileAddress, authority.ownershipVerified]);
  useEffect(() => () => {
    const ticket = chrome.current;
    chrome.current = null;
    ticket?.cancel();
  }, []);
  useEffect(() => {
    if (!journey) return;
    // A failed or superseded route may never mount a destination surface.
    const timeout = setTimeout(() => finish(journey), destination?.trip === journey ? 3500 : 30000);
    return () => clearTimeout(timeout);
  }, [journey, destination, finish]);
  return { endpoints, galleryMemory, chrome, journey, finish, changeRoute, surface, destination, setDestination };
}

export function useGalleryStudioEndpoint(role, address, capture, hostRef, Renderer) {
  const motion = useContext(GalleryStudioMotion);
  const read = useRef(capture);
  read.current = capture;
  const endpoints = motion?.endpoints, chrome = motion?.chrome;
  useLayoutEffect(() => {
    if (!endpoints || !address) return;
    const entry = { address, hostRef, Renderer, capture: id => read.current(id) };
    const registry = endpoints.current;
    registry[role] = entry;
    const pending = chrome.current;
    if (pending?.trip?.address === address && pending.trip.direction === (role === 'editor' ? 'editor' : 'overview')) pending.ready();
    return () => { if (registry[role] === entry) delete registry[role]; };
  }, [endpoints, chrome, role, address, hostRef, Renderer]);
  const direction = role === 'editor' ? 'editor' : 'overview';
  const trip = motion?.journey;
  return trip && trip.direction === direction && trip.address === address ? trip : null;
}

// A mounted route supplies measurements to the persistent surface. Its callbacks
// read the latest layout without restarting an in-flight artwork animation.
export function useGalleryStudioDestination(trip, presentation, hostRef, resolveTarget, revealLayers) {
  const motion = useContext(GalleryStudioMotion);
  const setDestination = motion?.setDestination;
  const latest = useRef(null);
  latest.current = { resolveTarget, revealLayers };
  useLayoutEffect(() => {
    if (!trip || !presentation || !setDestination) return;
    const entry = { trip, presentation, hostRef, resolveTarget: source => latest.current.resolveTarget(source),
      revealLayers: () => latest.current.revealLayers?.() || [] };
    setDestination(entry);
    return () => setDestination(current => current === entry ? null : current);
  }, [trip, presentation, hostRef, setDestination]);
}
