import { useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { slideCount, slideIndex, slideKey, swipeOffset } from './cellSlides.js';

export const wrapSlide = (index, count) => ((index % count) + count) % count;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

// The fractional track is continuous. Split a layer's translation only where
// it wraps from one fully clipped side of the cell to the other.
function coastFrames(index, count, from, to) {
  const stops = [0, 1];
  for (let seam = Math.ceil(Math.min(from, to)); seam < Math.max(from, to); seam++) {
    if (seam !== from && wrapSlide(index + 1 - seam, count) === 0) stops.push((seam - from) / (to - from));
  }
  stops.sort((a, b) => a - b);
  const frames = [];
  for (let i = 1; i < stops.length; i++) {
    const middle = from + (to - from) * (stops[i - 1] + stops[i]) / 2;
    const trackIndex = middle + wrapSlide(index - middle + 1, count) - 1;
    for (const offset of [stops[i - 1], stops[i]]) {
      const shift = trackIndex - (from + (to - from) * offset);
      frames.push({ offset, translate: `calc(${shift} * var(--slide-x)) calc(${shift} * var(--slide-y))` });
    }
  }
  return frames;
}

function syncCoastLayers(g) {
  const coast = g?.coast;
  if (!coast) return;
  for (const [node, animation] of coast.layers) {
    if (!node.isConnected) { animation.cancel(); coast.layers.delete(node); }
  }
  for (const group of g.nodes) {
    const layers = group.querySelectorAll(':scope > .composition-document-layer, :scope > .composition-document-cell > .composition-document-cell-content');
    for (const node of layers) {
      if (coast.layers.has(node)) continue;
      const index = Number(node.style.getPropertyValue('--layer-slide'));
      const animation = node.animate(coastFrames(index, g.count, coast.from, coast.to), {
        duration: coast.duration, easing: 'cubic-bezier(.333333333,1,.666666667,1)', fill: 'both',
      });
      animation.startTime = coast.start;
      coast.layers.set(node, animation);
    }
  }
}

function stopCoast(g) {
  if (!g?.coast) return;
  const { from, to, start, duration, layers, timers } = g.coast;
  const t = clamp((document.timeline.currentTime - start) / duration, 0, 1);
  g.position = to + (from - to) * (1 - t) ** 3;
  for (const animation of layers.values()) animation.cancel();
  for (const timer of timers) clearTimeout(timer);
  g.coast = null;
}

export function useCellSwipe(owner, canvas) {
  const [playback, setPlayback] = useState(null), [range, setRange] = useState(null);
  const positions = playback?.owner === owner ? playback.positions : {};
  const gesture = useRef(null), suppressClick = useRef(false);
  const retiring = useRef(new Set());
  useLayoutEffect(() => {
    syncCoastLayers(gesture.current);
    // Keep the final offset until the landing slide has been committed.
    for (const node of retiring.current) {
      if (node.hasAttribute('data-swiping') && node.isConnected) continue;
      node.style.removeProperty('--slide-position');
      retiring.current.delete(node);
    }
  }, [range, owner]);
  useLayoutEffect(() => () => {
    stopCoast(gesture.current);
    cancelAnimationFrame(gesture.current?.dragFrame);
    gesture.current?.nodes.forEach(node => node.style.removeProperty('--slide-position'));
    gesture.current = null;
  }, [owner]);

  const paint = (g, position) => {
    g.position = position;
    const nearest = Math.round(position);
    if (nearest !== g.nearest) {
      const first = g.nearest == null;
      g.nearest = nearest;
      const window = { owner, key: g.key, nearest };
      if (first) flushSync(() => setRange(window));
      else setRange(window);
    }
    g.nodes.forEach(node => node.style.setProperty('--slide-position', String(position)));
  };
  const paintDrag = (g, position) => {
    // Mount neighbours immediately. After that, publish the latest pointer
    // position once per frame while retaining every sample for release speed.
    if (g.nearest == null) { paint(g, position); return; }
    if (position === g.position) return;
    g.position = position;
    if (g.dragFrame != null) return;
    g.dragFrame = requestAnimationFrame(() => {
      g.dragFrame = null;
      paint(g, g.position);
    });
  };
  const clear = () => {
    cancelAnimationFrame(gesture.current?.dragFrame);
    stopCoast(gesture.current);
    if (gesture.current?.nearest != null) gesture.current.nodes.forEach(node => retiring.current.add(node));
    gesture.current = null;
    setRange(null);
  };
  const commit = (key, index) => setPlayback(previous => ({
    owner, positions: { ...(previous?.owner === owner ? previous.positions : {}), [key]: index },
  }));
  const step = (cell, delta) => {
    const prior = gesture.current, key = slideKey(cell);
    stopCoast(prior);
    if (prior && prior.key !== key) commit(prior.key, wrapSlide(Math.round(prior.position), prior.count));
    const start = prior?.key === key ? Math.round(prior.position) : slideIndex(cell, positions);
    clear(); commit(key, wrapSlide(start + delta, slideCount(cell)));
  };
  const settle = (g, target, speed = 0) => {
    if (g.dragFrame != null) {
      cancelAnimationFrame(g.dragFrame);
      g.dragFrame = null;
      paint(g, g.position);
    }
    g.pointer = null;
    const from = g.position, distance = Math.abs(target - from);
    const finish = () => {
      commit(g.key, wrapSlide(target, g.count));
      if (g.dragging) g.nodes.forEach(node => node.style.setProperty('--slide-position', String(target)));
      clear();
    };
    if (!distance || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { finish(); return; }
    // Cubic ease-out starts at 3 * distance / duration. Match release velocity
    // so coasting continues at the speed of the hand and gradually slows.
    const duration = speed ? clamp(3 * distance / Math.abs(speed), 140, 2200) : clamp(320 * distance, 110, 300);
    const coast = { from, to: target, duration, start: document.timeline.currentTime, layers: new Map(), timers: [] };
    g.coast = coast;
    syncCoastLayers(g);
    // React only needs a new window at the midpoint between two slides. The
    // inverse of the cubic ease gives its time on the shared document timeline.
    const direction = Math.sign(target - from);
    for (let index = Math.round(from) + direction; direction * (target - index) >= 0; index += direction) {
      const progress = (index - direction / 2 - from) / (target - from);
      const delay = duration * (1 - Math.cbrt(1 - progress));
      coast.timers.push(setTimeout(() => {
        g.nearest = index;
        setRange({ owner, key: g.key, nearest: index });
      }, delay));
    }
    coast.timers.push(setTimeout(finish, duration));
  };
  const events = cell => ({
    onPointerDown(event) {
      suppressClick.current = false;
      if (!event.isPrimary || event.button !== 0 || event.target.closest('a,button,input,select,textarea,[contenteditable="true"]')) return;
      const key = slideKey(cell), prior = gesture.current;
      stopCoast(prior);
      const active = prior?.key === key ? Math.round(prior.position) : slideIndex(cell, positions);
      if (prior && prior.key !== key) commit(prior.key, wrapSlide(Math.round(prior.position), prior.count));
      const position = prior?.key === key ? prior.position : active;
      clear();
      const [xAxis, yAxis] = swipeOffset(cell);
      const box = event.currentTarget.getBoundingClientRect();
      const g = { key, count: slideCount(cell), pointer: event.pointerId, active, position, origin: position, x: event.clientX, y: event.clientY,
        axis: xAxis ? 'clientX' : 'clientY', sign: xAxis || yAxis, extent: xAxis ? box.width : box.height, lastDelta: 0, time: event.timeStamp, speed: 0,
        dragging: prior?.key === key && prior.pointer === null, nodes: [...canvas.current.querySelectorAll('[data-swipe-key]')].filter(node => node.dataset.swipeKey === key) };
      gesture.current = g;
      if (g.dragging) { paint(g, position); event.currentTarget.setPointerCapture(event.pointerId); }
    },
    onDragStart(event) { if (gesture.current?.pointer != null) event.preventDefault(); },
    onPointerMove(event) {
      const g = gesture.current;
      if (!g || g.pointer !== event.pointerId || g.key !== slideKey(cell)) return;
      const dx = event.clientX - g.x, dy = event.clientY - g.y;
      const vertical = g.axis === 'clientY';
      const delta = (vertical ? dy : dx) * g.sign, cross = vertical ? dx : dy;
      if (!g.dragging) {
        if (Math.abs(cross) > 8 && Math.abs(cross) > Math.abs(delta)) { clear(); return; }
        if (Math.abs(delta) < 5 || Math.abs(delta) < Math.abs(cross)) return;
        g.dragging = true; event.currentTarget.setPointerCapture(event.pointerId);
      }
      const dt = Math.max(1, event.timeStamp - g.time);
      if (delta !== g.lastDelta) {
        const sample = (g.lastDelta - delta) / dt;
        g.speed = dt > 80 ? sample : g.speed * .35 + sample * .65;
        g.lastDelta = delta; g.time = event.timeStamp;
      }
      paintDrag(g, g.origin - delta / g.extent);
    },
    onPointerUp(event) {
      const g = gesture.current;
      if (!g || g.pointer !== event.pointerId) return;
      if (!g.dragging) { clear(); return; }
      suppressClick.current = true;
      const age = event.timeStamp - g.time;
      const speed = clamp(g.speed / g.extent, -.012, .012) * clamp(1 - Math.max(0, age - 32) / 80, 0, 1);
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const coast = reduced ? clamp(speed * 500, -.5, .5) : speed * 500;
      const target = Math.round(g.position + coast);
      settle(g, target, speed);
    },
    onLostPointerCapture(event) { if (event.target === event.currentTarget && gesture.current?.pointer === event.pointerId) settle(gesture.current, gesture.current.active); },
    onPointerCancel(event) { if (gesture.current?.pointer === event.pointerId) settle(gesture.current, gesture.current.active); },
    onClickCapture(event) {
      if (suppressClick.current && event.detail) { suppressClick.current = false; event.preventDefault(); event.stopPropagation(); }
    },
    onKeyDown(event) {
      const [x, y] = swipeOffset(cell);
      const delta = { ArrowLeft: -x, ArrowRight: x, ArrowUp: -y, ArrowDown: y }[event.key];
      if (event.target !== event.currentTarget || !delta) return;
      event.preventDefault(); step(cell, delta);
    },
  });
  return { positions, range: range?.owner === owner ? range : null, events };
}
