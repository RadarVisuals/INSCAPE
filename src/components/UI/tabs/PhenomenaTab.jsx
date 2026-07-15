import React from 'react';
import { useStore } from '../../../store/useStore';
import CompactSlider from '../CompactSlider';
import { getRenderParameterDefinition } from '../../../config/renderConfig.schema.js';

function Toggle({ storeKey }) {
  const definition = getRenderParameterDefinition(storeKey);
  const value = useStore((state) => state[storeKey]);
  const setParameter = useStore((state) => state.setParameter);
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '10px', color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase' }}>
      <input type="checkbox" checked={value !== false} onChange={(event) => setParameter(storeKey, event.target.checked)} />
      {definition?.label ?? storeKey}
    </label>
  );
}

const Heading = ({ children }) => (
  <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>{children}</h4>
);

export default function PhenomenaTab() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(190px, 1fr))', gap: '18px' }}>
      <section>
        <Heading>Vein Pulse</Heading>
        <Toggle storeKey="veinEnabled" />
        {['veinIntensity', 'veinReactionBoost', 'veinSpeed', 'veinScale', 'veinWidth', 'veinCore', 'veinSourceX', 'veinSourceY', 'veinColorR', 'veinColorG', 'veinColorB'].map((storeKey) => <CompactSlider key={storeKey} storeKey={storeKey} />)}
      </section>
      <section>
        <Heading>Captive Weather</Heading>
        <Toggle storeKey="weatherEnabled" />
        {['weatherIntensity', 'weatherScale', 'weatherSpeed', 'weatherColorR', 'weatherColorG', 'weatherColorB'].map((storeKey) => <CompactSlider key={storeKey} storeKey={storeKey} />)}
      </section>
      <section>
        <Heading>Shed Skin</Heading>
        <Toggle storeKey="shedSkinEnabled" />
        {['shedSkinCount', 'shedSkinSpacing', 'shedSkinLifetime', 'shedSkinOpacity', 'shedSkinMotionThreshold', 'shedSkinFullSpeed', 'shedSkinFade', 'shedSkinBackslide', 'shedSkinDrift', 'shedSkinExpansion', 'shedSkinDissolve', 'shedSkinColorMix', 'shedSkinColorR', 'shedSkinColorG', 'shedSkinColorB'].map((storeKey) => <CompactSlider key={storeKey} storeKey={storeKey} />)}
      </section>
    </div>
  );
}
