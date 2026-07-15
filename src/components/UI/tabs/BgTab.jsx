// src/components/UI/tabs/BgTab.jsx
import React from 'react';
import CompactSlider from '../CompactSlider';

export default function BgTab() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
      <div>
        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Background Pattern</h4>
        <CompactSlider storeKey="bgPatternBottomScale" />
        <CompactSlider storeKey="bgPatternTopScale" />
        <CompactSlider storeKey="bgWarpIntensity" />
        <CompactSlider storeKey="bgWarpSpeed" />
      </div>
      <div>
        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Parallax Environment</h4>
        <CompactSlider storeKey="bgScrollSpeed" />
        {/* Still point is now at 0.0 in the middle, allowing reverse motion on the left */}
        <CompactSlider storeKey="bg2ParallaxSpeed" />
      </div>
    </div>
  );
}
