import React, { useEffect, useState } from 'react';
import CompactSlider from '../CompactSlider';
import { useStore } from '../../../store/useStore';

const buttonStyle = {
  background: 'transparent',
  border: '1px solid var(--border-color)',
  color: 'var(--text-main)',
  padding: '6px 9px',
  fontSize: '9px',
  textTransform: 'uppercase',
  fontFamily: 'var(--font-mono)',
  cursor: 'pointer'
};

function EyeSlider({ eye, property, label, min, max, step }) {
  const updateEye = useStore((state) => state.updateCreatorEye);
  const value = eye[property];
  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
        <span style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</span>
        <span style={{ fontSize: '9px', color: 'var(--accent-color)' }}>{Number(value).toFixed(step < 1 ? 2 : 0)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => updateEye(eye.id, property, Number(event.target.value))} style={{ width: '100%', appearance: 'none', height: '2px', background: 'var(--border-color)', cursor: 'pointer' }} />
    </div>
  );
}

export default function CreatorEyesTab() {
  const eyes = useStore((state) => state.creatorEyes);
  const addEye = useStore((state) => state.addCreatorEye);
  const removeEye = useStore((state) => state.removeCreatorEye);
  const updateEye = useStore((state) => state.updateCreatorEye);
  const autoBlink = useStore((state) => state.autoBlink);
  const setParameter = useStore((state) => state.setParameter);
  const [selectedId, setSelectedId] = useState(eyes[0]?.id || null);

  useEffect(() => {
    if (!eyes.some((eye) => eye.id === selectedId)) setSelectedId(eyes[0]?.id || null);
  }, [eyes, selectedId]);

  const selectedEye = eyes.find((eye) => eye.id === selectedId) || null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '0.7fr 1fr 1fr', gap: '18px' }}>
      <section>
        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Post-Mutation Eyes</h4>
        <p style={{ fontSize: '9px', lineHeight: 1.35, color: 'var(--text-muted)', marginBottom: '9px' }}>Eyes are independent attachments placed after all body mirroring.</p>
        <div style={{ display: 'flex', gap: '5px', marginBottom: '8px' }}>
          <button onClick={addEye} style={{ ...buttonStyle, borderColor: 'var(--accent-color)', flex: 1 }}>Add Eye</button>
          <button onClick={() => selectedEye && removeEye(selectedEye.id)} disabled={!selectedEye} style={{ ...buttonStyle, color: '#d66', opacity: selectedEye ? 1 : 0.4 }}>Remove</button>
        </div>
        {eyes.length > 0 && (
          <select value={selectedId || ''} onChange={(event) => setSelectedId(event.target.value)} style={{ width: '100%', background: '#1c1c1c', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '6px', fontSize: '9px' }}>
            {eyes.map((eye, index) => <option key={eye.id} value={eye.id}>Eye {index + 1}</option>)}
          </select>
        )}
      </section>

      <section>
        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Placement</h4>
        {selectedEye ? (
          <>
            <EyeSlider eye={selectedEye} property="x" label="Position X" min={-1200} max={1200} step={1} />
            <EyeSlider eye={selectedEye} property="y" label="Position Y" min={-1200} max={1200} step={1} />
            <EyeSlider eye={selectedEye} property="scale" label="Scale" min={0.1} max={2.5} step={0.01} />
            <EyeSlider eye={selectedEye} property="rotation" label="Rotation" min={-180} max={180} step={1} />
          </>
        ) : <p style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Add an eye to begin.</p>}
      </section>

      <section>
        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Expression</h4>
        {selectedEye && (
          <>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '10px' }}>
              Iris Tint
              <input type="color" value={selectedEye.irisColor} onChange={(event) => updateEye(selectedEye.id, 'irisColor', event.target.value)} style={{ width: '42px', height: '24px', border: '1px solid var(--border-color)', background: 'transparent' }} />
            </label>
            <EyeSlider eye={selectedEye} property="gazeX" label="Gaze X" min={-1} max={1} step={0.01} />
            <EyeSlider eye={selectedEye} property="gazeY" label="Gaze Y" min={-1} max={1} step={0.01} />
            <EyeSlider eye={selectedEye} property="eyelidOpen" label="Eyelid Open" min={0} max={1} step={0.01} />
          </>
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-main)', margin: '9px 0' }}>
          <input type="checkbox" checked={autoBlink} onChange={(event) => setParameter('autoBlink', event.target.checked)} style={{ accentColor: 'var(--accent-color)' }} />
          Auto Blink
        </label>
        <CompactSlider label="Blink Interval" storeKey="blinkInterval" min="1" max="15" step="0.5" />
        <CompactSlider label="Blink Speed" storeKey="blinkSpeed" min="0.1" max="5" step="0.1" />
      </section>
    </div>
  );
}
