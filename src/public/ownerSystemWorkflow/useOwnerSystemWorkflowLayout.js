import { useEffect, useState } from 'react';

const snapshot = () => {
  const width = Math.max(1, globalThis.innerWidth || 1440);
  const height = Math.max(1, globalThis.innerHeight || 900);
  return {
    width,
    height,
    mode: width <= 760 ? 'narrow' : width <= 1100 ? 'compact' : 'wide',
    reducedMotion: globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true,
  };
};

export default function useOwnerSystemWorkflowLayout() {
  const [layout, setLayout] = useState(snapshot);
  useEffect(() => {
    const motion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
    const update = () => setLayout(snapshot());
    globalThis.addEventListener?.('resize', update);
    motion?.addEventListener?.('change', update);
    return () => {
      globalThis.removeEventListener?.('resize', update);
      motion?.removeEventListener?.('change', update);
    };
  }, []);
  return layout;
}
