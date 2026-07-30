import React, { useEffect } from 'react';

const resolved = (value) => typeof value === 'string' && value.trim();

const rectangleStyle = ({ height, left, top, width }) => ({ height, left, top, width });

function NarrativeContent({ dossier }) {
  return <>
    {(resolved(dossier?.title) || resolved(dossier?.description)) && <>
      <small>DESCRIPTION</small>
      {resolved(dossier?.title) && <h2>{dossier.title}</h2>}
      {resolved(dossier?.description) && <p>{dossier.description}</p>}
    </>}
    {dossier?.traits?.length > 0 && <section>
      <small>TRAITS</small>
      <ul className="lattice-focus-viewer__traits">
        {dossier.traits.map(({ label, value }) => <li key={label}>{label}: {value}</li>)}
      </ul>
    </section>}
  </>;
}

function RecordContent({ dossier }) {
  return <dl>{(dossier?.technical || []).filter(({ value }) => resolved(value)).map(({ href, label, value }) => (
    <div key={label}><dt>{label}</dt><dd>{href ? <a href={href} rel="noreferrer" target="_blank">{value}</a> : value}</dd></div>
  ))}</dl>;
}

function RackNarrativeContent({ dossier }) {
  return <>
    {(resolved(dossier?.title) || resolved(dossier?.description)) && <small className="lattice-focus-viewer__rack-eyebrow">DESCRIPTION</small>}
    {resolved(dossier?.title) && <h2>{dossier.title}</h2>}
    {resolved(dossier?.description) && <p>{dossier.description}</p>}
  </>;
}

function AttributeContent({ dossier }) {
  return <ul className="lattice-focus-viewer__rack-attributes">
    {(dossier?.traits || []).map(({ label, value }) => <li key={label}><span>{label}</span><strong>{value}</strong></li>)}
  </ul>;
}

function LatticeFocusRack({ activeSection, dossier, layout, onSectionChange, open }) {
  const sections = [
    { id: 'narrative', label: 'NARRATIVE DOSSIER', available: resolved(dossier?.title) || resolved(dossier?.description),
      content: <RackNarrativeContent dossier={dossier} /> },
    { id: 'attributes', label: 'ATTRIBUTE DOSSIER', available: dossier?.traits?.length > 0,
      content: <AttributeContent dossier={dossier} /> },
    { id: 'technical', label: 'TECHNICAL DOSSIER', available: dossier?.technical?.some(({ value }) => resolved(value)),
      content: <RecordContent dossier={dossier} /> },
  ].filter(({ available }) => available);
  const selected = sections.some(({ id }) => id === activeSection) ? activeSection : sections[0]?.id;
  useEffect(() => {
    if (selected && selected !== activeSection) onSectionChange?.(selected);
  }, [activeSection, onSectionChange, selected]);
  const collapsedRackHeight = Math.max(0, sections.length - 1) * 54 + Math.max(0, sections.length - 1) * 4;
  const expandedModuleHeight = Math.round(Math.max(54, layout.inspectionRack.height - collapsedRackHeight));
  let moduleTop = 0;
  const moduleTracks = new Map(sections.map(({ id }) => {
    const height = id === selected ? expandedModuleHeight : 54;
    const track = { height, '--lattice-rack-module-y': `${Math.round(moduleTop)}px` };
    moduleTop += height + 4;
    return [id, track];
  }));
  return <aside
    aria-hidden={!open}
    aria-label="Artwork metadata rack"
    className="lattice-focus-viewer__rack"
    data-active-section={selected}
    data-open={open || undefined}
    inert={!open ? '' : undefined}
    style={rectangleStyle(layout.inspectionRack)}
  >
    {sections.map((section) => {
      const active = section.id === selected;
      const panelId = `lattice-rack-${section.id}-panel`;
      return <section className="lattice-focus-viewer__rack-module" data-active={active || undefined}
        key={section.id} style={moduleTracks.get(section.id)}>
        <button aria-controls={panelId} aria-expanded={active} onClick={() => onSectionChange?.(section.id)} type="button">
          <i aria-hidden="true" />
          <span>{section.label}</span>
          <b aria-hidden="true">{active ? '−' : '+'}</b>
        </button>
        {active && <div className="lattice-focus-viewer__rack-panel" data-lattice-viewer-scroll id={panelId} role="region">
          {section.content}
        </div>}
      </section>;
    })}
  </aside>;
}

function LatticeFocusDossier({ dossier, layoutMode, open, rectangle, side }) {
  const isLeft = side === 'left';
  return (
    <aside
      aria-hidden={!open}
      aria-label={isLeft ? 'Artwork description dossier' : 'Artwork technical dossier'}
      className={`lattice-focus-viewer__dossier is-${side}`}
      data-open={open || undefined}
      data-placement={layoutMode === 'side' ? side : 'lower'}
      data-side={side}
      inert={!open ? '' : undefined}
      style={rectangleStyle(rectangle)}
    >
      <div className="lattice-focus-viewer__dossier-body" data-lattice-viewer-scroll>
        {isLeft ? <NarrativeContent dossier={dossier} /> : <RecordContent dossier={dossier} />}
      </div>
    </aside>
  );
}

function LatticeFocusCombinedDossier({ dossier, open, rectangle }) {
  return <aside
    aria-hidden={!open}
    aria-label="Artwork metadata dossier"
    className="lattice-focus-viewer__dossier is-combined"
    data-open={open || undefined}
    data-placement="lower"
    inert={!open ? '' : undefined}
    style={rectangleStyle(rectangle)}
  >
    <div className="lattice-focus-viewer__dossier-body is-combined" data-lattice-viewer-scroll>
      <div className="lattice-focus-viewer__dossier-column"><NarrativeContent dossier={dossier} /></div>
      <div className="lattice-focus-viewer__dossier-column"><RecordContent dossier={dossier} /></div>
    </div>
  </aside>;
}

export default function LatticeFocusInspection({ activeSection, dossier, layout, onSectionChange, open, variant = 'paired' }) {
  return <>
    <div
      aria-hidden="true"
      className="lattice-focus-viewer__inspection-frame"
      data-open={open || undefined}
      style={{
        ...rectangleStyle(layout.inspectionFrame),
        '--lattice-inspection-frame-left': `${layout.inspectionFrame.left}px`,
        '--lattice-inspection-frame-top': `${layout.inspectionFrame.top}px`,
      }}
    />
    {variant === 'rack' ? <LatticeFocusRack activeSection={activeSection} dossier={dossier} layout={layout}
      onSectionChange={onSectionChange} open={open} /> : layout.mode === 'lower' ? (
      <LatticeFocusCombinedDossier dossier={dossier} open={open} rectangle={layout.leftDossier} />
    ) : <>
      <LatticeFocusDossier dossier={dossier} layoutMode={layout.mode} open={open} rectangle={layout.leftDossier} side="left" />
      <LatticeFocusDossier dossier={dossier} layoutMode={layout.mode} open={open} rectangle={layout.rightDossier} side="right" />
    </>}
  </>;
}
