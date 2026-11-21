import { UserRound } from 'lucide-react';
import { resolvePublishedAssetUrl } from '../profileDocument/domain/publishedAssetUrl.js';
import ReceptionProfile from './ReceptionProfile.jsx';
import ReceptionAtmosphere from './ReceptionAtmosphere.jsx';

export default function ReceptionHeader({ reception, model, previewControls, children }) {
  if (reception.version === 3) return <header className="reception-window-header" data-profile-header data-preview-controls={previewControls ? true : undefined}>
    <ReceptionAtmosphere reception={reception} />
    <div className="reception-profile-header-content">
    <ReceptionProfile key={model?.address} model={model} />
    {previewControls}
    {children && <div className="reception-window-actions workbench-tool-controls" data-window-chrome="flat">{children}</div>}
    </div>
  </header>;
  const logo = reception.imageModules.find(item => item.id === reception.branding.logo)?.artwork?.asset.media.url || model?.profile?.avatarUrl;
  const name = reception.branding.name || model?.profile?.displayName || 'Inscape';
  return <header className="reception-window-header" data-brand-header>
    <a className="reception-brand" title={`Official Universal Profile · ${model?.officialProfile?.name || name}`}
      href={model?.officialProfile?.url} target="_blank" rel="noreferrer">
      {logo ? <img alt="" src={resolvePublishedAssetUrl(logo)} /> : <UserRound aria-hidden="true" />}<span>{name}</span>
    </a>
    <div className="reception-window-actions workbench-tool-controls" data-window-chrome="flat">{children}</div>
  </header>;
}
