import { useEffect, useRef } from 'react';
import { useProfileIdentity } from '../profileIdentity/index.js';
import { getIdentityProfileViewModel } from '../public/identity/profileViewModel.js';

export default function ProfilePreview({ viewedProfileAddress, connectedProfileAddress, connectedVisitorProfileAddress, onSearch, onReturn }) {
  const identity = useProfileIdentity(viewedProfileAddress); const profile = getIdentityProfileViewModel(identity, { walletConnected: false });
  const rootRef = useRef(null); const returnRef = useRef(null); const previousFocusRef = useRef(document.activeElement);
  useEffect(() => { returnRef.current?.focus(); return () => previousFocusRef.current?.focus?.(); }, []);
  const onKeyDown = (event) => {
    if (event.key === 'Escape') { event.preventDefault(); onReturn(); return; }
    if (event.key !== 'Tab') return;
    const focusable = [...rootRef.current.querySelectorAll('button:not(:disabled),a[href]')]; if (!focusable.length) return;
    const edge = event.shiftKey ? focusable[0] : focusable.at(-1);
    if (document.activeElement === edge) { event.preventDefault(); (event.shiftKey ? focusable.at(-1) : focusable[0]).focus(); }
  };
  return <div ref={rootRef} className="profile-preview" role="dialog" aria-modal="true" aria-labelledby="profile-preview-title" onKeyDown={onKeyDown}><article className="profile-preview__card">
    <header><p>Read-only profile preview</p><button ref={returnRef} type="button" onClick={onReturn} aria-label="Return to connected profile">×</button></header>
    <section className="profile-preview__identity"><span className="profile-discovery__avatar">{profile.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : <span aria-hidden="true">UP</span>}</span>
      <div><h2 id="profile-preview-title">{profile.name}</h2><code>{viewedProfileAddress}</code><small>{profile.metadataStatusLabel} · LUKSO RPC + LSP3</small></div></section>
    <p className="profile-preview__notice">This profile’s OS_UNDERNEATH world is not published here yet. Library, Activity, Creations, and authored presentation remain sealed to avoid showing or changing the connected profile’s private workspace.</p>
    <dl><div><dt>Profile being visited</dt><dd>{viewedProfileAddress}</dd></div><div><dt>Connected visitor</dt><dd>{connectedVisitorProfileAddress || 'No Universal Profile connected'}</dd></div><div><dt>Authored workspace owner</dt><dd>{connectedProfileAddress}</dd></div><div><dt>Permission</dt><dd>Public metadata only · no authoring</dd></div></dl>
    <footer><button type="button" onClick={onSearch}>[ Search profiles ]</button><button type="button" onClick={onReturn}>[ Return to connected profile ]</button></footer>
  </article></div>;
}
