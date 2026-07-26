import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import './nftTableViewerPrototype.css';

const ASSETS = [
  { id: 'local-01', src: '/assets/ratio/1.webp', file: '1.webp', record: '01' },
  { id: 'local-02', src: '/assets/ratio/3.webp', file: '3.webp', record: '02' },
  { id: 'local-03', src: '/assets/ratio/7.webp', file: '7.webp', record: '03' },
];

const CHROME_RATIO = 0.18;

function getCardSize(ratio, focused = false, viewport = window) {
  if (focused) {
    const maxWidth = Math.max(240, viewport.innerWidth - 96);
    const maxHeight = Math.max(300, viewport.innerHeight - 80);
    const width = Math.min(maxWidth, maxHeight / ((1 / ratio) + CHROME_RATIO));
    return { width, height: width * ((1 / ratio) + CHROME_RATIO) };
  }

  const width = ratio > 1.35 ? 330 : ratio < 0.85 ? 190 : 240;
  return { width, height: width * ((1 / ratio) + CHROME_RATIO) };
}

function getFocusedRect(ratio) {
  const size = getCardSize(ratio, true);
  return {
    ...size,
    left: (window.innerWidth - size.width) / 2,
    top: (window.innerHeight - size.height) / 2,
  };
}

function transformBetween(source, destination) {
  const sourceCenterX = source.left + (source.width / 2);
  const sourceCenterY = source.top + (source.height / 2);
  const destinationCenterX = destination.left + (destination.width / 2);
  const destinationCenterY = destination.top + (destination.height / 2);
  const scale = source.width / destination.width;
  return `translate3d(${sourceCenterX - destinationCenterX}px, ${sourceCenterY - destinationCenterY}px, 0) scale(${scale})`;
}

function useNftViewerTransition(dimensions) {
  const [viewerState, setViewerState] = useState('table');
  const [selectedId, setSelectedId] = useState(null);
  const [motionTransform, setMotionTransform] = useState('none');
  const [motionEnabled, setMotionEnabled] = useState(false);
  const [viewportVersion, setViewportVersion] = useState(0);
  const slotRefs = useRef(new Map());
  const triggerRefs = useRef(new Map());
  const closeRef = useRef(null);
  const selectedAsset = ASSETS.find((asset) => asset.id === selectedId) || null;
  const selectedDimensions = selectedId ? dimensions[selectedId] : null;
  const selectedRatio = selectedDimensions ? selectedDimensions.width / selectedDimensions.height : 1;
  const focusedRect = useMemo(
    () => selectedId ? getFocusedRect(selectedRatio) : null,
    [selectedId, selectedRatio, viewportVersion],
  );

  useEffect(() => {
    const handleResize = () => setViewportVersion((version) => version + 1);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const open = useCallback((assetId) => {
    if (viewerState !== 'table' || !dimensions[assetId]) return;
    const sourceRect = slotRefs.current.get(assetId)?.getBoundingClientRect();
    if (!sourceRect) return;
    const ratio = dimensions[assetId].width / dimensions[assetId].height;
    const destination = getFocusedRect(ratio);
    setMotionEnabled(false);
    setSelectedId(assetId);
    setMotionTransform(transformBetween(sourceRect, destination));
    setViewerState('focusing');
  }, [dimensions, viewerState]);

  useLayoutEffect(() => {
    if (viewerState !== 'focusing') return undefined;
    let secondFrame;
    const firstFrame = requestAnimationFrame(() => {
      setMotionEnabled(true);
      secondFrame = requestAnimationFrame(() => setMotionTransform('none'));
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame) cancelAnimationFrame(secondFrame);
    };
  }, [viewerState, selectedId]);

  const close = useCallback(() => {
    if (!selectedId || viewerState === 'returning' || !focusedRect) return;
    const sourceRect = slotRefs.current.get(selectedId)?.getBoundingClientRect();
    if (!sourceRect) return;
    setMotionEnabled(true);
    setViewerState('returning');
    setMotionTransform(transformBetween(sourceRect, focusedRect));
  }, [focusedRect, selectedId, viewerState]);

  useEffect(() => {
    if (viewerState === 'table') return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [close, viewerState]);

  const handleTransitionEnd = useCallback((event) => {
    if (event.propertyName !== 'transform') return;
    if (viewerState === 'focusing') {
      setViewerState('focused');
      closeRef.current?.focus({ preventScroll: true });
      return;
    }
    if (viewerState === 'returning') {
      const returnedId = selectedId;
      setSelectedId(null);
      setMotionEnabled(false);
      setMotionTransform('none');
      setViewerState('table');
      requestAnimationFrame(() => triggerRefs.current.get(returnedId)?.focus({ preventScroll: true }));
    }
  }, [selectedId, viewerState]);

  return {
    close,
    closeRef,
    focusedRect,
    handleTransitionEnd,
    motionTransform,
    motionEnabled,
    open,
    selectedAsset,
    selectedId,
    slotRefs,
    triggerRefs,
    viewerState,
  };
}

function NftArchiveCard({
  asset,
  dimensions,
  focusedRect,
  isSelected,
  motionTransform,
  motionEnabled,
  onClose,
  onImageLoad,
  onOpen,
  onTransitionEnd,
  setCloseRef,
  setSlotRef,
  setTriggerRef,
  viewerState,
}) {
  const ratio = dimensions ? dimensions.width / dimensions.height : 1;
  const compactSize = getCardSize(ratio);
  const cardSize = isSelected && focusedRect ? focusedRect : compactSize;
  const cardStyle = {
    '--card-width': `${cardSize.width}px`,
    '--card-height': `${cardSize.height}px`,
    '--card-header-height': `${cardSize.width * 0.085}px`,
    '--card-footer-height': `${cardSize.width * 0.095}px`,
    '--card-header-font': `${cardSize.width * 0.027}px`,
    '--card-footer-font': `${cardSize.width * 0.0225}px`,
    '--card-inline-padding': `${cardSize.width * 0.034}px`,
    '--card-close-size': `${cardSize.width * 0.054}px`,
    '--card-close-inset': `${cardSize.width * 0.0155}px`,
    width: `${cardSize.width}px`,
    height: `${cardSize.height}px`,
    ...(isSelected ? {
      left: `${focusedRect.left}px`,
      top: `${focusedRect.top}px`,
      transform: motionTransform,
    } : {}),
  };

  return <div
    className="nft-table-viewer__slot"
    ref={(node) => setSlotRef(asset.id, node)}
    style={{ width: `${compactSize.width}px`, height: `${compactSize.height}px` }}
  >
    <article
      className="nft-archive-card"
      data-selected={isSelected || undefined}
      data-state={isSelected ? viewerState : 'table'}
      data-motion-enabled={isSelected && motionEnabled ? 'true' : 'false'}
      style={cardStyle}
      onTransitionEnd={isSelected ? onTransitionEnd : undefined}
      aria-label={`Local artwork record ${asset.record}`}
    >
      <button
        type="button"
        className="nft-archive-card__hit-area"
        ref={(node) => setTriggerRef(asset.id, node)}
        aria-label={isSelected ? `Focused local artwork record ${asset.record}` : `Focus local artwork record ${asset.record}`}
        onClick={() => onOpen(asset.id)}
      />
      <header className="nft-archive-card__header">
        <span>INSCAPE / LOCAL ARCHIVE</span>
        <b>RECORD {asset.record}</b>
      </header>
      {isSelected && <button
        type="button"
        className="nft-archive-card__close"
        ref={setCloseRef}
        aria-label="Return artwork to table"
        onClick={onClose}
      ><X aria-hidden="true" /></button>}
      <div className="nft-archive-card__artwork">
        <img
          src={asset.src}
          alt={`Local artwork file ${asset.src}`}
          draggable="false"
          onLoad={(event) => onImageLoad(asset.id, event.currentTarget)}
        />
      </div>
      <footer className="nft-archive-card__footer">
        <span>{asset.file}</span>
        <span>{dimensions ? `${dimensions.width} × ${dimensions.height}` : 'RESOLVING SIZE'}</span>
        <span>LOCAL ARTWORK / NOT MINTED</span>
      </footer>
    </article>
  </div>;
}

function NftTable({ dimensions, transition, onImageLoad }) {
  const setSlotRef = useCallback((id, node) => {
    if (node) transition.slotRefs.current.set(id, node);
    else transition.slotRefs.current.delete(id);
  }, [transition.slotRefs]);
  const setTriggerRef = useCallback((id, node) => {
    if (node) transition.triggerRefs.current.set(id, node);
    else transition.triggerRefs.current.delete(id);
  }, [transition.triggerRefs]);

  return <section className="nft-table-viewer__table" aria-label="Local artwork test table">
    <header className="nft-table-viewer__table-header">
      <span>TABLE / NATIVE RATIO STUDY</span>
      <b>03 LOCAL OBJECTS</b>
    </header>
    <div className="nft-table-viewer__field">
      {ASSETS.map((asset) => <NftArchiveCard
        key={asset.id}
        asset={asset}
        dimensions={dimensions[asset.id]}
        focusedRect={transition.selectedId === asset.id ? transition.focusedRect : null}
        isSelected={transition.selectedId === asset.id}
        motionTransform={transition.motionTransform}
        motionEnabled={transition.motionEnabled}
        onClose={transition.close}
        onImageLoad={onImageLoad}
        onOpen={transition.open}
        onTransitionEnd={transition.handleTransitionEnd}
        setCloseRef={transition.closeRef}
        setSlotRef={setSlotRef}
        setTriggerRef={setTriggerRef}
        viewerState={transition.viewerState}
      />)}
    </div>
    <footer className="nft-table-viewer__table-footer">
      <span>SOURCE / LOCAL FILES</span>
      <span>METADATA / NOT RESOLVED</span>
    </footer>
  </section>;
}

function FocusedNftViewer({ transition }) {
  if (!transition.selectedAsset) return null;
  return <button
    type="button"
    className="nft-table-viewer__focus-layer"
    data-state={transition.viewerState}
    tabIndex={-1}
    aria-label="Return focused artwork to table"
    onPointerDown={transition.close}
  />;
}

export default function NftTableViewerPrototype() {
  const [dimensions, setDimensions] = useState({});
  const transition = useNftViewerTransition(dimensions);
  const handleImageLoad = useCallback((id, image) => {
    setDimensions((current) => {
      if (current[id]?.width === image.naturalWidth && current[id]?.height === image.naturalHeight) return current;
      return { ...current, [id]: { width: image.naturalWidth, height: image.naturalHeight } };
    });
  }, []);

  return <main className="nft-table-viewer" data-viewer-state={transition.viewerState}>
    <div className="nft-table-viewer__fixed-grid" aria-hidden="true" />
    <header className="nft-table-viewer__hud">
      <span>INSCAPE / NFT VIEWING INTERACTION</span>
      <b>PROTOTYPE / PHASE 01</b>
    </header>
    <NftTable dimensions={dimensions} transition={transition} onImageLoad={handleImageLoad} />
    <FocusedNftViewer transition={transition} />
    <footer className="nft-table-viewer__status" aria-live="polite">
      <span>STATE / {transition.viewerState.toUpperCase()}</span>
      <span>{transition.selectedAsset ? `ACTIVE / RECORD ${transition.selectedAsset.record}` : 'SELECT AN ARCHIVAL CARD'}</span>
    </footer>
  </main>;
}
