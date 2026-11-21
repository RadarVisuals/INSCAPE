import { useEffect, useState } from 'react';
import { ArrowUpRight, UserRound } from 'lucide-react';
import LibraryArtworkImage from '../public/ownerSystemWorkflow/LibraryArtworkImage.jsx';
import { ProfileSection, LinksSection } from '../public/identity/IdentityProfileContent.jsx';
import './receptionProfile.css';

export default function ReceptionProfile({ model }) {
  const official = model?.officialProfile || {}, authored = model?.authoredProfile || {};
  const portrait = model?.profile?.avatarUrl || official.avatarUrl;
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [portrait]);
  const status = model?.status?.metadata;
  return <div className="reception-profile" aria-label="Profile introduction">
    <div className="reception-profile-avatar">
      {portrait && !failed ? <LibraryArtworkImage key={portrait} src={portrait} alt="" draggable={false} onError={() => setFailed(true)} /> : <UserRound aria-hidden="true" />}
    </div>
    <div className="reception-profile-story">
      {authored.title && <p className="reception-profile-title">{authored.title}</p>}
      <h1>{official.name || model?.profile?.displayName || 'Universal Profile'}</h1>
      <ProfileSection profile={{ tags: [...new Set([...(official.tags || []), ...(authored.tags || [])])] }} />
      <div className="reception-profile-socials">
        <LinksSection links={(model?.links || []).filter(link => !['inscape-profile', 'universal-everything', 'explorer'].includes(link.id))} />
        {official.url && <a className="reception-profile-source" href={official.url} target="_blank" rel="noreferrer"
          title={model.address}>Universal Profile<ArrowUpRight aria-hidden="true" size={12} /></a>}
      </div>
      {['IDLE', 'LOADING'].includes(status) && <small role="status">Loading profile details…</small>}
      {['ERROR', 'UNAVAILABLE'].includes(status) && <small role="status">Profile details are currently unavailable.</small>}
    </div>
  </div>;
}
