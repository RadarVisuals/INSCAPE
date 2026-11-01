import { useLayoutEffect, useRef, useState } from 'react';
import ArticleView from '../text/ArticleView.jsx';
import { projectDisplayStageViewport, projectDisplayPlacementRectangle } from '../lattice/rendering/displayPaintGeometry.js';
import { moduleGrainStyle } from '../systemWorkflow/domain/moduleSurfaceAppearance.js';
import { receptionScenePlacements } from './receptionLayers.js';
import '../public/ownerSystemWorkflow/moduleSurface.css';
import './receptionScene.css';

// A cell owns its scene coordinates. Display and Reception share the projection;
// Image and Text remain the owners of their content and source identity.
export default function ReceptionScene({ reception, region, renderImage, mobile }) {
  const host = useRef(null), [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const node = host.current;
    const measure = () => setSize(previous => previous.width === node.clientWidth && previous.height === node.clientHeight
      ? previous : { width: node.clientWidth, height: node.clientHeight });
    measure(); const observer = new ResizeObserver(measure); observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const field = size.width && size.height ? projectDisplayStageViewport(region.scene.geometry, size) : null;
  return <div className="reception-scene" ref={host} aria-label="Frame layers">
    {field && receptionScenePlacements(region.scene, mobile).map(placement => {
      const image = reception.imageModules.find(item => item.id === placement.id);
      const text = reception.texts.find(item => item.id === placement.id);
      const shape = reception.shapes?.find(item => item.id === placement.id);
      if (!image && !text && !shape) return null;
      return <div key={placement.id} className="reception-scene-layer" data-layer-id={placement.id}
        data-text-layer={Boolean(text) || undefined} style={projectDisplayPlacementRectangle(placement, field, 1)}>
        {shape ? <div className="reception-scene-shape" style={{ background: shape.color, opacity: shape.opacity,
          filter: shape.blur ? `blur(${shape.blur}px)` : undefined, ...moduleGrainStyle(shape.grain) }}>
          {shape.grain > 0 && <span className="module-surface-grain" aria-hidden="true" />}</div>
          : image ? renderImage(image) : <ArticleView article={text.article} containerOwned />}
      </div>;
    })}
  </div>;
}
