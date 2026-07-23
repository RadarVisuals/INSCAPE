import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { buildNftViewerPages, compactAddress, compactTokenId, nftViewerPageRatio } from './nftFlipViewerModel.js';
import './nftFlipViewer.css';

const focusableSelector = 'button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])';

function DescriptionFace({ asset }) {
  const creators = Array.isArray(asset.creators) ? asset.creators : [];
  return <article className="nft-dossier">
    <header><small>01 / DESCRIPTION</small><strong>{asset.name || 'Untitled asset'}</strong></header>
    <div className="nft-dossier__body">
      <p>{asset.description || 'No description is available in this published record.'}</p>
      {!!asset.collectionName && <dl><div><dt>COLLECTION</dt><dd>{asset.collectionName}</dd></div></dl>}
      {!!creators.length && <section className="nft-dossier__people">
        {creators.map((creator) => <div key={creator.address}><small>CREATOR</small><b>{creator.name || compactAddress(creator.address)}</b></div>)}
      </section>}
    </div>
  </article>;
}

function AttributesFace({ asset }) {
  const attributes = Array.isArray(asset.attributes) ? asset.attributes : [];
  return <article className="nft-dossier">
    <header><small>02 / ATTRIBUTES</small><strong>ASSET TRAITS</strong></header>
    <div className="nft-dossier__body">
      {attributes.length ? <section className="nft-dossier__traits">
        {attributes.map((attribute, index) => <div key={`${attribute.key || 'attribute'}-${index}`}>
          <small>{attribute.key || attribute.type || `ATTRIBUTE ${index + 1}`}</small>
          <b>{String(attribute.value ?? '—')}</b>
        </div>)}
      </section> : <p>No attributes are available in this published record.</p>}
    </div>
  </article>;
}

function RecordFace({ asset, onCopyContract }) {
  const balance = asset.rawMetadata?.balance;
  return <article className="nft-dossier">
    <header><small>03 / RECORD</small><strong>ON-CHAIN INFORMATION</strong></header>
    <div className="nft-dossier__body">
      <dl>
        <div><dt>STANDARD</dt><dd>{asset.standard || 'UNKNOWN'}</dd></div>
        <div><dt>TOKEN ID</dt><dd title={asset.tokenId || undefined}>{compactTokenId(asset.tokenId)}</dd></div>
        {balance !== null && balance !== undefined && <div><dt>OWNED</dt><dd>{String(balance)}</dd></div>}
        <div><dt>NETWORK</dt><dd>{asset.chainId ? `CHAIN ${asset.chainId}` : 'UNAVAILABLE'}</dd></div>
        <div><dt>CONTRACT</dt><dd title={asset.contractAddress || undefined}>{compactAddress(asset.contractAddress)}{asset.contractAddress && <button type="button" onClick={onCopyContract}>COPY</button>}</dd></div>
      </dl>
    </div>
  </article>;
}

function MetadataFace({ page, asset, onCopyContract }) {
  if (page.kind === 'story') return <DescriptionFace asset={asset} />;
  if (page.kind === 'traits') return <AttributesFace asset={asset} />;
  return <RecordFace asset={asset} onCopyContract={onCopyContract} />;
}

export default function NftFlipViewer({ asset, onClose, returnFocus }) {
  const rootRef = useRef(null);
  const turntableRef = useRef(null);
  const timersRef = useRef([]);
  const gestureRef = useRef(null);
  const suppressClickRef = useRef(false);
  const pages = useMemo(() => buildNftViewerPages(asset), [asset]);
  const [pageIndex, setPageIndex] = useState(0);
  const [turn, setTurn] = useState(0);
  const [faceParity, setFaceParity] = useState(0);
  const [rotating, setRotating] = useState(false);
  const [contentHidden, setContentHidden] = useState(false);
  const [ratios, setRatios] = useState({});
  const [mediaSourceIndexes, setMediaSourceIndexes] = useState({});
  const page = pages[pageIndex];
  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const turnPage = useCallback((direction = 1) => {
    if (rotating || pages.length < 2) return;
    const step = direction < 0 ? -1 : 1;
    const nextIndex = (pageIndex + step + pages.length) % pages.length;
    const midpoint = reducedMotion ? 0 : 260;
    const reveal = reducedMotion ? 1 : 340;
    const complete = reducedMotion ? 1 : 570;
    setRotating(true);
    setContentHidden(true);
    setTurn((value) => value + step);
    timersRef.current.push(setTimeout(() => {
      setPageIndex(nextIndex);
      setFaceParity((value) => value + step);
    }, midpoint));
    timersRef.current.push(setTimeout(() => setContentHidden(false), reveal));
    timersRef.current.push(setTimeout(() => setRotating(false), complete));
  }, [pageIndex, pages.length, reducedMotion, rotating]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const previousFocus = returnFocus?.isConnected ? returnFocus : document.activeElement;
    const isolated = [...document.body.children].filter((node) => node !== root).map((node) => ({
      node,
      hadInert: node.hasAttribute('inert'),
      inertValue: node.inert
    }));
    isolated.forEach(({ node }) => { node.inert = true; });
    requestAnimationFrame(() => turntableRef.current?.focus());
    return () => {
      isolated.forEach(({ node, hadInert, inertValue }) => {
        if (hadInert) node.inert = inertValue;
        else node.removeAttribute('inert');
      });
      if (previousFocus?.isConnected) previousFocus.focus?.();
    };
  }, [returnFocus]);

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || (event.key === ' ' && event.target === turntableRef.current)) {
      event.preventDefault();
      if (!event.repeat) turnPage(event.key === 'ArrowLeft' ? -1 : 1);
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...rootRef.current.querySelectorAll(focusableSelector)].filter((node) => !node.closest('[inert]'));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  const copyContract = async (event) => {
    event.stopPropagation();
    if (!asset.contractAddress) return;
    try { await navigator.clipboard.writeText(asset.contractAddress); } catch { /* Clipboard access can be unavailable. */ }
  };

  const beginGesture = (event) => {
    if (event.target.closest('button,a') || (event.pointerType === 'mouse' && event.button !== 0)) return;
    gestureRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    suppressClickRef.current = false;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const moveGesture = (event) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - gesture.x;
    const deltaY = event.clientY - gesture.y;
    if (Math.abs(deltaX) > 8 && Math.abs(deltaX) > Math.abs(deltaY)) event.preventDefault();
  };

  const finishGesture = (event) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gestureRef.current = null;
    const deltaX = event.clientX - gesture.x;
    const deltaY = event.clientY - gesture.y;
    if (Math.abs(deltaX) >= 42 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
      suppressClickRef.current = true;
      turnPage(deltaX < 0 ? 1 : -1);
    }
  };

  const cancelGesture = (event) => {
    if (gestureRef.current?.pointerId === event.pointerId) gestureRef.current = null;
  };

  const ratio = nftViewerPageRatio(page, ratios);
  const mediaSourceIndex = page.kind === 'media' ? mediaSourceIndexes[page.url] || 0 : 0;
  const mediaSource = page.kind === 'media' ? page.sources[mediaSourceIndex] : null;
  const mediaUnavailable = page.kind === 'media' && !mediaSource;
  return createPortal(<div
    className="nft-flip-viewer"
    ref={rootRef}
    role="dialog"
    aria-modal="true"
    aria-label={`${asset.name || 'NFT'} viewer`}
    onKeyDown={handleKeyDown}
    onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
  >
    <button className="nft-flip-viewer__close" type="button" onClick={onClose} aria-label="Close NFT viewer">×</button>
    <div className="nft-flip-viewer__object" data-shape={page.kind === 'media' ? 'media' : 'dossier'} style={{ '--nft-media-ratio': ratio }}>
      <div
        className="nft-flip-viewer__turntable"
        ref={turntableRef}
        role="button"
        tabIndex="0"
        aria-label={`Browse faces from ${page.label}; click left or right, or swipe left for next and right for previous`}
        data-rotating={rotating || undefined}
        data-content-hidden={contentHidden || undefined}
        style={{ '--nft-turn': `${turn * 180}deg` }}
        onClick={(event) => {
          if (suppressClickRef.current) { suppressClickRef.current = false; return; }
          if (event.target.closest('button,a')) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          turnPage(event.clientX < bounds.left + bounds.width / 2 ? -1 : 1);
        }}
        onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); turnPage(1); } }}
        onPointerDown={beginGesture}
        onPointerMove={moveGesture}
        onPointerUp={finishGesture}
        onPointerCancel={cancelGesture}
        onLostPointerCapture={cancelGesture}
      >
        <div className="nft-flip-viewer__face" style={{ '--nft-face-correction': `${faceParity * 180}deg` }}>
          {mediaUnavailable ? <span className="nft-flip-viewer__unavailable">IMAGE UNAVAILABLE</span> : page.kind === 'media' ? <img
            src={mediaSource}
            alt={asset.name || 'NFT artwork'}
            draggable="false"
            referrerPolicy="no-referrer"
            onLoad={(event) => {
              const nextRatio = event.currentTarget.naturalWidth / event.currentTarget.naturalHeight;
              setRatios((current) => current[page.url] === nextRatio ? current : { ...current, [page.url]: nextRatio });
            }}
            onError={() => setMediaSourceIndexes((current) => ({ ...current, [page.url]: mediaSourceIndex + 1 }))}
          /> : <MetadataFace page={page} asset={asset} onCopyContract={copyContract} />}
        </div>
      </div>
    </div>
    <footer className="nft-flip-viewer__progress">
      <button type="button" onClick={() => turnPage(-1)} aria-label="Previous NFT face">‹</button>
      <span>{String(pageIndex + 1).padStart(2, '0')} / {String(pages.length).padStart(2, '0')}</span>
      <strong>{page.label}</strong>
      <button type="button" onClick={() => turnPage(1)} aria-label="Next NFT face">›</button>
    </footer>
  </div>, document.body);
}
