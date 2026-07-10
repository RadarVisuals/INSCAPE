// src/components/UI/tabs/EyesTab.jsx
import React from 'react';
import { useStore } from '../../../store/useStore';
import CompactSlider from '../CompactSlider';

export default function EyesTab() {
  const autoBlink = useStore((state) => state.autoBlink);
  const setParameter = useStore((state) => state.setParameter);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
      <div>
        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Eyelid Cycles</h4>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', height: '18px' }}>
          <input
            type="checkbox"
            id="autoBlink"
            checked={autoBlink}
            onChange={(e) => setParameter('autoBlink', e.target.checked)}
            style={{
              cursor: 'pointer',
              accentColor: 'var(--accent-color)',
              width: '12px',
              height: '12px',
              background: 'none',
              border: '1px solid var(--border-color)'
            }}
          />
          <label htmlFor="autoBlink" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-main)', cursor: 'pointer', userSelect: 'none' }}>
            Auto Blink
          </label>
        </div>

        <CompactSlider label="Blink Interval" storeKey="blinkInterval" min="1" max="15" step="0.5" />
        <CompactSlider label="Blink Speed" storeKey="blinkSpeed" min="0.1" max="5" step="0.1" />
        <CompactSlider label="Eyelid Travel" storeKey="eyelidTravel" min="10" max="100" step="1" />
      </div>
      <div>
        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Pupil Tracking</h4>
        <CompactSlider label="Manual Eyelid Openness" storeKey="eyelidManualProgress" min="0" max="1" step="0.05" />
        <CompactSlider label="Pupil Mouse Influence" storeKey="pupilMouseInfluence" min="0" max="2" step="0.1" />
        <CompactSlider label="Pupil Drift (Wander)" storeKey="pupilWander" min="0" max="3" step="0.1" />
        <CompactSlider label="Pupil Saccade Jitter" storeKey="pupilSaccade" min="0" max="3" step="0.1" />
      </div>
    </div>
  );
}