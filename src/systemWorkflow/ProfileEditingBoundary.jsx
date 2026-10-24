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
  const loading = status === 'loading';
  return <main className="published-profile-status" data-lattice-menu-surface data-menu-surface="mist">
    {!loading && <StartupDestinationReady />}
    <section className="published-profile-status__card" aria-label="Profile editing access">
      <header><span>INSCAPE</span><h1>{loading ? 'Checking editing access…' : 'This tab is view-only'}</h1></header>
      <div className="published-profile-status__body">
        <p role="status">{status === 'busy'
          ? 'This profile is being edited in another tab. Close that editor or leave its Workbench before editing here.'
          : loading ? 'Checking whether this profile is open in another editor.'
            : status === 'released' ? 'Editing access was released when you left this page. Try editing here again.'
              : status === 'unavailable' ? 'The browser could not reserve editing access. Try again.'
            : 'Editing requires browser support for exclusive access. Use a supported browser on localhost or HTTPS, then try again.'}</p>
        <p>No local draft has been replaced. Viewing a published workspace shows its last published version, not private edits.</p>
        <div className="published-profile-actions">
          {!loading && <button type="button" className="published-profile-retry" onClick={({ currentTarget: button }) => {
            // The recovery button is about to unmount. Keep keyboard focus in
            // the stable destination while its Workbench finishes loading.
            if (document.activeElement === button)
              button.closest('.application-interface')?.focus({ preventScroll: true });
            setAttempt(value => value + 1);
          }}>Try editing here</button>}
          {onView && <button type="button" className="published-profile-retry" onClick={onView}>View published workspace</button>}
        </div>
      </div>
    </section>
  </main>;
}
