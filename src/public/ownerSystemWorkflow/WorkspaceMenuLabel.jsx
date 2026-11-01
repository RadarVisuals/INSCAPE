import { useLayoutEffect, useRef, useState } from 'react';

export default function WorkspaceMenuLabel({ label, context, index, animateEntry = false }) {
  const host = useRef(null), mounted = useRef(false), entry = useRef(animateEntry);
  const [face, setFace] = useState({ label, context, previous: animateEntry && index === 0 ? 'My Inscape' : label });
  if (face.context !== context) setFace({ label, context, previous: face.label });
  useLayoutEffect(() => {
    if (!mounted.current) { mounted.current = true; if (!entry.current) return; }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const animations = [...host.current.children].map((letter, i) => letter.animate([
      { transform: 'rotateX(0deg)' }, { transform: 'rotateX(-180deg)' },
    ], { duration: 280, delay: i * 24 + index * 10, easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'backwards' }));
    return () => animations.forEach(animation => animation.cancel());
  }, [context, index]);
  return <span className="workspace-menu-label" ref={host} aria-hidden="true">
    {Array.from({ length: Math.max(face.previous.length, label.length) }, (_, i) => <span className="workspace-menu-letter" key={i}>
      <span>{face.previous[i] || ''}</span><span>{label[i] || ''}</span>
    </span>)}
  </span>;
}
