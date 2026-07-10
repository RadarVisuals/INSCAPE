// src/components/UI/CompactSlider.jsx
import React from 'react';
import { useStore } from '../../store/useStore';

export default function CompactSlider({ label, storeKey, min, max, step }) {
  const value = useStore((state) => state[storeKey]);
  const setParameter = useStore((state) => state.setParameter);

  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
        <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
          {label}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent-color)' }}>
          {Number(value).toFixed(step < 1 ? 2 : 0)}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => setParameter(storeKey, parseFloat(e.target.value))}
        style={{ width: '100%', appearance: 'none', height: '2px', background: 'var(--border-color)', outline: 'none', cursor: 'pointer' }}
      />
    </div>
  );
}