import { useRef, useState } from 'react';
import { ExternalLink, UserRound, X } from 'lucide-react';
import { normalizeProfileAddress } from '../../library/config.js';
import { useProfileIdentity } from '../../profileIdentity/index.js';

const compact = (value) => value?.length > 18 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;

function Creator({ creator }) {
  const address = normalizeProfileAddress(creator?.address);
  const identity = useProfileIdentity(address);
  const resolved = identity?.status === 'RESOLVED' && identity.isUniversalProfile;
  const name = resolved && identity.name || creator?.name || compact(address) || 'Unknown creator';
  const href = address ? resolved ? `https://universaleverything.io/${address}`
    : `https://explorer.lukso.network/address/${address}` : null;
  const body = <><i>{resolved && identity.avatarUrl ? <img alt="" src={identity.avatarUrl} /> : <UserRound />}</i>
    <span><strong>{name}</strong>{address && <small>{compact(address)}</small>}</span>{href && <ExternalLink />}</>;
  return href ? <a aria-label={`Open creator ${name}`} href={href} rel="noreferrer" target="_blank">{body}</a> : <div>{body}</div>;
}

export function OwnerSystemWorkflowMetadataContent({ dossier }) {
  return <div className="system-workflow__metadata-module-content">
    <section><small>CREATOR ATTRIBUTION</small><Creator creator={dossier?.creators?.[0]} /></section>
    <section className="system-workflow__metadata-module-description"><small>DESCRIPTION</small>
      <p>{dossier?.description || 'Select one artwork to inspect its metadata.'}</p></section>
    {dossier?.technical?.length > 0 && <ul className="system-workflow__metadata-module-facts">
      {dossier.technical.map((entry) => <li key={`${entry.kind}-${entry.label}`}><small>{entry.label}</small>
        {entry.href ? <a href={entry.href} rel="noreferrer" target="_blank"><strong>{entry.value}</strong><ExternalLink /></a> : <strong>{entry.value}</strong>}</li>)}
    </ul>}
    {dossier?.traits?.length > 0 && <ul className="system-workflow__metadata-module-traits">
      {dossier.traits.map((entry, index) => <li key={`${entry.label}-${index}`}><small>{entry.label}</small><strong>{entry.value}</strong></li>)}
    </ul>}
  </div>;
}

export default function OwnerSystemWorkflowMetadataModule({ dossier, onClose, onDock }) {
  const [position, setPosition] = useState(() => ({ x: Math.max(18, (globalThis.innerWidth || 1000) - 318), y: 72 }));
  const drag = useRef(null);
  const beginDrag = (event) => {
    if (event.button !== 0 || event.target.closest('button')) return;
    drag.current = { id: event.pointerId, clientX: event.clientX, clientY: event.clientY, left: position.x, top: position.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag = (event) => {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    setPosition({
      x: Math.max(8, Math.min((globalThis.innerWidth || 1000) - 294, start.left + event.clientX - start.clientX)),
      y: Math.max(8, Math.min((globalThis.innerHeight || 700) - 76, start.top + event.clientY - start.clientY)),
    });
  };
  const stopDrag = (event) => { if (drag.current?.id === event.pointerId) drag.current = null; };
  return <aside aria-label="Metadata module" className="system-workflow__metadata-module" data-floating
    style={{ left: position.x, top: position.y }}>
    <header onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={stopDrag} onPointerCancel={stopDrag}>
      <strong>METADATA</strong><span className="system-workflow__module-controls">
        <button aria-label="Dock Metadata to Presentation Board" className="system-workflow__round-control"
          onClick={onDock} type="button"><i aria-hidden="true" className="system-workflow__state-glyph" /></button>
        <button aria-label="Close Metadata" className="system-workflow__round-control is-close"
          onClick={onClose} type="button"><X /></button>
      </span>
    </header>
    <OwnerSystemWorkflowMetadataContent dossier={dossier} />
  </aside>;
}
