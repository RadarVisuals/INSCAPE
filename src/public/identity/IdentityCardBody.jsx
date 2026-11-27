import { BadgeCheck, ChevronDown, UserRound } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import IdentityPortrait from './IdentityPortrait.jsx';
import { ProfileSection, LinksSection } from './IdentityProfileContent.jsx';
import { IdentityFields, IdentityProfileEditor } from './IdentityCardSettings.jsx';
// The Identity window owns its expansion and explicit authoring controls.
// Composition reuses ProfileSection and LinksSection without this window shell.
export default function IdentityCardBody({ model, card, portraitUrl, portraitRef, interactive = true,
  expanded, onExpandedChange, expansionControls, edit = null, children }) {
  const extensionId = useId();
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [portraitUrl]);
  const official = model.officialProfile || { name: model.profile.displayName, description: model.profile.description, tags: model.profile.tags };
  const authored = model.authoredProfile;
  const designation = model.designation && <span className="identity-module__designation" title={model.designation.title}
    aria-label={model.designation.title}><BadgeCheck aria-hidden="true" />{model.designation.label}</span>;
  return <div className="identity-module__card">
    <div className="identity-module__intro">
      <div className="identity-module__portrait" ref={portraitRef} aria-label="Identity artwork">
        {portraitUrl && !imageFailed ? <IdentityPortrait key={model.address + ':' + portraitUrl} src={portraitUrl}
          interactive={interactive} title={official.name + ' — Identity artwork'} onError={() => setImageFailed(true)} /> : <UserRound />}
        {imageFailed && <span className="identity-module__drop-hint">Artwork unavailable</span>}
      </div>
      <div className="identity-module__story">
        {edit ? <IdentityProfileEditor edit={edit} official={official}>{designation}</IdentityProfileEditor> : <>
          {authored?.title && <p className="identity-module__custom-title">{authored.title}</p>}
          <h2>{official.name}</h2>{designation}
          <ProfileSection profile={{ ...official, description: authored?.description || official.description,
            tags: [...new Set([...(official.tags || []), ...(authored?.tags || [])])] }} />
        </>}
        <LinksSection links={model.links.filter(link => !['inscape-profile', 'universal-everything', 'explorer'].includes(link.id))} />
      </div>
      {expansionControls === undefined ? <button className="identity-module__expand" type="button" aria-expanded={expanded} aria-controls={extensionId}
        aria-label={expanded ? 'Collapse INSCAPE details' : 'Expand INSCAPE details'} onClick={() => onExpandedChange(!expanded)}>
        <ChevronDown aria-hidden="true" />
      </button> : expansionControls}
    </div>
    <div id={extensionId} className="identity-module__extension" hidden={!expanded}>
      <IdentityFields card={card} edit={edit} />{children}
    </div>
  </div>;
}
