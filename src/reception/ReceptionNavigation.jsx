import { UserRound, Sun, Moon } from 'lucide-react';
import { resolvePublishedAssetUrl } from '../profileDocument/domain/publishedAssetUrl.js';
export default function ReceptionNavigation({ reception, model, theme, onTheme, onCanvases, onDiscover, onReturn, returnLabel = 'Back to my Inscape', onEdit }) {
  const logo = reception.imageModules.find(i => i.id === reception.branding.logo)?.sides[0]?.asset.media.url;
  const name = reception.branding.name || model?.profile?.displayName || 'Inscape';
  return <><a className="reception-brand" title={`Official Universal Profile · ${model?.officialProfile?.name || name}`} href={model?.officialProfile?.url} target="_blank" rel="noreferrer">{logo ? <img alt="" src={resolvePublishedAssetUrl(logo)} /> : <UserRound aria-hidden="true" />}<span>{name}</span></a>
    <button type="button" aria-current="page">About</button>
    {onCanvases && <button type="button" onClick={onCanvases}>Canvases</button>}
    {onDiscover && <button type="button" onClick={onDiscover}>Discover</button>}
    <button type="button" aria-label={theme === 'carbon' ? 'Use light appearance' : 'Use dark appearance'} onClick={() => onTheme(theme === 'carbon' ? 'mist' : 'carbon')}>{theme === 'carbon' ? <Sun size={16} /> : <Moon size={16} />}</button>
    {onEdit && <button type="button" onClick={onEdit}>Edit Reception</button>}
    {onReturn && <button type="button" onClick={onReturn}>{returnLabel}</button>}
  </>;
}
