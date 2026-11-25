import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Check, ChevronDown, Copy, ExternalLink, Gift, LogOut, QrCode, Settings, UserRound } from 'lucide-react';
import { getOfficialProfileUrl } from '../../profileIdentity/domain/profileIdentity.js';
import { useProfileIdentity } from '../../profileIdentity/state/useProfileIdentity.js';
import AccountAvatar from '../../ui/AccountAvatar.jsx';
import { VisitorPortrait } from './VisitorProfile.jsx';
import './profileStrip.css';

export default function ProfileStrip({ address, account, model, accountStrip, onPanel, onDisconnect, onProfile }) {
  const id = useId(), trigger = useRef(null), drawer = useRef(null), back = useRef(null);
  const [open, setOpen] = useState(false), [view, setView] = useState('details');
  const [qr, setQr] = useState(null), [message, setMessage] = useState('');
  const [amount, setAmount] = useState(''), [sending, setSending] = useState(false);
  const pending = useRef(false), addressField = useRef(null);
  const own = account?.address?.toLowerCase() === address.toLowerCase();
  const canTip = Boolean(account?.address && !own);
  const matching = model?.address?.toLowerCase() === address.toLowerCase() ? model : null;
  const identity = useProfileIdentity(!matching && (open || !account?.name) ? address : null);
  const official = matching?.officialProfile || identity;
  const name = (accountStrip && account.name) || official?.name || matching?.profile?.displayName || address.slice(0, 6) + '…' + address.slice(-4);
  const links = matching ? matching.links?.filter(link => link.kind === 'AUTHORED') : identity?.links;
  const shortAddress = address.slice(0, 6) + '\u2026' + address.slice(-4);
  const profileUrl = getOfficialProfileUrl(address);
  const close = () => drawer.current?.hidePopover();
  useEffect(() => {
    const panel = drawer.current;
    const toggle = () => {
      const shown = panel.matches(':popover-open');
      setOpen(shown);
      if (!shown) { setView('details'); setMessage(''); }
    };
    panel.addEventListener('toggle', toggle);
    return () => panel.removeEventListener('toggle', toggle);
  }, []);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = trigger.current.getBoundingClientRect(), panel = drawer.current;
      panel.style.left = Math.max(8, Math.min(accountStrip ? rect.right - panel.offsetWidth : rect.left, document.documentElement.clientWidth - panel.offsetWidth - 8)) + 'px';
      panel.style.top = (rect.bottom + 4) + 'px';
      panel.style.maxHeight = Math.max(40, innerHeight - rect.bottom - 16) + 'px';
    };
    place(); window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open, accountStrip]);
  useEffect(() => {
    if (view !== 'qr') return;
    let live = true;
    import('../../public/identity/addressQr.js').then(({ createAddressQrImage }) => {
      if (live) setQr(createAddressQrImage(address));
    }).catch(() => { if (live) setMessage('Could not load QR code.'); });
    return () => { live = false; };
  }, [view, address]);
  useEffect(() => { if (view === 'address') { addressField.current?.focus(); addressField.current?.select(); }
    else if (view !== 'details') back.current?.focus(); }, [view]);
  const change = next => { setMessage(''); setView(next); };
  const returnToDetails = () => {
    const previous = view; change('details');
    requestAnimationFrame(() => drawer.current?.querySelector('[data-view="' + previous + '"]')?.focus());
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(address); setMessage('Address copied.'); }
    catch { change('address'); setMessage('Select and copy this address.'); }
  };
  const tip = async event => {
    event.preventDefault();
    if (!canTip || pending.current) return;
    pending.current = true; setSending(true); setMessage('');
    try {
      const { requestProfileTip } = await import('./requestProfileTip.js');
      await requestProfileTip(account.address, address, amount.trim());
      setAmount(''); setMessage('Tip submitted to the network.');
    } catch (error) { setMessage(error.shortMessage || error.message || 'Wallet request failed.'); }
    finally { pending.current = false; setSending(false); }
  };
  return <div className="profile-strip" data-account={accountStrip || undefined}>
    <button className={'strip-trigger ' + (accountStrip ? 'strip-account' : 'visitor-breadcrumb')} ref={trigger} type="button"
      popovertarget={id} aria-expanded={open} aria-label={accountStrip ? name + ' account' : 'Profile of ' + name} title={name}>
      {accountStrip ? <span className="visitor-account-avatar"><AccountAvatar account={account} model={matching}><UserRound size={14} /></AccountAvatar></span>
        : <VisitorPortrait src={matching?.profile?.avatarUrl || official?.avatarUrl} className="visitor-avatar" />}
      {!accountStrip && <span className="strip-name">{name}</span>}<ChevronDown size={11} aria-hidden="true" />
    </button>
    <section className="strip-drawer system-workflow__token-scope" data-workflow-material="tactile" data-workflow-finish="flat" data-workflow-palette="editor" id={id} ref={drawer} popover="auto" aria-label={name + ' profile details'}>
      {view === 'details' ? <>
        {accountStrip && <strong>{name}</strong>}
        <div className="strip-identity-row">
          <div><small>UP address</small><code title={address}>{shortAddress}</code></div>
          <button type="button" onClick={copy} data-view="address" aria-label="Copy address" title="Copy address">{message === 'Address copied.' ? <Check size={15} /> : <Copy size={15} />}</button>
          <button type="button" data-view="qr" onClick={() => change('qr')} aria-label="QR code" title="QR code"><QrCode size={16} /></button>
        </div>
        <div className="strip-actions">
          {onProfile && <button type="button" onClick={() => { close(); onProfile(); }}><UserRound size={15} />{accountStrip ? 'My profile' : 'View profile'}</button>}
          <a href={profileUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} />{own ? 'Universal Profile' : 'Follow on UP'}</a>
          {canTip && <button type="button" data-view="tip" onClick={() => change('tip')}><Gift size={15} />Tip LYX</button>}
          {accountStrip && <><button disabled={!onPanel} onClick={() => { close(); onPanel('settings', trigger.current); }}><Settings size={15} />Settings</button>
            <button disabled={!onDisconnect} onClick={() => { close(); onDisconnect(); }}><LogOut size={15} />Disconnect</button></>}
        </div>
        {links?.length > 0 && <details className="strip-links"><summary>Links</summary><nav aria-label="Official profile links">{links.map(link =>
          <a key={link.id} href={link.url} target="_blank" rel="noreferrer">{link.label}<ArrowUpRight size={12} /></a>)}</nav></details>}
      </> : <>
        <header><button ref={back} type="button" onClick={returnToDetails}><ArrowLeft size={14} /> Back</button><strong>{view === 'qr' ? 'Address QR' : view === 'address' ? 'UP address' : 'Tip ' + name}</strong></header>
        {view === 'qr' ? <div className="strip-qr">{qr ? <img src={qr} alt={'QR code for ' + name + '’s UP address'} /> : <span>Loading QR…</span>}<code title={address}>{shortAddress}</code></div>
          : view === 'address' ? <input ref={addressField} readOnly aria-label="Full UP address" value={address} />
          : canTip && <form onSubmit={tip}><code>{address}</code><label>Amount in LYX<input required inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} /></label>
            <button disabled={sending}>{sending ? 'Waiting for wallet…' : 'Review in wallet'}</button>
          </form>}
      </>}
      {message && <p role="status">{message}</p>}
    </section>
  </div>;
}
