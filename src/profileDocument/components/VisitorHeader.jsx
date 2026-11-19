import { useState } from 'react';
import { ChevronDown, Moon, Settings, Sun } from 'lucide-react';
import { interfaceTheme, useInterfaceTheme } from '../../interfaceTheme.js';
import { VisitorPortrait } from './VisitorProfile.jsx';
import VisitorMenu from './VisitorMenu.jsx';

export default function VisitorHeader({ model, account, works, onProfile, onWorks, onBento, ownerDestinations,
  onDiscover, onReturn, onConnect }) {
  const { mode, error } = useInterfaceTheme();
  const [copyMessage, setCopyMessage] = useState('');
  const name = model.officialProfile.name;
  const accountName = account?.name || (account?.address ? account.address.slice(0, 6) + '…' + account.address.slice(-4) : '');
  const initials = accountName.trim().split(/\s+/u).slice(0, 2).map(word => word[0]).join('');
  async function copyAddress() {
    try { await navigator.clipboard.writeText(model.address); setCopyMessage('Address copied.'); }
    catch { setCopyMessage('Clipboard unavailable. Open Universal Profile to copy the address.'); }
  }
  return <header className="visitor-header">
    <div className="visitor-signature"><VisitorMenu key={model.address} name={name + ' profile actions'} trigger={<>
      <VisitorPortrait src={model.profile.avatarUrl} className="visitor-avatar" /><span>{name}</span><ChevronDown size={13} /></>}>
      <button type="button" onClick={copyAddress}>Copy address</button>
      <a href={model.officialProfile.url} target="_blank" rel="noreferrer">Universal Profile</a>
      {onBento && <button type="button" onClick={onBento}>View published Bento</button>}
      {model.card.fields.length > 0 && <dl className="visitor-facts">{model.card.fields.map(field => <div key={field.id}>
        <dt>{field.label}</dt><dd>{field.type === 'list' ? field.value.join(' · ') : field.value}</dd>
      </div>)}</dl>}
    </VisitorMenu></div>
    <nav aria-label="Profile navigation" className="visitor-tabs">
      <button type="button" aria-current={!works ? 'page' : undefined} onClick={onProfile}>Profile</button>
      <button type="button" aria-current={works ? 'page' : undefined} onClick={onWorks}>Works</button>
      <button type="button" disabled title="Writing is not available in this preview">Writing</button>
      <button type="button" disabled title="Gallery is not available in this preview">Gallery</button>
    </nav>
    <div className="visitor-tools">
      {account ? <VisitorMenu name={accountName + ' account'} trigger={<><span className="visitor-account-avatar">{initials}</span>
        <span>{accountName}</span><ChevronDown size={12} /></>}>
        {Object.entries(ownerDestinations || {}).filter(([, go]) => go).map(([label, go]) =>
          <button key={label} type="button" onClick={go}>{label}</button>)}
        {onReturn && !ownerDestinations && <button type="button" onClick={onReturn}>Return to my Inscape</button>}
      </VisitorMenu> : onConnect && <button className="visitor-connect" type="button" onClick={onConnect}>Connect profile</button>}
      <span className="visitor-wordmark" role="img" aria-label="Inscape" />
      <button className="visitor-theme" type="button" role="switch" aria-label="Dark mode" aria-checked={mode === 'dark'}
        onClick={() => interfaceTheme.setMode(mode === 'dark' ? 'light' : 'dark')}><Sun /><i aria-hidden="true" /><Moon /></button>
      <VisitorMenu name="Settings" trigger={<Settings size={19} />}>
        <button type="button" onClick={() => interfaceTheme.setMode(mode === 'dark' ? 'light' : 'dark')}>{mode === 'dark' ? 'Light' : 'Dark'} appearance</button>
        {onDiscover && <button type="button" onClick={onDiscover}>Discover</button>}
      </VisitorMenu>
    </div>
    {copyMessage && <span className="visitor-feedback" role="status" onAnimationEnd={() => setCopyMessage('')}>{copyMessage}</span>}
    {error && <span className="visitor-notice" role="alert">{error}</span>}
  </header>;
}
