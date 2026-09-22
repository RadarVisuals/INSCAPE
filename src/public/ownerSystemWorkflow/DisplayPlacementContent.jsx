import { memo } from 'react';
import { assetForPlacement } from '../../systemWorkflow/domain/placementMedia.js';
import { projectArtworkInRectangle } from '../../lattice/rendering/latticeProductionProjection.js';
import { ownerSystemWorkflowAssetDimensions } from './ownerSystemWorkflowAssetDimensions.js';
import { progressiveArtworkSources } from './progressiveArtworkSources.js';
import ProgressiveArtworkImage from './ProgressiveArtworkImage.jsx';
import DisplayTextContent from './DisplayTextContent.jsx';

// Navigation changes the placement's interaction shell, not its media. Reuse
// this render until authored content, crop, resolved asset or geometry changes.
export default memo(function DisplayPlacementContent({ placement, asset: baseAsset, crop, width, height, cellSize, onAssetDimensions }) {
  if (placement.kind === 'text') return <DisplayTextContent placement={placement} cellSize={cellSize} />;
  const asset = assetForPlacement(baseAsset, placement);
  const dimensions = ownerSystemWorkflowAssetDimensions(asset);
  const opening = { left: 0, top: 0, width, height };
  const artwork = projectArtworkInRectangle({ ...placement, crop }, opening, dimensions);
  const style = artwork.imageRenderRectangle ? { ...artwork.imageRenderRectangle, transform: artwork.imageTransform } : undefined;
  return <span className="system-workflow__artwork-opening">
    {progressiveArtworkSources(asset).high
      ? <ProgressiveArtworkImage asset={asset} onSourceLoad={dimensions => onAssetDimensions?.(asset, dimensions)} style={style} />
      : <em>Media</em>}
  </span>;
});
