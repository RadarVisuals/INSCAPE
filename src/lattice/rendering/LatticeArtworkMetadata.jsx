const resolved = (value) => typeof value === 'string' && value.trim();

export function createLatticeArtworkMetadataSections(dossier) {
  return [
    { id: 'narrative', label: 'NARRATIVE', available: Boolean(resolved(dossier?.title) || resolved(dossier?.description)) },
    { id: 'attributes', label: 'ATTRIBUTES', available: dossier?.traits?.length > 0 },
    { id: 'technical', label: 'TECHNICAL', available: dossier?.creators?.length > 0
      || dossier?.technical?.some(({ value }) => resolved(value)) },
  ].filter(({ available }) => available);
}

export function LatticeArtworkMetadataContent({ attributesClassName = '', dossier, section, showNarrativeTitle = true }) {
  if (section === 'narrative') return <>
    {showNarrativeTitle && resolved(dossier?.title) && <h2>{dossier.title}</h2>}
    {resolved(dossier?.description) && <p>{dossier.description}</p>}
  </>;
  if (section === 'attributes') return <ul className={`lattice-artwork-metadata__attributes${attributesClassName ? ` ${attributesClassName}` : ''}`}>
    {(dossier?.traits || []).map(({ label, value }) => <li aria-label={`${label}: ${value}`} key={label}
      title={`${label}: ${value}`}><span>{label}</span><strong>{value}</strong></li>)}
  </ul>;
  return <dl>{(dossier?.technical || []).filter(({ value }) => resolved(value)).map(({ href, label, value }) => (
    <div key={label}><dt>{label}</dt><dd>{href ? <a href={href} rel="noreferrer" target="_blank">{value}</a> : value}</dd></div>
  ))}</dl>;
}
