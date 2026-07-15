// src/components/UI/tabs/AuraTab.jsx
import React from 'react';
import CompactSlider from '../CompactSlider';

export default function AuraTab() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
      <div>
        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Aura Properties</h4>
        {['auraScale', 'auraOpacity', 'auraBlur', 'auraPulseSpeed'].map((storeKey) => <CompactSlider key={storeKey} storeKey={storeKey} />)}
      </div>
      <div>
        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Cavern Light & Tint (RGB)</h4>
        {['cavernLightIntensity', 'auraColorR', 'auraColorG', 'auraColorB'].map((storeKey) => <CompactSlider key={storeKey} storeKey={storeKey} />)}
      </div>
    </div>
  );
}
