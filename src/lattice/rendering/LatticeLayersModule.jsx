import { GripVertical, Lock } from 'lucide-react';
import { moveLatticeLayerEntries } from './latticeLayersModel.js';
import './latticeLayersModule.css';

export default function LatticeLayersModule({
  layers = [],
  onReorder,
  onSelectionChange,
  reorderDisabled = false,
  selectedIds = [],
}) {
  const selected = new Set(selectedIds);
  const orderingBlocked = reorderDisabled || layers.some(({ locked }) => locked);
  const reorder = (sourceIds, targetId) => {
    const next = moveLatticeLayerEntries(layers, sourceIds, targetId);
    if (next) onReorder?.(next.map(({ id }) => id));
  };
  return <div className="lattice-layers-module" role="listbox" aria-label="Active table layers" aria-multiselectable="true">
    {!layers.length && <p>NO PLACEMENTS ON ACTIVE TABLE</p>}
    {layers.map((layer, index) => <button
      aria-selected={selected.has(layer.id)}
      className="lattice-layers-module__row"
      data-selected={selected.has(layer.id) || undefined}
      draggable={!orderingBlocked}
      key={layer.id}
      onClick={(event) => onSelectionChange?.(layer.id, {
        additive: event.ctrlKey || event.metaKey,
        range: event.shiftKey,
      })}
      onDragOver={(event) => { if (!orderingBlocked) event.preventDefault(); }}
      onDragStart={(event) => {
        const sourceIds = selected.has(layer.id) && selected.size > 1 ? [...selected] : [layer.id];
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/x-inscape-layers', JSON.stringify(sourceIds));
        event.dataTransfer.setData('text/x-inscape-layer', layer.id);
      }}
      onDrop={(event) => {
        event.preventDefault();
        let sourceIds;
        try { sourceIds = JSON.parse(event.dataTransfer.getData('text/x-inscape-layers')); }
        catch { sourceIds = [event.dataTransfer.getData('text/x-inscape-layer')]; }
        reorder(sourceIds, layer.id);
      }}
      onKeyDown={(event) => {
        if (!event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key) || orderingBlocked) return;
        const movingIds = selected.has(layer.id) && selected.size > 1 ? [...selected] : [layer.id];
        const movingIndexes = movingIds.map((id) => layers.findIndex((entry) => entry.id === id)).filter((value) => value >= 0);
        const edgeIndex = event.key === 'ArrowUp' ? Math.min(...movingIndexes) : Math.max(...movingIndexes);
        const target = layers[edgeIndex + (event.key === 'ArrowUp' ? -1 : 1)];
        if (!target) return;
        event.preventDefault();
        reorder(movingIds, target.id);
      }}
      role="option"
      type="button"
    >
      <span className="lattice-layers-module__preview">
        {layer.previewSrc ? <img alt="" draggable="false" src={layer.previewSrc} /> : <i aria-hidden="true" />}
      </span>
      <span className="lattice-layers-module__identity">
        <strong>{layer.name || 'UNTITLED ASSET'}</strong>
        <small>LAYER {String(layer.layer).padStart(2, '0')}</small>
      </span>
      {layer.locked ? <Lock aria-label="Locked" size={13} strokeWidth={2} />
        : <GripVertical aria-hidden="true" size={14} strokeWidth={2} />}
    </button>)}
  </div>;
}
