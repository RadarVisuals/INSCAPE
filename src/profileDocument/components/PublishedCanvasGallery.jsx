import { lazy, Suspense, useMemo, useRef, useState } from 'react';
import WorkbenchOverview from '../../public/workbenchOverview/WorkbenchOverview.jsx';
import WorkbenchOverviewPreview from '../../public/workbenchOverview/WorkbenchOverviewPreview.jsx';
import CompositionSources from '../../public/workbenchOverview/CompositionSources.jsx';
import { workbenchOverviewModel } from '../../public/workbenchOverview/workbenchOverviewModel.js';
import useDeferredFocusReturn from '../../public/useDeferredFocusReturn.js';
import './publishedCompositions.css';

const CanvasPresentation = lazy(() => import('../../public/workbenchOverview/CanvasPresentation.jsx'));

export default function PublishedCanvasGallery({ toolbarHost, entries, snapshot, persona, profileLinks = false, view, onViewChange,
  selectedId, onSelect, cardSize, onCardSize, cameraMemory, onEdit, onManageWorks, onNewComposition, onRemoveFromGallery }) {
  const [openId, setOpenId] = useState(null);
  const trigger = useRef(null);
  const { restoreFocus } = useDeferredFocusReturn();
  const previews = useMemo(() => {
    const byId = new Map(snapshot.entries.map(entry => [entry.id, entry]));
    return entries.map(item => {
      const entry = item.reception ? { ...item, draft: { profileAddress: snapshot.profileAddress, composition: item.reception } }
        : byId.get(item.id);
      return { ...entry, model: workbenchOverviewModel(entry.draft) };
    });
  }, [entries, snapshot]);
  const selected = previews.find(item => item.id === selectedId) || previews[0];
  const opened = previews.find(item => item.id === openId);
  if (!selected) return <main className="published-work-list"><h1>Gallery</h1><p>No compositions in Gallery yet.</p>{onNewComposition && <button type="button" onClick={() => onNewComposition()}>New composition</button>}{onManageWorks && <button type="button" onClick={onManageWorks}>Manage works</button>}</main>;
  return <CompositionSources snapshot={snapshot} profile={persona}>
    {profileLinks ? <section className="published-work-list profile-linked-works" aria-label="Linked compositions">
      <h2>Compositions</h2>
      <div className="profile-linked-grid">{previews.map(item => <article key={item.id}>
        <div className="profile-linked-thumb" inert="" aria-hidden="true"><WorkbenchOverviewPreview model={item.model} name={item.name} thumbnail crop={item.thumbnailCrop} /></div>
        <button type="button" aria-label={`Open ${item.name}`}
          onClick={event => { trigger.current = event.currentTarget; onSelect(item.id); setOpenId(item.id); }}>{item.name}</button>
      </article>)}</div>
      {opened && <Suspense fallback={null}><CanvasPresentation publishedWorks selected={opened} model={opened.model}
        origin={trigger.current?.previousElementSibling} onEdit={onEdit}
        onClose={() => { setOpenId(null); restoreFocus(trigger.current); }} /></Suspense>}
    </section> : <WorkbenchOverview toolbarHost={toolbarHost} visitorHeader galleryAddress={onEdit ? snapshot.profileAddress : undefined} items={previews} previews={previews} selected={selected} model={selected.model}
      profile={{ name: persona.profile.displayName, avatarUrl: persona.profile.avatarUrl }} onEdit={onEdit} onRequestNew={onNewComposition && (() => onNewComposition())}
      onManageWorks={onManageWorks} onRemoveFromGallery={onRemoveFromGallery} onSelect={onSelect} view={view} onViewChange={onViewChange} cardSize={cardSize} onCardSize={onCardSize} cameraMemory={cameraMemory} />}
  </CompositionSources>;
}
