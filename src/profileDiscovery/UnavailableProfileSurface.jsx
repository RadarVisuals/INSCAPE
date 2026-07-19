import { useState } from 'react';
import ProfileDiscovery from './ProfileDiscovery.jsx';
import ProfilePreview from './ProfilePreview.jsx';

export default function UnavailableProfileSurface({
  viewedProfileAddress,
  connectedProfileAddress,
  connectedVisitorProfileAddress,
  onVisitProfile
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  return <main className="public-shell" aria-label="Unavailable public profile canvas">
    <ProfilePreview
      viewedProfileAddress={viewedProfileAddress}
      connectedProfileAddress={connectedProfileAddress}
      connectedVisitorProfileAddress={connectedVisitorProfileAddress}
      onSearch={() => setSearchOpen(true)}
      onReturn={() => onVisitProfile?.(connectedProfileAddress)}
    />
    {searchOpen && <ProfileDiscovery
      onClose={() => setSearchOpen(false)}
      onSelect={(result) => { onVisitProfile?.(result.address); setSearchOpen(false); }}
    />}
  </main>;
}
