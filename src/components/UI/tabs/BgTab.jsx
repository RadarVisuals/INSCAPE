// src/components/UI/tabs/BgTab.jsx
import React from 'react';
import CompactSlider from '../CompactSlider';

export default function BgTab() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
      <div>
        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Background Pattern</h4>
        <CompactSlider label="BG Pattern Bottom Scale" storeKey="bgPatternBottomScale" min="0.5" max="3" step="0.1" />
        <CompactSlider label="BG Pattern Top Scale" storeKey="bgPatternTopScale" min="0.5" max="3" step="0.1" />
        <CompactSlider label="BG Warp Intensity" storeKey="bgWarpIntensity" min="0" max="100" step="1" />
        <CompactSlider label="BG Warp Speed" storeKey="bgWarpSpeed" min="0" max="5" step="0.1" />
      </div>
      <div>
        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Parallax Environment</h4>
        <CompactSlider label="BG Scroll Speed" storeKey="bgScrollSpeed" min="0" max="150" step="5" />
        {/* Still point is now at 0.0 in the middle, allowing reverse motion on the left */}
        <CompactSlider label="BG2 Parallax Factor" storeKey="bg2ParallaxSpeed" min="-5.0" max="5.0" step="0.1" />
      </div>
    </div>
  );
}