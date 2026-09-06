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
    <section><small>CREATOR</small><Creator creator={dossier?.creators?.[0]} /></section>
    <section className="system-workflow__metadata-module-description"><small>DESCRIPTION</small>
      <p>{dossier?.description || 'Select one artwork to inspect its metadata.'}</p></section>
    {dossier?.collection && <section className="system-workflow__metadata-module-collection"><small>COLLECTION</small>
      <strong>{dossier.collection}</strong></section>}
    {dossier?.traits?.length > 0 && <ul aria-label="Traits" className="system-workflow__metadata-module-traits">
      {dossier.traits.map((entry, index) => <li key={`${entry.label}-${index}`}><small>{entry.label}</small><strong>{entry.value}</strong></li>)}
    </ul>}
    {dossier?.assetDetailHref && <a className="system-workflow__metadata-asset-link" href={dossier.assetDetailHref}
      rel="noreferrer" target="_blank">ASSET ID ↗</a>}
  </>;
}

export function OwnerSystemWorkflowMetadataContent({ dossier }) {
  return <div className="system-workflow__metadata-module-content">
    <OwnerSystemWorkflowMetadataFields dossier={dossier} />
  </div>;
}
