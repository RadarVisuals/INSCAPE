import { useEffect, useRef } from 'react';
import { SteyraArtwork } from './steyra-artwork';
import { PerspectiveRoom } from './perspective-room';
import { roomCamera } from './room-camera';
import { useIntroTilt } from './use-intro-tilt';
import './steyra.css';
import './steyraFront.css';

export default function SteyraFront({ active, light, interactionSurface }) {
  const tilt = useIntroTilt(active, interactionSurface), plane = useRef(null), head = useRef({ tracked: false, x: 0, y: 0, distance: 1 });
  useEffect(() => {
    const host = tilt.ref.current;
    if (!host || !active) return;
    let frame = 0;
    const draw = () => {
      frame = 0;
      const w = host.clientWidth, h = host.clientHeight, camera = roomCamera(w, h, tilt.pose.current);
      const p = camera.project([0, 0, camera.f * .65]);
      plane.current.style.transform = `translate(${p.x - w / 2}px,${p.y - h / 2}px) scale(${p.scale})`;
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(draw); };
    const observer = new ResizeObserver(schedule); observer.observe(host); host.addEventListener('inscape-tilt', schedule); draw();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); host.removeEventListener('inscape-tilt', schedule); };
  }, [active, tilt.ref, tilt.pose]);
  return <div className={`intro mobile-steyra ${light ? 'mobile-steyra-light' : ''}`} ref={tilt.ref}>
    <PerspectiveRoom active={active} pose={tilt.pose} light={light} depthRatio={1.8} />
    <div className="mobile-steyra-plane" ref={plane}><div className="intro-art"><SteyraArtwork active={active} host={tilt.ref} pose={tilt.pose} head={head} /></div></div>
    {tilt.canUseMotion && <button className="mobile-steyra-motion" onClick={tilt.toggleMotion}>{tilt.buttonLabel}</button>}
    {tilt.hint && <span className="mobile-steyra-hint" role="status">{tilt.hint}</span>}
  </div>;
}
