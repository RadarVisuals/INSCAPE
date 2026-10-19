import { useEffect, useState } from 'react';
import { StartupDestinationReady } from '../startveil/StartupDestinationContext.jsx';
import { acquireProfileEditor } from './profileEditorLease.js';
import './workbenchBackup.css';

export default function ProfileEditingBoundary(props) {
  return <EditingSession key={props.profileAddress.toLowerCase()} {...props} />;
}

function EditingSession({ profileAddress, children, onView }) {
  const [attempt, setAttempt] = useState(0), [status, setStatus] = useState('loading');
  useEffect(() => {
    let active = true;
    setStatus('loading');
    const lease = acquireProfileEditor(profileAddress);
    lease.ready.then(next => { if (active) setStatus(next); });
    const hide = () => { lease.stop(); setStatus('released'); };
    const show = event => { if (event.persisted) setAttempt(value => value + 1); };
    addEventListener('pagehide', hide); addEventListener('pageshow', show);
    return () => { active = false; lease.stop(); removeEventListener('pagehide', hide); removeEventListener('pageshow', show); };
  }, [profileAddress, attempt]);
  if (status === 'editing') return children;
  return <main className="published-profile-status" data-lattice-menu-surface data-menu-surface="mist">
    <StartupDestinationReady />
    <section className="published-profile-status__card" aria-label="Profile editing access">
      <header><span>INSCAPE</span><h1>{status === 'loading' ? 'Checking editing access…' : 'This tab is view-only'}</h1></header>
      <div className="published-profile-status__body">
        <p role="status">{status === 'busy'
          ? 'This profile is being edited in another tab. Close that editor or leave its Workbench before editing here.'
          : status === 'loading' ? 'Checking whether this profile is open in another editor.'
            : status === 'released' ? 'Editing access was released when you left this page. Try editing here again.'
              : status === 'unavailable' ? 'The browser could not reserve editing access. Try again.'
            : 'Editing requires browser support for exclusive access. Use a supported browser on localhost or HTTPS, then try again.'}</p>
        <p>No local draft has been replaced. Viewing a published workspace shows its last published version, not private edits.</p>
        <div className="published-profile-actions">
          {status !== 'loading' && <button type="button" className="published-profile-retry" onClick={() => setAttempt(value => value + 1)}>Try editing here</button>}
          {onView && <button type="button" className="published-profile-retry" onClick={onView}>View published workspace</button>}
        </div>
      </div>
    </section>
  </main>;
}
