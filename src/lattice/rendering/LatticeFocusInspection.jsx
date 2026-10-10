import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import DisclosureModule from './DisclosureModule.jsx';
import { createLatticeArtworkMetadataSections, LatticeArtworkMetadataContent } from './LatticeArtworkMetadata.jsx';
import { createDisclosureModuleTracks } from './disclosureModuleTracks.js';

const resolved = (value) => typeof value === 'string' && value.trim();

const rectangleStyle = ({ height, left, top, width }) => ({ height, left, top, width });

function NarrativeContent({ dossier }) {
  return <>
    {(resolved(dossier?.title) || resolved(dossier?.description)) && <>
      {resolved(dossier?.title) && <h2>{dossier.title}</h2>}
      {resolved(dossier?.description) && <p>{dossier.description}</p>}
    </>}
    {dossier?.traits?.length > 0 && <section>
      <small>Traits</small>
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

function LatticeFocusRack({ activeSection, closeButtonRef, dossier, layout, onClose, onSectionChange, open }) {
  const sections = createLatticeArtworkMetadataSections(dossier);
  const selected = sections.some(({ id }) => id === activeSection) ? activeSection : sections[0]?.id;
  useEffect(() => {
    if (selected && selected !== activeSection) onSectionChange?.(selected);
  }, [activeSection, onSectionChange, selected]);
  const moduleTracks = createDisclosureModuleTracks(sections, selected, layout.inspectionRack.height, 53);
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
      return <DisclosureModule active={active}
        className="lattice-focus-viewer__rack-module lattice-inspection-rack__module"
        contentClassName="lattice-focus-viewer__rack-panel lattice-inspection-rack__panel"
        headerAction={active && section.id === 'narrative' && onClose ? <button aria-label="Close artwork viewer"
          onClick={onClose} ref={closeButtonRef} type="button"><X aria-hidden="true" /></button> : null}
        id={`lattice-rack-${section.id}`} key={section.id} label={section.label} onToggle={() => onSectionChange?.(section.id)}
        style={moduleTracks.get(section.id)}><LatticeArtworkMetadataContent attributesClassName="lattice-focus-viewer__rack-attributes"
          dossier={dossier} section={section.id} /></DisclosureModule>;
    })}
  </aside>;
}

function LatticeFocusDossier({ dossier, layoutMode, open, rectangle, side }) {
  const isLeft = side === 'left';
  return (
    <aside
      aria-hidden={!open}
      aria-label={isLeft ? 'Artwork description module' : 'Artwork technical module'}
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
    aria-label="Artwork metadata modules"
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

export default function LatticeFocusInspection({ activeSection, closeButtonRef, dossier, layout, onClose, onSectionChange, open, variant = 'paired' }) {
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
    {variant === 'rack' ? <LatticeFocusRack activeSection={activeSection} closeButtonRef={closeButtonRef} dossier={dossier}
      layout={layout} onClose={onClose} onSectionChange={onSectionChange} open={open} /> : layout.mode === 'lower' ? (
      <LatticeFocusCombinedDossier dossier={dossier} open={open} rectangle={layout.leftDossier} />
    ) : <>
      <LatticeFocusDossier dossier={dossier} layoutMode={layout.mode} open={open} rectangle={layout.leftDossier} side="left" />
      <LatticeFocusDossier dossier={dossier} layoutMode={layout.mode} open={open} rectangle={layout.rightDossier} side="right" />
    </>}
  </>;
}
