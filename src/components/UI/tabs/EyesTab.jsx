// src/components/UI/tabs/EyesTab.jsx
import React from 'react';
import { useStore } from '../../../store/useStore';
import CompactSlider from '../CompactSlider';
import CreatorEyesTab from './CreatorEyesTab';

export default function EyesTab() {
  const subjectMode = useStore((state) => state.subjectMode);
  const autoBlink = useStore((state) => state.autoBlink);
  const searchlightActive = useStore((state) => state.searchlightActive);
  const setParameter = useStore((state) => state.setParameter);

  if (subjectMode === 'creator') return <CreatorEyesTab />;

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
        
        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '10px', marginBottom: '8px', color: 'var(--text-muted)' }}>Pupil Tracking</h4>
        <CompactSlider label="Manual Eyelid Openness" storeKey="eyelidManualProgress" min="0" max="1" step="0.05" />
        <CompactSlider label="Pupil Mouse Influence" storeKey="pupilMouseInfluence" min="0" max="2" step="0.1" />
        <CompactSlider label="Pupil Drift (Wander)" storeKey="pupilWander" min="0" max="3" step="0.1" />
        <CompactSlider label="Pupil Saccade Jitter" storeKey="pupilSaccade" min="0" max="3" step="0.1" />
      </div>

      {/* Customizable Searchlight Column [3] */}
      <div>
        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Searchlight Rig</h4>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', height: '18px' }}>
          <input
            type="checkbox"
            id="searchlightActive"
            checked={searchlightActive}
            onChange={(e) => setParameter('searchlightActive', e.target.checked)}
            style={{
              cursor: 'pointer',
              accentColor: 'var(--accent-color)',
              width: '12px',
              height: '12px',
              background: 'none',
              border: '1px solid var(--border-color)'
            }}
          />
          <label htmlFor="searchlightActive" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-main)', cursor: 'pointer', userSelect: 'none' }}>
            Enable Beams
          </label>
        </div>

        <CompactSlider label="Emit Orbit Radius" storeKey="searchlightRadius" min="0" max="300" step="1" />
        <CompactSlider label="Beam Width" storeKey="searchlightWidth" min="0.1" max="3.0" step="0.05" />
        <CompactSlider label="Beam Length" storeKey="searchlightLength" min="0.2" max="2.0" step="0.05" />

        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '10px', marginBottom: '8px', color: 'var(--text-muted)' }}>Beam Color Tints</h4>
        <CompactSlider label="Beam Color: Red" storeKey="searchlightColorR" min="0" max="255" step="1" />
        <CompactSlider label="Beam Color: Green" storeKey="searchlightColorG" min="0" max="255" step="1" />
        <CompactSlider label="Beam Color: Blue" storeKey="searchlightColorB" min="0" max="255" step="1" />
      </div>
    </div>
  );
}
