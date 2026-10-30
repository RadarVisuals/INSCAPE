import { UserRound } from 'lucide-react';
import { resolvePublishedAssetUrl } from '../profileDocument/domain/publishedAssetUrl.js';
import './receptionSettings.css';

export function ReceptionBrandSettings({ value, model, onSave }) {
  const profileName = model?.profile?.displayName || 'Inscape';
  const portrait = model?.profile?.avatarUrl;
  const change = patch => onSave({ ...value, branding: { ...value.branding, ...patch } }, 'Edit Reception header');
  return <>
    <label className="reception-field">Name<input key={value.branding.name} aria-label="Header name" defaultValue={value.branding.name}
      placeholder={profileName} maxLength={64} onBlur={event => {
        const name = event.currentTarget.value.trim();
        if (name !== value.branding.name) change({ name });
      }} onKeyDown={event => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') { event.stopPropagation(); event.currentTarget.value = value.branding.name; event.currentTarget.blur(); }
      }} /></label>
    <p>Leave the name empty to use {profileName}.</p>
    <fieldset className="reception-choices"><legend>Logo</legend>
      <div className="reception-logo-options">
        <button type="button" className="reception-logo-option" aria-pressed={!value.branding.logo} onClick={() => change({ logo: null })}>
          <span className="reception-logo-preview">{portrait ? <img alt="" src={resolvePublishedAssetUrl(portrait)} /> : <UserRound aria-hidden="true" />}</span>
          <span>Profile portrait</span>
        </button>
        {value.imageModules.map(record => <button key={record.id} type="button" className="reception-logo-option"
          aria-pressed={value.branding.logo === record.id} onClick={() => change({ logo: record.id })}>
          <span className="reception-logo-preview"><img alt="" src={resolvePublishedAssetUrl(record.sides[0]?.asset.media.url)} /></span><span>{record.name || 'Untitled image'}</span>
        </button>)}
      </div>
    </fieldset>
    {!value.imageModules.length && <p>Add an image from Library to use it as your logo.</p>}
  </>;
}
