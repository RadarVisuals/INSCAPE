import { UserRound, Sun, Moon } from 'lucide-react';
import { resolvePublishedAssetUrl } from '../profileDocument/domain/publishedAssetUrl.js';
export default function ReceptionNavigation({ reception, model, theme, onTheme, onAbout, onCanvases, onDiscover, onEdit, onEditBrand }) {
  const logo = reception.imageModules.find(i => i.id === reception.branding.logo)?.sides[0]?.asset.media.url || model?.profile?.avatarUrl;
  const name = reception.branding.name || model?.profile?.displayName || 'Inscape';
  const identity = <>{logo ? <img alt="" src={resolvePublishedAssetUrl(logo)} /> : <UserRound aria-hidden="true" />}<span>{name}</span></>;
  return <nav className="reception-navigation" aria-label="Reception navigation">{onEditBrand
    ? <button type="button" className="reception-brand" aria-label="Edit name and logo" title="Edit name and logo" onClick={onEditBrand}>{identity}</button>
    : <a className="reception-brand" title={`Official Universal Profile · ${model?.officialProfile?.name || name}`} href={model?.officialProfile?.url} target="_blank" rel="noreferrer">{identity}</a>}
    <button type="button" aria-current="page" onClick={onAbout}>About</button>
    {onCanvases && <button type="button" onClick={onCanvases}>Canvases</button>}
    {onDiscover && <button type="button" onClick={onDiscover}>Discover</button>}
    <button type="button" aria-label={theme === 'carbon' ? 'Use light appearance' : 'Use dark appearance'} onClick={() => onTheme(theme === 'carbon' ? 'mist' : 'carbon')}>{theme === 'carbon' ? <Sun size={16} /> : <Moon size={16} />}</button>
    {onEdit && <button type="button" onClick={onEdit}>Edit Reception</button>}
  </nav>;
}
