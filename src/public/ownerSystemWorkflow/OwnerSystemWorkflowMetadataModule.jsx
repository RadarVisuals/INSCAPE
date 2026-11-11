import { ExternalLink, UserRound } from 'lucide-react';
import { normalizeProfileAddress } from '../../library/config.js';
import { useProfileIdentity } from '../../profileIdentity/index.js';
import './artworkInfo.css';

const compact = (value) => value?.length > 18 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;

export function MetadataCreator({ creator }) {
  const address = normalizeProfileAddress(creator?.address);
  const identity = useProfileIdentity(address);
  const resolved = identity?.status === 'RESOLVED' && identity.isUniversalProfile;
  const name = resolved && identity.name || creator?.name || compact(address) || 'Unknown creator';
  const href = address ? resolved ? `https://universaleverything.io/${address}`
    : `https://explorer.lukso.network/address/${address}` : null;
  const body = <><i>{resolved && identity.avatarUrl ? <img alt="" src={identity.avatarUrl} /> : <UserRound />}</i>
    <span><strong>{name}</strong>{address && <small>{compact(address)}</small>}</span>{href && <ExternalLink />}</>;
  return href ? <a aria-label={`Open creator ${name}`} href={href} rel="noreferrer" target="_blank">{body}</a> : <div>{body}</div>;
}
// Read-only presentation shared by the dock, detached Info and Visitor host.
export function OwnerSystemWorkflowMetadataContent({ dossier }) {
  if (!dossier) return <p className="workbench-tools-empty">Select one artwork with source information.</p>;
  return <article className="artwork-info" aria-label="Artwork metadata">
    <header><h3>{dossier.title || 'Untitled artwork'}</h3>
      {dossier.collection && <p>{dossier.collection}</p>}
    </header>
    <section aria-label="Description"><h4>Description</h4>
      <p>{dossier.description || 'No description provided.'}</p></section>
    <section className="artwork-info-creators" aria-label="Creators"><h4>{dossier.creators?.length > 1 ? 'Creators' : 'Creator'}</h4>
      {dossier.creators?.length ? dossier.creators.map((creator, index) => <MetadataCreator key={`${creator.address}-${index}`} creator={creator} />) : <MetadataCreator />}
    </section>
    {dossier.traits?.length > 0 && <section><h4>Attributes</h4><dl aria-label="Traits">
      {dossier.traits.map((entry, index) => <div key={`${entry.label}-${index}`}><dt>{entry.label}</dt><dd>{entry.value}</dd></div>)}
    </dl></section>}
    {(dossier.technical?.length > 0 || dossier.assetDetailHref) && <details className="artwork-info-sources">
      <summary>Source details</summary>
      {dossier.technical?.length > 0 && <dl>{dossier.technical.map((entry, index) =>
        <div key={`${entry.label}-${index}`}><dt>{entry.label}</dt><dd>{entry.href
          ? <a href={entry.href} rel="noreferrer" target="_blank">{entry.value}</a> : entry.value}
          {entry.provenance && <small>{entry.provenance}</small>}</dd></div>)}</dl>}
      {dossier.assetDetailHref && <a className="artwork-info-source-link" href={dossier.assetDetailHref} rel="noreferrer" target="_blank">View asset source <ExternalLink size={14} /></a>}
    </details>}
  </article>;
}
