// src/components/UI/tabs/GlitchTab.jsx
import React from 'react';
import CompactSlider from '../CompactSlider';

export default function GlitchTab() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
      <div>
        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Chromatic Split & Shocks</h4>
        <CompactSlider label="RGB Split Amount" storeKey="aberrationAmount" min="0" max="30" step="0.5" />
        <CompactSlider label="Aberration Speed" storeKey="aberrationSpeed" min="0" max="10" step="0.1" />
        <CompactSlider label="Glitch Burst Chance" storeKey="aberrationGlitch" min="0" max="5" step="0.1" />
        <CompactSlider label="Flicker Intensity" storeKey="flickerIntensity" min="0" max="0.9" step="0.05" />
        <CompactSlider label="Flicker Speed" storeKey="flickerSpeed" min="0" max="5" step="0.1" />
        <CompactSlider label="Screen Shake" storeKey="glitchShakeIntensity" min="0" max="30" step="1" />
      </div>
      <div>
        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Echoing Phase Trails</h4>
        <CompactSlider label="Trail Count" storeKey="trailCount" min="0" max="3" step="1" />
        <CompactSlider label="Frame Step Spacing" storeKey="trailSpacing" min="2" max="15" step="1" />
        <CompactSlider label="Manual Test Alpha" storeKey="trailManualAlpha" min="0" max="1" step="0.05" />
        <CompactSlider label="Glitch/Web3 Influence" storeKey="trailGlitchInfluence" min="0" max="1" step="0.05" />
      </div>
    </div>
  );
}