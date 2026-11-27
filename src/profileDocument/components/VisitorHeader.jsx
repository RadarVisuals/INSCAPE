import { useLayoutEffect, useRef } from 'react';
import { Settings } from 'lucide-react';
import { HeaderThemeButton, StudioHeaderTools, profileTabs, WorkspaceBrand } from '../../public/menus/WorkspaceHeader.jsx';
import ProfileStrip from './ProfileStrip.jsx';
import './visitorProfile.css';

export default function VisitorHeader({ model, account, works, current = works ? 'Gallery' : 'Profile',
  toolbarRef, onProfile, onWorks, onWriting, ownerDestinations, onPanel, onDisconnect, onConnect }) {
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
  const destinations = account && { ...(own && tabs), ...ownerDestinations };
  const accountMenu = account?.address && <ProfileStrip key={account.address} address={account.address} accountStrip onProfile={ownerDestinations?.Profile} {...{ account, model, onPanel, onDisconnect }} />;
  return <header className="workspace-header visitor-header">
    <div className="visitor-navigation">
    <div className="visitor-signature">
      <WorkspaceBrand trigger={trigger} current={own ? current : null}
        destinations={destinations} onPanel={onPanel} />
      {!own && model?.address && <ProfileStrip key={model.address} address={model.address} {...{ account, model, onProfile }} />}
    </div>
    {model ? <nav ref={tabList} aria-label="Profile navigation" className="visitor-tabs">
      {profileTabs.map(label => <button type="button" key={label} disabled={label !== current && !tabs[label]}
        aria-current={label === current ? 'page' : undefined} onClick={tabs[label]}>{label}{label === current && <span aria-hidden="true" className="visitor-tab-line" />}</button>)}
    </nav> : null}
    </div>
    {toolbarRef && <div className="visitor-toolbar-slot" ref={toolbarRef} />}
    <div className="visitor-tools">
      {own && ownerDestinations?.Studio ? <StudioHeaderTools onStudio={ownerDestinations.Studio}>{accountMenu}</StudioHeaderTools> : <><HeaderThemeButton />
      {!account?.address && onPanel && <button className="workspace-theme-button" type="button" aria-label="Settings" title="Settings"
        onClick={event => onPanel('settings', event.currentTarget)}><Settings size={16} aria-hidden="true" /></button>}
      {accountMenu || (onConnect && <button className="visitor-connect" type="button" onClick={onConnect}>Sign in</button>)}</>}
    </div>
  </header>;
}
