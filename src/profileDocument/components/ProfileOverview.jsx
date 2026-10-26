import { lazy, Suspense, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, UserRound } from 'lucide-react';
import { useProfileIdentity } from '../../profileIdentity/state/useProfileIdentity.js';
import { createPublishedIdentityRackViewModel } from './publishedIdentityRackViewModel.js';
import { useStartupDestinationReady } from '../../startveil/StartupDestinationContext.jsx';
import IdentityPortrait from '../../public/identity/IdentityPortrait.jsx';
import '../../public/ownerSystemWorkflow/workflowTactile.css';
import '../../public/ownerSystemWorkflow/ownerSystemWorkflow.css';
import '../../public/ownerSystemWorkflow/workflowFlat.css';
import '../../lattice/rendering/latticeMenuSurface.css';
import './profileOverview.css';
const ExplorationKeeper = lazy(() => import('../../keeper/ExplorationKeeper.jsx'));

// Only verified public identity is read here. Temporary room navigation owns no draft.
export default function ProfileOverview({ document: publication, ownerEditingAllowed = false, unavailableTarget = false, onOpenDirectory, onReturn, onOpenCanvas }) {
  useStartupDestinationReady();
  const identity = useProfileIdentity(publication.profile.address);
  const model = useMemo(() => createPublishedIdentityRackViewModel({ document: publication, identity }), [publication, identity]);
  const [exploring, setExploring] = useState(false);
  const explore = useRef(null), roomTitle = useRef(null), flightArea = useRef(null), previous = useRef(false);
  useLayoutEffect(() => {
    if (exploring) roomTitle.current?.focus({ preventScroll: true });
    else if (previous.current) explore.current?.focus({ preventScroll: true });
    previous.current = exploring;
  }, [exploring]);
  const profile = model?.profile || { displayName: publication.profile.cachedIdentity.name || 'Unnamed profile', avatarUrl: publication.profile.cachedIdentity.avatarUrl, description: '', tags: [] };
  const official = model?.officialProfile, fields = model?.card?.fields || [], links = model?.links || [], name = profile.displayName;
  return <main className="profile-overview system-workflow__token-scope" data-menu-surface={publication.appearance.menuSurfaceId}
    data-lattice-menu-surface data-workflow-material="tactile" data-workflow-finish="flat"
    data-published-focus-fallback tabIndex={-1} aria-label={`${name} reception`}
    onKeyDown={event => { if (event.key === 'Escape' && !event.defaultPrevented && exploring) { event.preventDefault(); setExploring(false); } }}>
    <div className="profile-overview__inner">
      <header className="reception-heading"><span>INSCAPE</span><span>{name}</span>
        {onOpenDirectory && <button type="button" onClick={onOpenDirectory}>Discover</button>}
        {onReturn && <button type="button" onClick={onReturn}>Back to my Inscape</button>}
      </header>
      {exploring ? <section className="exploration-room" aria-label="Exploration room">
        <header><button type="button" onClick={() => setExploring(false)}><ArrowLeft aria-hidden="true" />Back to Reception</button><span>01 / EXPLORATION</span></header>
        <div className="exploration-room__canvas" ref={flightArea}><div className="exploration-room__origin">
          <span className="reception-kicker">{name}</span><h1 ref={roomTitle} tabIndex={-1}>A space to explore.</h1><p>The world starts here.</p>
          <span className="exploration-room__marker" aria-hidden="true" />
        </div>
          {ownerEditingAllowed && <Suspense fallback={<p role="status">Opening Keeper dock…</p>}>
            <ExplorationKeeper profileAddress={publication.profile.address} flightAreaRef={flightArea} menuSurface={publication.appearance.menuSurfaceId} onReturn={() => setExploring(false)} />
          </Suspense>}
        </div>
        <footer>{ownerEditingAllowed ? '2800 × 1800 · Camera follows Keeper · Metal beams only · Direct recall.' : 'Exploration wireframe · The profile owner can configure a Keeper here.'}</footer>
      </section> : <>
        {unavailableTarget && <p className="reception-notice" role="status">That destination is no longer in this publication.</p>}
        <section className="reception-bento" aria-label="Reception wireframe">
          <article className="reception-bento__identity"><span className="reception-kicker">IDENTITY / PERSONA</span><h1>{name}</h1>
            <div className="reception-portrait">{profile.avatarUrl ? <IdentityPortrait src={profile.avatarUrl} title={`${name} portrait`} /> : <UserRound aria-hidden="true" />}</div>
            <a className="reception-official" href={official?.url || `https://universaleverything.io/${publication.profile.address}`} target="_blank" rel="noreferrer">Official profile · {official?.name || publication.profile.cachedIdentity.name || 'Universal Profile'} ↗</a>
            <span className="reception-address">{publication.profile.address}</span>
          </article>
          <section className="reception-bento__links" aria-label="Profile links"><span className="reception-kicker">LINKS</span>
            {links.length ? <ul>{links.map((link, i) => <li key={link.id || i}><a href={link.url} target="_blank" rel="noreferrer">{link.title || link.label || 'Website'} ↗</a></li>)}</ul> : <p>Your links belong here.</p>}
          </section>
          <section className="reception-bento__bio"><span className="reception-kicker">INTRODUCTION</span><h2>A little about {name}.</h2>
            <p>{profile.description || 'A place for your story, your practice and what you stand for.'}</p>
            {profile.tags?.length > 0 && <ul className="reception-tags">{profile.tags.map(tag => <li key={tag}>{tag}</li>)}</ul>}
          </section>
          <section className="reception-bento__details"><span className="reception-kicker">DETAILS</span>
            {fields.length ? <dl>{fields.map(field => <div key={field.id}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl> : <><h2>Make it yours.</h2><p>Interests, craft, location — or something else entirely.</p></>}
          </section>
          <section className="reception-bento__space"><span className="reception-kicker">YOUR SPACE</span><p>Room for your own introduction.</p></section>
          <button className="reception-explore" type="button" ref={explore} onClick={() => setExploring(true)}><span>Explore<span className="reception-explore__caption">Step into the exploration room</span></span><ArrowRight aria-hidden="true" /></button>
        </section>
        <footer className="reception-entry"><button type="button" onClick={() => onOpenCanvas()} disabled={!onOpenCanvas} aria-describedby="reception-entry-status"><ArrowDown aria-hidden="true" />Enter Inscape</button>
          <p id="reception-entry-status">Explore published canvases</p><span>Reception wireframe · Bento customization comes later.</span>
        </footer>
      </>}
    </div>
  </main>;
}
