import { lazy, Suspense, useCallback, useMemo, useRef, useState } from 'react';
import ReceptionPresentation from '../../reception/ReceptionPresentation.jsx';
import { resolvePresentationDestination } from '../../presentation/presentationSources.js';
import { workbenchOverviewModel } from './workbenchOverviewModel.js';
import useDeferredFocusReturn from '../useDeferredFocusReturn.js';

const CanvasPresentation = lazy(() => import('./CanvasPresentation.jsx'));

export default function CompositionSources({ snapshot, profile, children }) {
  const [link, setLink] = useState(null);
  const trigger = useRef(null);
  const { restoreFocus } = useDeferredFocusReturn();
  const result = link && resolvePresentationDestination(snapshot, link);
  const target = result?.status === 'ready' ? result.entry : null;
  const model = useMemo(() => target && workbenchOverviewModel(target.draft), [target]);
  const openSource = useCallback((ref, button) => { trigger.current = button; setLink(ref); }, []);
  const close = () => { setLink(null); restoreFocus(trigger.current); };
  return <ReceptionPresentation snapshot={snapshot} profile={profile} onOpenSource={openSource}>
    {children}
    {target && <Suspense fallback={null}><CanvasPresentation key={target.id} selected={target} model={model}
      initialDestinationId={link.destinationId} onClose={close} /></Suspense>}
    {link && !target && <p role="alert" className="visitor-notice"
      onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); } }}>
      This linked work is unavailable. <button autoFocus type="button" onClick={close}>Close</button>
    </p>}
  </ReceptionPresentation>;
}
