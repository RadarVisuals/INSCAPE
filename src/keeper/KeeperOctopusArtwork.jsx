import { forwardRef, useId, useImperativeHandle, useRef } from 'react';
import { createKeeperOctopusPose, stepKeeperOctopusPose, OCTOPUS_DROP_LIMIT } from './keeperOctopusMotion.js';
import { stepKeeperSvgPose } from './keeperSvgMotion.js';

const Shape = ({ part, ...props }) => <path d={part.d} fill={part.fill} fillOpacity={part.opacity} {...props} />;
export const KeeperOctopusArtwork = forwardRef(function KeeperOctopusArtwork({ rig, headControl, movement }, ref) {
  const id = useId().replace(/:/g, ''), body = useRef(null), control = useRef(null), tentacles = useRef([]), gradients = useRef([]), clips = useRef([]), gaze = useRef([]), drops = useRef([]), pose = useRef(null);
  useImperativeHandle(ref, () => ({
    reset() { pose.current = null; drops.current.forEach(node => { if (node) node.style.display = 'none'; }); },
    paint(motion, dt, options) {
      pose.current ??= createKeeperOctopusPose(rig);
      const step = movement === 'svg' ? stepKeeperSvgPose : stepKeeperOctopusPose;
      const state = step(pose.current, rig, motion, dt, options);
      const angle = state.headAngle || 0, degrees = angle * 180 / Math.PI;
      const transform = `rotate(${degrees}) scale(${state.scaleX} 1)`;
      body.current?.setAttribute('transform', transform);
      if (control.current) control.current.style.transform = `rotate(${angle}rad) scaleX(${state.scaleX})`;
      state.tentacles.forEach((part, i) => {
        tentacles.current[i]?.setAttribute('d', part.d);
        tentacles.current[i]?.setAttribute('transform', transform);
        gradients.current[i]?.setAttribute('x2', (part.localTip || rig.tentacles[i].tip).x);
        gradients.current[i]?.setAttribute('y2', (part.localTip || rig.tentacles[i].tip).y);
      });
      state.eyes.forEach((eye, i) => {
        clips.current[i]?.setAttribute('d', eye.d);
        gaze.current[i]?.setAttribute('transform', `translate(${eye.x} ${eye.y})`);
      });
      drops.current.forEach((node, i) => {
        if (!node) return;
        const drop = state.drops[i];
        node.style.display = drop ? '' : 'none';
        if (!drop) return;
        const radius = drop.radius * 1000 / options.size;
        node.setAttribute('transform', `translate(${drop.localX} ${drop.localY}) scale(${radius} ${radius * (1.25 + Math.min(.8, drop.life * 2))})`);
        node.setAttribute('opacity', drop.opacity);
      });
    },
  }), [rig, movement]);
  return <div className="keeper-rig keeper-octopus" data-keeper-rig="octopus">
    <svg className="keeper-octopus__art" viewBox="-500 -500 1000 1000" aria-hidden="true">
      <defs>
        {rig.tentacles.map((t, i) => <linearGradient key={t.id} ref={node => { gradients.current[i] = node; }} id={`${id}-goo-${i}`} gradientUnits="userSpaceOnUse"
          x1={t.root.x} y1={t.root.y} x2={t.tip.x} y2={t.tip.y}>
          {t.stops.map((stop, index) => <stop key={index} offset={stop.offset} stopColor={stop.color} />)}
        </linearGradient>)}
        {rig.eyes.map((eye, i) => <clipPath key={eye.id} id={`${id}-eye-${i}`} clipPathUnits="userSpaceOnUse">
          <path ref={node => { clips.current[i] = node; }} d={eye.aperture.d} />
        </clipPath>)}
      </defs>
      {rig.tentacles.map((t, i) => <path key={t.id} ref={node => { tentacles.current[i] = node; }} data-keeper-part={t.id} d={t.d} fill={`url(#${id}-goo-${i})`} />)}
      <g ref={body} data-keeper-part="body">
        <image href={rig.body.src} x={rig.body.x} y={rig.body.y} width={rig.body.width} height={rig.body.height} />
        {rig.eyes.map((eye, i) => <g key={eye.id} data-keeper-eye={eye.id}>
          <g clipPath={`url(#${id}-eye-${i})`}>
            <Shape part={eye.aperture} />
            <g ref={node => { gaze.current[i] = node; }} data-keeper-gaze={eye.id}>
              {eye.gaze.map((part, index) => <Shape key={index} part={part} />)}
            </g>
          </g>
          {eye.lids.map(part => <Shape key={part.role} part={part} data-keeper-lid={part.role} />)}
        </g>)}
      </g>
      <g fill={rig.colors.end} data-keeper-drops="">
        {Array.from({ length: OCTOPUS_DROP_LIMIT }, (_, i) => <path key={i} ref={node => { drops.current[i] = node; }}
          style={{ display: 'none' }} d="M0 -1.8 C.1 -.7 1 .05 1 .65 C1 1.9 -1 1.9 -1 .65 C-1 .05 -.1 -.7 0 -1.8Z" />)}
      </g>
    </svg>
    {headControl && <div className="keeper-rig__part" ref={control}><button {...headControl} type="button" className="keeper-head"
      style={{ width: `${rig.body.width / 10}%`, height: `${rig.body.height / 10}%` }} /></div>}
  </div>;
});
