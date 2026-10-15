import { useLayoutEffect, useRef, useState } from 'react';
import { Play, Pause, Eye, Info } from '../../public/InscapeIcons.jsx';
import { DisplayStageSizeContext } from '../../public/ownerSystemWorkflow/DisplayStageSizeContext.js';
import { useSharedDisplayTools } from '../../public/ownerSystemWorkflow/SharedDisplayTools.jsx';
import '../../public/ownerSystemWorkflow/moduleSurface.css';
import { moduleEdgeStyle } from '../../systemWorkflow/domain/moduleSurfaceAppearance.js';

// A bounded host only: no canvas camera, window placement or second Display state.
export default function BentoDisplayFrame({ children, navigation, documentGeometry, moduleAppearance, instanceId,
  onContextMenu, playing, playbackAvailable, onTogglePlayback, onInspect, inspectDisabled, renderCues, renderInspection, initialPresentation }) {
  const stage = useRef(null), scene = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [inspection, setInspection] = useState(null), [controls, setControls] = useState(null);
  const tools = useSharedDisplayTools();
  useLayoutEffect(() => {
    const node = stage.current;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize(current => current.width === width && current.height === height ? current : { width, height });
    });
    observer.observe(node); return () => observer.disconnect();
  }, []);
  const contentScale = size.width / (initialPresentation.window?.width || size.width || 1);
  return <article className="bento-display" onContextMenu={onContextMenu} style={{ '--display-ratio': documentGeometry.columns / documentGeometry.rows }}>
    <div className="bento-display__stage" ref={stage} style={{ aspectRatio: documentGeometry.columns / documentGeometry.rows,
      ...moduleEdgeStyle(moduleAppearance?.edges, contentScale) }}>
      <div className="bento-display__scene system-workflow__inspection-scene" ref={scene}>
        <DisplayStageSizeContext.Provider value={{ ...size, screenScale: 1, contentScale }}>{children}</DisplayStageSizeContext.Provider>
      </div>
      {moduleAppearance?.edges?.grain > 0 && <span aria-hidden="true" className="module-surface-grain" />}
      {moduleAppearance?.frame && <span aria-hidden="true" className="module-surface-outline" />}
      {stage.current && renderCues?.(stage.current)}
      <div className="bento-display__inspection" ref={setInspection} />
      <div className="bento-display__controls" data-workflow-material="tactile" ref={setControls}>
        {navigation}
        <button className="workflow-tactile-control" type="button" aria-label={playing ? 'Pause Grids' : 'Play Grids'} aria-pressed={playing}
          disabled={!playbackAvailable || Boolean(renderInspection)} onClick={onTogglePlayback}>{playing ? <Pause /> : <Play />}</button>
        <button className="workflow-tactile-control" type="button" aria-label="Artwork metadata" aria-pressed={tools.target === instanceId && tools.state.metadata}
          onClick={event => tools.command('metadata', undefined, event.currentTarget, instanceId)}><Info /></button>
        <button className="workflow-tactile-control" type="button" aria-label="Inspect artwork" disabled={inspectDisabled} onClick={onInspect}><Eye /></button>
      </div>
    </div>
    {inspection && controls && renderInspection?.(inspection, controls, scene.current)}
  </article>;
}
