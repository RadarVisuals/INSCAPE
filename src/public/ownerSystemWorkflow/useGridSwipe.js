import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { gridRailTransform } from './gridRail.js';

const sameTransition = (left, right) => Boolean(left) === Boolean(right)
  && left?.direction === right?.direction && left?.sourceGridId === right?.sourceGridId
  && left?.sourceSlot === right?.sourceSlot && left?.targetGridId === right?.targetGridId
  && left?.targetIndex === right?.targetIndex && left?.settling === right?.settling
  && left?.moving === right?.moving;

// Only transition identity belongs in React. Pixel progress belongs to this
// mounted Display and its explicit subscribers (currently scene-linked Text).
export default function useGridSwipe(viewportRef, trackRef) {
  const [swipe, setState] = useState(null);
  const current = useRef(null), width = useRef(1);
  const committed = useRef(null);
  const motion = useRef(null);
  if (!motion.current) {
    const listeners = new Set();
    motion.current = { progress: 0, subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
      publish(progress, settling) { this.progress = progress; this.settling = settling; listeners.forEach(listener => listener(progress)); } };
  }
  const paint = useCallback(() => {
    const pixels = current.current?.deltaX || 0;
    // React describes the prepared neighborhood; this camera alone paints its
    // physical slots. In short loops a reused incoming scene must change sides
    // before the track moves, without waiting for a content/navigation render.
    const active = current.current;
    for (const plane of trackRef.current?.children || []) {
      const id = plane.dataset.renderedGridId;
      if (!id) continue;
      const slot = id === active?.sourceGridId ? active.sourceSlot
        : id === active?.targetGridId ? active.sourceSlot + (active.direction === 'previous' ? -1 : 1)
          : Number(plane.dataset.railSlot || 0);
      plane.style.transform = gridRailTransform(slot);
    }
    // Camera and scene slots must use the same fractional CSS width. Multiplying
    // rounded clientWidth by the accumulated slot exposes an edge after wraps.
    const railPosition = current.current?.railPosition;
    if (trackRef.current) trackRef.current.style.transform = railPosition === undefined
      ? `translateX(${pixels}px)` : gridRailTransform(railPosition);
    // A pending React handoff must not send the new Grid's local progress to
    // subscribers still displaying the previous Grid. Its commit publishes it.
    if (sameTransition(committed.current, current.current))
      motion.current.publish(pixels / width.current, Boolean(current.current?.settling));
  }, [trackRef]);
  const setSwipe = useCallback(next => {
    const previous = current.current;
    current.current = next;
    const changed = !sameTransition(previous, next);
    if (changed) {
      // The prepared rail already occupies the right physical slots. Moving
      // it must not wait for navigation/React to finish rendering this frame.
      paint();
      if (next) {
        const { deltaX: _pixels, railPosition: _railPosition, ...transition } = next;
        setState({ ...transition, motion: motion.current });
      } else setState(null);
    } else if (next) paint();
  }, [paint]);
  useLayoutEffect(() => {
    if (!swipe) return;
    const node = viewportRef.current;
    if (!node) return;
    const measure = () => { width.current = node.clientWidth || 1; };
    measure();
    const observer = new ResizeObserver(measure); observer.observe(node);
    return () => observer.disconnect();
  }, [viewportRef, Boolean(swipe)]);
  useLayoutEffect(() => {
    // This camera owns the track. A canonical stop must also clear its physical
    // rail offset, even when Grid-local progress was already exactly zero.
    committed.current = swipe;
    paint();
  });
  return [swipe, setSwipe];
}
