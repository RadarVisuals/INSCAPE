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
        {['floatSpeed', 'floatAmpX', 'floatAmpY', 'flyTiltBias', 'flyHoverPause'].map((storeKey) => <CompactSlider key={storeKey} storeKey={storeKey} />)}
      </div>
      <div>
        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Skull Flight Scaling</h4>
        {['flyMinScale', 'flyMaxScale', 'floatRotation'].map((storeKey) => <CompactSlider key={storeKey} storeKey={storeKey} />)}
        
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
