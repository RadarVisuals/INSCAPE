import { lazy, Suspense, useMemo } from 'react';
import { assertValidProfileDocumentV9 } from '../domain/profileDocumentV9Validation.js';

import { resolvePublicCanvasTarget } from './profileOverviewModel.js';
import { applicationRouteUrl } from '../../profileDiscovery/applicationNavigation.js';
import './profileOverview.css';

const ProfileOverview = lazy(() => import('./ProfileOverview.jsx'));
const VisitorGridWorld = lazy(() => import('./VisitorGridWorld.jsx'));

export default function ProfileDocumentV9Preview({ document: input, ownerEditingAllowed = false, onExit, onOpenDirectory, onReturn, onConnect, entry, onOpenOverview }) {
  const document = useMemo(() => assertValidProfileDocumentV9(input), [input]);
  const target = useMemo(() => resolvePublicCanvasTarget(document, entry?.target), [document, entry?.target]);
  const unavailableTarget = Boolean(entry?.target && !target);
  // Existing direct work links retain the canonical canvas renderer. Reception
  // no longer mounts a second set of modules in a carousel/inspection host.
  const overview = entry && ((!target && entry.surface !== 'canvas') || unavailableTarget);
  const returnHref = applicationRouteUrl(window.location, { kind: 'profile', address: document.profile.address, reception: entry?.reception });
  return <Suspense fallback={<main className="public-shell" role="status">LOADING VISITOR GRID</main>}>
    {overview ? <ProfileOverview key={document.profile.address} document={document} ownerEditingAllowed={ownerEditingAllowed}
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
