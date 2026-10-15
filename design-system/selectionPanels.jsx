import React from 'react';
import { Plus } from 'lucide-react';
import ColourControls from './colourPreview.jsx';
import SampleArtwork from './sampleArtwork.jsx';
import { NumberField, CheckField } from './previewControls.jsx';
const typeHint = (kind) => (
  <p className="ds-studio-empty">
    Select {kind} to use these settings. Your current tab stays open.
  </p>
);
// These sample settings never own a second copy of the selection or write application drafts.
export default function SelectionPanels({
  tab,
  item,
  selectedCount,
  editable,
  update,
  colourTarget,
}) {
  if (selectedCount > 1)
    return (
      <p className="ds-studio-empty">
        {selectedCount} layers selected. Choose one layer for individual {tab} settings.
        Selection actions remain available in the toolbar.
      </p>
    );
  if (!item)
    return (
      <p className="ds-studio-empty">
        Nothing selected. Reset the example to restore the sample objects.
      </p>
    );
  if (tab === 'Color') {
    const target = item.kind === 'text' && colourTarget?.id === item.id ? colourTarget : null;
    return (
      <>
        {target && <p className="ds-studio-note">{target.label}</p>}
        <ColourControls
          key={item.id + ':' + (target?.key || '')}
          item={{ ...item, color: target?.color || item.color, locked: !editable }}
          update={(patch) => {
            if (patch.color !== undefined && target?.apply) target.apply(patch.color);
            else update(patch);
          }}
          beginGesture={target?.begin}
        />
      </>
    );
  }
  if (tab === 'Transform')
    return (
      <>
        <div className="ds-studio-field-row">
          <NumberField label="X" value={item.x} min={-4096} onChange={(x) => update({ x })} />
          <NumberField label="Y" value={item.y} min={-4096} onChange={(y) => update({ y })} />
        </div>
        <div className="ds-studio-field-row">
          <NumberField
            label="Width"
            value={item.width}
            min={8}
            onChange={(width) => update({ width })}
          />
          <NumberField
            label="Height"
            value={item.height}
            min={8}
            onChange={(height) => update({ height })}
          />
        </div>
        <NumberField
          label="Rotation"
          value={item.rotation}
          min={-360}
          max={360}
          onChange={(rotation) => update({ rotation })}
        />
        <small className="ds-studio-note">
          Position and size use example canvas coordinates.
        </small>
      </>
    );
  if (tab === 'FX')
    return (
      <>
        <label className="ds-studio-range">
          Grain
          <input
            aria-label="Studio grain"
            type="range"
            min="0"
            max="100"
            value={item.grain}
            onChange={(event) => update({ grain: Number(event.target.value) })}
          />
          <output>{item.grain}%</output>
        </label>
        <label className="ds-studio-range">
          Blur
          <input
            aria-label="Studio blur"
            type="range"
            min="0"
            max="12"
            step=".5"
            value={item.blur}
            onChange={(event) => update({ blur: Number(event.target.value) })}
          />
          <output>{item.blur}px</output>
        </label>
        <small className="ds-studio-note">
          Shared effects are proposed. These sliders affect only this sample.
        </small>
      </>
    );

  if (tab === 'Shape')
    return item.kind !== 'shape' ? (
      typeHint('a Shape')
    ) : (
      <>
        <label>
          Name
          <input
            aria-label="Studio shape name"
            value={item.name}
            onChange={(event) => update({ name: event.target.value })}
          />
        </label>
        <label>
          Shape
          <select
            aria-label="Studio shape type"
            value={item.shape}
            onChange={(event) => update({ shape: event.target.value })}
          >
            <option value="rectangle">Rectangle</option>
            <option value="grid">Grid</option>
          </select>
        </label>
        {item.shape === 'grid' && (
          <CheckField
            label="Snap to this grid"
            value={item.snap}
            onChange={(snap) => update({ snap })}
          />
        )}
        <CheckField
          label="Show shape"
          value={item.visible}
          onChange={(visible) => update({ visible })}
        />
        <CheckField
          label="Include in publication"
          value={item.included}
          onChange={(included) => update({ included })}
        />
        <p className="ds-studio-note">
          Colour, dimensions and effects live in their shared tabs.
        </p>
      </>
    );
  if (tab === 'Image')
    return item.kind !== 'image' ? (
      typeHint('an Image')
    ) : (
      <>
        <p className="ds-studio-section-label">Sides</p>
        <div className="ds-studio-sides">
          {Array.from({ length: item.sides }, (_, i) => (
            <button
              key={i}
              type="button"
              aria-pressed={(item.side || 0) === i}
              onClick={() => update({ side: i, name: `Image · Side ${i + 1}` })}
            >
              <span>
                <SampleArtwork item={item} />
              </span>
              Side {i + 1}
            </button>
          ))}
          <button
            type="button"
            onClick={() => update({ sides: Math.min(8, item.sides + 1) })}
            disabled={item.sides >= 8}
          >
            <Plus aria-hidden="true" size={20} />
            Add side
          </button>
        </div>
        <label>
          Library drop
          <select
            aria-label="Studio Library drop"
            value={item.drop || 'append'}
            onChange={(event) => update({ drop: event.target.value })}
          >
            <option value="append">Add side</option>
            <option value="replace">Replace side</option>
          </select>
        </label>
        <CheckField
          label="Include in publication"
          value={item.included}
          onChange={(included) => update({ included })}
        />
        <small className="ds-studio-note">
          Side management is being reviewed here. Artwork is a local sample.
        </small>
      </>
    );
  if (tab === 'Display')
    return item.kind !== 'display' ? (
      typeHint('a Display')
    ) : (
      <>
        <label>
          Scene
          <select
            aria-label="Studio scene"
            value={item.scene || '1'}
            onChange={(event) =>
              update({
                scene: event.target.value,
                name: `Display · Grid ${event.target.value}`,
              })
            }
          >
            <option value="1">Grid 1</option>
            <option value="2">Grid 2</option>
          </select>
        </label>
        <CheckField label="Show grid" value={item.grid} onChange={(grid) => update({ grid })} />
        <CheckField
          label="Snap to grid"
          value={item.snap}
          onChange={(snap) => update({ snap })}
        />
        <details>
          <summary>Edges</summary>
          <NumberField
            label="Corner radius"
            value={item.radius || 0}
            max={64}
            onChange={(radius) => update({ radius })}
          />
          <CheckField
            label="Shadow"
            value={item.shadow}
            onChange={(shadow) => update({ shadow })}
          />
        </details>
        <CheckField
          label="Include in publication"
          value={item.included}
          onChange={(included) => update({ included })}
        />
        <p className="ds-studio-note">
          Background colour, canvas dimensions and effects use the shared tabs.
        </p>
      </>
    );
  return item.kind !== 'text' ? typeHint('Text') : null;
}
