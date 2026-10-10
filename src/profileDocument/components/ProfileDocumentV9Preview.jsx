import { lazy, Suspense, useMemo, useState } from 'react';
import { assertValidProfileDocumentV9 } from '../domain/profileDocumentV9Validation.js';

import { resolvePublicCanvasTarget } from './profileOverviewModel.js';
import { applicationRouteUrl } from '../../profileDiscovery/applicationNavigation.js';
import './profileOverview.css';

const ProfileOverview = lazy(() => import('./ProfileOverview.jsx'));
const VisitorGridWorld = lazy(() => import('./VisitorGridWorld.jsx'));
const MobileVisitor = lazy(() => import('../../mobile/MobileVisitor.jsx'));

export default function ProfileDocumentV9Preview({ document: input, onExit, onOpenDirectory, onReturn, onConnect, entry, onOpenCanvas, onOpenOverview, onOpenWork, onCloseWork }) {
  const document = useMemo(() => assertValidProfileDocumentV9(input), [input]);
  // Decide at entry, not during a rotate/resize that would discard visitor navigation.
  const [mobile, setMobile] = useState(() => typeof matchMedia === 'function' && matchMedia('(max-width: 767px) and (pointer: coarse)').matches);
  const [returnTarget, setReturnTarget] = useState(null);
  const openCanvas = onOpenCanvas ? target => { setReturnTarget(target || {}); onOpenCanvas(target); } : undefined;
  const target = useMemo(() => resolvePublicCanvasTarget(document, entry?.target), [document, entry?.target]);
  const unavailableTarget = Boolean(entry?.target && !target);
  const overview = entry && (entry.surface !== 'canvas' || unavailableTarget);
  const returnHref = applicationRouteUrl(window.location, { kind: 'profile', address: document.profile.address, reception: entry?.reception });
  return <Suspense fallback={<main className="public-shell" role="status">LOADING VISITOR GRID</main>}>
    {mobile ? <MobileVisitor document={document} onExit={onExit} onReturn={onReturn} onDesktop={() => setMobile(false)} />
      : overview ? <ProfileOverview key={document.profile.address} document={document} focusedTarget={target} onOpenWork={onOpenWork} onCloseWork={onCloseWork} reception={entry?.reception} onOpenCanvas={openCanvas} returnTarget={returnTarget}
        onOpenDirectory={onOpenDirectory} onReturn={onReturn} unavailableTarget={unavailableTarget} />
      : <><VisitorGridWorld key={JSON.stringify([document.profile.address, document.documentId, document.revision, target])}
          document={document} entryTarget={target} onExit={onExit} onOpenDirectory={onOpenDirectory} onReturn={onReturn} onConnect={onConnect} />
        {entry && <a className="visitor-overview-return" href={returnHref} onClick={event => {
          if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && onOpenOverview) {
            event.preventDefault(); onOpenOverview();
          }
        }}>← Profile overview</a>}</>}
  </Suspense>;
}
