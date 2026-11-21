import { useLayoutEffect, useRef, useState } from 'react';
import { captureOverviewCanvas, overviewCanvasNode } from './overviewCanvasFrame.js';

export default function useGalleryLayoutJourney({ root, selected, model, layout, onViewChange }) {
  const [flight, setFlight] = useState(null);
  const [requestedLayout, setRequestedLayout] = useState(null);
  const surface = useRef(null);
  const destination = useRef(null);
  const cancelDeparture = useRef(null);
  useLayoutEffect(() => () => cancelDeparture.current?.(), [layout]);
  const tileOrigin = useRef(null);
  const journey = flight?.source.id === selected.id && flight.direction === layout ? flight : null;

  useLayoutEffect(() => {
    if (!journey) {
      if (flight) setFlight(null);
      return;
    }
    const cancel = () => setFlight(null);
    const host = root.current;
    const interrupt = event => {
      if (!event.target.closest('.gallery-layout-switch')) cancel();
    };
    host.addEventListener('pointerdown', interrupt);
    host.addEventListener('wheel', cancel, { passive: true });
    window.addEventListener('resize', cancel);
    return () => {
      host.removeEventListener('pointerdown', interrupt);
      host.removeEventListener('wheel', cancel);
      window.removeEventListener('resize', cancel);
      destination.current?.removeAttribute('data-layout-flight-target');
      destination.current = null;
    };
  }, [flight, journey, root]);

  function switchView(next, item = { ...selected, model }, tile = null) {
    cancelDeparture.current?.();
    if (next.layout === layout) return;
    // Fetch the destination chunk while the List surroundings fade out.
    if (next.layout === 'grid') import('./WorkbenchOverviewGrid.jsx').catch(() => {});
    const moving = surface.current?.dataset.canvasId === item.id ? surface.current : null;
    const node = tile || moving || overviewCanvasNode(root.current, item.id);
    if (next.layout === 'list') {
      tileOrigin.current = tile ? { id: item.id, cycle: tile.closest('[data-gallery-cycle]').dataset.galleryCycle } : null;
    }
    const source = captureOverviewCanvas(node, item.model, item.name, item.id);
    const bounds = node?.getBoundingClientRect();
    const scroll = node?.closest('.workbench-overview-gallery')?.getBoundingClientRect();
    const visible = bounds && bounds.right > (scroll?.left ?? 0) && bounds.left < (scroll?.right ?? window.innerWidth) && bounds.bottom > (scroll?.top ?? 0) && bounds.top < (scroll?.bottom ?? window.innerHeight);
    const host = root.current;
    const motion = source && visible && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    const depart = () => {
      setFlight(motion ? { direction: next.layout, source, clipTop: host.getBoundingClientRect().top } : null);
      onViewChange(next);
    };
    if (!motion || journey) { depart(); return; }

    // Give surrounding tiles and controls a short exit while the actual artwork
    // remains at the captured origin. A new gesture can supersede this handoff.
    setRequestedLayout(next.layout);
    host.setAttribute('data-layout-leaving', '');
    node.setAttribute('data-layout-flight-source', '');
    const listeners = new AbortController();
    const cleanup = () => {
      clearTimeout(timer);
      listeners.abort();
      host.removeAttribute('data-layout-leaving');
      node.removeAttribute('data-layout-flight-source');
      cancelDeparture.current = null;
      setRequestedLayout(null);
    };
    const interrupt = event => {
      if (!event.target.closest?.('.gallery-layout-switch')) cleanup();
    };
    const timer = setTimeout(() => { cleanup(); depart(); }, 100);
    cancelDeparture.current = cleanup;
    window.addEventListener('pointerdown', interrupt, { capture: true, signal: listeners.signal });
    window.addEventListener('keydown', interrupt, { capture: true, signal: listeners.signal });
    window.addEventListener('wheel', cleanup, { capture: true, passive: true, signal: listeners.signal });
    window.addEventListener('resize', cleanup, { signal: listeners.signal });
  }

  function resolveTarget() {
    const origin = tileOrigin.current;
    const originalTile = layout === 'grid' && origin?.id === selected.id
      ? root.current.querySelector(`[data-gallery-cycle="${CSS.escape(origin.cycle)}"] [data-card-id="${CSS.escape(selected.id)}"]`) : null;
    const node = originalTile || overviewCanvasNode(root.current, selected.id);
    if (!node) return null;
    const scroller = node.closest('.workbench-overview-gallery');
    if (scroller) {
      const box = node.getBoundingClientRect(), viewport = scroller.getBoundingClientRect();
      if (box.bottom <= viewport.top || box.top >= viewport.bottom || box.right <= viewport.left || box.left >= viewport.right) {
        node.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        return null;
      }
    }
    if (destination.current !== node) {
      destination.current?.removeAttribute('data-layout-flight-target');
      destination.current = node;
      node.setAttribute('data-layout-flight-target', '');
    }
    return captureOverviewCanvas(node, model, selected.name, selected.id);
  }

  return { requestedLayout: requestedLayout || layout, fromTile: Boolean(tileOrigin.current) && layout === 'list', journey, surface, switchView, resolveTarget, finish: () => setFlight(null) };
}
