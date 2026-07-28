import { useMemo, useRef, useState } from 'react';
import ArtCanvas from '../../components/Canvas/ArtCanvas.jsx';
import KeeperDock from '../../public/KeeperDock.jsx';

const KEEPER_ID = 'abyssal_eye';
const LATTICE_DOCKED_KEEPER_SCALE = 0.5;
const PRESENTATION = Object.freeze({ keeperId: KEEPER_ID });
const TRANSITIONAL_PHASES = new Set(['approaching', 'entering', 'releasing']);

function blockTransitionActivation(event) {
  const phase = event.target.closest?.('.keeper-dock')?.dataset.phase;
  if (!TRANSITIONAL_PHASES.has(phase)) return;
  event.preventDefault();
  event.stopPropagation();
}

export default function LatticeKeeperDockHarness({ blocked = false, reducedMotion = false }) {
  const canvasRef = useRef(null);
  const [ready, setReady] = useState(false);

  const residentHandoff = useMemo(() => ({
    start(bounds, options) {
      return canvasRef.current?.startResidentHandoff(bounds, options);
    },
    updateBounds(bounds) {
      return canvasRef.current?.updateResidentHandoffBounds(bounds);
    },
    exit(bounds, options) {
      return canvasRef.current?.exitResidentHandoff(bounds, options);
    },
    cancel() {
      canvasRef.current?.cancelResidentHandoff();
    },
  }), []);

  return <>
    <div className="lattice-keeper-world" aria-hidden="true">
      <ArtCanvas
        ref={canvasRef}
        actorVisible
        foregroundOnly
        stageVisible={false}
        reducedMotion={reducedMotion}
        presentationOverride={PRESENTATION}
        onReady={() => setReady(true)}
      />
    </div>
    <div id="keeper-dock-underlay" className="lattice-keeper-dock-underlay" aria-hidden="true" />
    <div
      className="lattice-keeper-dock-layer"
      data-blocked={blocked || undefined}
      inert={blocked ? '' : undefined}
      onClickCapture={blockTransitionActivation}
    >
      {ready && <KeeperDock
        actorId={KEEPER_ID}
        residentHandoff={residentHandoff}
        reducedMotion={reducedMotion}
        residentScale={LATTICE_DOCKED_KEEPER_SCALE}
      />}
    </div>
  </>;
}
