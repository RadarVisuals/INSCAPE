// src/components/UI/tabs/Web3Tab.jsx
import React, { useRef, useEffect } from 'react';
import { useStore } from '../../../store/useStore';
import { useWalletStore } from '../../../store/useWalletStore';
import CompactSlider from '../CompactSlider';

/**
 * Dynamically binds high-frequency custom events to a target DOM node 
 * to avoid triggering parent-level React render cycles.
 */
function ReactionProgressDisplay({ activeReaction }) {
  const labelRef = useRef(null);

  useEffect(() => {
    const handleProgress = (e) => {
      if (labelRef.current) {
        labelRef.current.textContent = `${activeReaction.toUpperCase()} (${Math.round(e.detail.progress * 100)}%)`;
      }
    };

    if (labelRef.current) {
      labelRef.current.textContent = `${activeReaction.toUpperCase()} (100%)`;
    }

    window.addEventListener('gothic-reaction-progress', handleProgress);
    return () => {
      window.removeEventListener('gothic-reaction-progress', handleProgress);
    };
  }, [activeReaction]);

  return (
    <span ref={labelRef} style={{ color: 'var(--text-main)' }} />
  );
}

export default function Web3Tab() {
  const hostProfileAddress = useWalletStore((state) => state.hostProfileAddress);
  const isWalletConnected = useWalletStore((state) => state.isWalletConnected);
  const profileMetadata = useWalletStore((state) => state.profileMetadata);
  const isProfileLoading = useWalletStore((state) => state.isProfileLoading);
  const activeReaction = useStore((state) => state.activeReaction);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
      <div>
        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Connection status</h4>
        
        {/* Dynamic Universal Profile Metadata Display without description/bio */}
        {isWalletConnected && profileMetadata ? (
          <div style={{ 
            display: 'flex', 
            gap: '12px', 
            padding: '10px', 
            border: '1px solid var(--border-color)', 
            background: 'rgba(255, 255, 255, 0.02)',
            marginBottom: '12px',
            alignItems: 'center'
          }}>
            {/* Avatar Frame */}
            {profileMetadata.avatarUrl ? (
              <img 
                src={profileMetadata.avatarUrl} 
                alt={profileMetadata.name} 
                style={{ 
                  width: '42px', 
                  height: '42px', 
                  border: '1px solid var(--border-color)',
                  objectFit: 'cover',
                  display: 'block'
                }} 
              />
            ) : (
              <div style={{ 
                width: '42px', 
                height: '42px', 
                border: '1px solid var(--border-color)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                background: 'var(--border-color)',
                fontSize: '14px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 'bold',
                color: 'var(--text-main)'
              }}>
                {profileMetadata.name ? profileMetadata.name.substring(0, 1).toUpperCase() : "?"}
              </div>
            )}

            {/* Profile Info Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                <span style={{ 
                  fontSize: '11px', 
                  fontWeight: 'bold', 
                  color: '#00ff80',
                  fontFamily: 'var(--font-mono)',
                  textTransform: 'uppercase',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap'
                }}>
                  {profileMetadata.name}
                </span>
                <span style={{ fontSize: '8px', color: '#00ff80', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>[CONNECTED]</span>
              </div>
              
              <div style={{ 
                fontSize: '8px', 
                fontFamily: 'var(--font-mono)', 
                color: 'var(--text-muted)',
                textOverflow: 'ellipsis',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                marginTop: '1px'
              }}>
                UP: {hostProfileAddress}
              </div>
            </div>
          </div>
        ) : isWalletConnected && isProfileLoading ? (
          <div style={{ 
            padding: '16px 12px', 
            border: '1px solid var(--border-color)', 
            fontSize: '9px', 
            fontFamily: 'var(--font-mono)', 
            color: 'var(--text-muted)', 
            marginBottom: '12px',
            textAlign: 'center',
            letterSpacing: '0.5px'
          }}>
            [ QUERYING UNIVERSAL PROFILE METADATA... ]
          </div>
        ) : (
          /* Disconnected Status Block */
          <div style={{ padding: '8px', border: '1px solid var(--border-color)', fontSize: '10px', fontFamily: 'var(--font-mono)', marginBottom: '12px' }}>
            <div>Status: <span style={{ color: isWalletConnected ? '#00ff80' : '#8b0000', fontWeight: 'bold' }}>{isWalletConnected ? "CONNECTED" : "DISCONNECTED"}</span></div>
            <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', marginTop: '2px', color: 'var(--text-muted)' }}>
              UP: {hostProfileAddress || "No Context Resolved"}
            </div>
          </div>
        )}

        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Shockwave Rig Setup</h4>
        <CompactSlider storeKey="shockwaveStrength" />
        <CompactSlider storeKey="shockwaveThickness" />
        <CompactSlider storeKey="shockwaveDuration" />
        <CompactSlider storeKey="shockwavePulseCount" />
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
            Decaying: <ReactionProgressDisplay activeReaction={activeReaction} />
          </div>
        )}
      </div>
    </div>
  );
}
