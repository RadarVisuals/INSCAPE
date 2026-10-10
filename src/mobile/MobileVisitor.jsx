import { useMemo } from 'react';
import { useProfileIdentity } from '../profileIdentity/index.js';
import { createPublishedIdentityRackViewModel } from '../profileDocument/components/publishedIdentityRackViewModel.js';
import { useStartupDestinationReady } from '../startveil/StartupDestinationContext.jsx';
import MobilePresentation from './MobilePresentation.jsx';

export default function MobileVisitor({ document, onExit, onReturn, onDesktop }) {
  useStartupDestinationReady();
  const identity = useProfileIdentity(document.profile.address);
  const model = useMemo(() => createPublishedIdentityRackViewModel({ document, identity }), [document, identity]);
  if (!document.mobile) return <main className="mobile-unavailable"><h1>{model?.profile.displayName || 'INSCAPE'}</h1>
    <p>This profile has not published a mobile presentation.</p>
    <button onClick={onDesktop}>Open desktop experience</button>{(onReturn || onExit) && <button onClick={onReturn || onExit}>Back</button>}</main>;
  return <main className="mobile-visitor"><MobilePresentation key={`${document.profile.address}:${document.documentId}:${document.revision}`}
    content={document.mobile} identity={model} rememberTheme onExit={onReturn || onExit} /></main>;
}
