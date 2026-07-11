// src/components/UI/tabs/Web3Tab.jsx
import React from 'react';
import { useStore } from '../../../store/useStore';
import { useWalletStore } from '../../../store/useWalletStore';
import CompactSlider from '../CompactSlider';

export default function Web3Tab() {
  const hostProfileAddress = useWalletStore((state) => state.hostProfileAddress);
  const isWalletConnected = useWalletStore((state) => state.isWalletConnected);
  const activeReaction = useStore((state) => state.activeReaction);
  const reactionProgress = useStore((state) => state.reactionProgress);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
      <div>
        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Connection status</h4>
        <div style={{ padding: '8px', border: '1px solid var(--border-color)', fontSize: '10px', fontFamily: 'var(--font-mono)', marginBottom: '12px' }}>
          <div>Status: <span style={{ color: isWalletConnected ? '#00ff80' : '#8b0000', fontWeight: 'bold' }}>{isWalletConnected ? "CONNECTED" : "DISCONNECTED"}</span></div>
          <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', marginTop: '2px', color: 'var(--text-muted)' }}>
            UP: {hostProfileAddress || "No Context Resolved"}
          </div>
        </div>

        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Shockwave Rig Setup</h4>
        <CompactSlider label="Shockwave Strength" storeKey="shockwaveStrength" min="0" max="2" step="0.1" />
        <CompactSlider label="Wavefront Thickness" storeKey="shockwaveThickness" min="50" max="300" step="10" />
        <CompactSlider label="Ripple Expansion Time" storeKey="shockwaveDuration" min="0.5" max="4" step="0.1" />
        <CompactSlider label="Cascading Ripple Count" storeKey="shockwavePulseCount" min="1" max="5" step="1" />
      </div>
      <div>
        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>LSP1 Simulators</h4>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => window.simulateGothicEvent && window.simulateGothicEvent('lyx_received')}
            style={{ flex: 1, background: 'transparent', border: '1px solid #ff5500', color: '#ff9900', padding: '6px', fontSize: '9px', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}
          >
            🔥 LYX
          </button>
          <button
            onClick={() => window.simulateGothicEvent && window.simulateGothicEvent('lsp8_received')}
            style={{ flex: 1, background: 'transparent', border: '1px solid #00f3ff', color: '#00f3ff', padding: '6px', fontSize: '9px', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}
          >
            👾 NFT
          </button>
        </div>
        {activeReaction && (
          <div style={{ marginTop: '8px', fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
            Decaying: <span style={{ color: 'var(--text-main)' }}>{activeReaction.toUpperCase()} ({Math.round(reactionProgress * 100)}%)</span>
          </div>
        )}
      </div>
    </div>
  );
}