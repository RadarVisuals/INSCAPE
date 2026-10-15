import { Source } from './referenceLinks.local.jsx';
import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Copy,
  Crop,
  Trash2,
  ZoomIn,
  ChevronDown,
  ChevronUp,
  ChevronsDown,
  ChevronsUp,
} from 'lucide-react';
import DetachedWindow from '../src/public/ownerSystemWorkflow/OwnerSystemWorkflowDetachedWindow.jsx';
import ArtworkTransformTools from '../src/public/ownerSystemWorkflow/ArtworkTransformTools.jsx';
import PlacementSizeControls from '../src/public/ownerSystemWorkflow/PlacementSizeControls.jsx';
import { ModuleGrainControl } from '../src/public/ownerSystemWorkflow/ModuleSurfaceControls.jsx';
import '../src/public/ownerSystemWorkflow/displayInstruments.css';
import '../src/imageModule/imageModule.css';
import '../src/shapes/shapes.css';

// Reference-only adapters. Keep the control inventory aligned with these owners;
// artwork rendering, module sessions and persistence remain in the production app.
const owners = {
  image: 'src/imageModule/ImageWorkbench.jsx',
  display: 'src/public/ownerSystemWorkflow/OwnerSystemWorkflowSelectionInspector.jsx',
  shape: 'src/shapes/ShapeWorkbench.jsx',
};
const examples = {
  image: [
    ['artwork', 'With artwork'],
    ['empty', 'Empty Image'],
    ['busy', 'Turning a side'],
    ['limit', 'Image limit reached'],
  ],
  display: [
    ['single', 'One artwork'],
    ['multiple', 'Multiple artworks'],
    ['group', 'Grouped artworks'],
    ['locked', 'Locked artwork'],
    ['text', 'Text selection'],
    ['empty', 'Nothing selected'],
  ],
  shape: [
    ['rectangle', 'Rectangle'],
    ['grid', 'Grid'],
    ['texture', 'Retained texture'],
    ['limit', 'Shape limit reached'],
  ],
};
const orderActions = [
  ['back', 'Send to back', ChevronsDown],
  ['backward', 'Move backward', ChevronDown],
  ['forward', 'Move forward', ChevronUp],
  ['front', 'Bring to front', ChevronsUp],
];
const control = 'workflow-tactile-control';
function IconButton({ label, icon: Icon, ...props }) {
  return (
    <button type="button" className={control} aria-label={label} title={label} {...props}>
      <Icon size={18} strokeWidth={1.6} />
    </button>
  );
}
function CropSample({ onFinish }) {
  const [zoom, setZoom] = useState(1);
  return (
    <div
      className="system-workflow__crop-controls"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onFinish('cancel');
        }
      }}
    >
      <div>
        <strong>Crop / drag image</strong>
        <output>{Math.round(zoom * 100)}%</output>
      </div>
      <input
        autoFocus
        aria-label="Crop zoom"
        type="range"
        min="1"
        max="4"
        step="0.05"
        value={zoom}
        onChange={(event) => setZoom(Number(event.target.value))}
      />
      <footer>
        <button className={control} onClick={() => onFinish('native')}>
          Native fit
        </button>
        <button className={control} onClick={() => onFinish('cancel')}>
          Cancel
        </button>
        <button className={control} onClick={() => onFinish('done', zoom)}>
          Done
        </button>
      </footer>
    </div>
  );
}
function ImageSample({ example, report, setTitle }) {
  const [hasSide, setHasSide] = useState(example !== 'empty'),
    [fit, setFit] = useState('cover');
  const [drop, setDrop] = useState('append'),
    [included, setIncluded] = useState(example !== 'empty'),
    [cropping, setCropping] = useState(false);
  const [size, setSize] = useState({ width: '288', height: '192' }),
    [count, setCount] = useState(example === 'limit' ? 16 : 1);
  const [rotation, setRotation] = useState(0);
  const cropButton = useRef(null),
    busy = example === 'busy';
  useEffect(() => setTitle(`Image / ${hasSide ? 'Side 1' : 'Empty'}`), [hasSide, setTitle]);
  const finishCrop = (action, zoom) => {
    setCropping(false);
    if (action === 'native') setFit('contain');
    else if (action === 'done') setFit('cover');
    report(
      action === 'cancel'
        ? 'Crop cancelled; the previous fit is retained'
        : action === 'native'
          ? 'Native fit selected'
          : `Crop applied at ${Math.round(zoom * 100)}%`,
    );
    requestAnimationFrame(() => cropButton.current?.focus());
  };
  if (cropping) return <CropSample onFinish={finishCrop} />;
  return (
    <>
      <nav
        className="system-workflow__selection-actions system-workflow__selection-actions--six"
        aria-label="Image actions"
      >
        <IconButton
          label="Inspect Image"
          icon={ZoomIn}
          disabled={!hasSide || busy}
          onClick={() => report('Inspect Image opens the full artwork in the app')}
        />
        <ArtworkTransformTools
          disabled={!hasSide || busy}
          onTransform={(operation) => {
            if (operation === 'ROTATE') {
              const next = (rotation + 90) % 360;
              setRotation(next);
              report(`ROTATE · ${next}°`);
            } else report(operation);
          }}
        />
        <button
          ref={cropButton}
          type="button"
          className={control}
          aria-label="Crop"
          title="Crop"
          disabled={!hasSide || busy}
          onClick={() => setCropping(true)}
        >
          <Crop />
        </button>
        <IconButton
          label="Duplicate"
          icon={Copy}
          disabled={count >= 16 || busy}
          onClick={() => {
            setCount((value) => value + 1);
            report(`Duplicate Image · ${count + 1} example Images`);
          }}
        />
      </nav>
      <div
        className="system-workflow__inspection-selector ds-fit-choices"
        role="group"
        aria-label="Image fit"
      >
        <button
          type="button"
          className={control}
          disabled={!hasSide || busy}
          aria-pressed={hasSide && fit === 'contain'}
          onClick={() => {
            setFit('contain');
            report('Fit inside · complete image');
          }}
        >
          Fit inside
        </button>
        <button
          type="button"
          className={control}
          disabled={!hasSide || busy}
          aria-pressed={hasSide && fit === 'cover'}
          onClick={() => {
            setFit('cover');
            report('Fill canvas · centred crop');
          }}
        >
          Fill canvas
        </button>
      </div>
      <details className="workbench-dimensions">
        <summary>Dimensions…</summary>
        <form
          className="image-module__size"
          onSubmit={(event) => {
            event.preventDefault();
            report(`Image size set to ${size.width} × ${size.height} px`);
          }}
        >
          {['width', 'height'].map((axis) => (
            <label key={axis}>
              {axis === 'width' ? 'Width' : 'Height'}
              <input
                aria-label={`Image ${axis}`}
                required
                type="number"
                min="32"
                max="4096"
                step="1"
                value={size[axis]}
                onChange={(event) => setSize((value) => ({ ...value, [axis]: event.target.value }))}
              />
            </label>
          ))}
          <button className={control} type="submit">
            Set size
          </button>
        </form>
      </details>
      <div className="image-module__side-tools">
        <label>
          Library drop
          <select
            aria-label="Image drop action"
            value={drop}
            onChange={(event) => setDrop(event.target.value)}
          >
            <option value="append">Add side</option>
            <option value="replace">Replace side</option>
          </select>
        </label>
        <IconButton
          label="Remove Image side"
          icon={Trash2}
          disabled={!hasSide || busy}
          onClick={() => {
            setHasSide(false);
            report('Current side removed; the example Image is empty');
          }}
        />
      </div>
      <label className="image-module__publication">
        <input
          type="checkbox"
          checked={included}
          onChange={(event) => setIncluded(event.target.checked)}
        />
        Include Image in publication
      </label>
    </>
  );
}
function DisplaySample({ example, report, setTitle }) {
  const [grouped, setGrouped] = useState(example === 'group'),
    [inspection, setInspection] = useState('IN_PLACE');
  const [layer, setLayer] = useState(1),
    [cropping, setCropping] = useState(false);
  const [placement, setPlacement] = useState({
    id: 'example-artwork',
    column: 2,
    row: 2,
    columnSpan: 12,
    rowSpan: 8,
  });
  const cropButton = useRef(null),
    empty = example === 'empty',
    text = example === 'text',
    locked = example === 'locked';
  const multiple = example === 'multiple' || example === 'group';
  useEffect(
    () =>
      setTitle(
        `Display / ${empty ? 'No selection' : text ? 'Text' : multiple ? '2 artworks' : 'Artwork'}`,
      ),
    [empty, text, multiple, setTitle],
  );
  const controller = {
    selectedGridId: 'example-grid',
    run: (action) =>
      action({
        resizePlacement: ({ destination }) => {
          setPlacement((current) => ({ ...current, ...destination }));
          report(`Artwork size · ${destination.columnSpan} × ${destination.rowSpan} canvas units`);
        },
      }),
  };
  if (empty)
    return <p className="system-workflow__layer-hint">Select a layer to edit its properties.</p>;
  if (cropping)
    return (
      <CropSample
        onFinish={(action, zoom) => {
          setCropping(false);
          report(
            action === 'cancel'
              ? 'Crop cancelled'
              : action === 'native'
                ? 'Native fit selected'
                : `Crop applied at ${Math.round(zoom * 100)}%`,
          );
          requestAnimationFrame(() => cropButton.current?.focus());
        }}
      />
    );
  return (
    <>
      <nav className="system-workflow__selection-actions" aria-label="Selection actions">
        {!text && (
          <IconButton
            label="Inspect artwork"
            icon={ZoomIn}
            disabled={multiple}
            onClick={() => report('Inspect artwork opens the selected artwork in the app')}
          />
        )}
        {!text && <ArtworkTransformTools disabled={locked} onTransform={report} />}
        <IconButton
          label="Duplicate"
          icon={Copy}
          disabled={locked}
          onClick={() =>
            report(multiple ? 'Duplicate selected artworks' : 'Duplicate selected layer')
          }
        />
        {orderActions.map(([direction, label, Icon]) => (
          <IconButton
            key={direction}
            label={label}
            icon={Icon}
            disabled={locked || (direction.startsWith('back') ? layer === 0 : layer === 2)}
            onClick={() => {
              setLayer(
                direction === 'back'
                  ? 0
                  : direction === 'front'
                    ? 2
                    : layer + (direction === 'backward' ? -1 : 1),
              );
              report(label);
            }}
          />
        ))}
        {!text && (
          <button
            ref={cropButton}
            type="button"
            className={control}
            aria-label="Crop"
            title="Crop artwork"
            disabled={locked || multiple}
            onClick={() => setCropping(true)}
          >
            <Crop />
          </button>
        )}
      </nav>
      <section className="system-workflow__layer-controls" aria-label="Selection properties">
        {multiple && (
          <button
            type="button"
            className={`${control} system-workflow__add-text`}
            onClick={() => {
              setGrouped(!grouped);
              report(grouped ? 'Ungroup layers' : 'Group layers');
            }}
          >
            {grouped ? 'Ungroup' : 'Group layers'}
          </button>
        )}
        {grouped && (
          <p className="system-workflow__layer-hint">
            Moves and animates together. Ungroup to edit individual layers. Ungroup removes group
            effects and restores individual effects.
          </p>
        )}
        {!multiple && (
          <details className="workbench-dimensions">
            <summary>Dimensions…</summary>
            <PlacementSizeControls
              placement={placement}
              controller={controller}
              disabled={locked}
            />
          </details>
        )}
        {!multiple && !text && (
          <div
            className="system-workflow__inspection-selector"
            role="group"
            aria-label="Artwork inspection mode"
          >
            <span>Inspect</span>
            {[
              ['IN_PLACE', 'In place'],
              ['LIFT', 'Lift'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={control}
                disabled={locked}
                aria-pressed={inspection === value}
                onClick={() => setInspection(value)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {!multiple && !text && !locked && (
          <>
            <button
              type="button"
              className={`${control} system-workflow__add-text`}
              onClick={() => report('Artwork info opens the source and metadata in the app')}
            >
              Artwork info
            </button>
            <nav className="system-workflow__placement-actions" aria-label="Artwork placement">
              {['Fit inside Display', 'Cover Display', 'Centre'].map((label) => (
                <button key={label} type="button" className={control} onClick={() => report(label)}>
                  {label}
                </button>
              ))}
            </nav>
          </>
        )}
        {text && (
          <button
            type="button"
            className={`${control} system-workflow__add-text`}
            onClick={() => report('Edit Text opens the complete Text inspector in the app')}
          >
            Edit Text
          </button>
        )}
      </section>
    </>
  );
}
const initialShapes = () => [
  {
    id: 'rectangle',
    kind: 'rectangle',
    name: 'Rectangle',
    color: '#b5a99a',
    opacity: 1,
    grain: 0,
    width: 288,
    height: 192,
    open: true,
    included: true,
  },
  {
    id: 'grid',
    kind: 'grid',
    name: 'Grid',
    color: '#a7a7a0',
    opacity: 1,
    grid: { snap: true, spacing: 24, lineWidth: 1 },
    width: 288,
    height: 192,
    open: true,
    included: true,
  },
  {
    id: 'texture',
    kind: 'texture',
    name: 'Retained texture',
    color: '#a7a7a0',
    opacity: 0.4,
    texture: { scale: 1 },
    width: 288,
    height: 192,
    open: true,
    included: true,
  },
];
function PatternNumber({ label, caption, value, min, max, step = 1, onChange }) {
  return (
    <label>
      {caption || label}
      <input
        key={value}
        aria-label={label}
        type="number"
        min={min}
        max={max}
        step={step}
        defaultValue={value}
        onBlur={(event) => {
          if (event.target.value === '' || !event.target.validity.valid) {
            event.target.value = value;
            return;
          }
          onChange(Number(event.target.value));
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
      />
    </label>
  );
}
function ShapeSample({ example, report, setTitle }) {
  const [records, setRecords] = useState(initialShapes),
    [selected, setSelected] = useState(example === 'limit' ? 'rectangle' : example);
  const record = records.find((item) => item.id === selected),
    index = records.indexOf(record);
  useEffect(() => setTitle(record?.name || 'No shape'), [record?.name, setTitle]);
  const change = (patch) =>
    setRecords((list) => list.map((item) => (item.id === selected ? { ...item, ...patch } : item)));
  if (!record)
    return (
      <p className="system-workflow__layer-hint">
        No shapes remain in this example. Reset to restore them.
      </p>
    );
  const resize = (width, height) => {
    const step = record.kind === 'grid' ? record.grid.spacing : 1;
    const w = record.kind === 'grid' ? Math.ceil(width / step) * step : width,
      h = record.kind === 'grid' ? Math.ceil(height / step) * step : height;
    change({ width: w, height: h });
    report(`Shape size · ${w} × ${h} px`);
  };
  const order = (direction) => {
    const list = [...records];
    list.splice(index, 1);
    list.splice(
      direction === 'back'
        ? 0
        : direction === 'front'
          ? list.length
          : index + (direction === 'backward' ? -1 : 1),
      0,
      record,
    );
    setRecords(list);
    report(orderActions.find((item) => item[0] === direction)[1]);
  };
  return (
    <div className="shape-tools">
      <nav
        className="system-workflow__selection-actions system-workflow__selection-actions--six"
        aria-label="Shape actions"
      >
        <IconButton
          label="Duplicate shape"
          icon={Copy}
          disabled={example === 'limit' || records.length >= 32}
          onClick={() => {
            const copy = {
              ...record,
              id: `${record.id}-copy-${records.length}`,
              name: `${record.name} copy`,
            };
            setRecords([...records, copy]);
            setSelected(copy.id);
            report('Shape duplicated');
          }}
        />
        {orderActions.map(([direction, label, Icon]) => (
          <IconButton
            key={direction}
            label={label}
            icon={Icon}
            disabled={direction.startsWith('back') ? index === 0 : index === records.length - 1}
            onClick={() => order(direction)}
          />
        ))}
        <IconButton
          label="Delete shape"
          icon={Trash2}
          onClick={() => {
            const next = records.filter((item) => item.id !== selected);
            setRecords(next);
            setSelected(next[0]?.id);
            report('Example shape deleted');
          }}
        />
      </nav>
      <label>
        Shape
        <select
          aria-label="Choose shape"
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
        >
          {[...records].reverse().map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Name
        <input
          key={`${record.id}:${record.name}`}
          aria-label="Shape name"
          maxLength={48}
          defaultValue={record.name}
          onBlur={(event) => {
            if (event.target.value.trim()) change({ name: event.target.value.trim() });
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
        />
      </label>
      <div className="shape-tools-row">
        <label>
          Colour
          <input
            type="color"
            aria-label="Shape colour"
            value={record.color}
            onChange={(event) => change({ color: event.target.value })}
          />
        </label>
        <PatternNumber
          label={record.kind === 'texture' ? 'Noise strength' : 'Shape opacity'}
          caption={record.kind === 'texture' ? 'Noise strength (%)' : 'Opacity (%)'}
          value={Math.round(record.opacity * 100)}
          min={0}
          max={100}
          onChange={(value) => change({ opacity: value / 100 })}
        />
      </div>
      {record.kind === 'rectangle' && (
        <ModuleGrainControl value={record.grain} onChange={(grain) => change({ grain })} />
      )}
      {record.kind === 'grid' && (
        <>
          <label className="shape-check">
            <input
              type="checkbox"
              checked={record.grid.snap}
              onChange={(event) => change({ grid: { ...record.grid, snap: event.target.checked } })}
            />
            Snap to this grid
          </label>
          <div className="shape-tools-row">
            <PatternNumber
              label="Grid spacing"
              value={record.grid.spacing}
              min={8}
              max={512}
              step="any"
              onChange={(spacing) => change({ grid: { ...record.grid, spacing } })}
            />
            <PatternNumber
              label="Line width"
              value={record.grid.lineWidth}
              min={0.25}
              max={4}
              step={0.25}
              onChange={(lineWidth) => change({ grid: { ...record.grid, lineWidth } })}
            />
          </div>
        </>
      )}
      {record.kind === 'texture' && (
        <PatternNumber
          label="Noise scale"
          value={record.texture.scale}
          min={0.25}
          max={8}
          step={0.25}
          onChange={(scale) => change({ texture: { scale } })}
        />
      )}
      <details className="workbench-dimensions">
        <summary>Dimensions…</summary>
        <form
          key={`${record.id}:${record.width}:${record.height}`}
          onSubmit={(event) => {
            event.preventDefault();
            const values = new FormData(event.currentTarget);
            resize(Number(values.get('width')), Number(values.get('height')));
          }}
        >
          <div className="shape-tools-row">
            {['width', 'height'].map((axis) => (
              <label key={axis}>
                {axis === 'width' ? 'Width' : 'Height'}
                <input
                  aria-label={`Shape ${axis}`}
                  name={axis}
                  type="number"
                  min="8"
                  max="7992"
                  step="any"
                  required
                  defaultValue={record[axis]}
                />
              </label>
            ))}
          </div>
          <div className="shape-tools-row">
            <button type="submit" className={control}>
              Apply size
            </button>
            <button
              type="button"
              className={control}
              onClick={() => resize(record.width, record.width)}
            >
              Make square
            </button>
          </div>
        </form>
      </details>
      <label className="shape-check">
        <input
          type="checkbox"
          checked={record.open}
          onChange={(event) => change({ open: event.target.checked })}
        />
        Show shape
      </label>
      <label className="shape-check">
        <input
          type="checkbox"
          checked={record.included}
          onChange={(event) => change({ included: event.target.checked })}
        />
        Include in publication
      </label>
    </div>
  );
}
export function PropertiesPreview({ theme, onAction, status }) {
  const [variant, setVariant] = useState('image'),
    [example, setExample] = useState('artwork'),
    [revision, setRevision] = useState(0);
  const [title, setTitle] = useState('Image / Side 1'),
    [open, setOpen] = useState(true),
    [message, setMessage] = useState('Choose a control to try it.');
  const windowRef = useRef(null),
    reopen = useRef(null),
    previousOpen = useRef(true);
  const report = (message) => {
    setMessage(message + ' · example only');
    onAction(message);
  };
  useEffect(() => {
    if (previousOpen.current === open) return;
    previousOpen.current = open;
    (open
      ? windowRef.current?.querySelector(
          '.system-workflow__detached-window-surface button:not(:disabled), .system-workflow__detached-window-surface input:not(:disabled), .system-workflow__detached-window-surface select:not(:disabled)',
        )
      : reopen.current
    )?.focus();
  }, [open]);
  const Sample =
    variant === 'image' ? ImageSample : variant === 'display' ? DisplaySample : ShapeSample;
  const reset = () => {
    setRevision((value) => value + 1);
    setMessage('Example reset.');
    setOpen(true);
  };
  return (
    <section className="ds-properties-review" aria-labelledby="properties-review-title">
      <div className="ds-example-heading">
        <h2 id="properties-review-title">Properties</h2>
        {status}
      </div>
      <p className="ds-caption">
        The controls for each selection, including crop, grouping and shape variants. Changes stay
        in the example; artwork actions report what they do.
      </p>
      <div className="ds-properties-switcher">
        <label>
          Properties for
          <select
            aria-label="Properties for"
            value={variant}
            onChange={(event) => {
              const next = event.target.value;
              setVariant(next);
              setExample(examples[next][0][0]);
              setMessage('Example changed.');
              setOpen(true);
            }}
          >
            <option value="image">Image</option>
            <option value="display">Display artwork</option>
            <option value="shape">Shape</option>
          </select>
        </label>
        <label>
          Example state
          <select
            aria-label="Properties example state"
            value={example}
            onChange={(event) => {
              setExample(event.target.value);
              setMessage('Example changed.');
              setOpen(true);
            }}
          >
            {examples[variant].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="ds-button" onClick={reset}>
          Reset example
        </button>
      </div>
      <div
        className="ds-properties-stage ds-flat-preview"
        data-menu-surface={theme}
        data-lattice-menu-surface
      >
        <div className="ds-properties-frame" hidden={!open}>
          <DetachedWindow
            ref={windowRef}
            ariaLabel="Properties preview"
            title={`Properties · ${title}`}
            chrome="tactile"
            className="workbench-tool-window ds-example-window ds-properties-window"
            controls={
              <button
                type="button"
                className={control}
                aria-label="Close example Properties"
                onClick={() => setOpen(false)}
              >
                <X aria-hidden="true" />
              </button>
            }
          >
            <Sample
              key={`${variant}:${example}:${revision}`}
              example={example}
              report={report}
              setTitle={setTitle}
            />
          </DetachedWindow>
        </div>
        {!open && (
          <button ref={reopen} type="button" className="ds-button" onClick={() => setOpen(true)}>
            Reopen example Properties
          </button>
        )}
      </div>
      <p role="status" className="ds-properties-feedback">
        {message}
      </p>
      <p className="ds-caption">
        {variant === 'image'
          ? 'Image keeps its six actions, direct Fit choices, exact size, Library drop and publication setting.'
          : variant === 'display'
            ? 'Selection changes the available actions. Grouping, locked layers, text and no selection each have their own state.'
            : 'Rectangle has grain; Grid has snapping and line settings. Retained texture represents existing saved work; it is not a new creation option.'}
      </p>
      <div className="ds-properties-links">
        <a
          className="ds-source"
          href={`/browser-tests/tool-chrome-fixture.html?sample=${variant === 'display' ? 'layers' : variant}`}
          target="_blank"
          rel="noreferrer"
        >
          Open current app example
        </a>
        <Source path={owners[variant]}>View source</Source>
      </div>
    </section>
  );
}
