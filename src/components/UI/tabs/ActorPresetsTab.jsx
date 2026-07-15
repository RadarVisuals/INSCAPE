import React, { useState } from 'react';
import { useStore } from '../../../store/useStore';

const buttonStyle = {
  background: 'transparent',
  border: '1px solid var(--border-color)',
  color: 'var(--text-main)',
  padding: '6px 9px',
  fontSize: '9px',
  textTransform: 'uppercase',
  fontFamily: 'var(--font-mono)',
  cursor: 'pointer'
};

export default function ActorPresetsTab() {
  const presets = useStore((state) => state.actorPresets);
  const savePreset = useStore((state) => state.saveActorPreset);
  const applyPreset = useStore((state) => state.applyActorPreset);
  const deletePreset = useStore((state) => state.deleteActorPreset);
  const [name, setName] = useState('');

  const save = () => {
    if (!name.trim()) return;
    savePreset(name);
    setName('');
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '0.8fr 2fr', gap: '20px' }}>
      <section>
        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Capture Actor</h4>
        <p style={{ fontSize: '9px', lineHeight: 1.35, color: 'var(--text-muted)', marginBottom: '9px' }}>
          Saves geometry, warp, motion, eyes, phenomena, and atmosphere without replacing the selected actor.
        </p>
        <div style={{ display: 'flex', gap: '6px' }}>
          <input value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') save(); }} placeholder="preset name" style={{ minWidth: 0, flex: 1, background: '#1c1c1c', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '6px', fontSize: '10px', outline: 'none' }} />
          <button onClick={save} disabled={!name.trim()} style={{ ...buttonStyle, opacity: name.trim() ? 1 : 0.45 }}>Save</button>
        </div>
      </section>

      <section>
        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Saved Presets</h4>
        {presets.length === 0 ? (
          <p style={{ fontSize: '9px', color: 'var(--text-muted)' }}>No actor presets saved yet.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '6px' }}>
            {presets.map((preset) => (
              <div key={preset.id} style={{ border: '1px solid var(--border-color)', padding: '8px', background: 'rgba(255,255,255,0.02)' }}>
                <div style={{ fontSize: '10px', marginBottom: '7px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preset.name}</div>
                <div style={{ display: 'flex', gap: '5px' }}>
                  <button onClick={() => applyPreset(preset.id)} style={{ ...buttonStyle, borderColor: 'var(--accent-color)', flex: 1 }}>Apply</button>
                  <button onClick={() => deletePreset(preset.id)} style={{ ...buttonStyle, color: '#d66' }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
