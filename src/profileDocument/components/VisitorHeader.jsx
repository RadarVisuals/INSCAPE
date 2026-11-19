import { useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, UserRound } from 'lucide-react';
import { getOfficialProfileUrl } from '../../profileIdentity/domain/profileIdentity.js';
import { useProfileIdentity } from '../../profileIdentity/state/useProfileIdentity.js';
import { HeaderThemeButton, profileTabs, WorkspaceBrand } from '../../public/menus/WorkspaceHeader.jsx';
import AccountAvatar from '../../ui/AccountAvatar.jsx';
import { VisitorPortrait } from './VisitorProfile.jsx';
import VisitorMenu from './VisitorMenu.jsx';
import './visitorProfile.css';

function AccountMenu({ account, model, onPanel, onDisconnect }) {
  const [copyMessage, setCopyMessage] = useState('');
  const address = account.address, own = model?.address?.toLowerCase() === address.toLowerCase();
  const identity = useProfileIdentity(!account.name && !own ? address : null);
  const short = address.slice(0, 6) + '…' + address.slice(-4);
  const name = account.name || identity?.name || (own && model?.officialProfile?.name) || 'Universal Profile';
  const trigger = useRef(null);
  const copy = async () => {
    try { await navigator.clipboard.writeText(address); setCopyMessage('Address copied.'); }
    catch { setCopyMessage('Clipboard unavailable. Open Universal Profile to copy the address.'); }
  };
  return <><VisitorMenu name={name + ' account'} buttonRef={trigger} trigger={<>
    <span className="visitor-account-avatar"><AccountAvatar account={account} model={model}><UserRound size={14} /></AccountAvatar></span>
    <ChevronDown size={12} aria-hidden="true" /></>}>
    <div className="visitor-account-identity"><strong>{name}</strong><small title={address}>{short}</small></div>
    <button type="button" onClick={copy}>Copy address</button>
    <a href={getOfficialProfileUrl(address)} target="_blank" rel="noreferrer">Universal Profile</a>
    <button type="button" disabled={!onPanel} onClick={() => onPanel('settings', trigger.current)}>Settings</button>
    <button type="button" disabled={!onDisconnect} onClick={onDisconnect}>Disconnect</button>
  </VisitorMenu>
    {copyMessage && <span className="visitor-feedback" role="status" onAnimationEnd={() => setCopyMessage('')}>{copyMessage}</span>}</>;
}

export default function VisitorHeader({ model, account, works, current = works ? 'Gallery' : 'Profile',
  onProfile, onWorks, onWriting, onEdit, ownerDestinations, onDiscover, onPanel, onDisconnect, onConnect, children }) {
  const trigger = useRef(null);
  const tabList = useRef(null);
  const hasProfile = Boolean(model);
  useLayoutEffect(() => {
    const list = tabList.current, active = list?.querySelector('[aria-current="page"]');
    if (!active) return;
    const revealActiveTab = () => {
      const tab = active.getBoundingClientRect(), bounds = list.getBoundingClientRect();
      if (tab.left < bounds.left) list.scrollLeft += tab.left - bounds.left;
      else if (tab.right > bounds.right) list.scrollLeft += tab.right - bounds.right;
    };
    revealActiveTab();
    const resize = new ResizeObserver(revealActiveTab);
    resize.observe(list);
    return () => resize.disconnect();
  }, [current, hasProfile]);

  const own = Boolean(account?.address && account.address.toLowerCase() === model?.address?.toLowerCase());
  const tabs = { Profile: onProfile, Gallery: onWorks, Writing: onWriting };
  const destinations = account && { ...(own && tabs), Discover: onDiscover, ...ownerDestinations };
  const name = model?.officialProfile?.name || model?.profile?.displayName || model?.address;
  return <header className="workspace-header visitor-header">
    <div className="visitor-signature">
      <WorkspaceBrand trigger={trigger} current={own || current === 'Discover' ? current : null} onDiscover={onDiscover}
        destinations={destinations} onPanel={onPanel} />
      {model && <><span className="visitor-path-separator" aria-hidden="true">/</span>
        <button className="visitor-breadcrumb" type="button" onClick={onProfile} aria-label={'Profile of ' + name} title={name}>
          <VisitorPortrait src={model.profile?.avatarUrl} className="visitor-avatar" /><span>{name}</span>
        </button></>}
    </div>
    {model ? <nav ref={tabList} aria-label="Profile navigation" className="visitor-tabs">
      {profileTabs.map(label => <button type="button" key={label} disabled={label !== current && !tabs[label]}
        aria-current={label === current ? 'page' : undefined} onClick={tabs[label]}>{label}</button>)}
    </nav> : children}
    <div className="visitor-tools">
      {own && onEdit && <button className="visitor-edit" type="button" onClick={onEdit}>Studio</button>}
      <HeaderThemeButton />
      {account?.address ? <AccountMenu key={account.address} {...{ account, model, onPanel, onDisconnect }} />
        : onConnect && <button className="visitor-connect" type="button" onClick={onConnect}>Sign in</button>}
    </div>
  </header>;
}
