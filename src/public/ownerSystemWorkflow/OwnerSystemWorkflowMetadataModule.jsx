import { ExternalLink, UserRound } from 'lucide-react';
import { normalizeProfileAddress } from '../../library/config.js';
import { useProfileIdentity } from '../../profileIdentity/index.js';

const compact = (value) => value?.length > 18 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;

function Creator({ creator }) {
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

function OwnerSystemWorkflowMetadataFields({ dossier }) {
  return <>
    <section><small>CREATOR</small>{dossier?.creators?.length
      ? dossier.creators.map((creator, index) => <Creator key={`${creator.address}-${index}`} creator={creator} />)
      : <Creator />}</section>
    <section className="system-workflow__metadata-module-description"><small>DESCRIPTION</small>
      <p>{dossier?.description || 'Select one artwork to inspect its metadata.'}</p></section>
    {dossier?.collection && <section className="system-workflow__metadata-module-collection"><small>COLLECTION</small>
      <strong>{dossier.collection}</strong></section>}
    {dossier?.traits?.length > 0 && <ul aria-label="Traits" className="system-workflow__metadata-module-traits">
      {dossier.traits.map((entry, index) => <li key={`${entry.label}-${index}`}><small>{entry.label}</small><strong>{entry.value}</strong></li>)}
    </ul>}
    {dossier?.assetDetailHref && <a className="system-workflow__metadata-asset-link" href={dossier.assetDetailHref}
      rel="noreferrer" target="_blank">ASSET ID ↗</a>}
    {dossier?.technical?.length > 0 && <details className="system-workflow__metadata-sources">
      <summary>Source details</summary>
      <ul className="system-workflow__metadata-module-traits">{dossier.technical.map((entry, index) =>
        <li key={`${entry.label}-${index}`}><small>{entry.label}</small><strong>{entry.href
          ? <a href={entry.href} rel="noreferrer" target="_blank">{entry.value}</a> : entry.value}</strong>
          {entry.provenance && <small>{entry.provenance}</small>}</li>)}</ul>
    </details>}
  </>;
}

export function OwnerSystemWorkflowMetadataContent({ dossier }) {
  return <div className="system-workflow__metadata-module-content">
    <OwnerSystemWorkflowMetadataFields dossier={dossier} />
  </div>;
}
