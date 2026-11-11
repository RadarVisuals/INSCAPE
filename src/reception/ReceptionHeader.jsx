import { UserRound } from 'lucide-react';
import WorkspaceSwitcher from '../public/menus/WorkspaceSwitcher.jsx';
import { resolvePublishedAssetUrl } from '../profileDocument/domain/publishedAssetUrl.js';

export default function ReceptionHeader({ reception, model, destinations, children }) {
  const logo = reception.imageModules.find(item => item.id === reception.branding.logo)?.artwork?.asset.media.url || model?.profile?.avatarUrl;
  const name = reception.branding.name || model?.profile?.displayName || 'Inscape';
  return <header className="reception-window-header">
    <a className="reception-brand" title={`Official Universal Profile · ${model?.officialProfile?.name || name}`}
      href={model?.officialProfile?.url} target="_blank" rel="noreferrer">
      {logo ? <img alt="" src={resolvePublishedAssetUrl(logo)} /> : <UserRound aria-hidden="true" />}<span>{name}</span>
    </a>
    <nav className="reception-navigation" aria-label="Reception navigation">
      <WorkspaceSwitcher current="Reception" destinations={destinations} />
    </nav>
    <div className="reception-window-actions workbench-tool-controls" data-window-chrome="flat">{children}</div>
  </header>;
}
