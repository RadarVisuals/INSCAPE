import React, { useEffect, useState } from 'react';
import CompactSlider from '../CompactSlider';
import { useStore } from '../../../store/useStore';

const selectStyle = {
  background: '#1c1c1c',
  border: '1px solid var(--border-color)',
  color: 'var(--text-main)',
  padding: '5px',
  fontSize: '9px',
  width: '100%',
  outline: 'none'
};

const labelStyle = {
  fontSize: '9px',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  display: 'block',
  marginBottom: '4px'
};

function AssetSelect({ label, value, options, onChange }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <select value={value} onChange={(event) => onChange(event.target.value)} style={selectStyle}>
        {options.map((id) => <option key={id} value={id}>{id.replace('basic_', '')}</option>)}
      </select>
    </div>
  );
}

function LayerControls({ title, prefix, paletteAKey, paletteBKey, patternKey, manifest }) {
  const mode = useStore((state) => state[`${prefix}ColorMode`]);
  const paletteA = useStore((state) => state[paletteAKey]);
  const paletteB = useStore((state) => state[paletteBKey]);
  const pattern = useStore((state) => patternKey ? state[patternKey] : null);
  const setParameter = useStore((state) => state.setParameter);

  return (
    <section>
      <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>{title}</h4>
      <div style={{ display: 'grid', gridTemplateColumns: patternKey ? '1.2fr 0.8fr' : '1fr', gap: '6px', marginBottom: '6px' }}>
        {patternKey && (
          <AssetSelect label="Pattern" value={pattern} options={manifest.patterns} onChange={(value) => setParameter(patternKey, value)} />
        )}
        <AssetSelect
          label="Mode"
          value={mode}
          options={['solid', 'gradient']}
          onChange={(value) => setParameter(`${prefix}ColorMode`, value)}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '9px' }}>
        <AssetSelect label="Palette A" value={paletteA} options={manifest.palettes} onChange={(value) => setParameter(paletteAKey, value)} />
        <AssetSelect label="Palette B" value={paletteB} options={manifest.palettes} onChange={(value) => setParameter(paletteBKey, value)} />
      </div>
      <CompactSlider label="Opacity" storeKey={`${prefix}Opacity`} min="0" max="1" step="0.01" />
      {patternKey && <CompactSlider label="Pattern Scale" storeKey={`${prefix}Scale`} min="0.25" max="4" step="0.01" />}
      {mode === 'gradient' && (
        <>
          <CompactSlider label="Gradient Angle" storeKey={`${prefix}GradientAngle`} min="-180" max="180" step="1" />
          <CompactSlider label="Gradient Balance" storeKey={`${prefix}GradientBalance`} min="0.01" max="0.99" step="0.01" />
        </>
      )}
    </section>
  );
}

export default function CreatorLayersTab() {
  const subjectMode = useStore((state) => state.subjectMode);
  const [manifest, setManifest] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/assets/manifest.json')
      .then((response) => {
        if (!response.ok) throw new Error(`Manifest request failed (${response.status})`);
        return response.json();
      })
      .then((data) => { if (!cancelled) setManifest(data); })
      .catch((reason) => { if (!cancelled) setError(reason.message); });
    return () => { cancelled = true; };
  }, []);

  if (subjectMode !== 'creator') {
    return <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Choose Creator Mutation Test in Setup to edit the biological colour stack.</p>;
  }
  if (!manifest) {
    return <p style={{ fontSize: '10px', color: error ? '#d66' : 'var(--text-muted)' }}>{error || 'Loading creator manifest...'}</p>;
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 0.8fr', gap: '18px' }}>
      <LayerControls title="Base / Mask" prefix="creatorBase" paletteAKey="creatorPaletteId" paletteBKey="creatorBasePaletteBId" manifest={manifest} />
      <LayerControls title="Pattern I" prefix="creatorPattern1" paletteAKey="creatorPattern1PaletteAId" paletteBKey="creatorPattern1PaletteBId" patternKey="creatorPatternId" manifest={manifest} />
      <LayerControls title="Pattern II" prefix="creatorPattern2" paletteAKey="creatorPattern2PaletteAId" paletteBKey="creatorPattern2PaletteBId" patternKey="creatorPattern2Id" manifest={manifest} />
      <section>
        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Surface Grit</h4>
        <p style={{ fontSize: '9px', lineHeight: 1.35, color: 'var(--text-muted)', marginBottom: '10px' }}>Static character-space noise affects colour only. Line art remains clean.</p>
        <CompactSlider label="Noise Intensity" storeKey="creatorNoiseIntensity" min="0" max="1" step="0.01" />
        <CompactSlider label="Noise Grain" storeKey="creatorNoiseScale" min="20" max="600" step="1" />
      </section>
    </div>
  );
}
