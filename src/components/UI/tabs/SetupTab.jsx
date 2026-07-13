// src/components/UI/tabs/SetupTab.jsx
import React, { useEffect, useState } from 'react';
import { useStore } from '../../../store/useStore';

const availableActors = [
  { id: "skull_reaper", label: "Skull Reaper" },
  { id: "abyssal_eye", label: "Abyssal Eye" }
];

const backdropOptions = [
  { id: "beige", label: "Beige Backdrop" },
  { id: "black", label: "Black Backdrop" },
  { id: "darkblue", label: "Dark Blue" },
  { id: "darkgrey", label: "Dark Grey" },
  { id: "hotpink", label: "Hot Pink" },
  { id: "lightblue", label: "Light Blue" },
  { id: "lightgrey", label: "Light Grey" },
  { id: "orange", label: "Orange" },
  { id: "pastelpurple", label: "Pastel Purple" },
  { id: "purple", label: "Purple" },
  { id: "moonpurple", label: "Moon Purple" }
];

const mountainOptions = [
  { id: 1, label: "Mountain 01" },
  { id: 2, label: "Mountain 02" },
  { id: 3, label: "Mountain 03" }
];

const patternStyleOptions = [
  { id: "bubble", label: "Bubble Style" },
  { id: "stone", label: "Stone Style" },
  { id: "digitalblob", label: "Digital Blob" }
];

export default function SetupTab() {
  const subjectMode = useStore((state) => state.subjectMode);
  const characterId = useStore((state) => state.characterId);
  const creatorCharacterId = useStore((state) => state.creatorCharacterId);
  const creatorPatternId = useStore((state) => state.creatorPatternId);
  const creatorPaletteId = useStore((state) => state.creatorPaletteId);
  const bgClippingMaskId = useStore((state) => state.bgClippingMaskId);
  const bgPatternStyle = useStore((state) => state.bgPatternStyle);
  const bgMountainId = useStore((state) => state.bgMountainId);
  const bgMountainBackId = useStore((state) => state.bgMountainBackId);
  const setParameter = useStore((state) => state.setParameter);
  const [creatorManifest, setCreatorManifest] = useState(null);
  const [manifestError, setManifestError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/assets/manifest.json')
      .then((response) => {
        if (!response.ok) throw new Error(`Manifest request failed (${response.status})`);
        return response.json();
      })
      .then((manifest) => {
        if (!cancelled) setCreatorManifest(manifest);
      })
      .catch((error) => {
        if (!cancelled) setManifestError(error.message);
      });

    return () => {
      cancelled = true;
    };
  }, []);

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
          <label style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Subject Source</label>
          <select
            value={subjectMode}
            onChange={(e) => setParameter('subjectMode', e.target.value)}
            style={selectStyle}
          >
            <option value="actor">Current Animated Actors</option>
            <option value="creator">Creator Mutation Test</option>
          </select>
        </div>

        {subjectMode === 'actor' ? (
          <div style={{ marginBottom: '10px' }}>
            <label style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Active Character</label>
            <select
              value={characterId}
              onChange={(e) => setParameter('characterId', e.target.value)}
              style={selectStyle}
            >
              {availableActors.map(actor => (
                <option key={actor.id} value={actor.id}>{actor.label}</option>
              ))}
            </select>
          </div>
        ) : creatorManifest ? (
          <div style={{ display: 'grid', gridTemplateColumns: '0.7fr 1.3fr 1fr', gap: '6px', marginBottom: '10px' }}>
            <div>
              <label style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Seed</label>
              <select value={creatorCharacterId} onChange={(e) => setParameter('creatorCharacterId', e.target.value)} style={selectStyle}>
                {creatorManifest.characters.map((id) => <option key={id} value={id}>{id}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Pattern</label>
              <select value={creatorPatternId} onChange={(e) => setParameter('creatorPatternId', e.target.value)} style={selectStyle}>
                {creatorManifest.patterns.map((id) => <option key={id} value={id}>{id}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Palette</label>
              <select value={creatorPaletteId} onChange={(e) => setParameter('creatorPaletteId', e.target.value)} style={selectStyle}>
                {creatorManifest.palettes.map((id) => <option key={id} value={id}>{id.replace('basic_', '')}</option>)}
              </select>
            </div>
          </div>
        ) : (
          <p style={{ fontSize: '9px', color: manifestError ? '#d66' : 'var(--text-muted)', marginBottom: '10px' }}>
            {manifestError || 'Loading creator manifest…'}
          </p>
        )}
        
        <p style={{ fontSize: '9px', color: 'var(--text-muted)', lineHeight: '1.2' }}>
          {subjectMode === 'actor'
            ? "* Loads the current actor rig without using creator-library assets."
            : "* Loads only manifest-listed creator masks, shared patterns, and palettes."}
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
                <option key={option.id} value={option.id}>{option.label.toUpperCase()}</option>
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
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
          <div>
            <label style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Back Mountain</label>
            <select
              value={bgMountainBackId}
              onChange={(e) => setParameter('bgMountainBackId', parseInt(e.target.value) || 1)}
              style={{ background: '#1c1c1c', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '6px', fontSize: '10px', width: '100%', outline: 'none', cursor: 'pointer' }}
            >
              {mountainOptions.map(option => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Front Mountain</label>
            <select
              value={bgMountainId}
              onChange={(e) => setParameter('bgMountainId', parseInt(e.target.value) || 1)}
              style={{ background: '#1c1c1c', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '6px', fontSize: '10px', width: '100%', outline: 'none', cursor: 'pointer' }}
            >
              {mountainOptions.map(option => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
