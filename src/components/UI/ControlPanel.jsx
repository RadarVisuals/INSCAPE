// src/components/UI/ControlPanel.jsx
import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { useWalletStore } from '../../store/useWalletStore';
import { 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  Skull, 
  Layers, 
  Sparkles, 
  Wind, 
  Zap,
  Sliders
} from 'lucide-react';

const CompactSlider = ({ label, storeKey, min, max, step }) => {
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
};

export default function ControlPanel() {
  const isUiVisible = useStore((state) => state.isUiVisible);
  const toggleUi = useStore((state) => state.toggleUi);
  const autoBlink = useStore((state) => state.autoBlink);
  const setParameter = useStore((state) => state.setParameter);

  const hostProfileAddress = useWalletStore((state) => state.hostProfileAddress);
  const isWalletConnected = useWalletStore((state) => state.isWalletConnected);
  const activeReaction = useStore((state) => state.activeReaction);
  const reactionProgress = useStore((state) => state.reactionProgress);

  const characterId = useStore((state) => state.characterId);
  const bgClippingMaskId = useStore((state) => state.bgClippingMaskId);
  const bgPatternStyle = useStore((state) => state.bgPatternStyle);
  const bgMountainId = useStore((state) => state.bgMountainId);

  const [activeTab, setActiveTab] = useState('setup');

  // List of active actors matching your folder names
  const availableActors = [
    { id: "skull_reaper", label: "Skull Reaper" },
    { id: "abyssal_eye", label: "Abyssal Eye" }
  ];

  // Configured backdrop options matching your backdrop files
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
    { id: "purple", label: "Purple" }
  ];

  // Configured mountain assets
  const mountainOptions = [
    { id: 1, label: "Mountain 01" },
    { id: 2, label: "Mountain 02" },
    { id: 3, label: "Mountain 03" }
  ];

  // Configured background pattern prefixes
  const patternStyleOptions = [
    { id: "bubble", label: "Bubble Style" },
    { id: "stone", label: "Stone Style" }
  ];

  const tabs = [
    { id: 'setup', label: 'Setup', icon: <Sliders size={12} /> },
    { id: 'web3', label: 'Web3', icon: <ShieldCheck size={12} /> },
    { id: 'skull', label: 'Skull', icon: <Skull size={12} /> },
    { id: 'bg', label: 'Background', icon: <Layers size={12} /> },
    { id: 'eyes', label: 'Eyes', icon: <Eye size={12} /> },
    { id: 'aura', label: 'Aura', icon: <Sparkles size={12} /> },
    { id: 'atmosphere', label: 'Atmosphere', icon: <Wind size={12} /> },
    { id: 'glitch', label: 'Glitch', icon: <Zap size={12} /> }
  ];

  return (
    <>
      <button
        onClick={toggleUi}
        style={{
          position: 'fixed', top: '15px', right: '15px', zIndex: 100,
          background: 'var(--panel-bg)', border: '1px solid var(--border-color)',
          color: 'var(--text-main)', width: '36px', height: '36px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', borderRadius: '0', 
        }}
      >
        {isUiVisible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>

      <div
        style={{
          position: 'fixed', bottom: 0, left: 0, width: '100%',
          background: 'var(--panel-bg)', borderTop: '1px solid var(--border-color)',
          zIndex: 50, padding: '15px', boxSizing: 'border-box',
          transform: isUiVisible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          display: 'flex', flexDirection: 'column', gap: '15px',
          maxHeight: '280px'
        }}
      >
        <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', scrollbarWidth: 'none' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: activeTab === tab.id ? 'var(--accent-color)' : 'transparent',
                border: '1px solid var(--border-color)', color: 'var(--text-main)',
                fontSize: '9px', textTransform: 'uppercase', padding: '6px 10px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-mono)',
                whiteSpace: 'nowrap'
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        <div style={{ overflowY: 'auto', flex: 1, paddingRight: '5px' }}>
          {activeTab === 'setup' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '20px' }}>
              {/* Actor Column */}
              <div>
                <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Actor Config</h4>
                
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Active Character</label>
                  <select
                    value={characterId}
                    onChange={(e) => setParameter('characterId', e.target.value)}
                    style={{ background: '#1c1c1c', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '6px', fontSize: '10px', width: '100%', outline: 'none', cursor: 'pointer' }}
                  >
                    {availableActors.map(actor => (
                      <option key={actor.id} value={actor.id}>{actor.label}</option>
                    ))}
                  </select>
                </div>
                
                <p style={{ fontSize: '9px', color: 'var(--text-muted)', lineHeight: '1.2' }}>
                  * The engine will load mask.webp, patterns, lineart, and eyes/eyelids from the actor's directory automatically.
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
                    <label style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Mountain Layer</label>
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
            </div>
          )}

          {activeTab === 'web3' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Connection status</h4>
                <div style={{ padding: '8px', border: '1px solid var(--border-color)', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
                  <div>Status: <span style={{ color: isWalletConnected ? '#00ff80' : '#8b0000', fontWeight: 'bold' }}>{isWalletConnected ? "CONNECTED" : "DISCONNECTED"}</span></div>
                  <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', marginTop: '2px', color: 'var(--text-muted)' }}>
                    UP: {hostProfileAddress || "No Context Resolved"}
                  </div>
                </div>
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
          )}

          {activeTab === 'skull' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Motion Dynamics</h4>
                <CompactSlider label="Float Speed" storeKey="floatSpeed" min="0" max="3" step="0.1" />
                <CompactSlider label="Float Amp X" storeKey="floatAmpX" min="0" max="100" step="1" />
                <CompactSlider label="Float Amp Y" storeKey="floatAmpY" min="0" max="100" step="1" />
                <CompactSlider label="Float Rotation" storeKey="floatRotation" min="0" max="10" step="0.1" />
              </div>
              <div>
                <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Foreground Skull</h4>
                <CompactSlider label="Pattern Bottom Scale" storeKey="patternBottomScale" min="0.5" max="3" step="0.1" />
                <CompactSlider label="Pattern Top Scale" storeKey="patternTopScale" min="0.5" max="3" step="0.1" />
                <CompactSlider label="Warp Intensity" storeKey="warpIntensity" min="0" max="100" step="1" />
                <CompactSlider label="Warp Speed" storeKey="warpSpeed" min="0" max="5" step="0.1" />
              </div>
            </div>
          )}

          {activeTab === 'bg' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Background Pattern</h4>
                <CompactSlider label="BG Pattern Bottom Scale" storeKey="bgPatternBottomScale" min="0.5" max="3" step="0.1" />
                <CompactSlider label="BG Pattern Top Scale" storeKey="bgPatternTopScale" min="0.5" max="3" step="0.1" />
                <CompactSlider label="BG Warp Intensity" storeKey="bgWarpIntensity" min="0" max="100" step="1" />
                <CompactSlider label="BG Warp Speed" storeKey="bgWarpSpeed" min="0" max="5" step="0.1" />
              </div>
              <div>
                <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Parallax Environment</h4>
                <CompactSlider label="BG Scroll Speed" storeKey="bgScrollSpeed" min="0" max="150" step="5" />
                <CompactSlider label="BG2 Parallax Factor" storeKey="bg2ParallaxSpeed" min="0" max="5" step="0.1" />
              </div>
            </div>
          )}

          {activeTab === 'eyes' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Eyelid Cycles</h4>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', height: '18px' }}>
                  <input
                    type="checkbox"
                    id="autoBlink"
                    checked={autoBlink}
                    onChange={(e) => setParameter('autoBlink', e.target.checked)}
                    style={{
                      cursor: 'pointer',
                      accentColor: 'var(--accent-color)',
                      width: '12px',
                      height: '12px',
                      background: 'none',
                      border: '1px solid var(--border-color)'
                    }}
                  />
                  <label htmlFor="autoBlink" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-main)', cursor: 'pointer', userSelect: 'none' }}>
                    Auto Blink
                  </label>
                </div>

                <CompactSlider label="Blink Interval" storeKey="blinkInterval" min="1" max="15" step="0.5" />
                <CompactSlider label="Blink Speed" storeKey="blinkSpeed" min="0.1" max="5" step="0.1" />
                <CompactSlider label="Eyelid Travel" storeKey="eyelidTravel" min="10" max="100" step="1" />
              </div>
              <div>
                <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Pupil Tracking</h4>
                <CompactSlider label="Manual Eyelid Openness" storeKey="eyelidManualProgress" min="0" max="1" step="0.05" />
                <CompactSlider label="Pupil Mouse Influence" storeKey="pupilMouseInfluence" min="0" max="2" step="0.1" />
                <CompactSlider label="Pupil Drift (Wander)" storeKey="pupilWander" min="0" max="3" step="0.1" />
                <CompactSlider label="Pupil Saccade Jitter" storeKey="pupilSaccade" min="0" max="3" step="0.1" />
              </div>
            </div>
          )}

          {activeTab === 'aura' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Aura Properties</h4>
                <CompactSlider label="Aura Scale" storeKey="auraScale" min="1.0" max="1.5" step="0.01" />
                <CompactSlider label="Aura Opacity" storeKey="auraOpacity" min="0" max="1" step="0.05" />
                <CompactSlider label="Aura Blur strength" storeKey="auraBlur" min="0" max="50" step="1" />
                <CompactSlider label="Aura Pulse Speed" storeKey="auraPulseSpeed" min="0" max="5" step="0.1" />
              </div>
              <div>
                <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Aura Tint (RGB)</h4>
                <CompactSlider label="Red Channel" storeKey="auraColorR" min="0" max="255" step="1" />
                <CompactSlider label="Green Channel" storeKey="auraColorG" min="0" max="255" step="1" />
                <CompactSlider label="Blue Channel" storeKey="auraColorB" min="0" max="255" step="1" />
              </div>
            </div>
          )}

          {activeTab === 'atmosphere' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Particulate Shards</h4>
                <CompactSlider label="Particle Count" storeKey="particleCount" min="0" max="300" step="5" />
                <CompactSlider label="Particle Speed" storeKey="particleSpeed" min="0" max="5" step="0.1" />
                <CompactSlider label="Wind Drift" storeKey="particleWind" min="-20" max="20" step="1" />
                <CompactSlider label="Flutter Sway" storeKey="particleSway" min="0" max="5" step="0.1" />
                <CompactSlider label="Particle Size" storeKey="particleSize" min="0.1" max="3.0" step="0.1" />
                <CompactSlider label="Particle Opacity" storeKey="particleOpacity" min="0" max="1" step="0.05" />
              </div>
              <div>
                <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Screen Overlay</h4>
                <CompactSlider label="Scanline Density" storeKey="scanlineOpacity" min="0" max="1" step="0.05" />
                <CompactSlider label="Vignette Intensity" storeKey="vignetteOpacity" min="0" max="1" step="0.05" />
              </div>
            </div>
          )}

          {activeTab === 'glitch' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Chromatic Split</h4>
                <CompactSlider label="RGB Split Amount" storeKey="aberrationAmount" min="0" max="30" step="0.5" />
                <CompactSlider label="Aberration Speed" storeKey="aberrationSpeed" min="0" max="10" step="0.1" />
                <CompactSlider label="Glitch Burst Chance" storeKey="aberrationGlitch" min="0" max="5" step="0.1" />
              </div>
              <div>
                <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Corruption & Flicker</h4>
                <CompactSlider label="Flicker Intensity" storeKey="flickerIntensity" min="0" max="0.9" step="0.05" />
                <CompactSlider label="Flicker Speed" storeKey="flickerSpeed" min="0" max="5" step="0.1" />
                <CompactSlider label="Screen Shake" storeKey="glitchShakeIntensity" min="0" max="30" step="1" />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}