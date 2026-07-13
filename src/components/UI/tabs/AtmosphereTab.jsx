// src/components/UI/tabs/AtmosphereTab.jsx
import React from 'react';
import CompactSlider from '../CompactSlider';

export default function AtmosphereTab() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
      <div>
        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Particulate Shards</h4>
        <CompactSlider label="Particle Count" storeKey="particleCount" min="0" max="300" step="5" />
        <CompactSlider label="Particle Speed" storeKey="particleSpeed" min="0" max="5" step="0.1" />
        <CompactSlider label="Wind Drift" storeKey="particleWind" min="-20" max="20" step="1" />
        <CompactSlider label="Flutter Sway" storeKey="particleSway" min="0" max="5" step="0.1" />
        <CompactSlider label="Particle Size" storeKey="particleSize" min="0.1" max="3.0" step="0.1" />
        <CompactSlider label="Particle Opacity" storeKey="particleOpacity" min="0" max="1" step="0.05" />
      </div>
      <div>
        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Volumetric Cave Fog</h4>
        <CompactSlider label="Fog Opacity" storeKey="fogOpacity" min="0" max="1" step="0.05" />
        <CompactSlider label="Fog Drift Speed" storeKey="fogSpeed" min="0" max="5" step="0.1" />
        <CompactSlider label="Fog Color: Red" storeKey="fogColorR" min="0" max="255" step="1" />
        <CompactSlider label="Fog Color: Green" storeKey="fogColorG" min="0" max="255" step="1" />
        <CompactSlider label="Fog Color: Blue" storeKey="fogColorB" min="0" max="255" step="1" />

        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '12px', marginBottom: '8px', color: 'var(--text-muted)' }}>Screen Overlay & Post</h4>
        <CompactSlider label="Scanline Density" storeKey="scanlineOpacity" min="0" max="1" step="0.05" />
        <CompactSlider label="Vignette Intensity" storeKey="vignetteOpacity" min="0" max="1" step="0.05" />
      </div>
    </div>
  );
}