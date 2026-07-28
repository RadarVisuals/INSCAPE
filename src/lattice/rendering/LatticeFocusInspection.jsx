import React from 'react';

const unresolved = (value) => (typeof value === 'string' && value.trim() ? value : 'NOT RESOLVED');

const rectangleStyle = ({ height, left, top, width }) => ({ height, left, top, width });

function LatticeFocusDossier({ dossier, layoutMode, onClose, open, rectangle, side }) {
  const isLeft = side === 'left';
  return (
    <aside
      aria-hidden={!open}
      aria-label={isLeft ? 'Artwork description dossier' : 'Artwork technical dossier'}
      className={`lattice-focus-viewer__dossier is-${side}`}
      data-open={open || undefined}
      data-placement={layoutMode === 'side' ? side : 'lower'}
      style={rectangleStyle(rectangle)}
    >
      <header>
        <span>{isLeft ? 'INSCAPE / ASSET NARRATIVE' : 'INSCAPE / TECHNICAL RECORD'}</span>
        <button aria-label="Close both artwork dossiers" disabled={!open} onClick={onClose} tabIndex={open ? 0 : -1} type="button">×</button>
      </header>
      <div className="lattice-focus-viewer__dossier-body" data-lattice-viewer-scroll>
        <small>{isLeft ? 'DESCRIPTION' : 'MEDIA RECORD'}</small>
        <h2>{unresolved(dossier?.title)}</h2>
        {isLeft ? <>
          <p>{unresolved(dossier?.description)}</p>
          <section>
            <small>TRAITS</small>
            {dossier?.traits?.length
              ? <dl>{dossier.traits.map(({ label, value }) => <div key={label}><dt>{label}</dt><dd>{unresolved(value)}</dd></div>)}</dl>
              : <p>NO TRAITS RESOLVED</p>}
          </section>
        </> : (
          <dl>{(dossier?.technical || []).map(({ label, value }) => <div key={label}><dt>{label}</dt><dd>{unresolved(value)}</dd></div>)}</dl>
        )}
      </div>
      <footer><span>INSCAPE PROTOCOL</span><span>{isLeft ? 'LEFT / DESCRIPTION' : 'RIGHT / RECORD'}</span></footer>
    </aside>
  );
}

export default function LatticeFocusInspection({ dossier, layout, onClose, open }) {
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
    >
      <i className="is-top-left" />
      <i className="is-top-right" />
      <i className="is-bottom-left" />
      <i className="is-bottom-right" />
    </div>
    <div
      aria-hidden="true"
      className="lattice-focus-viewer__connectors"
      data-open={open || undefined}
    >
      {layout.connectors.map((connector, index) => (
        <i key={`${connector.left}:${connector.top}:${index}`} style={rectangleStyle(connector)} />
      ))}
    </div>
    <LatticeFocusDossier
      dossier={dossier}
      layoutMode={layout.mode}
      onClose={onClose}
      open={open}
      rectangle={layout.leftDossier}
      side="left"
    />
    <LatticeFocusDossier
      dossier={dossier}
      layoutMode={layout.mode}
      onClose={onClose}
      open={open}
      rectangle={layout.rightDossier}
      side="right"
    />
  </>;
}
