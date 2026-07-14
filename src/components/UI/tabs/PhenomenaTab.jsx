import React from 'react';
import { useStore } from '../../../store/useStore';
import CompactSlider from '../CompactSlider';

function Toggle({ label, storeKey }) {
  const value = useStore((state) => state[storeKey]);
  const setParameter = useStore((state) => state.setParameter);
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '10px', color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase' }}>
      <input type="checkbox" checked={value !== false} onChange={(event) => setParameter(storeKey, event.target.checked)} />
      {label}
    </label>
  );
}

const Heading = ({ children }) => (
  <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>{children}</h4>
);

export default function PhenomenaTab() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(190px, 1fr))', gap: '18px' }}>
      <section>
        <Heading>Vein Pulse</Heading>
        <Toggle label="Enabled" storeKey="veinEnabled" />
        <CompactSlider label="Intensity" storeKey="veinIntensity" min="0" max="2" step="0.01" />
        <CompactSlider label="Reaction Boost" storeKey="veinReactionBoost" min="0" max="2" step="0.01" />
        <CompactSlider label="Speed" storeKey="veinSpeed" min="0" max="4" step="0.01" />
        <CompactSlider label="Branch Scale" storeKey="veinScale" min="1" max="40" step="0.1" />
        <CompactSlider label="Width" storeKey="veinWidth" min="0.2" max="3" step="0.01" />
        <CompactSlider label="Core Light" storeKey="veinCore" min="0" max="3" step="0.01" />
        <CompactSlider label="Source X" storeKey="veinSourceX" min="0" max="1" step="0.01" />
        <CompactSlider label="Source Y" storeKey="veinSourceY" min="0" max="1" step="0.01" />
        <CompactSlider label="Color R" storeKey="veinColorR" min="0" max="255" step="1" />
        <CompactSlider label="Color G" storeKey="veinColorG" min="0" max="255" step="1" />
        <CompactSlider label="Color B" storeKey="veinColorB" min="0" max="255" step="1" />
      </section>
      <section>
        <Heading>Captive Weather</Heading>
        <Toggle label="Enabled" storeKey="weatherEnabled" />
        <CompactSlider label="Intensity" storeKey="weatherIntensity" min="0" max="1.5" step="0.01" />
        <CompactSlider label="Scale" storeKey="weatherScale" min="0.5" max="8" step="0.01" />
        <CompactSlider label="Speed" storeKey="weatherSpeed" min="0" max="3" step="0.01" />
        <CompactSlider label="Color R" storeKey="weatherColorR" min="0" max="255" step="1" />
        <CompactSlider label="Color G" storeKey="weatherColorG" min="0" max="255" step="1" />
        <CompactSlider label="Color B" storeKey="weatherColorB" min="0" max="255" step="1" />
      </section>
      <section>
        <Heading>Layer Transfusion</Heading>
        <Toggle label="Enabled" storeKey="transfusionEnabled" />
        <CompactSlider label="Intensity" storeKey="transfusionIntensity" min="0" max="1" step="0.01" />
        <CompactSlider label="Territory Scale" storeKey="transfusionScale" min="0.5" max="12" step="0.01" />
        <CompactSlider label="Balance" storeKey="transfusionBalance" min="0" max="1" step="0.01" />
        <CompactSlider label="Membrane Edge" storeKey="transfusionEdge" min="0" max="1" step="0.01" />
        <Heading>Shed Skin</Heading>
        <Toggle label="Enabled" storeKey="shedSkinEnabled" />
        <CompactSlider label="Shell Count" storeKey="shedSkinCount" min="0" max="8" step="1" />
        <CompactSlider label="Frame Spacing" storeKey="shedSkinSpacing" min="1" max="16" step="1" />
        <CompactSlider label="Lifetime" storeKey="shedSkinLifetime" min="0.08" max="3" step="0.01" />
        <CompactSlider label="Opacity" storeKey="shedSkinOpacity" min="0" max="1" step="0.01" />
        <CompactSlider label="Motion Threshold" storeKey="shedSkinMotionThreshold" min="0" max="1" step="0.01" />
        <CompactSlider label="Full Speed" storeKey="shedSkinFullSpeed" min="0.1" max="5" step="0.05" />
        <CompactSlider label="Age Fade" storeKey="shedSkinFade" min="0.2" max="3" step="0.05" />
        <CompactSlider label="Backslide" storeKey="shedSkinBackslide" min="0" max="80" step="1" />
        <CompactSlider label="Upward Drift" storeKey="shedSkinDrift" min="0" max="20" step="0.5" />
        <CompactSlider label="Shell Expansion" storeKey="shedSkinExpansion" min="0" max="0.08" step="0.001" />
        <CompactSlider label="Dissolve" storeKey="shedSkinDissolve" min="0" max="1" step="0.01" />
        <CompactSlider label="Color Mix" storeKey="shedSkinColorMix" min="0" max="1" step="0.01" />
        <CompactSlider label="Color R" storeKey="shedSkinColorR" min="0" max="255" step="1" />
        <CompactSlider label="Color G" storeKey="shedSkinColorG" min="0" max="255" step="1" />
        <CompactSlider label="Color B" storeKey="shedSkinColorB" min="0" max="255" step="1" />
      </section>
      <section>
        <Heading>Boundary Tendrils</Heading>
        <CompactSlider label="Amount" storeKey="tendrilAmount" min="0" max="1" step="0.01" />
        <CompactSlider label="Count" storeKey="tendrilCount" min="0" max="8" step="1" />
        <CompactSlider label="Length" storeKey="tendrilLength" min="20" max="500" step="1" />
        <CompactSlider label="Width" storeKey="tendrilWidth" min="0.15" max="3" step="0.01" />
        <CompactSlider label="Wave" storeKey="tendrilWave" min="0" max="5" step="0.01" />
        <CompactSlider label="Wave Repeats" storeKey="tendrilWaveRepeats" min="0.5" max="8" step="0.01" />
      </section>
      <section>
        <Heading>Tendril Motion</Heading>
        <CompactSlider label="Speed" storeKey="tendrilSpeed" min="0" max="3" step="0.01" />
        <CompactSlider label="Pulse" storeKey="tendrilPulse" min="0" max="0.45" step="0.01" />
        <CompactSlider label="Alignment" storeKey="tendrilAlignment" min="0" max="1" step="0.01" />
        <CompactSlider label="Turn Speed" storeKey="tendrilTurnSpeed" min="0.5" max="12" step="0.1" />
        <CompactSlider label="Movement Response" storeKey="tendrilMovement" min="0" max="2" step="0.01" />
      </section>
    </div>
  );
}
