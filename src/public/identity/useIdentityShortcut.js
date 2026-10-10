import { useEffect, useRef, useState } from 'react';
import { clampWorkbenchPosition } from '../ownerSystemWorkflow/workbenchSpace.js';

export const IDENTITY_SHORTCUT_SIZES = { small: 80, medium: 128, large: 192 };
const storageKey = address => `inscape:identity-shortcut:${address.toLowerCase()}`;
export function saveIdentityShortcut(address, value) {
  try { localStorage.setItem(storageKey(address), JSON.stringify(value)); } catch { /* Optional preference. */ }
}
export function loadIdentityShortcut(address) {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey(address)));
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return { ...value, shape: value.shape === 'square' ? 'square' : 'circle',
      mode: ['window', 'minimized', 'closed'].includes(value.mode) ? value.mode : null };
  } catch { return null; }
}
const clamp = value => {
  const position = clampWorkbenchPosition({ left: value.x, top: value.y }, { width: value.size, height: value.size });
  return { ...value, x: position.left, y: position.top };
};

// Local presentation only. Visitors never read or write the owner's preferences.
export default function useIdentityShortcut(address, owner) {
  const [position, setPosition] = useState(() => {
    const saved = owner ? loadIdentityShortcut(address) : null;
    return clamp({ size: Object.values(IDENTITY_SHORTCUT_SIZES).includes(saved?.size) ? saved.size : 128,
      shape: saved?.shape || 'circle', mode: saved?.mode === 'minimized' ? 'minimized' : 'window',
      x: Number.isFinite(saved?.x) ? saved.x : window.innerWidth - 152,
      y: Number.isFinite(saved?.y) ? saved.y : 24 });
  });
  const current = useRef(position); current.current = position;
  const gesture = useRef(null);
  const suppressClick = useRef(false);
  const persist = value => {
    if (owner) saveIdentityShortcut(address, value);
  };
  const change = value => { const next = clamp(value); current.current = next; setPosition(next); return next; };
  useEffect(() => { persist(current.current); }, []);
  return {
    position, suppressClick,
    setMode: mode => persist(change({ ...current.current, mode })),
    setShape: shape => persist(change({ ...current.current, shape })),
    resize: size => persist(change({ ...current.current, size })),
    pointer: {
      onPointerDown: event => {
        if (event.button !== 0) return;
        suppressClick.current = false;
        gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, origin: current.current };
        event.currentTarget.setPointerCapture(event.pointerId);
      },
      onPointerMove: event => {
        const start = gesture.current;
        if (start?.id !== event.pointerId) return;
        const dx = event.clientX - start.x, dy = event.clientY - start.y;
        if (Math.hypot(dx, dy) > 5) suppressClick.current = true;
        if (suppressClick.current) change({ ...start.origin, x: start.origin.x + dx, y: start.origin.y + dy });
      },
      onPointerUp: event => {
        if (gesture.current?.id !== event.pointerId) return;
        gesture.current = null; persist(current.current);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      },
      onPointerCancel: () => { gesture.current = null; suppressClick.current = true; },
      onLostPointerCapture: () => { gesture.current = null; },
    },
    moveByKey: event => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      const step = event.shiftKey ? 24 : 8;
      persist(change({ ...current.current,
        x: current.current.x + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0),
        y: current.current.y + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0) }));
    },
  };
}
