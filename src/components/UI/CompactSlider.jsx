// src/components/UI/CompactSlider.jsx
import React from 'react';
import { useStore } from '../../store/useStore';
import { getRenderParameterDefinition } from '../../config/renderConfig.schema.js';

export default function CompactSlider({ label, storeKey, min, max, step }) {
  const definition = getRenderParameterDefinition(storeKey);
  const resolvedLabel = label ?? definition?.label ?? storeKey;
  const resolvedMin = min ?? definition?.min;
  const resolvedMax = max ?? definition?.max;
  const resolvedStep = step ?? definition?.step ?? 1;
  const value = useStore((state) => state[storeKey]);
  const setParameter = useStore((state) => state.setParameter);

  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
        <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
          {resolvedLabel}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent-color)' }}>
          {Number(value).toFixed(resolvedStep < 1 ? 2 : 0)}
        </span>
      </div>
      <input
        type="range" min={resolvedMin} max={resolvedMax} step={resolvedStep} value={value}
        onChange={(e) => setParameter(storeKey, parseFloat(e.target.value))}
        style={{ width: '100%', appearance: 'none', height: '2px', background: 'var(--border-color)', outline: 'none', cursor: 'pointer' }}
      />
    </div>
  );
}
