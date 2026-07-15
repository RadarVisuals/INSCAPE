// src/components/UI/tabs/AtmosphereTab.jsx
import React from 'react';
import CompactSlider from '../CompactSlider';

export default function AtmosphereTab() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
      <div>
        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Particulate Shards</h4>
        <CompactSlider storeKey="particleCount" />
        <CompactSlider storeKey="particleSpeed" />
        <CompactSlider storeKey="particleWind" />
        <CompactSlider storeKey="particleSway" />
        <CompactSlider storeKey="particleSize" />
        <CompactSlider storeKey="particleOpacity" />
      </div>
      <div>
        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Volumetric Cave Fog</h4>
        <CompactSlider storeKey="fogOpacity" />
        <CompactSlider storeKey="fogSpeed" />
        <CompactSlider storeKey="fogColorR" />
        <CompactSlider storeKey="fogColorG" />
        <CompactSlider storeKey="fogColorB" />

        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '12px', marginBottom: '8px', color: 'var(--text-muted)' }}>Screen Overlay & Post</h4>
        <CompactSlider label="Scanline Density" storeKey="scanlineOpacity" min="0" max="1" step="0.05" />
        <CompactSlider label="Vignette Intensity" storeKey="vignetteOpacity" min="0" max="1" step="0.05" />
      </div>
    </div>
  );
}
