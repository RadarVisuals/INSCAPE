import { useLayoutEffect, useMemo, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import CompositionSources from './CompositionSources.jsx';
import WorkbenchOverviewPreview from './WorkbenchOverviewPreview.jsx';
import { workbenchOverviewModel } from './workbenchOverviewModel.js';
import './workbenchOverview.css';
import './compositionPreview.css';

export default function CompositionPreview({ entry, snapshot, profile, onClose }) {
  const dialog = useRef(null);
  const model = useMemo(() => workbenchOverviewModel(entry.draft), [entry.draft]);
  useLayoutEffect(() => {
    const node = dialog.current;
    node.showModal();
    return () => node.close();
  }, []);

  return <dialog ref={dialog} className="studio-composition-preview" aria-label="Composition preview"
    onCancel={event => {
      if (event.target !== event.currentTarget) return;
      event.preventDefault();
      onClose();
    }}>
    <header><button type="button" onClick={() => onClose()} autoFocus>
      <ArrowLeft size={16} aria-hidden="true" />Back to editing
    </button></header>
    <CompositionSources snapshot={snapshot} profile={profile}>
      <WorkbenchOverviewPreview model={model} name={entry.name} presenting emptyHint="" />
    </CompositionSources>
  </dialog>;
}
