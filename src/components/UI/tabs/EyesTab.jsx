// src/components/UI/tabs/EyesTab.jsx
import React from 'react';
import { useStore } from '../../../store/useStore';
import CompactSlider from '../CompactSlider';

export default function EyesTab() {
  const autoBlink = useStore((state) => state.autoBlink);
  const searchlightActive = useStore((state) => state.searchlightActive);
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

        {['blinkInterval', 'blinkSpeed', 'eyelidTravel'].map((storeKey) => <CompactSlider key={storeKey} storeKey={storeKey} />)}
        
        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '10px', marginBottom: '8px', color: 'var(--text-muted)' }}>Pupil Tracking</h4>
        {['eyelidManualProgress', 'pupilMouseInfluence', 'pupilWander', 'pupilSaccade'].map((storeKey) => <CompactSlider key={storeKey} storeKey={storeKey} />)}
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

        {['searchlightRadius', 'searchlightWidth', 'searchlightLength'].map((storeKey) => <CompactSlider key={storeKey} storeKey={storeKey} />)}

        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '10px', marginBottom: '8px', color: 'var(--text-muted)' }}>Beam Color Tints</h4>
        {['searchlightColorR', 'searchlightColorG', 'searchlightColorB'].map((storeKey) => <CompactSlider key={storeKey} storeKey={storeKey} />)}
      </div>
    </div>
  );
}
