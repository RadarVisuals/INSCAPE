import { useLayoutEffect, useRef, useState } from 'react';
import WorkbenchOverviewPreview from './WorkbenchOverviewPreview.jsx';

// Both Studio's draft manager and the published Gallery paint the same measured flight.
export default function CanvasJourney({ journey, hostRef, surface, duration = 650, targetReady = true, resolveTarget, revealLayers, onComplete }) {
  const [plan, setPlan] = useState(null);
  const latest = useRef(null); latest.current = { onComplete, resolveTarget, revealLayers };
  useLayoutEffect(() => {
    setPlan(null);
    if (!journey) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { latest.current.onComplete(); return; }
    // Keep painting the captured source until Studio has fitted its own camera.
    if (!targetReady) return;
    let frame = 0, attempts = 0;
    const prepare = () => {
      const source = journey.source;
      const target = latest.current.resolveTarget(source);
      if (!target && attempts++ < 120) { frame = requestAnimationFrame(prepare); return; }
      if (!target) { latest.current.onComplete(); return; }
      setPlan({ blend: journey.address && journey.direction, from: source, to: target, scale: Math.max(source.paint.scale, target.paint.scale) });
    };
    if (journey.direction === 'list' || journey.direction === 'grid') prepare();
    else frame = requestAnimationFrame(() => { frame = requestAnimationFrame(prepare); });
    return () => cancelAnimationFrame(frame);
  }, [journey, targetReady]);
  useLayoutEffect(() => {
    if (!plan) return;
    const node = surface.current, canvas = node.querySelector('.workbench-overview-canvas');
    const density = devicePixelRatio || 1;
    const frame = value => ({ left: `${value.frame.left}px`, top: `${value.frame.top}px`, width: `${value.frame.width}px`,
      height: `${value.frame.height}px`, borderRadius: `${value.radius}px`, backgroundColor: plan.blend === 'overview' ? 'transparent' : value.background });
    const paint = value => ({ transform: `translate(${value.paint.left}px, ${value.paint.top}px) scale(${value.paint.scale / (plan.scale * density)})` });
    const options = { duration, fill: 'both' };
    const ease = 'cubic-bezier(.4,0,.2,1)';
    // Hold the frame still at the Studio end while the two versions exchange paint.
    const move = project => {
      const from = project(plan.from), to = project(plan.to);
      if (plan.blend === 'overview') return [from, { ...from, offset: .22, easing: ease }, to];
      if (plan.blend === 'editor') return [{ ...from, easing: ease }, { ...to, offset: .76 }, to];
      return [{ ...from, easing: ease }, to];
    };
    const animations = [node.animate(move(frame), options), canvas.animate(move(paint), options)];
    if (plan.blend === 'editor') {
      // Dissolve one opaque frame over the fully painted draft. Its backing also
      // covers the margins of a differently shaped publication, so moved/new
      // artwork cannot pop through there when the live layer becomes visible.
      // Fading both layers would dim identical pixels halfway through the blend.
      animations.push(node.animate([{ opacity: 1 }, { opacity: 1, offset: .76 }, { opacity: 0 }], options));
      for (const layer of latest.current.revealLayers()) {
        animations.push(layer.animate([
          { visibility: 'hidden', opacity: 0, easing: 'steps(1, end)' }, { visibility: 'visible', opacity: 1, offset: .76 },
          { visibility: 'visible', opacity: 1 },
        ], options));
      }
    } else if (plan.from.fadeIn) {
      animations.push(node.animate([{ opacity: 0 }, { opacity: 1, offset: .22 }, { opacity: 1 }], options));
    }
    let current = true;
    const finish = () => {
      if (!current) return;
      current = false;
      setPlan(null);
      latest.current.onComplete();
      if (document.activeElement === document.body) hostRef.current?.focus({ preventScroll: true });
    };
    Promise.all(animations.map(animation => animation.finished)).then(finish, () => {});
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    preference.addEventListener('change', finish);
    addEventListener('resize', finish);
    return () => { current = false; animations.forEach(animation => animation.cancel()); removeEventListener('resize', finish); preference.removeEventListener('change', finish); };
  }, [plan, hostRef, surface, duration]);
  if (!journey) return null;
  const source = journey.source, { model, name } = source;
  const scale = plan?.scale || source.paint.scale;
  return <div className="owner-canvas-journey" ref={surface} aria-hidden="true" inert="" data-direction={journey.direction} data-canvas-id={source.id}
    style={{ opacity: source.fadeIn ? 0 : undefined, left: source.frame.left, top: source.frame.top, width: source.frame.width, height: source.frame.height, borderRadius: source.radius, background: journey.address && journey.direction === 'overview' ? 'transparent' : source.background }}>
    <WorkbenchOverviewPreview model={model} name={name} viewport={plan?.to.frame || source.frame}
      camera={{ scale, offset: { x: source.paint.left - model.area.left * scale, y: source.paint.top - model.area.top * scale } }} presenting />
  </div>;
}
