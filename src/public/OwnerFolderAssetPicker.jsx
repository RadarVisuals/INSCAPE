import { useEffect, useRef, useState } from 'react';
import FolderAssetPicker from '../library/components/FolderAssetPicker.jsx';

const STORAGE_KEY = 'human-underneath:owner-folder-asset-picker:v1';
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const screenSize = () => ({ width: globalThis.innerWidth || 1280, height: globalThis.innerHeight || 720 });

function normalize(value) {
  const screen = screenSize();
  const width = clamp(Number(value?.width) || Math.min(980, screen.width - 32), 480, Math.max(480, screen.width - 16));
  const height = clamp(Number(value?.height) || Math.min(760, screen.height - 32), 360, Math.max(360, screen.height - 16));
  return {
    width, height,
    x: clamp(Number.isFinite(Number(value?.x)) ? Number(value.x) : (screen.width - width) / 2, 8, Math.max(8, screen.width - width - 8)),
    y: clamp(Number.isFinite(Number(value?.y)) ? Number(value.y) : (screen.height - height) / 2, 8, Math.max(8, screen.height - height - 8))
  };
}

function load() { try { return normalize(JSON.parse(window.localStorage.getItem(STORAGE_KEY))); } catch { return normalize(null); } }
function save(value) { try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch {} }

export default function OwnerFolderAssetPicker(props) {
  const [geometry, setGeometry] = useState(load);
  const geometryRef = useRef(geometry);
  const formRef = useRef(null);
  const dragRef = useRef(null);
  geometryRef.current = geometry;

  useEffect(() => {
    const form = formRef.current;
    if (!form || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => setGeometry((current) => {
      const next = normalize({ ...current, width: form.offsetWidth, height: form.offsetHeight }); save(next); return next;
    }));
    observer.observe(form);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const resize = () => setGeometry((current) => { const next = normalize(current); save(next); return next; });
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const titlebarProps = {
    onPointerDown(event) {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, origin: geometryRef.current };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    onPointerMove(event) {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      setGeometry(normalize({ ...drag.origin, x: drag.origin.x + event.clientX - drag.x, y: drag.origin.y + event.clientY - drag.y }));
    },
    onPointerUp(event) {
      if (dragRef.current?.pointerId !== event.pointerId) return;
      dragRef.current = null; save(geometryRef.current);
    },
    onPointerCancel() { dragRef.current = null; }
  };
  const windowProps = {
    formRef,
    style: { left: geometry.x, top: geometry.y, width: geometry.width, height: geometry.height },
    titlebarProps,
    backdropProps: { onPointerDown: (event) => { if (event.target === event.currentTarget) props.onCancel(); } }
  };
  return <FolderAssetPicker {...props} windowProps={windowProps} />;
}
