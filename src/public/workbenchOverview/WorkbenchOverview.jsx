import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import OverviewNavigation from './OverviewNavigation.jsx';
import WorkbenchOverviewPreview from './WorkbenchOverviewPreview.jsx';
import { MAX_WORKBENCH_INTRODUCTION } from '../../systemWorkflow/domain/workbenchCollection.js';
import '../ownerSystemWorkflow/workflowTactile.css';
import '../ownerSystemWorkflow/workflowFlat.css';
import './workbenchOverview.css';

const WorkbenchOverviewGrid = lazy(() => import('./WorkbenchOverviewGrid.jsx'));
const CanvasPresentation = lazy(() => import('./CanvasPresentation.jsx'));
const ThumbnailCropForm = lazy(() => import('./ThumbnailCropForm.jsx'));

function DetailsForm({ selected, onSave, onCancel, creating }) {
  const [name, setName] = useState(creating ? '' : selected.name);
  const [introduction, setIntroduction] = useState(creating ? '' : selected.introduction);
  const [error, setError] = useState('');
  const input = useRef(null);
  useEffect(() => { input.current?.focus(); }, []);
  return <form className="workbench-overview-form" onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); onCancel(); }
  }} onSubmit={event => {
    event.preventDefault();
    try { onSave({ name: name.trim(), introduction: introduction.trim() }); } catch (failure) { setError(failure.message); }
  }}>
    <h2>{creating ? 'New Workbench' : 'Edit details'}</h2>
    <label>Workbench name<input ref={input} value={name} onChange={event => setName(event.target.value)} required maxLength={64} /></label>
    {!creating && <label>Introduction <span>optional</span><textarea value={introduction} onChange={event => setIntroduction(event.target.value)} maxLength={MAX_WORKBENCH_INTRODUCTION} rows={4} />
      <small>{introduction.length} / {MAX_WORKBENCH_INTRODUCTION}</small></label>}
    {error && <p role="alert">{error}</p>}
    <div className="workbench-overview-actions"><button className="workbench-overview-primary" type="submit">{creating ? 'Create Workbench' : 'Save details'}</button><button type="button" onClick={onCancel}>Cancel</button></div>
  </form>;
}

export default function WorkbenchOverview({ items, selected, model, previews, view, onViewChange, profile, onSelect, onEdit, onCreate, onSave, onOpenReception,
  cardSize, onCardSize, onReorder, preferenceError, onRetryPreferences }) {
  const [editing, setEditing] = useState(null), [error, setError] = useState('');
  const [arranging, setArranging] = useState(false);
  const [presentation, setPresentation] = useState(null);
  const [cropRatio, setCropRatio] = useState(1);
  const list = useRef(null), menuButton = useRef(null), editButton = useRef(null), returnFocus = useRef(null), stage = useRef(null);
  const grid = view.layout === 'grid';
  const focusSelected = options => list.current?.querySelector('button[data-previewed="true"]')?.focus(options);
  useEffect(() => { focusSelected({ preventScroll: true }); }, []);
  const run = action => { try { action(); setError(''); } catch (failure) { setError(failure.message); } };
  const closeForm = () => { setEditing(null); requestAnimationFrame(() => {
    if (!grid && editing === 'details') editButton.current?.focus({ preventScroll: true });
    else if (returnFocus.current?.isConnected) returnFocus.current.focus({ preventScroll: true });
    else focusSelected({ preventScroll: true });
  }); };
  const preview = id => { if (!editing && !presentation) { setError(''); onSelect(id); } };
  const manage = (id, kind, trigger) => {
    preview(id);
    const card = trigger?.closest('.workbench-overview-card'), bounds = card?.getBoundingClientRect();
    returnFocus.current = card?.querySelector('.workbench-overview-card-open') || trigger;
    if (kind === 'crop') setCropRatio(bounds ? bounds.width / bounds.height : 1);
    setEditing(kind);
  };
  const open = (id, trigger) => { preview(id); setPresentation({ origin: grid ? trigger?.closest('.workbench-overview-card') : stage.current?.querySelector('.workbench-overview-preview') }); };
  const closePresentation = () => { setPresentation(null); requestAnimationFrame(() => focusSelected({ preventScroll: true })); };
  return <div className="workbench-overview system-workflow__token-scope" data-workflow-material="tactile" data-workflow-finish="flat"
    data-menu-surface={selected.draft.appearance.menuSurfaceId} data-layout={view.layout}>
    <div className="workbench-overview-browse" inert={presentation ? '' : undefined}>
    <OverviewNavigation profile={profile} address={selected.draft.profileAddress} disabled={Boolean(editing)}
      onAbout={onOpenReception} onCanvases={() => requestAnimationFrame(() => focusSelected({ preventScroll: true }))}
      view={view} onViewChange={next => { setError(''); onViewChange(next); }} count={items.length} triggerRef={menuButton}
      arranging={arranging} onArrange={() => setArranging(!arranging)} cardSize={cardSize} onCardSize={onCardSize}
      onCreate={() => { returnFocus.current = menuButton.current; setEditing('new'); }} />
    <main className="workbench-overview-main">
      {grid ? <Suspense fallback={<p role="status">Opening gallery…</p>}><div className="workbench-overview-grid-host" inert={editing ? '' : undefined}>
        <WorkbenchOverviewGrid items={previews} selectedId={selected.id} wrap={view.wrap} hostRef={list}
          cardSize={cardSize} arranging={arranging} onFinishArrange={() => { setArranging(false); requestAnimationFrame(() => menuButton.current?.focus()); }} onReorder={ids => run(() => onReorder(ids))}
          onOpen={open} onEdit={id => run(() => onEdit(id))} onManage={manage} />
      </div></Suspense> : <section ref={stage} className="workbench-overview-stage" aria-label="Composition preview">
        <WorkbenchOverviewPreview key={selected.id} model={model} name={selected.name} surfaceId={selected.draft.appearance.surfaceId} />
        <div className="workbench-overview-caption"><span>{selected.name}</span><span>Preview</span></div>
      </section>}
      <div className="workbench-overview-content">
        <header className="workbench-overview-heading"><h1>Canvases</h1>
          <div><p>Your compositions, all in one place.</p><span>{items.length} {items.length === 1 ? 'Workbench' : 'Workbenches'}</span></div>
        </header>
        {!grid && <nav className="workbench-overview-list" aria-label="Named Workbenches" ref={list}>
          {items.map((item, index) => <button type="button" key={item.id} data-previewed={selected.id === item.id} disabled={Boolean(editing)}
            onPointerEnter={event => { if (event.pointerType === 'mouse') preview(item.id); }}
            onFocus={event => { if (event.currentTarget.matches(':focus-visible')) preview(item.id); }}
            onClick={event => open(item.id, event.currentTarget)} aria-label={`Open ${item.name}`}>
            <small>{String(index + 1).padStart(2, '0')}</small><span>{item.name}</span><ArrowUpRight size={18} aria-hidden="true" /></button>)}
        </nav>}
        {(!grid || editing) && <section className="workbench-overview-detail" aria-label={editing ? 'Canvas settings' : 'Selected Workbench'}>
          {editing === 'crop' ? <Suspense fallback={<p role="status">Opening crop controls…</p>}><ThumbnailCropForm key={selected.id} selected={selected} model={model} ratio={cropRatio}
            onCancel={closeForm} onSave={thumbnailCrop => { onSave({ name: selected.name, introduction: selected.introduction, thumbnailCrop }); closeForm(); }} /></Suspense>
            : editing ? <DetailsForm key={`${selected.id}:${editing}`} creating={editing === 'new'} selected={selected} onCancel={closeForm}
            onSave={details => { if (editing === 'new') onCreate(details.name); else onSave(details); closeForm(); }} />
            : <><div className="workbench-overview-description"><div className="workbench-overview-title"><h2>{selected.name}</h2><button type="button" ref={editButton} onClick={event => manage(selected.id, 'details', event.currentTarget)}>Edit details</button></div>
              {selected.introduction && <p className="workbench-overview-introduction">{selected.introduction}</p>}
              {model.interactive && <p className="workbench-overview-preview-note">Interactive artwork runs when you open the Workbench.</p>}
              <div className="workbench-overview-actions"><button type="button" className="workbench-overview-primary" onClick={event => open(selected.id, event.currentTarget)}>View canvas<ArrowUpRight size={16} aria-hidden="true" /></button>
                <button type="button" onClick={() => run(() => onEdit(selected.id))}>Edit canvas</button></div>
              </div><dl className="workbench-overview-metadata"><div><dt>Contains</dt><dd>{model.contains}</dd></div><div><dt>Canvas</dt><dd>{model.area.width} × {model.area.height}</dd></div></dl>
            </>}
        </section>}
        {error && <p role="alert" className="workbench-overview-error">{error}</p>}
        {preferenceError && <p role="alert" className="workbench-overview-error">{preferenceError} <button type="button" onClick={onRetryPreferences}>Retry saving</button></p>}
      </div>
    </main>
    </div>
    {presentation && <Suspense fallback={<p role="status">Opening canvas…</p>}><CanvasPresentation key={selected.id} selected={selected} model={model}
      origin={presentation.origin} onClose={closePresentation} onEdit={onEdit} /></Suspense>}
  </div>;
}
