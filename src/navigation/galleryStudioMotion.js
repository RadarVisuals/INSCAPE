import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
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
    chrome.current?.cancel();
    chrome.current = null;
    const from = resolveApplicationDestination(previous, account.current);
    const to = resolveApplicationDestination(next, account.current);
    const gallery = page => page.kind === 'public' && page.canvas && !page.target;
    const studio = page => page.kind === 'workbench' && !page.canvas && !page.newComposition;
    let trip = null;
    if (from.address && from.address === to.address) {
      const entering = gallery(from) && studio(to);
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
    if (!trip) { commit(); return; }
    if (!document.startViewTransition || !globalThis.ViewTransition?.prototype || !('types' in ViewTransition.prototype)) {
      const host = trip.direction === 'overview' && endpoints.current.editor?.hostRef?.current;
      const artwork = host && (surface.current || host.querySelector('.workbench-canvas-content:not([data-suspended])'));
      if (!artwork) { commit(); return; }
      // Without browser snapshots, finish fading the live Studio before releasing it.
      // No draft model or DOM is retained by Gallery.
      trip.source = { ...trip.source, fadeIn: true };
      const fade = artwork.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 110, fill: 'forwards' });
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
    const ticket = { ready, trip };
    const types = trip.direction === 'overview' ? ['gallery-studio', 'studio-to-gallery'] : ['gallery-studio'];
    const transition = document.startViewTransition({ types, update: () => {
      if (chrome.current !== ticket) return;
      commit();
      return mounted;
    } });
    ticket.cancel = () => { ready(); transition.skipTransition(); };
    chrome.current = ticket;
    const timeout = setTimeout(ready, 1000);
    transition.finished.finally(() => {
      clearTimeout(timeout);
      if (chrome.current === ticket) chrome.current = null;
    }).catch(() => {});
  }, []);
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
