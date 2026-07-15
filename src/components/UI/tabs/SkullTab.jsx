// src/components/UI/tabs/SkullTab.jsx
import React from 'react';
import CompactSlider from '../CompactSlider';
import { useStore } from '../../../store/useStore';
import { getRenderParameterDefinition } from '../../../config/renderConfig.schema.js';

function ParameterSelect({ storeKey, value, onChange, style }) {
  const definition = getRenderParameterDefinition(storeKey);
  return (
    <div>
      <label style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>{definition.label}</label>
      <select value={value} onChange={(event) => onChange(event.target.value)} style={style}>
        {definition.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  );
}

export default function SkullTab() {
  const mutationMode = useStore((state) => state.mutationMode);
  const mutationSourceX = useStore((state) => state.mutationSourceX);
  const mutationSourceY = useStore((state) => state.mutationSourceY);
  const mutationAutoRotate = useStore((state) => state.mutationAutoRotate);
  const mutationRotationDirection = useStore((state) => state.mutationRotationDirection);
  const warpMode = useStore((state) => state.warpMode);
  const setParameter = useStore((state) => state.setParameter);

  const selectStyle = {
    background: '#1c1c1c',
    border: '1px solid var(--border-color)',
    color: 'var(--text-main)',
    padding: '5px',
    fontSize: '9px',
    width: '100%',
    outline: 'none'
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
      <div>
        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Flight & Hover Controls</h4>
        <CompactSlider label="Float Speed" storeKey="floatSpeed" min="0" max="3" step="0.1" />
        <CompactSlider label="Float Amp X (Sway)" storeKey="floatAmpX" min="0" max="400" step="2" />
        <CompactSlider label="Float Amp Y (Rise)" storeKey="floatAmpY" min="0" max="400" step="2" />
        <CompactSlider label="Tilt Bias (Degrees)" storeKey="flyTiltBias" min="-20" max="20" step="0.5" />
        <CompactSlider label="Hover Pause Factor" storeKey="flyHoverPause" min="1.0" max="5.0" step="0.1" />
      </div>
      <div>
        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Skull Flight Scaling</h4>
        <CompactSlider label="Scale at Lowest Point" storeKey="flyMinScale" min="0.5" max="1.5" step="0.05" />
        <CompactSlider label="Scale at Highest Peak" storeKey="flyMaxScale" min="0.3" max="1.2" step="0.05" />
        <CompactSlider label="Wobble Rotation Osc" storeKey="floatRotation" min="0" max="10" step="0.1" />
        
        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '10px', marginBottom: '8px', color: 'var(--text-muted)' }}>Skull Warp</h4>
        {['patternBottomScale', 'patternTopScale', 'warpIntensity', 'warpSpeed'].map((storeKey) => <CompactSlider key={storeKey} storeKey={storeKey} />)}
        <ParameterSelect storeKey="warpMode" value={warpMode} onChange={(value) => setParameter('warpMode', value)} style={{ ...selectStyle, marginBottom: '12px' }} />
        {warpMode === 'organic' && (
          <>
            {['warpOrganicRange', 'warpLayerDivergence', 'warpCursorInfluence', 'warpCursorRadius'].map((storeKey) => <CompactSlider key={storeKey} storeKey={storeKey} />)}
          </>
        )}
      </div>

      <div>
          <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Geometry Mutation</h4>

          <ParameterSelect storeKey="mutationMode" value={mutationMode} onChange={(value) => setParameter('mutationMode', value)} style={{ ...selectStyle, marginBottom: '8px' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' }}>
            <div>
              <ParameterSelect storeKey="mutationSourceX" value={mutationSourceX} onChange={(value) => setParameter('mutationSourceX', value)} style={selectStyle} />
            </div>
            <div>
              <ParameterSelect storeKey="mutationSourceY" value={mutationSourceY} onChange={(value) => setParameter('mutationSourceY', value)} style={selectStyle} />
            </div>
          </div>

          {['mutationAxisX', 'mutationAxisY', 'mutationRotation'].map((storeKey) => <CompactSlider key={storeKey} storeKey={storeKey} />)}

          <label style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', margin: '8px 0' }}>
            <input
              type="checkbox"
              checked={mutationAutoRotate}
              onChange={(e) => setParameter('mutationAutoRotate', e.target.checked)}
            />
            Auto Source Rotation
          </label>

          {mutationAutoRotate && (
            <>
              <ParameterSelect storeKey="mutationRotationDirection" value={mutationRotationDirection} onChange={(value) => setParameter('mutationRotationDirection', value)} style={{ ...selectStyle, marginBottom: '8px' }} />
              <CompactSlider storeKey="mutationRotationSpeed" />
            </>
          )}
        </div>
    </div>
  );
}
