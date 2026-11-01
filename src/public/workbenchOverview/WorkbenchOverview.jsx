import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import OverviewNavigation from './OverviewNavigation.jsx';
import CompositionIndex from './CompositionIndex.jsx';
import { MAX_WORKBENCH_INTRODUCTION } from '../../systemWorkflow/domain/workbenchCollection.js';
import useDeferredFocusReturn from '../useDeferredFocusReturn.js';
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
    <h2>{creating ? 'New canvas' : 'Edit details'}</h2>
    <label>Canvas name<input ref={input} value={name} onChange={event => setName(event.target.value)} required maxLength={64} /></label>
    {!creating && <label>Introduction <span>optional</span><textarea value={introduction} onChange={event => setIntroduction(event.target.value)} maxLength={MAX_WORKBENCH_INTRODUCTION} rows={4} />
      <small>{introduction.length} / {MAX_WORKBENCH_INTRODUCTION}</small></label>}
    {error && <p role="alert">{error}</p>}
    <div className="workbench-overview-actions"><button className="workbench-overview-primary" type="submit">{creating ? 'Create canvas' : 'Save details'}</button><button type="button" onClick={onCancel}>Cancel</button></div>
  </form>;
}

export default function WorkbenchOverview({ items, selected, model, previews, view, onViewChange, profile, onSelect, onEdit, onCreate, onSave, onOpenReception, onEditReception,
  cardSize, onCardSize, onReorder, preferenceError, onRetryPreferences }) {
  const [editing, setEditing] = useState(null), [error, setError] = useState('');
  const [arranging, setArranging] = useState(false);
  const [presentation, setPresentation] = useState(null);
  const [cropRatio, setCropRatio] = useState(1);
  const list = useRef(null), menuButton = useRef(null), returnFocus = useRef(null);
  const grid = view.layout === 'grid';
  const { restoreFocus } = useDeferredFocusReturn();
  const selectedButton = () => list.current?.querySelector('button[data-previewed="true"]');
  useEffect(() => { selectedButton()?.focus({ preventScroll: true }); }, []);
  const run = action => { try { action(); setError(''); } catch (failure) { setError(failure.message); } };
  const closeForm = () => { setEditing(null); restoreFocus(() => {
    if (!grid && editing === 'details') return list.current?.closest('.composition-index')?.querySelector('.composition-explorer-secondary button');
    return returnFocus.current?.isConnected ? returnFocus.current : selectedButton();
  }); };
  const preview = id => { if (!editing && !presentation) { setError(''); onSelect(id); } };
  const manage = (id, kind, trigger) => {
    preview(id);
    const card = trigger?.closest('.workbench-overview-card'), bounds = card?.getBoundingClientRect();
    returnFocus.current = card?.querySelector('.workbench-overview-card-open') || trigger;
    if (kind === 'crop') setCropRatio(bounds ? bounds.width / bounds.height : 1);
    setEditing(kind);
  };
  const open = (id, trigger) => { preview(id); setPresentation({ origin: trigger?.closest('.workbench-overview-card') }); };
  const closePresentation = () => { setPresentation(null); restoreFocus(selectedButton); };
  const settings = editing === 'crop' ? <Suspense fallback={<p role="status">Opening crop controls…</p>}><ThumbnailCropForm key={selected.id} selected={selected} model={model} ratio={cropRatio}
    onCancel={closeForm} onSave={thumbnailCrop => { onSave({ name: selected.name, introduction: selected.introduction, thumbnailCrop }); closeForm(); }} /></Suspense>
    : editing ? <DetailsForm key={`${selected.id}:${editing}`} creating={editing === 'new'} selected={selected} onCancel={closeForm}
      onSave={details => { if (editing === 'new') onCreate(details.name); else onSave(details); closeForm(); }} /> : null;
  return <div className="workbench-overview system-workflow__token-scope" data-workflow-material="tactile" data-workflow-finish="flat"
     data-layout={view.layout}>
    {grid ? <div className="workbench-overview-browse" inert={presentation ? '' : undefined}>
    <OverviewNavigation profile={profile} address={selected.draft.profileAddress} disabled={Boolean(editing)}
      onAbout={onOpenReception} onEditReception={onEditReception} onCanvases={() => restoreFocus(selectedButton)}
      view={view} onViewChange={next => { setError(''); onViewChange(next); }} count={items.length} triggerRef={menuButton}
      arranging={arranging} onArrange={onReorder ? () => setArranging(!arranging) : undefined} cardSize={cardSize} onCardSize={onCardSize}
      onCreate={onCreate ? () => { returnFocus.current = menuButton.current; setEditing('new'); } : undefined} />
    <main className="workbench-overview-main">
      <Suspense fallback={<p role="status">Opening gallery…</p>}><div className="workbench-overview-grid-host" inert={editing ? '' : undefined}>
        <WorkbenchOverviewGrid items={previews} selectedId={selected.id} wrap={view.wrap} hostRef={list}
          cardSize={cardSize} arranging={arranging} onFinishArrange={() => { setArranging(false); restoreFocus(() => menuButton.current); }} onReorder={ids => run(() => onReorder(ids))}
          onOpen={open} onEdit={onEdit ? id => run(() => onEdit(id)) : undefined} onManage={onSave ? manage : undefined} />
      </div></Suspense>
      <div className="workbench-overview-content">
        <header className="workbench-overview-heading"><h1>{onEdit ? 'My Inscape' : 'Canvases'}</h1>
          <div><p>{onEdit ? 'Your compositions, all in one place.' : 'Published compositions.'}</p><span>{items.length} {items.length === 1 ? 'Canvas' : 'Canvases'}</span></div>
        </header>
        {editing && <section className="workbench-overview-detail" aria-label="Canvas settings">{settings}</section>}
      </div>
    </main>
    </div> : <CompositionIndex items={items} selected={selected} model={model} profile={profile} listRef={list} settings={settings} disabled={Boolean(editing)}
      onSelect={preview} onEdit={onEdit ? id => run(() => onEdit(id)) : undefined} onOpenReception={onOpenReception} onEditReception={onEditReception}
      onGrid={() => onViewChange({ ...view, layout: 'grid' })}
      onDetails={onSave ? event => manage(selected.id, 'details', event.currentTarget) : undefined}
      onCreate={onCreate ? event => { returnFocus.current = event.currentTarget; setEditing('new'); } : undefined} />}
    {error && <p role="alert" className="workbench-overview-error">{error}</p>}
    {preferenceError && <p role="alert" className="workbench-overview-error">{preferenceError} <button type="button" onClick={onRetryPreferences}>Retry saving</button></p>}
    {presentation && <Suspense fallback={<p role="status">Opening canvas…</p>}><CanvasPresentation key={selected.id} selected={selected} model={model}
      origin={presentation.origin} onClose={closePresentation} onEdit={onEdit} /></Suspense>}
  </div>;
}
