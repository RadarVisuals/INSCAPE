import { useEffect, useId, useRef, useState, lazy, Suspense } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronsDown,
  ChevronsUp,
  Copy,
  Crop,
  Image,  Lock,  Shapes,
  Trash2,
  Type,  ZoomIn,
} from 'lucide-react';
import WorkbenchToolbar from '../src/public/ownerSystemWorkflow/WorkbenchToolbar.jsx';
import KeeperDockContent from '../src/keeper/KeeperDockContent.jsx';
import ArtworkTransformTools from '../src/public/ownerSystemWorkflow/ArtworkTransformTools.jsx';
import '../src/public/ownerSystemWorkflow/contextToolbar.css';
import './workspacePreview.css';
import NavigationPreview from './navigationPreview.jsx';
import { IconKey, keyClass } from './previewControls.jsx';
import SampleArtwork from './sampleArtwork.jsx';
import NavigatorMap from './navigatorPreview.jsx';
import { NavigatorHome, NavigatorZoom } from '../src/public/ownerSystemWorkflow/NavigatorContent.jsx';
import SelectionPanels from './selectionPanels.jsx';
import LayersPreview, { LayerScene, LayerRemovalConfirmation } from './layersPreview.jsx';
import {
  selectedGroup,
  expandGroup,
  layerAvailability,
  reorderLayers,
  dropLayer,
  canGroup,
  cleanGroups,
  applyLayerGutter,
  sampleLayers,
} from './workspaceLayers.js';

import { sampleArticle, patchPreviewItem } from './textPreviewModel.js';
const TextPreview = lazy(() => import('./textPreview.jsx'));
const LibraryPreview = lazy(() => import('./libraryPreview.jsx'));
const libraryExamples = [
  ['browse', 'Browsing & organization'],
  ['loading', 'Loading'],
  ['empty', 'Empty Library'],
  ['unavailable', 'Assets unavailable'],
  ['retained', 'Retained results'],
  ['created-error', 'Created source unavailable'],
];

const tabs = ['Color', 'Layers', 'Shape', 'Image', 'Display', 'Transform', 'FX', 'Info'];
const seed = () =>
  [
    { id: 'image', kind: 'image', name: 'Image · Side 1', color: '#b5a99a', sides: 2 },
    { id: 'shape', kind: 'shape', name: 'Rectangle', color: '#8d9c8c', shape: 'rectangle' },
    { id: 'display', kind: 'display', name: 'Display · Grid 1', color: '#d4d1c8', grid: true },
    ...sampleLayers(),
  ].map((item) => ({
    x: 120,
    y: 90,
    width: 288,
    height: 192,
    rotation: 0,
    opacity: 100,
    grain: 0,
    blur: 0,
    fit: 'contain',
    inspect: 'IN_PLACE',
    visible: true,
    locked: false,
    included: true,
    ...item,
  }));
export default function WorkspacePreview({ theme, onAction, status }) {
  const id = useId(),
    nextId = useRef(0),
    tabRefs = useRef([]);
  const [items, setItems] = useState(seed),
    [selectedIds, setSelectedIds] = useState(['image']),
    [tab, setTab] = useState('Image');
  const [groups, setGroups] = useState([]),
    [layerScenario, setLayerScenario] = useState('composition'),
    [removeCandidate, setRemoveCandidate] = useState(null);
  const removeOrigin = useRef(null),
    readOnly = layerScenario === 'readonly';
  useEffect(() => setRemoveCandidate(null), [tab]);
  const [tool, setTool] = useState('select'),
    [zoom, setZoom] = useState(100),
    [view, setView] = useState({ x: 50, y: 50 });
  const cropTrigger = useRef(null);
  const [textOpen, setTextOpen] = useState(false),
    [textCanvasHost, setTextCanvasHost] = useState(null),
    [layerTextHost, setLayerTextHost] = useState(null),
    [textColourTarget, setTextColourTarget] = useState(null),
    [textVisited, setTextVisited] = useState(false),
    [textReset, setTextReset] = useState(0);
  const [crop, setCrop] = useState(null),
    [notice, setNotice] = useState('Choose a selection, then try the tabs and tools.');
  const [libraryOpen, setLibraryOpen] = useState(false),
    [libraryVisited, setLibraryVisited] = useState(false),
    [libraryScenario, setLibraryScenario] = useState('browse');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false),
    [libraryNavigationHost, setLibraryNavigationHost] = useState(null);
  const libraryTrigger = useRef(null);
  const toggleLibrary = () => {
    libraryTrigger.current = document.activeElement;
    setLibraryVisited(true);
    setSidebarCollapsed(false);
    setLibraryOpen(value => !value);
  };
  const closeLibrary = () => {
    setLibraryOpen(false);
    requestAnimationFrame(() => libraryTrigger.current?.focus());
  };
  const selected = selectedIds[0] || '',
    selectedItems = items.filter((i) => selectedIds.includes(i.id)),
    multiple = selectedItems.length > 1;
  const isLayerSelection =
    selectedItems.length > 0 && selectedItems.every((i) => i.parent === 'display');
  const record = items.find((record) => record.id === selected),
    item =
      record?.kind === 'text'
        ? {
            ...record,
            color: record.article.appearance.color,
            grain: (record.article.appearance.edges?.grain || 0) * 100,
          }
        : record,
    index = items.findIndex((record) => record.id === selected);
  useEffect(() => {
    if (item?.kind === 'text') setTextVisited(true);
  }, [item?.kind]);
  const editable =
      selectedItems.length > 0 &&
      selectedItems.every((i) => !i.locked && !i.textReadOnly && i.visible) &&
      !(readOnly && isLayerSelection),
    image = !multiple && ['image', 'artwork'].includes(item?.kind);
  const layerMoves = layerAvailability(items, groups, selectedIds, readOnly);
  const showComposition = !item || isLayerSelection;
  const report = (message) => {
    setNotice(message);
    onAction(message);
  };
  const update = (patch) => {
    if (editable)
      setItems((list) =>
        list.map((record) =>
          selectedIds.includes(record.id) ? patchPreviewItem(record, patch) : record,
        ),
      );
  };
  const choose = (value, additive = false) => {
    if (crop)
      setItems((list) =>
        list.map((record) =>
          record.id === crop.id ? { ...record, fit: crop.fit, cropZoom: crop.zoom } : record,
        ),
      );
    const target = items.find((i) => i.id === value),
      ids =
        target?.parent === 'display'
          ? expandGroup(items, groups, [value]).filter(
              (id) => items.find((i) => i.id === id)?.visible,
            )
          : value
            ? [value]
            : [];
    setSelectedIds((current) =>
      additive && isLayerSelection
        ? current.includes(value)
          ? current.filter((id) => !ids.includes(id))
          : [...new Set([...current, ...ids])]
        : ids,
    );
    setCrop(null);
    setRemoveCandidate(null);
  };
  const toggleLayer = (id, field) => {
    if (readOnly) return;
    const target = items.find((i) => i.id === id),
      ids = expandGroup(items, groups, [id]);
    setItems((list) =>
      list.map((i) => (ids.includes(i.id) ? { ...i, [field]: !target[field] } : i)),
    );
    if (field === 'visible')
      setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
    setRemoveCandidate(null);
  };
  const requestRemove = (ids, origin, rowId = null) => {
    if (readOnly || ids.some((id) => items.find((i) => i.id === id)?.locked)) return;
    removeOrigin.current = origin;
    setRemoveCandidate({ ids, rowId });
  };
  const cancelRemove = () => {
    setRemoveCandidate(null);
    removeOrigin.current?.focus();
  };
  const confirmRemove = () => {
    if (!removeCandidate || readOnly) return;
    setItems((list) => list.filter((i) => !removeCandidate.ids.includes(i.id)));
    setGroups((list) => cleanGroups(list, removeCandidate.ids));
    setSelectedIds((ids) => ids.filter((id) => !removeCandidate.ids.includes(id)));
    setRemoveCandidate(null);
    report('Layers removed from the example Grid.');
  };
  const groupLayers = () => {
    if (!readOnly && canGroup(items, groups, selectedIds)) {
      setGroups((list) => [
        ...list,
        { id: 'group:preview-' + ++nextId.current, placementIds: [...selectedIds] },
      ]);
      report('Layers grouped in this example.');
    }
  };
  const ungroupLayers = () => {
    const group = selectedGroup(items, groups, selectedIds);
    if (group && editable) {
      setGroups((list) => list.filter((g) => g.id !== group.id));
      report('Example group separated into layers.');
    }
  };
  const changeLayerExample = (value) => {
    setLayerScenario(value);
    setItems((list) => {
      const retained = list.filter((i) => i.parent !== 'display');
      const samples = sampleLayers(value).map((i) =>
        retained.some((r) => r.id === i.id) ? { ...i, id: i.id + '-' + ++nextId.current } : i,
      );
      return [...retained, ...samples];
    });
    setGroups([]);
    setSelectedIds([]);
    setCrop(null);
    setRemoveCandidate(null);
    report('Layer example reset. Select a layer to try its controls.');
  };
  const addLayerText = () => {
    if (readOnly) return;
    const text = {
      ...sampleLayers().find((i) => i.kind === 'text'),
      id: 'text-' + ++nextId.current,
      name: 'New Text',
      article: sampleArticle('empty'),
    };
    // Added text must not cover an existing text frame in this fixed-size example.
    const textLayers = items.filter((layer) => layer.parent === 'display' && layer.kind === 'text');
    const positions = [text.y, ...textLayers.map((layer) => layer.y + layer.height + 8)];
    const y = positions
      .sort((a, b) => a - b)
      .find(
        (candidate) =>
          candidate + text.height <= 240 &&
          textLayers.every(
            (layer) =>
              text.x + text.width <= layer.x ||
              text.x >= layer.x + layer.width ||
              candidate + text.height <= layer.y ||
              candidate >= layer.y + layer.height,
          ),
      );
    if (y === undefined) {
      report(
        'No room for another text frame in this example. Move or resize an existing frame first.',
      );
      return;
    }
    setItems((list) => [...list, { ...text, y }]);
    setSelectedIds([text.id]);
    report('Text added to the example Display.');
  };
  const applyGutter = (value) => {
    try {
      if (readOnly) throw new Error('This example is read-only.');
      if (!value.trim()) throw new Error('Enter a gutter value.');
      setItems(applyLayerGutter(items, groups, Number(value)));
      return { text: 'Spacing applied to this example.' };
    } catch (error) {
      return { error: true, text: error.message };
    }
  };
  const selectSample = (kind) => {
    const existing = items.find((record) => record.kind === kind);
    if (existing) choose(existing.id);
    else {
      const sample = seed().find((record) => record.kind === kind);
      setItems((list) => [...list, sample]);
      choose(sample.id);
    }
  };
  const finishCrop = (accept) => {
    if (!accept) update({ fit: crop.fit, cropZoom: crop.zoom });
    setCrop(null);
    cropTrigger.current?.focus();
    report(accept ? 'Sample crop applied.' : 'Sample crop cancelled.');
  };
  const duplicate = () => {
    if (!editable) return;
    const copies = selectedItems.map((i) => ({
      ...i,
      id: 'copy-' + ++nextId.current,
      name: i.name + ' copy',
    }));
    const idMap = new Map(selectedItems.map((i, index) => [i.id, copies[index].id]));
    const copiedGroups = groups
      .filter((g) => g.placementIds.every((id) => idMap.has(id)))
      .map((g) => ({
        id: 'group:preview-' + ++nextId.current,
        placementIds: g.placementIds.map((id) => idMap.get(id)),
      }));
    setItems((list) => [...list, ...copies]);
    setGroups((list) => [...list, ...copiedGroups]);
    setSelectedIds(copies.map((i) => i.id));
    setCrop(null);
    report('Selection duplicated in this example.');
  };
  const remove = (event) => {
    if (!editable) return;
    if (isLayerSelection) {
      requestRemove(selectedIds, event.currentTarget);
      return;
    }
    const next = items.filter((i) => !selectedIds.includes(i.id));
    setItems(next);
    choose(next[0]?.id || '');
    report('Selection removed from this example. Reset restores it.');
  };
  const order = (direction) => {
    if (!editable) return;
    if (isLayerSelection) {
      if (layerMoves[direction])
        setItems((list) => reorderLayers(list, selectedIds, direction));
    } else {
      const list = [...items];
      list.splice(index, 1);
      list.splice(
        direction === 'back'
          ? 0
          : direction === 'front'
            ? list.length
            : index + (direction === 'backward' ? -1 : 1),
        0,
        item,
      );
      setItems(list);
    }
    report('Example order updated.');
  };
  const reset = () => {
    setTextOpen(false);
    setTextReset((n) => n + 1);
    setLibraryOpen(false);
    setLibraryVisited(false);
    setLibraryScenario('browse');
    setItems(seed());
    setSelectedIds(['image']);
    setGroups([]);
    setLayerScenario('composition');
    setRemoveCandidate(null);
    setCrop(null);
    setTab('Image');
    setZoom(100);
    setView({ x: 50, y: 50 });
    setTool('select');
    report('Workspace example reset.');
  };
  const changeText = (id, patch) =>
    setItems((list) =>
      list.map((i) =>
        i.id === id &&
        !i.locked &&
        !i.textReadOnly &&
        i.visible &&
        !(readOnly && i.parent === 'display')
          ? patchPreviewItem(i, patch)
          : i,
      ),
    );
  const changeTextExample = (mode) =>
    setItems((list) =>
      list.map((i) =>
        i.id === selected
          ? {
              ...i,
              article: sampleArticle(mode),
              parent: mode === 'display' ? 'display' : undefined,
              name: mode === 'display' ? 'Text · Display' : 'Text · Article',
              textReadOnly: mode === 'readonly',
              textExample: mode,
              textRevision: (i.textRevision || 0) + 1,
            }
          : i,
      ),
    );
  const selectedTab = (name) => setTab(name);
  const transform = (operation) => {
    if (operation === 'ROTATE')
      setItems((list) =>
        list.map((i) =>
          selectedIds.includes(i.id) ? { ...i, rotation: (i.rotation + 90) % 360 } : i,
        ),
      );
    else
      setItems((list) =>
        list.map((i) =>
          selectedIds.includes(i.id)
            ? {
                ...i,
                [operation === 'MIRROR_HORIZONTAL' ? 'flipX' : 'flipY']:
                  !i[operation === 'MIRROR_HORIZONTAL' ? 'flipX' : 'flipY'],
              }
            : i,
        ),
      );
    report(operation);
  };
  function panelContent() {
    if (tab === 'Layers')
      return (
        <LayersPreview
          items={items}
          groups={groups}
          selectedIds={selectedIds}
          readOnly={readOnly}
          onSelect={choose}
          onClear={() => choose('')}
          onToggle={toggleLayer}
          onRemove={requestRemove}
          onGroup={groupLayers}
          onUngroup={ungroupLayers}
          onDrop={(source, target, edge) => {
            if (!readOnly) setItems((list) => dropLayer(list, groups, source, target, edge));
          }}
          onAddText={addLayerText}
          onEditText={(id) => {
            choose(id);
            setTextOpen(true);
          }}
          onGutter={applyGutter}
          confirmation={removeCandidate}
          onCancelRemove={cancelRemove}
          onConfirmRemove={confirmRemove}
        />
      );
    return (
      <SelectionPanels
        tab={tab}
        item={item}
        selectedCount={selectedItems.length}
        editable={editable}
        update={update}
        colourTarget={textColourTarget}
      />
    );
  }
  return (
    <section className="ds-studio" aria-labelledby={`${id}-title`}>
      <div className="ds-example-heading">
        <h2 id={`${id}-title`}>The creative workspace</h2>
        {status}
      </div>
      <p className="ds-caption">
        A compact, Affinity-inspired layout. Shared tools follow the selection; tabs keep their
        place. This is a local design preview.
      </p>
      <div className="ds-studio-chooser">
        <label>
          Example selection
          <select
            aria-label="Workspace selection"
            value={selected}
            onChange={(event) => choose(event.target.value)}
          >
            {!item && <option value="">Nothing selected</option>}
            {items.map((record) => (
              <option key={record.id} value={record.id}>
                {record.name}
              </option>
            ))}
          </select>
        </label>
        {tab === 'Layers' && (
          <label>
            Layer example
            <select
              aria-label="Layer example"
              value={layerScenario}
              onChange={(event) => changeLayerExample(event.target.value)}
            >
              <option value="composition">Composition</option>
              <option value="spacing">Spacing study</option>
              <option value="long">Long list · 24 layers</option>
              <option value="empty">Empty Display</option>
              <option value="readonly">Read-only</option>
            </select>
          </label>
        )}
        {item?.kind === 'text' && !multiple && <button type="button" className="workflow-tactile-control" onClick={() => setTextOpen(true)}>Text tools</button>}
        {textOpen && item?.kind === 'text' && !multiple && (
          <label>
            Text example
            <select
              aria-label="Text example"
              value={item.textExample || 'display'}
              onChange={(event) => changeTextExample(event.target.value)}
            >
              <option value="display">Display text</option>
              <option value="article">Standalone article</option>
              <option value="illustrated">Illustrated article</option>
              <option value="empty">Empty article</option>
              <option value="readonly">Read-only article</option>
            </select>
          </label>
        )}
        {libraryOpen && (
          <label>
            Library example
            <select
              aria-label="Library example"
              value={libraryScenario}
              onChange={(event) => setLibraryScenario(event.target.value)}
            >
              {libraryExamples.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="button" className="ds-button" onClick={reset}>
          Reset workspace
        </button>
      </div>
      <div className="ds-studio-shell ds-flat-preview" data-menu-surface={theme} data-lattice-menu-surface
        data-library-open={libraryOpen || undefined} data-navigation-collapsed={sidebarCollapsed || undefined}>
        <NavigationPreview collapsed={sidebarCollapsed} onCollapse={() => setSidebarCollapsed(value => !value)}
          libraryOpen={libraryOpen} onLibrary={toggleLibrary} navigationHost={setLibraryNavigationHost}
          onWorkbench={() => setLibraryOpen(false)} onGrids={() => { selectSample('display'); setTab('Display'); report('Grids belong to the selected Display.'); }} />
        <div className="ds-studio-body"><div className="ds-studio-content">
          {libraryVisited && (
            <Suspense fallback={null}>
              <LibraryPreview
                open={libraryOpen}
                navigationHost={libraryNavigationHost}
                theme={theme}
                scenario={libraryScenario}
                onScenarioChange={setLibraryScenario}
                onClose={closeLibrary}
              />
            </Suspense>
          )}
        <div className="ds-studio-main">
      <div
        className="ds-studio-layout ds-flat-preview"
        data-menu-surface={theme}
        data-lattice-menu-surface
      >
        <div className="ds-studio-workbench">
          <div
            className="ds-studio-canvas"
            aria-label="Example workbench"
            data-grid={(item?.kind === 'display' && item.grid) || undefined}
          >
            <span className="ds-studio-canvas-label">
              WORKBENCH <span>{zoom}%</span>
            </span>
            <div
              className="ds-studio-canvas-scroll"
              tabIndex={0}
              role="region"
              aria-label="Workbench viewport"
            >
              <div
                className="ds-studio-canvas-content"
                style={{ '--preview-scale': zoom / 100 }}
              >
                {showComposition ? (
                  <LayerScene
                    items={items}
                    selectedIds={selectedIds}
                    onSelect={choose}
                    zoom={zoom}
                    view={view}
                    onTextHost={setLayerTextHost}
                  />
                ) : (
                  item &&
                  item.kind !== 'text' && (
                    <div
                      className="ds-studio-art-position"
                      style={{
                        transform: `translate(${(item.x - 120) / 6 + (50 - view.x)}px, ${(item.y - 90) / 6 + (50 - view.y)}px) scale(${zoom / 100})`,
                      }}
                    >
                      <div
                        className="ds-studio-art"
                        data-kind={item.kind}
                        data-lift={item.inspect === 'LIFT' || undefined}
                        data-shape={item.shape}
                        style={{
                          width: `${Math.max(40, Math.min(300, item.width))}px`,
                          aspectRatio: `${item.width}/${item.height}`,
                          transform: `rotate(${item.rotation}deg) scale(${item.flipX ? -1 : 1}, ${item.flipY ? -1 : 1})`,
                          opacity: item.visible ? item.opacity / 100 : 0,
                          filter: `blur(${item.blur}px)`,
                          background: item.color,
                          borderRadius: item.radius || 0,
                          boxShadow: item.shadow ? '0 8px 20px #0003' : 'none',
                          '--studio-text': item.color,
                          fontSize: item.fontSize || 26,
                          fontFamily: item.font === 'Serif' ? 'Georgia, serif' : undefined,
                        }}
                      >
                        {image ? (
                          <SampleArtwork item={item} />
                        ) : item.kind === 'display' ? (
                          <>
                            <span className="ds-studio-display-art">
                              <SampleArtwork
                                item={items.find((i) => i.kind === 'artwork') || item}
                              />
                            </span>
                            <small>Grid {item.scene || 1}</small>
                            <span
                              className="ds-studio-grain"
                              style={{ opacity: item.grain / 100 }}
                            />
                          </>
                        ) : (
                          <span
                            className="ds-studio-grain"
                            style={{ opacity: item.grain / 100 }}
                          />
                        )}
                      </div>
                      <span className="ds-studio-selection-caption">{item.name}</span>
                    </div>
                  )
                )}
                <div
                  ref={setTextCanvasHost}
                  className="ds-studio-text-canvas"
                  hidden={item?.kind !== 'text' || showComposition}
                  aria-label="Text editing preview"
                  style={{
                    transform: `translate(${50 - view.x}px,${50 - view.y}px) scale(${zoom / 100})`,
                  }}
                />
              </div>
            </div>
          </div>
          <div className="ds-studio-bars" data-workflow-material="tactile" data-workflow-finish="flat">
            {image && (
              <div
                className="ds-studio-inspection context-action-bar"
                role="group"
                aria-label="Inspection and placement"
              >
                <span>Inspect</span>
                {[
                  ['IN_PLACE', 'In place'],
                  ['LIFT', 'Lift'],
                ].map(([value, label]) => (
                  <button
                    type="button"
                    className={keyClass}
                    key={value}
                    aria-pressed={item.inspect === value}
                    onClick={() => update({ inspect: value })}
                  >
                    {label}
                  </button>
                ))}
                <span className="ds-studio-divider" />
                {[
                  ['contain', 'Fit'],
                  ['cover', 'Cover'],
                ].map(([value, label]) => (
                  <button
                    type="button"
                    className={keyClass}
                    key={value}
                    aria-pressed={item.fit === value}
                    disabled={!editable}
                    onClick={() => {
                      update({ fit: value });
                      report(`${label} · example placement`);
                    }}
                  >
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  className={keyClass}
                  disabled={!editable}
                  onClick={() => update({ x: 120, y: 90 })}
                >
                  Center
                </button>
              </div>
            )}
            {item && (
              <div
                className="ds-studio-actions context-action-bar"
                role="group"
                aria-label="Selection actions preview"
              >
                <IconKey
                  label="Studio inspect"
                  icon={ZoomIn}
                  disabled={!image}
                  onClick={() =>
                    update({ inspect: item.inspect === 'LIFT' ? 'IN_PLACE' : 'LIFT' })
                  }
                />
                <ArtworkTransformTools disabled={!editable} onTransform={transform} />
                <IconKey
                  label="Studio duplicate"
                  icon={Copy}
                  disabled={!editable}
                  onClick={duplicate}
                />
                <span className="ds-studio-divider" />
                {[
                  ['back', 'Send to back', ChevronsDown],
                  ['backward', 'Move backward', ArrowDown],
                  ['forward', 'Move forward', ArrowUp],
                  ['front', 'Bring to front', ChevronsUp],
                ].map(([direction, label, Icon]) => (
                  <IconKey
                    key={direction}
                    label={`Studio ${label.toLowerCase()}`}
                    icon={Icon}
                    disabled={
                      !editable ||
                      (isLayerSelection
                        ? !layerMoves[direction]
                        : direction.startsWith('back')
                          ? index === 0
                          : index === items.length - 1)
                    }
                    onClick={() => order(direction)}
                  />
                ))}
                <button
                  ref={cropTrigger}
                  type="button"
                  className={keyClass}
                  aria-label="Studio crop"
                  title="Crop"
                  disabled={!editable || !image}
                  onClick={() => {
                    setCrop({ id: item.id, fit: item.fit, zoom: item.cropZoom || 100 });
                    update({ fit: 'cover' });
                  }}
                >
                  <Crop aria-hidden="true" size={18} strokeWidth={1.6} />
                </button>
                <span className="ds-studio-divider" />
                <IconKey
                  label={`Delete ${item.name} from example`}
                  icon={Trash2}
                  disabled={!editable}
                  onClick={remove}
                />
              </div>
            )}
            {crop !== null && (
              <div
                className="ds-studio-crop context-action-bar"
                role="group"
                aria-label="Crop example"
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    finishCrop(false);
                  }
                }}
              >
                <label>
                  Crop zoom
                  <input
                    autoFocus
                    type="range"
                    aria-label="Studio crop zoom"
                    disabled={!editable}
                    min="100"
                    max="200"
                    step="5"
                    value={item.cropZoom || 100}
                    onChange={(event) => update({ cropZoom: Number(event.target.value) })}
                  />
                </label>
                <output>{item.cropZoom || 100}%</output>
                <button type="button" className={keyClass} onClick={() => finishCrop(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className={keyClass}
                  disabled={!editable}
                  onClick={() => finishCrop(true)}
                >
                  Done
                </button>
              </div>
            )}
            <WorkbenchToolbar
              activeTool={tool}
              onToolChange={(value) => {
                setTool(value);
                report(`${value} tool`);
                if (value === 'text') {
                  if (item?.kind !== 'text' || multiple) selectSample('text');
                  setTextOpen(true);
                }
              }}
              onOpenLibrary={toggleLibrary}
              libraryOpen={libraryOpen}
              layers={{
                enabled: true,
                open: tab === 'Layers',
                onToggle: () => selectedTab('Layers'),
              }}
              info={{
                enabled: !multiple && ['image', 'artwork'].includes(item?.kind),
                open: tab === 'Info',
                onToggle: () => selectedTab('Info'),
              }}
              actions={[
                {
                  id: 'duplicate',
                  label: 'Duplicate artwork',
                  icon: Copy,
                  disabled: !editable,
                  onSelect: duplicate,
                },
                {
                  id: 'align',
                  label: 'Align',
                  children: [
                    {
                      id: 'horizontal',
                      label: 'Horizontal centre',
                      disabled: !editable,
                      onSelect: () => {
                        update({ x: 120 });
                        report('Horizontal centre');
                      },
                    },
                  ],
                },
              ]}
              shapeCommands={[
                {
                  id: 'rectangle',
                  label: 'Rectangle',
                  icon: Shapes,
                  onSelect: () => {
                    selectSample('shape');
                    setTab('Shape');
                    report('Rectangle example selected.');
                  },
                },
              ]}
              addCommands={[
                {
                  id: 'image',
                  label: 'Image',
                  icon: Image,
                  onSelect: () => {
                    selectSample('image');
                    setTab('Image');
                    report('Add Image');
                  },
                },
                {
                  id: 'text',
                  label: 'Text',
                  icon: Type,
                  onSelect: () => {
                    selectSample('text');
                    setTextOpen(true);
                    report('Add Text');
                  },
                },
              ]}
            />
          </div>

        </div>
        <div className="ds-studio-instruments">
          <section
            className="ds-studio-inspector ds-properties-window"
            data-workflow-material="tactile" data-workflow-finish="flat"
            aria-label="Tabbed tools preview"
          >
            <div className="ds-studio-tabs" role="tablist" aria-label="Tool panels">
              {tabs.map((name, i) => (
                <button
                  ref={(node) => {
                    tabRefs.current[i] = node;
                  }}
                  key={name}
                  id={`${id}-tab-${name}`}
                  type="button"
                  role="tab"
                  tabIndex={tab === name ? 0 : -1}
                  aria-selected={tab === name}
                  aria-controls={`${id}-panel`}
                  onClick={() => setTab(name)}
                  onKeyDown={(event) => {
                    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                      event.preventDefault();
                      const next =
                        event.key === 'Home'
                          ? 0
                          : event.key === 'End'
                            ? tabs.length - 1
                            : (i + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) %
                              tabs.length;
                      setTab(tabs[next]);
                      tabRefs.current[next]?.focus();
                    }
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
            <div
              className="ds-studio-panel"
              id={`${id}-panel`}
              role="tabpanel"
              aria-labelledby={`${id}-tab-${tab}`}
              tabIndex={0}
            >
              {item?.locked && (
                <p className="ds-studio-lock-note">
                  <Lock size={12} aria-hidden="true" />
                  Locked layer · unlock in Layers to edit.
                </p>
              )}
              <fieldset
                disabled={Boolean(
                  !['Layers', 'Info'].includes(tab) &&
                  (selectedItems.some((i) => i.locked || i.textReadOnly) ||
                    (readOnly && isLayerSelection)),
                )}
                aria-label={`${tab} settings`}
              >
                {panelContent()}
                {tab !== 'Layers' && removeCandidate && (
                  <LayerRemovalConfirmation
                    count={removeCandidate.ids.length}
                    onCancel={cancelRemove}
                    onConfirm={() => {
                      confirmRemove();
                      requestAnimationFrame(() => tabRefs.current[tabs.indexOf(tab)]?.focus());
                    }}
                  />
                )}
              </fieldset>
            </div>
          </section>
          <div className="ds-studio-utilities">
            <section
              className="ds-studio-minimap"
              data-workflow-material="tactile" data-workflow-finish="flat"
              aria-label="Minimap preview"
            >
              <header>
                <strong>Navigator</strong>
                <NavigatorHome label="Reset preview view" onClick={() => { setZoom(100); setView({ x: 50, y: 50 }); }} />
              </header>
              <NavigatorMap view={view} zoom={zoom} onViewChange={setView} />
              <NavigatorZoom label="Preview zoom" zoom={zoom} onChange={setZoom} />
            </section>
            <section
              className="ds-studio-keeper"
              data-workflow-material="tactile" data-workflow-finish="flat"
              aria-label="Keeper dock preview"
            >
              <header>
                <strong>Keeper</strong>
              </header>
              <KeeperDockContent empty label="Drop artwork" hint="Dock placement preview" />
            </section>
          </div>
        </div>
      </div>
        </div></div></div>
      </div>
      {textVisited && (
        <Suspense fallback={null}>
          <TextPreview
            key={textReset}
            items={items}
            selectedId={multiple ? '' : selected}
            open={textOpen && !multiple}
            onOpenChange={setTextOpen}
            canvasHost={textCanvasHost}
            layerHost={layerTextHost}
            onColourTarget={setTextColourTarget}
            onChange={changeText}
            onFindRequest={() => setTextOpen(true)}
            theme={theme}
            readOnly={readOnly}
          />
        </Suspense>
      )}
      <p className="ds-studio-feedback" role="status">
        {notice}
      </p>
      <p className="ds-caption">
        This reference uses a disposable Display composition. The local Workbench now has
        Layers, Transform, Color, Image, Shape, FX and Info in movable docks. Text uses its own window;
        Color and Transform remain shared.
        Existing control references remain below.
      </p>
    </section>
  );
}
