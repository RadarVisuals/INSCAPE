import { useState } from 'react';
import { useProfileIdentity } from '../profileIdentity/state/useProfileIdentity.js';
import LibraryArtworkImage from '../public/ownerSystemWorkflow/LibraryArtworkImage.jsx';

export default function AccountAvatar({ account, model, children }) {
  const [failed, setFailed] = useState([]);
  const identity = useProfileIdentity(account?.avatarUrl && !failed.includes(account.avatarUrl) ? null : account?.address);
  const ownProfile = account?.address && account.address.toLowerCase() === model?.address?.toLowerCase();
  const sources = [account?.avatarUrl, identity?.avatarUrl, ownProfile && model.officialProfile?.avatarUrl];
  const src = sources.find(url => url && !failed.includes(url));
  if (!src) return children;
  return <LibraryArtworkImage key={src} src={src} alt="" onError={() =>
    setFailed(previous => previous.includes(src) ? previous : [...previous, src])} />;
}
