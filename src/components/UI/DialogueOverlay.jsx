// src/components/UI/DialogueOverlay.jsx
import React from 'react';
import { useStore } from '../../store/useStore';

export default function DialogueOverlay() {
  const activeDialog = useStore((state) => state.activeDialog); // e.g. "[HUMMING NOISES]" or null
  const setParameter = useStore((state) => state.setParameter);

  if (!activeDialog) return null;

  return (
    <div style={{
      position: 'absolute', bottom: '15%', left: '50%',
      transform: 'translateX(-50%)', zIndex: 100,
      background: 'rgba(5, 5, 5, 0.9)', border: '2px solid var(--accent-color)',
      padding: '20px 30px', width: '80%', maxWidth: '550px',
      fontFamily: 'var(--font-mono)', display: 'flex', flexDirection: 'column', gap: '15px'
    }}>
      <div style={{ fontSize: '12px', color: '#00f3ff', letterSpacing: '0.5px' }}>
        {activeDialog}
      </div>
      <button 
        onClick={() => setParameter('activeDialog', null)}
        style={{
          alignSelf: 'flex-end', background: 'transparent', border: 'none',
          color: 'var(--text-muted)', fontSize: '10px', cursor: 'pointer',
          textTransform: 'uppercase', fontFamily: 'var(--font-mono)'
        }}
      >
        continue ▾
      </button>
    </div>
  );
}