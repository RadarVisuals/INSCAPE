import { forwardRef, useImperativeHandle, useRef } from 'react';
import { createKeeperRigPose, stepKeeperRigPose } from './keeperRigMotion.js';
import { createKeeperSnakePose, stepKeeperSnakePose } from './keeperSnakeMotion.js';
import { usePreparedRasterArtwork } from './usePreparedRasterArtwork.js';
import { KeeperOctopusArtwork } from './KeeperOctopusArtwork.jsx';

function KeeperPartImage({ part }) {
  const ref = usePreparedRasterArtwork(part.src);
  return <img ref={ref} src={part.src} alt="" draggable={false} style={{ width: `${part.width * 100}%`, height: `${part.height * 100}%` }} />;
}

// React owns the immutable artwork; the shared Keeper animation loop updates
// scoped part refs directly. No React render or saved-state write per frame.
const KeeperRasterArtwork = forwardRef(function KeeperRasterArtwork({ rig, headControl }, ref) {
  const nodes = useRef([]), pose = useRef(null);
  const snake = rig.kind === 'snake';
  useImperativeHandle(ref, () => ({
    reset() { pose.current = null; },
    paint(motion, dt, options) {
      pose.current ??= snake ? createKeeperSnakePose(rig) : createKeeperRigPose(rig);
      (snake ? stepKeeperSnakePose : stepKeeperRigPose)(pose.current, rig, motion, dt, options);
      pose.current.parts.forEach((part, index) => {
        if (nodes.current[index]) nodes.current[index].style.transform =
          `translate(${part.x * 100}%, ${part.y * 100}%) rotate(${part.angle}rad)`;
      });
    },
  }), [rig]);
  return <div className="keeper-rig" data-keeper-rig={snake ? 'snake' : 'tentacles'}>
    {rig.parts.map((part, index) => <div key={part.id} ref={node => { nodes.current[index] = node; }}
      className="keeper-rig__part" data-keeper-part={part.id}
      style={{ transform: `translate(${part.x * 100}%, ${part.y * 100}%)`, zIndex: part.id === 'eye' ? 2 : part.id === 'body' ? 1 : 0 }}>
      <KeeperPartImage part={part} />
      {part.id === 'body' && headControl && <button {...headControl} type="button" className="keeper-head"
        style={{ width: `${part.width * 100}%`, height: `${part.height * 100}%` }} />}
    </div>)}
  </div>;
});

export const KeeperRigArtwork = forwardRef(function KeeperRigArtwork(props, ref) {
  return props.rig.kind === 'octopus' ? <KeeperOctopusArtwork {...props} ref={ref} /> : <KeeperRasterArtwork {...props} ref={ref} />;
});
