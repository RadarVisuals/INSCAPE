import { useEffect, useMemo, useRef, useState } from 'react';
import './nftCardViewerPrototype.css';

const RATIO_ASSET_LIMIT = 24;
const EXTRA_MEDIA_LIMIT = 3;
const RATIO_SCAN_VERSION = '20260723';
const GAP = 8;

function probeImage(url) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ kind: 'image', url, ratio: image.naturalWidth / image.naturalHeight });
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

function useNumberedRatioAssets(open) {
  const [assets, setAssets] = useState([]);
  const [finished, setFinished] = useState(false);
  const scanGeneration = useRef(0);

  useEffect(() => {
    if (!open) {
      scanGeneration.current += 1;
      return;
    }
    const generation = ++scanGeneration.current;
    setFinished(false);

    Promise.all(Array.from({ length: RATIO_ASSET_LIMIT }, async (_, index) => {
      const number = index + 1;
      const primary = await probeImage(`/assets/ratio/${number}.webp?v=${RATIO_SCAN_VERSION}`);
      if (!primary) return null;
      const extras = await Promise.all(Array.from({ length: EXTRA_MEDIA_LIMIT - 1 }, (_, extraIndex) => (
        probeImage(`/assets/ratio/${number}-${extraIndex + 2}.webp?v=${RATIO_SCAN_VERSION}`)
      )));
      return {
        id: String(number).padStart(2, '0'),
        title: `ARCHIVE WORK ${String(number).padStart(2, '0')}`,
        ratio: primary.ratio,
        media: [primary, ...extras.filter(Boolean)]
      };
    })).then((found) => {
      if (scanGeneration.current !== generation) return;
      setAssets(found.filter(Boolean));
      setFinished(true);
    });
  }, [open]);

  return {
    assets: finished ? assets : [],
    scanFailed: finished && !assets.length,
    scanning: open && !finished
  };
}

function makeRows(assets, width, targetHeight = 152) {
  if (!width || !assets.length) return [];
  const rows = [];
  let pending = [];
  let ratioTotal = 0;

  assets.forEach((asset) => {
    pending.push(asset);
    ratioTotal += asset.ratio;
    const projectedWidth = ratioTotal * targetHeight + GAP * Math.max(0, pending.length - 1);
    if (projectedWidth >= width && pending.length > 1) {
      const height = (width - GAP * (pending.length - 1)) / ratioTotal;
      rows.push({ assets: pending, height });
      pending = [];
      ratioTotal = 0;
    }
  });

  if (pending.length) {
    const justifiedHeight = (width - GAP * (pending.length - 1)) / ratioTotal;
    rows.push({ assets: pending, height: Math.min(targetHeight, justifiedHeight), incomplete: true });
  }

  return rows;
}

function SyntheticArtwork({ asset, label }) {
  return <span className="nft-artwork-synthetic" style={{ '--synthetic-hue': asset.hue || '#4c5362' }}><i /><b>{label}</b></span>;
}

function Artwork({ media, asset, label }) {
  if (media?.kind === 'image') return <img src={media.url} alt={asset.title} draggable="false" />;
  return <SyntheticArtwork asset={{ ...asset, hue: media?.hue || asset.hue }} label={label} />;
}

function MetadataFace({ kind, asset }) {
  if (kind === 'story') return <article className="artifact-dossier"><header><span>01 / STORY</span><strong>{asset.title}</strong></header><p>This work belongs to a continuing visual archive about identity, mutation and the systems we construct around ourselves. The description can become substantially longer without forcing the artwork face to carry interface chrome.</p><section className="artifact-dossier__people"><div><small>CREATOR</small><b>VXCTXR <i>#E3C1</i></b></div><div><small>MAINTAINER</small><b>VXCTXR <i>#E3C1</i></b></div></section><footer><button type="button">CREATOR PROFILE ↗</button><button type="button">PROJECT LINK ↗</button></footer></article>;
  if (kind === 'traits') return <article className="artifact-dossier"><header><span>02 / TRAITS</span><strong>ATTRIBUTES + ASSETS</strong></header><div className="artifact-dossier__traits">{[['ORIGIN','UNDERNEATH'],['FORM','MUTATION'],['SIGNAL','VIOLET'],['EDITION','GENESIS'],['STATE','AWAKE'],['ARCHIVE','NORTH']].map(([label,value]) => <div key={label}><small>{label}</small><b>{value}</b></div>)}</div><section className="artifact-dossier__attachments"><small>ATTACHED ASSETS</small><div><button type="button">IMAGE / MASTER</button><button type="button">VIDEO / PROCESS</button><button type="button">AUDIO / FIELD</button></div></section></article>;
  return <article className="artifact-dossier"><header><span>03 / RECORD</span><strong>ON-CHAIN INFORMATION</strong></header><dl><div><dt>TOKEN ID</dt><dd>#{asset.id}</dd></div><div><dt>SUPPLY</dt><dd>1 / 1</dd></div><div><dt>STANDARD</dt><dd>LSP8 IDENTIFIABLE DIGITAL ASSET</dd></div><div><dt>CREATED</dt><dd>22 JUL 2026</dd></div><div><dt>CONTRACT</dt><dd>0xE3C1…8A72 <button type="button">COPY</button></dd></div><div><dt>NETWORK</dt><dd>LUKSO MAINNET</dd></div></dl><footer><button type="button">VIEW COLLECTION</button><button type="button">TRADE ↗</button></footer></article>;
}

function ArtifactViewer({ asset, onClose }) {
  const pages = useMemo(() => [
    ...asset.media.map((media, index) => ({ kind: 'media', media, label: asset.media.length > 1 ? `MEDIA ${index + 1} / ${asset.media.length}` : 'ARTIFACT' })),
    { kind: 'story', label: 'STORY' },
    { kind: 'traits', label: 'TRAITS' },
    { kind: 'record', label: 'RECORD' }
  ], [asset]);
  const [pageIndex, setPageIndex] = useState(0);
  const [turn, setTurn] = useState(0);
  const [faceParity, setFaceParity] = useState(0);
  const [rotating, setRotating] = useState(false);
  const timers = useRef([]);
  const page = pages[pageIndex];

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => () => clearTimers(), []);
  useEffect(() => {
    const keydown = (event) => {
      if (event.key === 'Escape') onClose();
      if ((event.key === 'ArrowRight' || event.key === ' ') && !event.repeat) { event.preventDefault(); advance(); }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  });

  const advance = () => {
    if (rotating) return;
    const nextPage = (pageIndex + 1) % pages.length;
    setRotating(true);
    setTurn((value) => value + 1);
    timers.current.push(setTimeout(() => {
      setPageIndex(nextPage);
      setFaceParity((value) => value + 1);
    }, 260));
    timers.current.push(setTimeout(() => setRotating(false), 570));
  };

  const mediaRatio = page.kind === 'media' ? page.media.ratio : 1;
  return <div className="artifact-viewer" role="dialog" aria-modal="true" aria-label={`${asset.title} viewer`} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <button className="artifact-viewer__close" type="button" onClick={onClose} aria-label="Close NFT viewer">×</button>
    <div className="artifact-viewer__object" data-shape={page.kind === 'media' ? 'media' : 'dossier'} style={{ '--media-ratio': mediaRatio }}>
      <div className="artifact-viewer__turntable" role="button" tabIndex="0" aria-label={`Show next face after ${page.label}`} onClick={(event) => { if (!event.target.closest('.artifact-dossier button')) advance(); }} onKeyDown={(event) => { if (event.key === 'Enter') advance(); }} style={{ '--artifact-turn': `${turn * -180}deg` }} data-rotating={rotating || undefined}>
        <span className="artifact-viewer__face" style={{ '--face-correction': `${faceParity * 180}deg` }}>
          {page.kind === 'media' ? <Artwork media={page.media} asset={asset} label={page.label} /> : <MetadataFace kind={page.kind} asset={asset} />}
        </span>
      </div>
    </div>
    <footer className="artifact-viewer__progress"><span>{String(pageIndex + 1).padStart(2, '0')} / {String(pages.length).padStart(2, '0')}</span><strong>{page.label}</strong><button type="button" onClick={advance}>TURN →</button></footer>
  </div>;
}

export default function NftCardViewerPrototype({ open, category }) {
  const { assets, scanFailed, scanning } = useNumberedRatioAssets(open);
  const browserRef = useRef(null);
  const [browserWidth, setBrowserWidth] = useState(0);
  const [thumbnailSize, setThumbnailSize] = useState(190);
  const [assetOrder, setAssetOrder] = useState([]);
  const [draggingId, setDraggingId] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!open) { setSelected(null); return undefined; }
    const node = browserRef.current;
    if (!node) return undefined;
    const observer = new ResizeObserver(([entry]) => setBrowserWidth(entry.contentRect.width));
    observer.observe(node);
    setBrowserWidth(Math.max(0, node.clientWidth - 36));
    return () => observer.disconnect();
  }, [open]);

  useEffect(() => {
    const availableIds = assets.map((asset) => asset.id);
    setAssetOrder((current) => {
      const next = [...current.filter((id) => availableIds.includes(id)), ...availableIds.filter((id) => !current.includes(id))];
      return next.length === current.length && next.every((id, index) => id === current[index]) ? current : next;
    });
  }, [assets]);

  const orderedAssets = useMemo(() => {
    const byId = new Map(assets.map((asset) => [asset.id, asset]));
    return assetOrder.map((id) => byId.get(id)).filter(Boolean);
  }, [assets, assetOrder]);
  const rows = useMemo(() => makeRows(orderedAssets, browserWidth, thumbnailSize), [orderedAssets, browserWidth, thumbnailSize]);

  const moveAsset = (sourceId, targetId) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    setAssetOrder((current) => {
      const sourceIndex = current.indexOf(sourceId);
      const targetIndex = current.indexOf(targetId);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const next = [...current];
      next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, sourceId);
      return next;
    });
  };

  const moveAssetBy = (id, direction) => {
    setAssetOrder((current) => {
      const index = current.indexOf(id);
      const nextIndex = Math.max(0, Math.min(current.length - 1, index + direction));
      if (index < 0 || nextIndex === index) return current;
      const next = [...current];
      next.splice(index, 1);
      next.splice(nextIndex, 0, id);
      return next;
    });
  };

  return <>
    <section className="nft-menu-browser" data-visible={open || undefined} aria-hidden={!open} aria-label={`${category} NFT works`}>
      <header><div><strong>{category}</strong><span>{scanFailed ? 'RATIO ASSETS NOT FOUND' : `${assets.length.toString().padStart(2, '0')} WORKS`}</span></div><label className="nft-menu-browser__density"><span>THUMBNAIL SIZE</span><input aria-label="Thumbnail size" type="range" min="110" max="300" step="10" value={thumbnailSize} onChange={(event) => setThumbnailSize(Number(event.target.value))}/><output>{thumbnailSize}</output></label><small>NATIVE RATIO · JUSTIFIED ROWS</small></header>
      <div className="nft-menu-browser__rows" ref={browserRef}>
        {scanning && <p className="nft-menu-browser__scanning">SCANNING RATIO ASSETS<span>1.WEBP → {RATIO_ASSET_LIMIT}.WEBP</span></p>}
        {scanFailed && <p className="nft-menu-browser__scanning">NO NUMBERED WEBP FILES RESOLVED<span>EXPECTED /PUBLIC/ASSETS/RATIO/1.WEBP</span></p>}
        {rows.map((row, rowIndex) => <div className="nft-justified-row" key={`${rowIndex}-${row.assets.map((asset) => asset.id).join('-')}`} data-incomplete={row.incomplete || undefined} style={{ '--row-height': `${row.height}px` }}>
          {row.assets.map((asset) => <button className="nft-thumbnail" key={asset.id} type="button" draggable data-dragging={draggingId === asset.id || undefined} data-drop-target={dropTargetId === asset.id || undefined} style={{ width: `${row.height * asset.ratio}px` }} aria-label={`${asset.title}. Open artwork; hold and drag to reorder.`} onClick={() => setSelected(asset)} onKeyDown={(event) => { if (event.altKey && event.key === 'ArrowLeft') { event.preventDefault(); moveAssetBy(asset.id, -1); } if (event.altKey && event.key === 'ArrowRight') { event.preventDefault(); moveAssetBy(asset.id, 1); } }} onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', asset.id); setDraggingId(asset.id); }} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDropTargetId(asset.id); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDropTargetId(null); }} onDrop={(event) => { event.preventDefault(); moveAsset(event.dataTransfer.getData('text/plain') || draggingId, asset.id); setDraggingId(null); setDropTargetId(null); }} onDragEnd={() => { setDraggingId(null); setDropTargetId(null); }}>
            <span className="nft-thumbnail__media"><Artwork media={asset.media[0]} asset={asset} label={asset.id} /></span>
            <span className="nft-thumbnail__rail"><strong>{asset.title}</strong><small>#{asset.id} · {asset.media.length > 1 ? `${asset.media.length} MEDIA` : 'IMAGE'}</small><i aria-hidden="true">⠿</i></span>
          </button>)}
        </div>)}
      </div>
      <footer><span>CLICK TO INSPECT · DRAG TO ARRANGE</span><span>VISITOR DISPLAY ORDER</span></footer>
    </section>
    {selected && <ArtifactViewer asset={selected} onClose={() => setSelected(null)} />}
  </>;
}
