// src/components/UI/tabs/SkullTab.jsx
import React from 'react';
import CompactSlider from '../CompactSlider';
import { useStore } from '../../../store/useStore';

export default function SkullTab() {
  const subjectMode = useStore((state) => state.subjectMode);
  const mutationMode = useStore((state) => state.mutationMode);
  const mutationSourceX = useStore((state) => state.mutationSourceX);
  const mutationSourceY = useStore((state) => state.mutationSourceY);
  const mutationPatternMode = useStore((state) => state.mutationPatternMode);
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
        <CompactSlider label="Pattern Bottom Scale" storeKey="patternBottomScale" min="0.5" max="3" step="0.1" />
        <CompactSlider label="Pattern Top Scale" storeKey="patternTopScale" min="0.5" max="3" step="0.1" />
        <CompactSlider label="Warp Intensity" storeKey="warpIntensity" min="0" max="100" step="1" />
        <CompactSlider label="Warp Speed" storeKey="warpSpeed" min="0" max="5" step="0.1" />
        <label style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Warp Behavior</label>
        <select value={warpMode} onChange={(e) => setParameter('warpMode', e.target.value)} style={{ ...selectStyle, marginBottom: '12px' }}>
          <option value="classic">Classic / Original</option>
          <option value="organic">Organic / Layered</option>
        </select>
        {warpMode === 'organic' && (
          <>
            <CompactSlider label="Morph Range" storeKey="warpOrganicRange" min="0" max="3" step="0.05" />
            <CompactSlider label="Layer Divergence" storeKey="warpLayerDivergence" min="0" max="1" step="0.05" />
            <CompactSlider label="Cursor Influence" storeKey="warpCursorInfluence" min="0" max="1" step="0.05" />
            <CompactSlider label="Cursor Radius" storeKey="warpCursorRadius" min="0.05" max="0.5" step="0.01" />
          </>
        )}
      </div>

      <div>
          <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Geometry Mutation</h4>

          <label style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Geometry</label>
          <select value={mutationMode} onChange={(e) => setParameter('mutationMode', e.target.value)} style={{ ...selectStyle, marginBottom: '8px' }}>
            <option value="none">Original</option>
            <option value="mirrorX">Mirror Left / Right</option>
            <option value="mirrorY">Mirror Top / Bottom</option>
            <option value="quad">Four Way</option>
          </select>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' }}>
            <div>
              <label style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>X Source</label>
              <select value={mutationSourceX} onChange={(e) => setParameter('mutationSourceX', e.target.value)} style={selectStyle}>
                <option value="left">Left</option>
                <option value="right">Right</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Y Source</label>
              <select value={mutationSourceY} onChange={(e) => setParameter('mutationSourceY', e.target.value)} style={selectStyle}>
                <option value="top">Top</option>
                <option value="bottom">Bottom</option>
              </select>
            </div>
          </div>

          {subjectMode === 'creator' && (
            <>
              <label style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Pattern Behavior</label>
              <select value={mutationPatternMode} onChange={(e) => setParameter('mutationPatternMode', e.target.value)} style={{ ...selectStyle, marginBottom: '8px' }}>
                <option value="symbiosis">Continuous / Symbiosis</option>
                <option value="mirrored">Mirror With Geometry</option>
              </select>
            </>
          )}

          <CompactSlider label="Vertical Axis" storeKey="mutationAxisX" min="0.05" max="0.95" step="0.001" />
          <CompactSlider label="Horizontal Axis" storeKey="mutationAxisY" min="0.05" max="0.95" step="0.001" />
          <CompactSlider label="Source Rotation Offset" storeKey="mutationRotation" min="-180" max="180" step="1" />

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
              <label style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Rotation Direction</label>
              <select
                value={mutationRotationDirection}
                onChange={(e) => setParameter('mutationRotationDirection', e.target.value)}
                style={{ ...selectStyle, marginBottom: '8px' }}
              >
                <option value="clockwise">Clockwise</option>
                <option value="counterclockwise">Counter-clockwise</option>
              </select>
              <CompactSlider label="Rotation Speed (Deg / Sec)" storeKey="mutationRotationSpeed" min="0" max="90" step="0.5" />
            </>
          )}
        </div>
    </div>
  );
}
