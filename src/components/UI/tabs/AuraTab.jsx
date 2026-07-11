// src/components/UI/tabs/AuraTab.jsx
import React from 'react';
import CompactSlider from '../CompactSlider';

export default function AuraTab() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
      <div>
        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Aura Properties</h4>
        <CompactSlider label="Aura Scale" storeKey="auraScale" min="1.0" max="1.5" step="0.01" />
        <CompactSlider label="Aura Opacity" storeKey="auraOpacity" min="0" max="1" step="0.05" />
        <CompactSlider label="Aura Blur strength" storeKey="auraBlur" min="0" max="50" step="1" />
        <CompactSlider label="Aura Pulse Speed" storeKey="auraPulseSpeed" min="0" max="5" step="0.1" />
      </div>
      <div>
        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Cavern Light & Tint (RGB)</h4>
        <CompactSlider label="Cavern Light Intensity" storeKey="cavernLightIntensity" min="0" max="2" step="0.05" />
        <CompactSlider label="Red Channel" storeKey="auraColorR" min="0" max="255" step="1" />
        <CompactSlider label="Green Channel" storeKey="auraColorG" min="0" max="255" step="1" />
        <CompactSlider label="Blue Channel" storeKey="auraColorB" min="0" max="255" step="1" />
      </div>
    </div>
  );
}