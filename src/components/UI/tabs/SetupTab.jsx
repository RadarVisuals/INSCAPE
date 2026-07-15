// src/components/UI/tabs/SetupTab.jsx
import React from 'react';
import { useStore } from '../../../store/useStore';
import { RENDER_PARAMETER_DEFINITIONS } from '../../../config/renderConfig.schema.js';

const availableActors = RENDER_PARAMETER_DEFINITIONS.characterId.options;
const backdropOptions = RENDER_PARAMETER_DEFINITIONS.bgClippingMaskId.options;
const mountainOptions = RENDER_PARAMETER_DEFINITIONS.bgMountainId.options;
const patternStyleOptions = RENDER_PARAMETER_DEFINITIONS.bgPatternStyle.options;

export default function SetupTab() {
  const characterId = useStore((state) => state.characterId);
  const bgClippingMaskId = useStore((state) => state.bgClippingMaskId);
  const bgPatternStyle = useStore((state) => state.bgPatternStyle);
  const bgMountainId = useStore((state) => state.bgMountainId);
  const bgMountainBackId = useStore((state) => state.bgMountainBackId);
  const setParameter = useStore((state) => state.setParameter);
  const selectStyle = {
    background: '#1c1c1c',
    border: '1px solid var(--border-color)',
    color: 'var(--text-main)',
    padding: '6px',
    fontSize: '10px',
    width: '100%',
    outline: 'none',
    cursor: 'pointer'
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '20px' }}>
      {/* Actor Column */}
      <div>
        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Actor Config</h4>

        <div style={{ marginBottom: '10px' }}>
            <label style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Active Character</label>
            <select
              value={characterId}
              onChange={(e) => setParameter('characterId', e.target.value)}
              style={selectStyle}
            >
              {availableActors.map(actor => (
                <option key={actor.value} value={actor.value}>{actor.label}</option>
              ))}
            </select>
        </div>
        <p style={{ fontSize: '9px', color: 'var(--text-muted)', lineHeight: '1.2' }}>
          * Loads an authored actor rig. Geometry mutation and effects are configured independently.
        </p>
      </div>

      {/* Background Column */}
      <div>
        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Background Stage Setup</h4>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '10px', marginBottom: '10px' }}>
          <div>
            <label style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Backdrop Color</label>
            <select
              value={bgClippingMaskId}
              onChange={(e) => setParameter('bgClippingMaskId', e.target.value)}
              style={{ background: '#1c1c1c', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '6px', fontSize: '10px', width: '100%', outline: 'none', cursor: 'pointer' }}
            >
              {backdropOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label.toUpperCase()}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Pattern Style</label>
            <select
              value={bgPatternStyle}
              onChange={(e) => setParameter('bgPatternStyle', e.target.value)}
              style={{ background: '#1c1c1c', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '6px', fontSize: '10px', width: '100%', outline: 'none', cursor: 'pointer' }}
            >
              {patternStyleOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
          <div>
            <label style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Back Mountain</label>
            <select
              value={bgMountainBackId}
              onChange={(e) => setParameter('bgMountainBackId', parseInt(e.target.value))}
              style={{ background: '#1c1c1c', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '6px', fontSize: '10px', width: '100%', outline: 'none', cursor: 'pointer' }}
            >
              {mountainOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Front Mountain</label>
            <select
              value={bgMountainId}
              onChange={(e) => setParameter('bgMountainId', parseInt(e.target.value))}
              style={{ background: '#1c1c1c', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '6px', fontSize: '10px', width: '100%', outline: 'none', cursor: 'pointer' }}
            >
              {mountainOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
