import React from 'react';

const unresolved = (value) => (typeof value === 'string' && value.trim() ? value : 'NOT RESOLVED');

const rectangleStyle = ({ height, left, top, width }) => ({ height, left, top, width });

function NarrativeContent({ dossier }) {
  return <>
    <small>DESCRIPTION</small>
    <h2>{unresolved(dossier?.title)}</h2>
    <p>{unresolved(dossier?.description)}</p>
    <section>
      <small>TRAITS</small>
      <ul className="lattice-focus-viewer__traits">
        {dossier?.traits?.length
          ? dossier.traits.map(({ label, value }) => <li key={label}>{label}: {unresolved(value)}</li>)
          : <li>NO DATA</li>}
      </ul>
    </section>
  </>;
}

function RecordContent({ dossier }) {
  return <dl>{(dossier?.technical || []).map(({ label, value }) => (
    <div key={label}><dt>{label}</dt><dd>{unresolved(value)}</dd></div>
  ))}</dl>;
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
    style={rectangleStyle(rectangle)}
  >
    <div className="lattice-focus-viewer__dossier-body is-combined" data-lattice-viewer-scroll>
      <div className="lattice-focus-viewer__dossier-column"><NarrativeContent dossier={dossier} /></div>
      <div className="lattice-focus-viewer__dossier-column"><RecordContent dossier={dossier} /></div>
    </div>
  </aside>;
}

export default function LatticeFocusInspection({ dossier, layout, open }) {
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
    {layout.mode === 'lower' ? (
      <LatticeFocusCombinedDossier dossier={dossier} open={open} rectangle={layout.leftDossier} />
    ) : <>
      <LatticeFocusDossier dossier={dossier} layoutMode={layout.mode} open={open} rectangle={layout.leftDossier} side="left" />
      <LatticeFocusDossier dossier={dossier} layoutMode={layout.mode} open={open} rectangle={layout.rightDossier} side="right" />
    </>}
  </>;
}
