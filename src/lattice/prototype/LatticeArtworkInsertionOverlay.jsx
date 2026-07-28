export default function LatticeArtworkInsertionOverlay({
  assetSource,
  flow,
  onCancel,
  onChoose,
  onViewChange,
}) {
  return (
    <>
      {flow && flow.view !== 'chooser' && (
        <div
          className="lattice-insertion-menu"
          data-lattice-chrome
          role="menu"
          aria-label="Table insertion commands"
          style={{ left: flow.screen.x, top: flow.screen.y }}
        >
          {flow.view === 'root' ? (
            <button type="button" role="menuitem" autoFocus onClick={() => onViewChange('add')}>
              <span>ADD</span><span aria-hidden="true">›</span>
            </button>
          ) : (
            <>
              <button type="button" role="menuitem" onClick={() => onViewChange('root')}>‹ BACK</button>
              <button type="button" role="menuitem" autoFocus onClick={() => onViewChange('chooser')}>ARTWORK</button>
            </>
          )}
        </div>
      )}
      {flow?.view === 'chooser' && (
        <div className="lattice-insertion-chooser-backdrop" data-lattice-chrome onPointerDown={(event) => {
          if (event.target === event.currentTarget) onCancel();
        }}>
          <section className="lattice-insertion-chooser" role="dialog" aria-modal="true" aria-labelledby="lattice-insertion-title">
            <header><span>ADD / ARTWORK</span><h2 id="lattice-insertion-title">Choose repository fixture</h2></header>
            <div>
              {assetSource.listAssets().map(({ stableAssetId, ...media }, index) => (
                <button type="button" autoFocus={index === 0} key={stableAssetId} onClick={() => onChoose(stableAssetId)}>
                  <img src={media.src} alt="" draggable="false" />
                  <span>{media.accessibleLabel.replace(' rendering fixture', '').toUpperCase()}</span>
                </button>
              ))}
            </div>
            <button type="button" onClick={onCancel}>CANCEL</button>
          </section>
        </div>
      )}
    </>
  );
}
