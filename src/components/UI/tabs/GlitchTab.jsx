// src/components/UI/tabs/GlitchTab.jsx
import React from 'react';
import CompactSlider from '../CompactSlider';

export default function GlitchTab() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
      <div>
        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Chromatic Split & Shocks</h4>
        <CompactSlider storeKey="aberrationAmount" />
        <CompactSlider storeKey="aberrationSpeed" />
        <CompactSlider storeKey="aberrationGlitch" />
        <CompactSlider storeKey="flickerIntensity" />
        <CompactSlider storeKey="flickerSpeed" />
        <CompactSlider storeKey="glitchShakeIntensity" />
      </div>
      <div>
        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Echoing Phase Trails</h4>
        <CompactSlider storeKey="trailCount" />
        <CompactSlider storeKey="trailSpacing" />
        <CompactSlider storeKey="trailManualAlpha" />
        <CompactSlider storeKey="trailGlitchInfluence" />
      </div>
    </div>
  );
}
