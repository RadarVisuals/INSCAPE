import { flushSync } from 'react-dom';
import { useLayoutEffect, useRef, useState } from 'react';
import { captureOverviewCanvas, overviewCanvasNode } from './overviewCanvasFrame.js';

export default function useGalleryLayoutJourney({ root, selected, model, layout, onViewChange }) {
  const [flight, setFlight] = useState(null);
  const [requestedLayout, setRequestedLayout] = useState(null);
  const surface = useRef(null);
  const destination = useRef(null);
  const previousLanding = useRef(null);
  const cancelDeparture = useRef(null);
  useLayoutEffect(() => () => cancelDeparture.current?.(), []);
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
    const moving = surface.current?.dataset.canvasId === item.id ? surface.current : null;
    const node = tile || moving || overviewCanvasNode(root.current, item.id);
    if (next.layout === 'list') {
      const departure = tile?.closest('[data-gallery-cycle]');
      tileOrigin.current = tile ? { id: item.id, cycle: departure?.dataset.galleryCycle } : null;
    }
    const source = captureOverviewCanvas(node, item.model, item.name, item.id);
    const bounds = node?.getBoundingClientRect();
    const scroll = node?.closest('.workbench-overview-gallery')?.getBoundingClientRect();
    const visible = bounds && bounds.right > (scroll?.left ?? 0) && bounds.left < (scroll?.right ?? window.innerWidth) && bounds.bottom > (scroll?.top ?? 0) && bounds.top < (scroll?.bottom ?? window.innerHeight);
    const host = root.current;
    const motion = source && visible && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    const depart = () => {
      previousLanding.current = null;
      setFlight(motion ? { direction: next.layout, source, clipTop: host.getBoundingClientRect().top } : null);
      onViewChange(next);
    };
    if (!motion || journey || !document.startViewTransition || !globalThis.ViewTransition?.prototype
      || !('types' in ViewTransition.prototype) || document.activeViewTransition) { depart(); return; }

    // Snapshot only the departing controls. The measured canvas stays live.
    setRequestedLayout(next.layout);
    node.setAttribute('data-layout-flight-source', '');
    const transition = document.startViewTransition({ types: ['gallery-layout', 'leave-' + layout], update: () => {
      if (cancelDeparture.current !== cancel) return;
      flushSync(() => { depart(); setRequestedLayout(null); });
    } });
    const cancel = () => {
      cancelDeparture.current = null;
      node.removeAttribute('data-layout-flight-source');
      setRequestedLayout(null);
      transition.skipTransition();
    };
    cancelDeparture.current = cancel;
    transition.ready.catch(() => {});
    transition.finished.finally(() => {
      node.removeAttribute('data-layout-flight-source');
      if (cancelDeparture.current === cancel) cancelDeparture.current = null;
    }).catch(() => {});
  }

  function resolveTarget() {
    const origin = tileOrigin.current;
    const node = overviewCanvasNode(root.current, selected.id, layout === 'grid' && origin?.id === selected.id ? origin.cycle : undefined);
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
    const target = captureOverviewCanvas(node, model, selected.name, selected.id);
    if (scroller && target) {
      // Grid mount restores its scroll and measures the thumbnail crop before
      // the destination is final. Keep the source painted during that handoff.
      const previous = previousLanding.current;
      previousLanding.current = { node, target };
      if (previous?.node !== node || ['frame', 'paint'].some(part =>
        Object.entries(target[part]).some(([key, value]) => Math.abs(value - previous.target[part][key]) > 0.01))) return null;
    }
    return target;
  }

  return { requestedLayout: requestedLayout || layout, fromTile: Boolean(tileOrigin.current) && layout === 'list', journey, surface, switchView, resolveTarget, finish: () => setFlight(null) };
}
