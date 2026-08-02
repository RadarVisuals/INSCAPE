import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  LATTICE_PRODUCTION_FRAME_IDS,
  LATTICE_PRODUCTION_TRANSPARENCY_MODES,
} from '../domain/latticeProductionDraft.js';
import {
  ARTWORK_MAT_INSET_MAX,
  ARTWORK_MAT_PRESET_IDS,
  resolveArtworkMatPreset,
} from '../rendering/latticeMat.js';
import {
  latticeProductionPlacementPresentation,
  normalizeLatticeProductionPresentation,
} from './latticeProductionPresentation.js';
import './latticeProductionPresentationInspector.css';

const PRESET_IDS = Object.values(ARTWORK_MAT_PRESET_IDS);
const EDGE_LABELS = Object.freeze({ top: 'Top', right: 'Right', bottom: 'Bottom', left: 'Left' });

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function matchingPreset(mat) {
  return PRESET_IDS.find((presetId) => sameValue(mat, resolveArtworkMatPreset(presetId))) || '';
}

function inspectorPosition(anchor) {
  const viewportWidth = Math.max(320, globalThis.innerWidth || 320);
  const viewportHeight = Math.max(320, globalThis.innerHeight || 320);
  const width = Math.min(388, viewportWidth - 16);
  return {
    left: Math.max(8, Math.min(anchor?.x || 8, viewportWidth - width - 8)),
    top: Math.max(8, Math.min(anchor?.y || 8, viewportHeight - 160)),
    width,
  };
}

export default function LatticeProductionPresentationInspector({
  anchor,
  artworkName,
  onApply,
  onCancel,
  onPreview,
  placement,
  returnFocus,
}) {
  const headingId = useId();
  const rootRef = useRef(null);
  const initial = useMemo(() => latticeProductionPlacementPresentation(placement), [placement]);
  const [value, setValue] = useState(initial);
  const [error, setError] = useState(null);
  const close = () => {
    onPreview?.(null);
    onCancel?.();
    requestAnimationFrame(() => returnFocus?.isConnected && returnFocus.focus({ preventScroll: true }));
  };

  useEffect(() => {
    rootRef.current?.querySelector('select, input, button')?.focus({ preventScroll: true });
    const keydown = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
    };
    const outside = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        event.stopPropagation();
        close();
      }
    };
    window.addEventListener('keydown', keydown, true);
    window.addEventListener('pointerdown', outside, true);
    return () => {
      window.removeEventListener('keydown', keydown, true);
      window.removeEventListener('pointerdown', outside, true);
    };
  }, []);

  const update = (next) => {
    setValue(next);
    try {
      const normalized = normalizeLatticeProductionPresentation(next);
      setError(null);
      onPreview?.(normalized);
    } catch (nextError) {
      setError(nextError?.message || 'Presentation values are invalid');
      onPreview?.(null);
    }
  };
  const presetId = matchingPreset(value.mat);
  const apply = () => {
    let normalized;
    try {
      normalized = normalizeLatticeProductionPresentation(value);
      setError(null);
    } catch (nextError) {
      setError(nextError?.message || 'Presentation values are invalid');
      return;
    }
    if (onApply?.(normalized) === false) return;
    onPreview?.(null);
    requestAnimationFrame(() => returnFocus?.isConnected && returnFocus.focus({ preventScroll: true }));
  };

  return <section
    aria-labelledby={headingId}
    className="lattice-production-presentation-inspector"
    data-lattice-chrome
    ref={rootRef}
    role="dialog"
    style={inspectorPosition(anchor)}
  >
    <header>
      <div><small>PLACEMENT PRESENTATION</small><strong id={headingId}>FRAME &amp; MAT — {artworkName}</strong></div>
      <button aria-label="Close Frame and mat inspector" onClick={close} type="button">×</button>
    </header>
    <div className="lattice-production-presentation-inspector__fields">
      <label><span>FRAME</span><select value={value.frameId} onChange={(event) => update({ ...value, frameId: event.currentTarget.value })}>
        {LATTICE_PRODUCTION_FRAME_IDS.map((id) => <option key={id} value={id}>{id}</option>)}
      </select></label>
      <label><span>MAT PRESET</span><select value={presetId} onChange={(event) => update({ ...value, mat: resolveArtworkMatPreset(event.currentTarget.value) })}>
        {!presetId && <option value="" disabled>CUSTOM VALUES</option>}
        {PRESET_IDS.map((id) => <option key={id} value={id}>{id}</option>)}
      </select></label>
      <label className="is-toggle"><span>MAT ENABLED</span><input checked={value.mat.enabled} onChange={(event) => update({ ...value, mat: { ...value.mat, enabled: event.currentTarget.checked } })} type="checkbox" /></label>
      <label><span>MAT COLOR</span><input onChange={(event) => update({ ...value, mat: { ...value.mat, color: event.currentTarget.value } })} type="color" value={value.mat.color} /></label>
      <fieldset><legend>MAT INSET</legend><div>
        {Object.entries(EDGE_LABELS).map(([edge, label]) => <label key={edge}><span>{label}</span><input
          inputMode="decimal"
          max={ARTWORK_MAT_INSET_MAX}
          min="0"
          onChange={(event) => update({ ...value, mat: { ...value.mat, inset: { ...value.mat.inset, [edge]: Number(event.currentTarget.value) } } })}
          step="0.01"
          type="number"
          value={value.mat.inset[edge]}
        /></label>)}
      </div></fieldset>
      <label className="is-toggle"><span>BACKING ENABLED</span><input checked={value.backing.enabled} onChange={(event) => update({ ...value, backing: { ...value.backing, enabled: event.currentTarget.checked } })} type="checkbox" /></label>
      <label><span>BACKING COLOR</span><input onChange={(event) => update({ ...value, backing: { ...value.backing, color: event.currentTarget.value } })} type="color" value={value.backing.color} /></label>
      <label><span>TRANSPARENCY</span><select value={value.transparencyMode} onChange={(event) => update({ ...value, transparencyMode: event.currentTarget.value })}>
        {LATTICE_PRODUCTION_TRANSPARENCY_MODES.map((id) => <option key={id} value={id}>{id}</option>)}
      </select></label>
    </div>
    {error && <p role="alert">{error}</p>}
    <footer><button onClick={close} type="button">CANCEL</button><button disabled={Boolean(error)} onClick={apply} type="button">APPLY</button></footer>
  </section>;
}
