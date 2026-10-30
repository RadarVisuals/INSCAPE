import React, { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import ToolPanel from '../src/ui/ToolPanel.jsx';
import ArtworkOrderControls from '../src/ui/ArtworkOrderControls.jsx';
import CommittedColourControls from '../src/colour/CommittedColourControls.jsx';
import TextColourTools from '../src/text/TextColourTools.jsx';
import ArticleView from '../src/text/ArticleView.jsx';
import { ReceptionImage } from '../src/reception/ReceptionCanvas.jsx';
import { createArticle } from '../src/text/domain/article.js';
import { createWorkbenchGestures } from '../src/public/ownerSystemWorkflow/workbenchGestures.js';
import { initialWorkbenchSelection, changeWorkbenchSelection, workbenchSelectionTarget } from '../src/public/ownerSystemWorkflow/workbenchSelection.js';
import { resizeWorkbenchWindow, clampOwnerSystemWorkflowWindowPosition, WORKBENCH_RESIZE_EDGES } from '../src/public/ownerSystemWorkflow/ownerSystemWorkflowWindowGeometry.js';
import { artworkRecords, reorderArtwork, validArtworkLayers } from '../src/systemWorkflow/domain/artworkLayers.js';
import { draftChanges, applyDraftChanges } from '../src/systemWorkflow/draftHistory.js';
import { createProfileDocumentV9AssetResolver } from '../src/profileDocument/domain/profileDocumentV9Asset.js';
import { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS as assets } from '../src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js';
import { validShapes } from '../src/shapes/shapes.js';
import '../src/index.css';
import '../src/public/ownerSystemWorkflow/workflowTactile.css';
import '../src/public/ownerSystemWorkflow/workflowFlat.css';
import '../src/public/ownerSystemWorkflow/workbenchToolChrome.css';
import '../src/public/ownerSystemWorkflow/ownerSystemWorkflow.css';
import '../src/public/ownerSystemWorkflow/workbenchLayers.css';
import '../src/lattice/rendering/latticeMenuSurface.css';
import './reception-rich-cell.css';

// Experiment only: no production import, owner address, editing lease, wallet,
// canonical Reception record or public projection can reach this storage key.
const key = 'inscape:fixture:rich-cell:' + (new URLSearchParams(location.search).get('session') || 'manual');
function seed() {
  const article = createArticle('Small worlds');
  article.content = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Image, text and shape keep their own identity inside one cell.' }] }] };
  return { version: 1, size: { width: 800, height: 600 },
    imageModules: [{ id: 'image:trial', name: 'SKULL REAPER', visibility: 'PUBLIC', width: 800, height: 600,
      sides: [{ id: 'side:trial', asset: createProfileDocumentV9AssetResolver(assets)(assets[1].id), crop: null,
        transform: { quarterTurns: 0, mirrorX: false, mirrorY: false } }] }],
    texts: [{ id: 'text:trial', article, visibility: 'PUBLIC' }],
    shapes: [{ id: 'shape:trial', name: 'Backdrop', color: '#456057', opacity: 1, visibility: 'PUBLIC' }],
    artworkLayers: ['shape:trial', 'image:trial', 'text:trial'],
    placements: { 'shape:trial': { left: 35, top: 70, width: 680, height: 460 },
      'image:trial': { left: 55, top: 100, width: 390, height: 380 },
      'text:trial': { left: 425, top: 180, width: 320, height: 250 } } };
}
let value = JSON.parse(localStorage.getItem(key) || 'null') || seed(), generation = 0;
const listeners = new Set(), undo = [], redo = [];
function valid(next) {
  if (next.version !== 1 || !validShapes(next.shapes) || !validArtworkLayers(next.artworkLayers, next)) throw Error('Invalid experimental scene');
  for (const id of next.artworkLayers) {
    const frame = next.placements[id];
    if (!frame || !Object.values(frame).every(Number.isFinite) || frame.width < 32 || frame.height < 32
      || frame.left < 0 || frame.top < 0 || frame.left + frame.width > next.size.width + 1 || frame.top + frame.height > next.size.height + 1) throw Error('Invalid experimental placement');
  }
}
valid(value);
function persist(next) { valid(next); localStorage.setItem(key, JSON.stringify(next)); value = next; generation++; listeners.forEach(f => f()); }
const store = { getSnapshot: () => value, getGeneration: () => generation,
  subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); },
  commit(next, expected = generation) {
    if (generation !== expected) return false;
    const changes = draftChanges(value, next); if (!changes.length) return true;
    persist(next); undo.push(changes); redo.length = 0; return true;
  },
  history(direction) {
    const from = direction === 'undo' ? undo : redo, to = direction === 'undo' ? redo : undo;
    if (!from.length) return;
    const changes = from.at(-1), next = applyDraftChanges(value, changes, direction);
    if (!next) throw Error('Experimental history conflict'); persist(next); from.pop(); to.push(changes);
  },
};
window.richCellFixture = { store, key };
function Trial() {
  const scene = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [selection, setSelection] = useState(() => initialWorkbenchSelection(scene, 'text:trial'));
  const [preview, setPreview] = useState(null), [colorPreview, setColorPreview] = useState(null), [textPreview, setTextPreview] = useState(null);
  const [mode, setMode] = useState('scale'), [width, setWidth] = useState(800), [showTools, setShowTools] = useState(true), [target, setTarget] = useState('default');
  const [toolFrame, setToolFrame] = useState({ left: 850, top: 16, width: 360, height: 640 });
  const workspace = useRef(null), cell = useRef(null);
  const [gestures] = useState(() => createWorkbenchGestures({ getHost: () => cell.current,
    restoreTransforms: () => setPreview(null), finishSnap: () => setPreview(null), cancelDrop: () => {}, previewMarquee: () => {} }));
  useEffect(() => () => gestures.cancel(), [gestures]);
  useEffect(() => { gestures.cancel(); setColorPreview(null); setTextPreview(null); }, [scene, gestures]);
  useLayoutEffect(() => { const node = workspace.current; const measure = () => setWidth(Math.min(800, node.clientWidth - 24));
    const observer = new ResizeObserver(measure); observer.observe(node); measure(); return () => observer.disconnect(); }, []);
  const id = workbenchSelectionTarget(selection, scene), item = artworkRecords(scene).find(i => i.id === id);
  const scale = width / scene.size.width;
  const select = id => { gestures.cancel(); setColorPreview(null); setTextPreview(null); setSelection(state => changeWorkbenchSelection(state, { type: 'select', id }, scene)); };
  const change = (patch, expected = store.getGeneration()) => store.commit({ ...scene, ...patch }, expected);
  const setFrame = (id, frame, expected) => change({ placements: { ...scene.placements, [id]: frame } }, expected);
  const begin = (event, id, edge) => {
    if (event.button !== 0 || mode === 'flow' && width < 640) return;
    event.preventDefault(); event.stopPropagation(); select(id);
    const start = scene.placements[id], version = store.getGeneration(), node = event.currentTarget;
    let candidate = start;
    const move = delta => {
      const d = { x: delta.x / scale, y: delta.y / scale };
      if (edge) candidate = resizeWorkbenchWindow(start, edge, d, { width: 32, height: 32 }, { left: 0, top: 0, right: scene.size.width, bottom: scene.size.height });
      else { const p = clampOwnerSystemWorkflowWindowPosition({ x: start.left + d.x, y: start.top + d.y }, start, scene.size, 0); candidate = { ...start, left: p.x, top: p.y }; }
      setPreview({ id, frame: candidate }); return candidate;
    };
    if (edge) gestures.beginResize(event, { beforeTransforms: {}, valid: () => store.getGeneration() === version && node.isConnected,
      preview: move, commit: () => setFrame(id, candidate, version) });
    else gestures.beginMove(event, { nodes: [node], beforeTransforms: {}, preview: move, commit: frame => setFrame(id, frame, version), previewDrop: () => {}, commitDrop: () => false });
  };
  return <main className="rich-trial system-workflow__token-scope" data-menu-surface="carbon" data-lattice-menu-surface data-workflow-material="tactile" data-workflow-finish="flat"
    onKeyDown={event => { if (event.defaultPrevented || event.target.closest('input,textarea,[contenteditable]')) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); gestures.cancel(); store.history(event.shiftKey ? 'redo' : 'undo'); } }}>
    <header className="workbench-tool-controls" data-window-chrome="flat"><strong>Rich Reception cell · isolated experiment</strong>
      <button className="workflow-tactile-control" onClick={() => { gestures.cancel(); store.history('undo'); }}>Undo</button><button className="workflow-tactile-control" onClick={() => store.history('redo')}>Redo</button>
      <button className="workflow-tactile-control" onClick={() => setShowTools(!showTools)}>Tools</button>
      <label>Mobile candidate<select aria-label="Mobile candidate" value={mode} onChange={e => setMode(e.target.value)}><option value="scale">Scale composition</option><option value="flow">Readable flow</option></select></label>
      <p>Saved only in this fixture. Mobile choices are comparisons, not accepted product behavior.</p>
    </header>
    <div ref={workspace} className="rich-trial-workspace">
      <div style={{ width, height: mode === 'flow' && width < 640 ? 'auto' : 600 * scale }} className="rich-trial-viewport">
        <section ref={cell} tabIndex={0} aria-label="Experimental cell" className="rich-trial-cell" data-flow={mode === 'flow' && width < 640 || undefined}
          style={{ width: 800, height: 600, transform: `scale(${scale})` }}>
          {scene.artworkLayers.map(id => { const record = artworkRecords(scene).find(i => i.id === id), frame = preview?.id === id ? preview.frame : scene.placements[id];
            return <div key={id} data-object={id} data-selected={showTools && id === item?.id || undefined} className="rich-trial-object" style={frame}
              role="group" aria-label={record.name} tabIndex={0} onFocus={() => select(id)} onPointerDown={e => begin(e, id)}>
              {record.key === 'shapes' ? <div className="rich-trial-shape" style={{ background: id === item?.id && colorPreview?.color || record.record.color, opacity: record.record.opacity }} />
                : record.key === 'imageModules' ? <ReceptionImage record={record.record} />
                : <ArticleView article={id === item?.id && textPreview || record.record.article} containerOwned />}
              {showTools && id === item?.id && WORKBENCH_RESIZE_EDGES.map(([edge]) => <button key={edge} type="button" className={'rich-trial-resize edge-' + edge} aria-label={`Resize ${record.name} ${edge}`} onPointerDown={e => begin(e, id, edge)} />)}
            </div>;
          })}
        </section>
      </div>
      {showTools && <ToolPanel chrome="flat" label="Cell object tools" title="Cell object tools" boundsRef={workspace} frame={toolFrame} onFrameChange={setToolFrame} onClose={() => setShowTools(false)} className="workbench-tool-controls reception-tool-panel">
        <div className="workbench-layers"><div className="rich-trial-layer-list">{artworkRecords(scene).map(record => <button key={record.id} type="button" aria-pressed={record.id === id} onClick={() => select(record.id)}>{'Select ' + record.name}</button>)}</div>
        <nav className="workbench-layers-actions"><ArtworkOrderControls disabled={!id} onOrder={direction => change({ artworkLayers: reorderArtwork(scene.artworkLayers, [id], direction) })} /></nav></div>
        <div key={id}>
          {item?.key === 'shapes' && <CommittedColourControls color={item.record.color} opacity={item.record.opacity} getVersion={store.getGeneration} onPreview={setColorPreview}
            onChange={patch => change({ shapes: scene.shapes.map(s => s.id === id ? { ...s, ...patch } : s) })} />}
          {item?.key === 'texts' && <TextColourTools article={item.record.article} editor={null} store={store} target={target} onTarget={setTarget} containerControls={false}
            onPreview={setTextPreview} onChange={article => change({ texts: scene.texts.map(t => t.id === id ? { ...t, article } : t) })} />}
          {item?.key === 'imageModules' && <p>Images retain their source and framing. They have no general color effect in the current tools.</p>}
        </div>
      </ToolPanel>}
    </div>
  </main>;
}
createRoot(document.getElementById('root')).render(<Trial />);
