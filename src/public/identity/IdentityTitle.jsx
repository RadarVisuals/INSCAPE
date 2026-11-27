import { Check, UserRound, X } from 'lucide-react';
import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import OwnerSystemWorkflowDetachedWindow from '../ownerSystemWorkflow/OwnerSystemWorkflowDetachedWindow.jsx';
// Small header controls share native 16px geometry and rounded square corners.
function IdentityActionIcon({ kind }) {
  return <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
    {kind === 'copy' && <><rect x="5.5" y="5.5" width="9" height="9" rx="1" /><path d="M10.5 3.5v-1a1 1 0 0 0-1-1h-7a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h1" /></>}
    {kind === 'source' && <path d="M7 1.5H3.5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V9M9.5 1.5h5v5M14.5 1.5 7.5 8.5" />}
    {kind === 'qr' && <path d="M1.5 5V3.5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2V5M1.5 8h13M1.5 11v1.5a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V11" />}
  </svg>;
}

function AddressQr({ address }) {
  const id = useId();
  const popover = useRef(null);
  const trigger = useRef(null);
  const [open, setOpen] = useState(false);
  const [image, setImage] = useState(null);
  const [failed, setFailed] = useState(false);
  useLayoutEffect(() => {
    if (!open) return undefined;
    let frame;
    let previous = '';
    const locate = () => {
      const anchor = trigger.current.getBoundingClientRect();
      const node = popover.current;
      const bounds = node.getBoundingClientRect();
      const left = Math.max(16, Math.min(anchor.left, innerWidth - bounds.width - 16));
      const below = anchor.bottom + 8;
      const preferredTop = below + bounds.height <= innerHeight - 16 ? below : anchor.top - bounds.height - 8;
      const top = Math.max(16, Math.min(preferredTop, innerHeight - bounds.height - 16));
      const position = `${left}:${top}`;
      if (position !== previous) {
        node.style.left = `${left}px`;
        node.style.top = `${top}px`;
        previous = position;
      }
      frame = requestAnimationFrame(locate);
    };
    locate();
    return () => cancelAnimationFrame(frame);
  }, [open]);
  useEffect(() => {
    const node = popover.current;
    const toggle = event => setOpen(event.newState === 'open');
    node.addEventListener('toggle', toggle);
    return () => node.removeEventListener('toggle', toggle);
  }, []);
  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setImage(null); setFailed(false);
    import('./addressQr.js').then(({ createAddressQrImage }) => {
      if (active) setImage(createAddressQrImage(address));
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [open, address]);
  return <>
    <button ref={trigger} className="identity-module__header-action" type="button" popovertarget={id}
      aria-label="Show address QR code" aria-expanded={open} title="Show QR code"><IdentityActionIcon kind="qr" /></button>
    <div ref={popover} id={id} popover="auto" className="identity-module__qr" role="dialog" aria-label="Share profile address"
      onPointerDown={event => event.stopPropagation()}
      onKeyDown={event => { if (event.key === 'Escape') event.stopPropagation(); }}>
      {open && <OwnerSystemWorkflowDetachedWindow as="div" title="Share profile address" className="identity-module__qr-window"
        surfaceClassName="identity-module__qr-content"
        controls={<button className="system-workflow__round-control" type="button" popovertarget={id} popovertargetaction="hide" aria-label="Close QR code"><X /></button>}>
        {image ? <img draggable={false} src={image} alt="QR code containing the full Universal Profile address" />
          : <p role="status">{failed ? 'QR unavailable. Use the copy button.' : 'Creating QR…'}</p>}
        <code><span>{address.slice(0, 22)}</span><span>{address.slice(22)}</span></code>
      </OwnerSystemWorkflowDetachedWindow>}
    </div>
  </>;
}

export default function IdentityTitle({ address, profile, label, groupedActions = false }) {
  const ActionGroup = groupedActions ? 'span' : Fragment;
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const request = useRef(0);
  useEffect(() => { setAvatarFailed(false); }, [profile.avatarUrl]);
  useEffect(() => {
    setCopied(false); setFailed(false);
    return () => { request.current++; };
  }, [address]);
  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  const copyAddress = async () => {
    const current = ++request.current;
    try {
      await navigator.clipboard.writeText(address);
      if (request.current === current) { setCopied(true); setFailed(false); }
    } catch { if (request.current === current) { setCopied(false); setFailed(true); } }
  };
  return <div className="identity-module__title">
    {!label && <span className="identity-module__title-avatar">{profile.avatarUrl && !avatarFailed
      ? <img alt="" src={profile.avatarUrl} onError={() => setAvatarFailed(true)} /> : <UserRound aria-hidden="true" />}</span>}
    <span className="identity-module__title-name" title={profile.name}>{label || profile.name}</span>
    {!label && <span className="identity-module__identifier">#{address.slice(2, 6)}</span>}
    <ActionGroup {...(groupedActions ? { className: 'identity-module__title-actions' } : {})}>
    <span className="identity-module__address-control">
      <button type="button" aria-label={copied ? 'Address copied' : 'Copy profile address'} title={address} onClick={copyAddress}>
        {copied ? <Check aria-hidden="true" /> : <IdentityActionIcon kind="copy" />}
      </button>
      <span className="identity-module__address-tooltip">{address}</span>
    </span>
    <a className="identity-module__source-link" href={profile.url} target="_blank" rel="noreferrer"
      aria-label="Open official Universal Profile" title="Open on Universal Everything"><IdentityActionIcon kind="source" /></a>
    <AddressQr key={address} address={address} />
    </ActionGroup>
    <span className="identity-module__copy-status" role="status">{failed ? 'Copy failed — use the full address above.' : copied ? 'Address copied' : ''}</span>
  </div>;
}

