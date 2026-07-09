# 📦 Gothic Art Animator Codebase Dump
This file compiled your active components, stores, styles, layouts, and engine scripts.

---
### `index.html`
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>Gothic Art Animator</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

---
### `package.json`
```json
{
  "name": "gothic-animator",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@erc725/erc725.js": "^0.28.2",
    "@lukso/up-provider": "^0.3.7",
    "buffer": "^6.0.3",
    "lucide-react": "^0.370.0",
    "pixi-filters": "^6.1.5",
    "pixi.js": "^8.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "viem": "^2.54.6",
    "zustand": "^4.5.2"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^5.2.0"
  }
}

```

---
### `src\App.jsx`
```javascript
// src/App.jsx
import React, { useEffect } from 'react';
import ArtCanvas from './components/Canvas/ArtCanvas';
import ControlPanel from './components/UI/ControlPanel';
import { useWalletStore } from './store/useWalletStore';
import { useArtworkReactions } from './hooks/useArtworkReactions';

function App() {
  const initWallet = useWalletStore((s) => s.initWallet);

  // Initialize wallet hooks and postMessage channels
  useEffect(() => {
    initWallet();
  }, [initWallet]);

  // Start the background reaction watcher
  useArtworkReactions();

  return (
    <>
      <ArtCanvas />
      <ControlPanel />
    </>
  );
}

export default App;
```

---
### `src\components\Canvas\ArtCanvas.jsx`
```javascript
// src/components/Canvas/ArtCanvas.jsx
import { useEffect, useRef } from 'react';
import { PixiEngine } from '../../engine/PixiEngine';
import { useStore } from '../../store/useStore';

export default function ArtCanvas() {
  const containerRef = useRef(null);
  const engineRef = useRef(null);
  const setMousePos = useStore((state) => state.setMousePos);
  
  // Grab overlay params from store
  const scanlineOpacity = useStore((state) => state.scanlineOpacity);
  const vignetteOpacity = useStore((state) => state.vignetteOpacity);

  useEffect(() => {
    if (engineRef.current || !containerRef.current) return;
    engineRef.current = new PixiEngine(containerRef.current);
    engineRef.current.init().catch(err => console.error("Failed to boot PixiEngine:", err));

    const handleResize = () => { if (engineRef.current) engineRef.current.resize(); };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  }, []);

  const handleMouseMove = (e) => {
    const x = (e.clientX / window.innerWidth) * 2 - 1;
    const y = (e.clientY / window.innerHeight) * 2 - 1;
    setMousePos(x, y);
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      
      {/* PixiJS Container */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0, left: 0, zIndex: 1,
          cursor: 'crosshair',
          backgroundColor: '#050505' 
        }}
      />

      {/* Screen Overlay (Vignette & Scanlines) */}
      <div 
        style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            pointerEvents: 'none', zIndex: 10,
            background: `
              radial-gradient(circle, transparent 35%, rgba(0,0,0,${vignetteOpacity}) 100%),
              repeating-linear-gradient(rgba(0,0,0,${scanlineOpacity}) 0px, rgba(0,0,0,${scanlineOpacity}) 1px, transparent 1px, transparent 3px)
            `,
            mixBlendMode: 'multiply'
        }}
      />
    </div>
  );
}
```

---
### `src\components\UI\ControlPanel.jsx`
```javascript
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
```

---
### `src\engine\filters\EffectFactory.js`
```javascript

```

---
### `src\engine\filters\WarpFilterFactory.js`
```javascript
// src/engine/filters/WarpFilterFactory.js
import { Filter, defaultFilterVert } from 'pixi.js';
import { WARP_FRAGMENT_SHADER } from '../shaders/WarpShader';

/**
 * Creates an instance of the custom WebGL warp filter.
 * @param {number} initialIntensity - The starting warp intensity value.
 * @returns {Filter} A configured PixiJS v8 Filter instance.
 */
export function createWarpFilter(initialIntensity = 20.0) {
  const filter = Filter.from({
    gl: {
      vertex: defaultFilterVert,
      fragment: WARP_FRAGMENT_SHADER
    },
    resources: {
      warpUniforms: {
        uTime: { value: 0.0, type: 'f32' },
        uWarpIntensity: { value: initialIntensity, type: 'f32' }
      }
    }
  });

  // Assign padding to allow offsets to render past original sprite edges without harsh cuts
  filter.padding = 40; 
  return filter;
}

/**
 * Utility helper to construct separate foreground and background warp filters.
 * @returns {Object} An object containing the primary and background filters.
 */
export function createWarpFilters() {
  return {
    warpFilter: createWarpFilter(20.0),
    bgWarpFilter: createWarpFilter(20.0)
  };
}
```

---
### `src\engine\PixiEngine.js`
```javascript
// src/engine/PixiEngine.js
import { 
  Application, 
  Assets, 
  Container, 
  Sprite,
  TilingSprite,
  Texture,
  Graphics
} from 'pixi.js';
import { useStore } from '../store/useStore.js';
import { EffectsSystem } from './systems/EffectsSystem.js';
import { ParticleSystem } from './systems/ParticleSystem.js';
import { EyeSystem } from './systems/EyeSystem.js';
import { createWarpFilters } from './filters/WarpFilterFactory.js';

function testImageAsset(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = src;
  });
}

export class PixiEngine {
  constructor(containerElement) {
    this.container = containerElement;
    this.app = new Application();
    this.layers = {};
    this.time = 0;
    this.isReady = false;
    this.isDestroyed = false;

    // Direct existential flags
    this.hasBgClippingMask = false;
    this.hasBgMountain = false;
    this.hasCharClippingMask = false;
    this.hasLineart = false;

    this.discoveredPatterns = [];
    this.discoveredEyes = [];
    this.hasEyelids = false;
    this.hasBgPat1 = false;
    this.hasBgPat2 = false;

    this.isPanoramaMode = false;
    this.hasBg2 = false;
    this.keys = {}; 

    this.effectsSystem = new EffectsSystem();
    this.eyeSystem = null;
    this.particleSystem = null;

    // Setup filter instances
    this.warpFilter = null;
    this.bgWarpFilter = null;

    this.config = { ...useStore.getState() };

    this.unsubscribeStore = useStore.subscribe((state) => {
      const prevChar = this.config.characterId;
      const prevBgClip = this.config.bgClippingMaskId;
      const prevBgStyle = this.config.bgPatternStyle;
      const prevBgMountain = this.config.bgMountainId;

      this.config = state;

      if (
        prevChar !== state.characterId ||
        prevBgClip !== state.bgClippingMaskId ||
        prevBgStyle !== state.bgPatternStyle ||
        prevBgMountain !== state.bgMountainId
      ) {
        this.reloadAssetsAndScene().catch(err => console.error("Re-init assets failed:", err));
      }
    });
  }

  async init() {
    try {
      await this.app.init({
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundAlpha: 1,
        backgroundColor: 0x050505,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        preference: 'webgl', 
      });

      if (this.isDestroyed) {
        this.app.destroy(true);
        return;
      }

      this.container.appendChild(this.app.canvas);
      await this.loadAssets();

      if (this.isDestroyed) {
        this.app.destroy(true);
        return;
      }
      
      this.buildSceneGraph();
      this.app.ticker.add((ticker) => this.update(ticker.deltaTime));
      this.resize();
      
      this.isReady = true;
    } catch (err) {
      console.error("PixiEngine Init Error:", err);
    }
  }

  async loadAssets() {
    const { characterId, bgClippingMaskId, bgPatternStyle, bgMountainId } = this.config;
    const verifiedLoadQueue = [];

    this.discoveredPatterns = [];
    this.discoveredEyes = [];
    this.hasEyelids = false;
    this.isPanoramaMode = false;
    this.hasBg2 = false;

    console.log(`%c🔍 [PixiEngine] Rig Loader: Locating Stage Assets`, 'color: #00f3ff; font-weight: bold;');

    // Normalize IDs to padded 2-digit strings (e.g. 1 -> "01", 2 -> "02")
    const padId = (id) => typeof id === 'number' ? String(id).padStart(2, '0') : id;
    const formattedMountainId = padId(bgMountainId);

    this.keys = {
      bg_clipping_mask: `bg_clipping_mask_${bgClippingMaskId}`,
      bg_pat_1: `bg_pat_1_${bgPatternStyle}`,
      bg_pat_2: `bg_pat_2_${bgPatternStyle}`,
      bg_mountain: `bg_mountain_${formattedMountainId}`,
      char_clipping_mask: `char_clipping_mask_${characterId}`,
      char_lineart: `char_lineart_${characterId}`,
      eyelids_top: `eyelids_top_${characterId}`,
      eyelids_bottom: `eyelids_bottom_${characterId}`
    };

    // --- Legacy Panorama Detection ---
    let panorama1Path = '/assets/panorama1.webp';
    let hasPanorama1 = await testImageAsset(panorama1Path);
    if (!hasPanorama1) {
      panorama1Path = '/assets/stage/panorama1.webp';
      hasPanorama1 = await testImageAsset(panorama1Path);
    }

    if (hasPanorama1) {
      this.isPanoramaMode = true;
      console.log("🌌 [PixiEngine] Legacy Panorama detected. Building Tiling Layers.");
      verifiedLoadQueue.push({ alias: 'bg', src: panorama1Path });

      let panorama2Path = '/assets/panorama2.webp';
      let hasPanorama2 = await testImageAsset(panorama2Path);
      if (!hasPanorama2) {
        panorama2Path = '/assets/stage/panorama2.webp';
        hasPanorama2 = await testImageAsset(panorama2Path);
      }
      if (hasPanorama2) {
        this.hasBg2 = true;
        verifiedLoadQueue.push({ alias: 'bg2', src: panorama2Path });
      } else {
        Assets.cache.set('bg2', Texture.EMPTY);
      }
    } else {
      Assets.cache.set('bg', Texture.EMPTY);
      Assets.cache.set('bg2', Texture.EMPTY);
    }

    // --- Dynamic Background Layers (Clean Rig) ---
    if (!this.isPanoramaMode) {
      // 1. Backdrop Color
      const bgClipPath = `/assets/stage/backdrops/backdrop_${bgClippingMaskId}.webp`;
      this.hasBgClippingMask = await testImageAsset(bgClipPath);
      if (this.hasBgClippingMask) {
        console.log(`✅ [PixiEngine] Backdrop: ${bgClipPath}`);
        verifiedLoadQueue.push({ alias: this.keys.bg_clipping_mask, src: bgClipPath });
      } else {
        console.warn(`⚠️ [PixiEngine] Missing Backdrop Color at: ${bgClipPath}`);
        Assets.cache.set(this.keys.bg_clipping_mask, Texture.EMPTY);
      }

      // 2. Background Flat Patterns (style_bottom and style_top)
      const bgPat1Path = `/assets/stage/patterns/${bgPatternStyle}_top.webp`;
      const bgPat2Path = `/assets/stage/patterns/${bgPatternStyle}_bottom.webp`;
      this.hasBgPat1 = await testImageAsset(bgPat1Path);
      this.hasBgPat2 = await testImageAsset(bgPat2Path);

      if (this.hasBgPat1) {
        console.log(`✅ [PixiEngine] Found BG Pattern Top: ${bgPat1Path}`);
        verifiedLoadQueue.push({ alias: this.keys.bg_pat_1, src: bgPat1Path });
      } else {
        console.warn(`⚠️ [PixiEngine] Missing BG Pattern Top at: ${bgPat1Path}`);
      }

      if (this.hasBgPat2) {
        console.log(`✅ [PixiEngine] Found BG Pattern Bottom: ${bgPat2Path}`);
        verifiedLoadQueue.push({ alias: this.keys.bg_pat_2, src: bgPat2Path });
      } else {
        console.warn(`⚠️ [PixiEngine] Missing BG Pattern Bottom at: ${bgPat2Path}`);
      }

      // 3. Mountains Layer
      let mountainPath = `/assets/stage/mountains/mountain_${formattedMountainId}.webp`;
      this.hasBgMountain = await testImageAsset(mountainPath);
      if (!this.hasBgMountain) {
        // Fallback to unpadded ID
        mountainPath = `/assets/stage/mountains/mountain_${bgMountainId}.webp`;
        this.hasBgMountain = await testImageAsset(mountainPath);
      }
      if (this.hasBgMountain) {
        console.log(`✅ [PixiEngine] Mountain Graphic: ${mountainPath}`);
        verifiedLoadQueue.push({ alias: this.keys.bg_mountain, src: mountainPath });
      } else {
        console.warn(`⚠️ [PixiEngine] Missing Mountain Asset at: /assets/stage/mountains/mountain_${formattedMountainId}.webp`);
        Assets.cache.set(this.keys.bg_mountain, Texture.EMPTY);
      }
    }

    // --- Foreground Character Clipping Mask ---
    const charClipPath = `/assets/actors/${characterId}/mask.webp`;
    this.hasCharClippingMask = await testImageAsset(charClipPath);
    if (this.hasCharClippingMask) {
      console.log(`✅ [PixiEngine] Actor Mask: ${charClipPath}`);
      verifiedLoadQueue.push({ alias: this.keys.char_clipping_mask, src: charClipPath });
    } else {
      console.error(`❌ [PixiEngine] Missing Actor Mask at: ${charClipPath}. Silhouette clipping and patterns bypassed.`);
      Assets.cache.set(this.keys.char_clipping_mask, Texture.EMPTY);
    }

    // --- Foreground Character Patterns (Dynamic sequential scan: pattern_01, pattern_02...) ---
    let patternIndex = 1;
    while (true) {
      const idxStr = padId(patternIndex);
      let patPath = `/assets/actors/${characterId}/patterns/pattern_${idxStr}.webp`;
      let exists = await testImageAsset(patPath);

      if (!exists) {
        // Fallback checks for unpadded index formatting
        patPath = `/assets/actors/${characterId}/patterns/pattern_${patternIndex}.webp`;
        exists = await testImageAsset(patPath);
      }
      if (!exists) break;

      console.log(`✅ [PixiEngine] Found Pattern Layer #${patternIndex}: ${patPath}`);
      const alias = `char_${characterId}_pattern_${patternIndex}`;
      verifiedLoadQueue.push({ alias, src: patPath });
      this.discoveredPatterns.push(alias);
      patternIndex++;
      if (patternIndex > 30) break;
    }

    // --- Foreground Character Lineart ---
    const lineartPath = `/assets/actors/${characterId}/lineart.webp`;
    this.hasLineart = await testImageAsset(lineartPath);
    if (this.hasLineart) {
      console.log(`✅ [PixiEngine] Lineart Layout: ${lineartPath}`);
      verifiedLoadQueue.push({ alias: this.keys.char_lineart, src: lineartPath });
    } else {
      console.error(`❌ [PixiEngine] Missing Lineart File at: ${lineartPath}`);
      Assets.cache.set(this.keys.char_lineart, Texture.EMPTY);
    }

    // --- Foreground Character Dynamic Eye Sockets (Sequential scan: socket_01, socket_02...) ---
    let socketIndex = 1;
    while (true) {
      const idxStr = padId(socketIndex);
      let eyeballPath = `/assets/actors/${characterId}/eyes/socket_${idxStr}/eyeball.webp`;
      let pupilPath = `/assets/actors/${characterId}/eyes/socket_${idxStr}/pupil.webp`;

      let hasEyeball = await testImageAsset(eyeballPath);
      let hasPupil = await testImageAsset(pupilPath);

      if (!hasEyeball && !hasPupil) {
        // Fallback checks for unpadded indices
        eyeballPath = `/assets/actors/${characterId}/eyes/socket_${socketIndex}/eyeball.webp`;
        pupilPath = `/assets/actors/${characterId}/eyes/socket_${socketIndex}/pupil.webp`;
        hasEyeball = await testImageAsset(eyeballPath);
        hasPupil = await testImageAsset(pupilPath);
      }

      if (!hasEyeball && !hasPupil) break;

      console.log(`👁️ [PixiEngine] Discovered Eye Rig: socket_${idxStr} (Eyeball: ${hasEyeball ? 'Yes' : 'No'}, Pupil: ${hasPupil ? 'Yes' : 'No'})`);

      const scleraAlias = `char_${characterId}_eye_sclera_${socketIndex}`;
      const pupilAlias = `char_${characterId}_eye_pupil_${socketIndex}`;

      if (hasEyeball) verifiedLoadQueue.push({ alias: scleraAlias, src: eyeballPath });
      if (hasPupil) verifiedLoadQueue.push({ alias: pupilAlias, src: pupilPath });

      this.discoveredEyes.push({
        id: socketIndex,
        scleraAlias: hasEyeball ? scleraAlias : null,
        pupilAlias: hasPupil ? pupilAlias : null
      });

      socketIndex++;
      if (socketIndex > 30) break;
    }

    // --- Foreground Character Eyelids (Flat in eyes folder) ---
    const eyelidsTopPath = `/assets/actors/${characterId}/eyes/eyelids_top.webp`;
    const eyelidsBottomPath = `/assets/actors/${characterId}/eyes/eyelids_bottom.webp`;
    const hasEyelidsTop = await testImageAsset(eyelidsTopPath);
    const hasEyelidsBottom = await testImageAsset(eyelidsBottomPath);

    if (hasEyelidsTop && hasEyelidsBottom) {
      console.log(`✅ [PixiEngine] Found Flat Eyelid Elements`);
      verifiedLoadQueue.push({ alias: this.keys.eyelids_top, src: eyelidsTopPath });
      verifiedLoadQueue.push({ alias: this.keys.eyelids_bottom, src: eyelidsBottomPath });
      this.hasEyelids = true;
    } else {
      console.warn(`⚠️ [PixiEngine] Eyelids missing (Expected flat eyelids_top.webp and eyelids_bottom.webp inside eyes/ folder)`);
      Assets.cache.set(this.keys.eyelids_top, Texture.EMPTY);
      Assets.cache.set(this.keys.eyelids_bottom, Texture.EMPTY);
    }

    if (verifiedLoadQueue.length > 0) {
      try {
        await Assets.load(verifiedLoadQueue);
        console.log(`%c✅ [PixiEngine] Dynamic asset payload cached!`, 'color: #00ff80; font-weight: bold;');
      } catch (err) {
        console.error("❌ [PixiEngine] Critical Loader Exception:", err);
      }
    }
  }

  buildSceneGraph() {
    const { stage } = this.app;

    this.masterContainer = new Container();
    stage.addChild(this.masterContainer);

    const createSprite = (alias) => {
      const s = Sprite.from(alias);
      s.anchor.set(0.5);
      return s;
    };

    let clipTex = Assets.get(this.keys.char_clipping_mask);
    if (!clipTex || clipTex === Texture.EMPTY) {
      clipTex = Assets.get('bg');
    }
    this.bgHeightScale = (clipTex && clipTex !== Texture.EMPTY) ? clipTex.height : 1000;

    this.masterClipMask = new Graphics()
      .rect(-this.bgHeightScale / 2, -this.bgHeightScale / 2, this.bgHeightScale, this.bgHeightScale)
      .fill({ color: 0xffffff });
    this.masterContainer.addChild(this.masterClipMask);

    this.bgAtmosphereContainer = new Container();
    this.bgAtmosphereContainer.mask = this.masterClipMask;
    this.masterContainer.addChild(this.bgAtmosphereContainer);

    // Instantiate dynamic warp filters directly
    const { warpFilter, bgWarpFilter } = createWarpFilters();
    this.warpFilter = warpFilter;
    this.bgWarpFilter = bgWarpFilter;

    // --- ASSEMBLE BACKGROUND ---
    if (this.isPanoramaMode) {
      const bgTexture = Assets.get('bg');
      if (bgTexture && bgTexture !== Texture.EMPTY) {
        this.layers.bg = new TilingSprite({
          texture: bgTexture,
          width: this.bgHeightScale * 6,
          height: this.bgHeightScale
        });
        this.layers.bg.anchor.set(0.5);
        this.bgAtmosphereContainer.addChild(this.layers.bg);
      }

      if (this.hasBg2) {
        const bg2Texture = Assets.get('bg2');
        if (bg2Texture && bg2Texture !== Texture.EMPTY) {
          this.layers.bg2 = new TilingSprite({
            texture: bg2Texture,
            width: this.bgHeightScale * 6,
            height: this.bgHeightScale
          });
          this.layers.bg2.anchor.set(0.5);
          this.bgAtmosphereContainer.addChild(this.layers.bg2);
        }
      }
    } else {
      // 1. Solid Backdrop Color
      if (this.hasBgClippingMask) {
        this.layers.bg_clip = createSprite(this.keys.bg_clipping_mask);
        this.bgAtmosphereContainer.addChild(this.layers.bg_clip);
      }

      // 2. Background warp patterns container (Applied directly)
      const hasAnyBgPat = this.hasBgPat1 || this.hasBgPat2;
      if (hasAnyBgPat) {
        this.bgPatternsContainer = new Container();
        this.bgPatternsContainer.filters = [this.bgWarpFilter];
        this.bgAtmosphereContainer.addChild(this.bgPatternsContainer);

        // Pattern bottom (bg_pat_2) renders underneath pattern top (bg_pat_1)
        if (this.hasBgPat2) {
          const sp2 = createSprite(this.keys.bg_pat_2);
          this.bgPatternsContainer.addChild(sp2);
        }
        if (this.hasBgPat1) {
          const sp1 = createSprite(this.keys.bg_pat_1);
          this.bgPatternsContainer.addChild(sp1);
        }
      }

      // 3. Mountains graphic
      if (this.hasBgMountain) {
        this.layers.bg_mountain = createSprite(this.keys.bg_mountain);
        this.bgAtmosphereContainer.addChild(this.layers.bg_mountain);
      }
    }

    // Particles
    this.particleSystem = new ParticleSystem(this.app.renderer, this.bgAtmosphereContainer, this.bgHeightScale);
    
    // --- ASSEMBLE CHARACTER ---
    this.headContainer = new Container();
    this.masterContainer.addChild(this.headContainer);

    // Blurry shadow glow container (renders underneath)
    if (this.hasCharClippingMask) {
      this.layers.aura = createSprite(this.keys.char_clipping_mask);
      this.headContainer.addChild(this.layers.aura);
    }

    // Nested composition to decouple filters from the mask sprite
    if (this.hasCharClippingMask) {
      // 1. The mask sprite (must be set as renderable=false so it does not draw as a solid colored block)
      const charMaskSprite = createSprite(this.keys.char_clipping_mask);
      charMaskSprite.renderable = false; 
      this.headContainer.addChild(charMaskSprite);

      // 2. The wrapped container applying only the clip-mask
      this.characterContentContainer = new Container();
      
      // Use setMask with channel: 'alpha' to bypass color channel processing (fixes purple alpha muffling)
      this.characterContentContainer.setMask({
        mask: charMaskSprite,
        channel: 'alpha'
      });
      
      this.headContainer.addChild(this.characterContentContainer);

      // 3. Render base color (clipping mask file acting as character color) inside masked wrapper
      this.layers.base = createSprite(this.keys.char_clipping_mask);
      this.characterContentContainer.addChild(this.layers.base);

      // 4. Render character patterns container inside masked wrapper (warp applied with zero mask conflicts)
      if (this.discoveredPatterns.length > 0) {
        this.patternsContainer = new Container();
        this.patternsContainer.filters = [this.warpFilter]; 
        this.characterContentContainer.addChild(this.patternsContainer);

        // Render ascending chronological layers (Pattern 1 on bottom, Pattern 2 on top)
        for (const patternAlias of this.discoveredPatterns) {
          const sp = createSprite(patternAlias);
          this.patternsContainer.addChild(sp);
        }
      }
    }

    // Attach glow behaviors
    this.effectsSystem.attach({
      headContainer: this.headContainer,
      auraSprite: this.layers.aura,
      baseSprite: this.layers.base
    });

    // Render lineart & teeth
    if (this.hasLineart) {
      this.layers.lineart = createSprite(this.keys.char_lineart);
      this.headContainer.addChild(this.layers.lineart);
    }

    // Render eyeballs and lids
    this.eyeSystem = new EyeSystem(this.headContainer, {
      discoveredEyes: this.discoveredEyes,
      hasEyelids: this.hasEyelids,
      eyelidsTopAlias: this.hasEyelids ? this.keys.eyelids_top : null,
      eyelidsBottomAlias: this.hasEyelids ? this.keys.eyelids_bottom : null
    });
  }

  async reloadAssetsAndScene() {
    this.isReady = false;

    if (this.masterContainer) {
      this.masterContainer.destroy({ children: true, texture: false });
      this.masterContainer = null;
    }

    if (this.eyeSystem?.destroy) {
      this.eyeSystem.destroy();
    }
    if (this.particleSystem?.destroy) {
      this.particleSystem.destroy();
    }

    await this.loadAssets();

    if (this.isDestroyed) return;

    this.buildSceneGraph();
    this.resize();
    this.isReady = true;
  }

  update(deltaTime) {
    if (!this.isReady) return;
    const dtSeconds = deltaTime / 60;
    this.time += dtSeconds;

    const config = this.config;
    const { isGlitched, currentSplit } = this.effectsSystem.update(this.time, config);

    const tFloat = this.time * config.floatSpeed;
    let floatX = Math.sin(tFloat) * config.floatAmpX;
    let floatY = Math.sin(2 * tFloat) * config.floatAmpY;
    const rotation = Math.cos(tFloat) * config.floatRotation * (Math.PI / 180);

    if (config.glitchShakeIntensity > 0 && (isGlitched || currentSplit > (config.aberrationAmount * 1.15))) {
        floatX += (Math.random() - 0.5) * config.glitchShakeIntensity;
        floatY += (Math.random() - 0.5) * config.glitchShakeIntensity;
    }
    this.headContainer.position.set(floatX, floatY);
    this.headContainer.rotation = rotation;

    // --- Dynamic Scaling & Warp Shading for Background Patterns ---
    if (this.bgPatternsContainer && this.bgPatternsContainer.children.length > 0) {
      const kids = this.bgPatternsContainer.children;
      if (kids.length === 1) {
        kids[0].scale.set(config.bgPatternTopScale);
      } else if (kids.length > 1) {
        // kids[0] is background bottom (index 0), kids[1] is background top (index 1)
        kids[0].scale.set(config.bgPatternBottomScale);
        kids[1].scale.set(config.bgPatternTopScale);
      }

      if (this.bgWarpFilter && this.bgWarpFilter.resources.warpUniforms) {
        this.bgWarpFilter.resources.warpUniforms.uniforms.uTime = this.time * config.bgWarpSpeed;
        this.bgWarpFilter.resources.warpUniforms.uniforms.uWarpIntensity = config.bgWarpIntensity;
      }
    }

    // --- Dynamic Scaling & Warp Shading for Character Patterns ---
    if (this.patternsContainer && this.patternsContainer.children.length > 0) {
      const kids = this.patternsContainer.children;
      if (kids.length === 1) {
        kids[0].scale.set(config.patternTopScale);
      } else if (kids.length > 1) {
        // kids[0] is pattern_1 (bottom)
        kids[0].scale.set(config.patternBottomScale); // pattern_1 (lowest number) maps to patternBottomScale
        kids[kids.length - 1].scale.set(config.patternTopScale); // pattern_N maps to patternTopScale
        for (let i = 1; i < kids.length - 1; i++) {
          kids[i].scale.set((config.patternBottomScale + config.patternTopScale) / 2);
        }
      }

      if (this.warpFilter && this.warpFilter.resources.warpUniforms) {
        this.warpFilter.resources.warpUniforms.uniforms.uTime = this.time * config.warpSpeed;
        this.warpFilter.resources.warpUniforms.uniforms.uWarpIntensity = config.warpIntensity;
      }
    }

    if (this.eyeSystem) {
      this.eyeSystem.update(deltaTime, config);
    }

    if (this.particleSystem) {
      this.particleSystem.update(deltaTime, config);
    }

    if (this.isPanoramaMode) {
      const baseSpeed = config.bgScrollSpeed;
      if (this.layers.bg) {
        this.layers.bg.tilePosition.x -= baseSpeed * dtSeconds;
      }
      if (this.hasBg2 && this.layers.bg2) {
        this.layers.bg2.tilePosition.x -= (baseSpeed * config.bg2ParallaxSpeed) * dtSeconds;
      }
    }
  }

  resize() {
    if(!this.app || !this.app.renderer || !this.masterContainer) return;
    this.app.renderer.resize(window.innerWidth, window.innerHeight);
    const { screen } = this.app;
    
    this.masterContainer.position.set(screen.width / 2, screen.height / 2);
    
    const clipTex = Assets.get(this.keys.char_clipping_mask) || Assets.get('bg');
    const bgWidth = (clipTex && clipTex !== Texture.EMPTY) ? clipTex.width : 1000;
    const bgHeight = (clipTex && clipTex !== Texture.EMPTY) ? clipTex.height : 1000;

    const scaleX = screen.width / bgWidth;
    const scaleY = screen.height / bgHeight;
    const scale = Math.max(scaleX, scaleY);
    
    this.masterContainer.scale.set(scale);

    if (this.masterClipMask) {
      const localW = screen.width / scale;
      const localH = screen.height / scale;
      this.masterClipMask.clear()
        .rect(-localW / 2, -localH / 2, localW, localH)
        .fill({ color: 0xffffff });
    }
  }

  destroy() {
    this.isDestroyed = true;

    if (this.unsubscribeStore) {
      this.unsubscribeStore();
    }

    if (this.isReady && this.app) {
      try { 
        if (this.eyeSystem?.destroy) {
          this.eyeSystem.destroy();
        }
        if (this.particleSystem?.destroy) {
          this.particleSystem.destroy();
        }
        this.app.destroy(true, { children: true, texture: true }); 
      } catch (e) {
        console.warn("[PixiEngine] Strict cleanup warn:", e);
      }
    }
  }
}
```

---
### `src\engine\shaders\FogShader.js`
```javascript
// src/engine/shaders/FogShader.js
export const FOG_FRAGMENT_SHADER = `
precision highp float;

in vec2 vTextureCoord;
out vec4 finalColor;

uniform float uTime;
uniform float uOpacity;
uniform vec3 uColor;
uniform float uSpeed;

// 2D Random (Removed explicit 'in' qualifier to prevent ANGLE varying collision)
float random (vec2 st) {
    return fract(sin(dot(st.xy, vec2(127.1, 311.7))) * 43758.5453123);
}

// 2D Noise
float noise (vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

// Fractal Brownian Motion for "smoky" texture
float fbm (vec2 st) {
    float value = 0.0;
    float amplitude = 0.5;
    
    // Write into local variable to bypass write-restrictions on function parameters
    vec2 p = st;
    for (int i = 0; i < 5; i++) {
        value += amplitude * noise(p);
        p *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}

void main() {
    vec2 uv = vTextureCoord;
    
    // Volumetric Horizontal Band Mask with spec-compliant descending smoothstep
    // Gently fades the smoke in at the top and cleanly fades it to 0 opacity before the bottom
    float band = smoothstep(0.15, 0.45, uv.y) * (1.0 - smoothstep(0.55, 0.85, uv.y));
    
    // Movement logic
    vec2 shift = vec2(uTime * uSpeed, uTime * 0.02);
    
    // Generate layered noise
    float n = fbm(uv * vec2(1.5, 3.0) + shift);
    
    // Distort noise for more "wispiness"
    n += fbm(uv * 4.0 - shift * 0.5) * 0.5;
    
    float alpha = n * band * uOpacity;
    
    finalColor = vec4(uColor * alpha, alpha);
}
`;
```

---
### `src\engine\shaders\WarpShader.js`
```javascript
// src/engine/shaders/WarpShader.js

export const WARP_FRAGMENT_SHADER = `
precision highp float;

in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec4 uInputClamp; // Built-in Pixi uniform defining active subregion bounds
uniform float uTime;
uniform float uWarpIntensity;

// Pseudo-random 2D Hash
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

// 2D Value Noise
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i + vec2(0.0, 0.0)), 
                 hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), 
                 hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

// 3-Octave Fractional Brownian Motion (Perfectly zero-centered)
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  vec2 shift = vec2(100.0);
  mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
  for (int i = 0; i < 3; ++i) {
      // Mapping noise value from [0, 1] to signed [-1, 1] keeps the displacement average at 0
      v += a * (noise(p) * 2.0 - 1.0);
      p = rot * p * 2.0 + shift;
      a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = vTextureCoord;
  float t = uTime;

  // Keep a constant spatial scale for the warp patterns
  float freq = 25.0;

  // Continuous velocity offset vector (negative values scroll up/left)
  vec2 flowVelocity = vec2(-0.8, -1.2);
  vec2 flowOffset = flowVelocity * t;

  // Apply translation over time to make displacement flow in one direction
  float displacementX = fbm(uv * freq + flowOffset);
  float displacementY = fbm(uv * freq + flowOffset + vec2(23.0, 47.0));

  // Calculate offset vector and scale it relative to user intensity input
  vec2 offset = vec2(displacementX, displacementY) * (uWarpIntensity * 0.001);

  // Clamp coordinates to the subtexture region bounds to eliminate edge bleeding
  vec2 clampedUV = clamp(uv + offset, uInputClamp.xy, uInputClamp.zw);

  finalColor = texture(uTexture, clampedUV);
}
`;
```

---
### `src\engine\systems\EffectsSystem.js`
```javascript
// src/engine/systems/EffectsSystem.js
import { BlurFilter, ColorMatrixFilter } from 'pixi.js';
import { RGBSplitFilter } from 'pixi-filters';

export class EffectsSystem {
  constructor() {
    // 1. Instantiate filter instances
    this.rgbSplitFilter = new RGBSplitFilter({
      red: { x: 0, y: 0 },
      green: { x: 0, y: 0 },
      blue: { x: 0, y: 0 }
    });
    this.auraBlurFilter = new BlurFilter({ strength: 20 });
    this.colorMatrix = new ColorMatrixFilter();

    // Store target references
    this.targets = {
      headContainer: null,
      auraSprite: null,
      baseSprite: null
    };
  }

  /**
   * Connects the initialized filters to their respective target display objects.
   * @param {Object} targets - Target display objects to receive the filters.
   * @param {Container} targets.headContainer - Container for head assets.
   * @param {Sprite} targets.auraSprite - Background glow/aura sprite.
   * @param {Sprite} targets.baseSprite - Skull base color sprite.
   */
  attach(targets) {
    this.targets = { ...this.targets, ...targets };

    if (this.targets.headContainer) {
      this.targets.headContainer.filters = [this.rgbSplitFilter];
    }
    if (this.targets.auraSprite) {
      this.targets.auraSprite.filters = [this.auraBlurFilter];
    }
    if (this.targets.baseSprite) {
      this.targets.baseSprite.filters = [this.colorMatrix];
    }
  }

  /**
   * Updates visual parameters on a per-frame basis.
   * @param {number} time - Elapsed time in seconds.
   * @param {Object} state - State from useStore.
   * @returns {Object} Glitch state metrics for the main engine (such as screen shake).
   */
  update(time, state) {
    const metrics = {
      isGlitched: false,
      currentSplit: state.aberrationAmount
    };

    // 1. RGB Split / Glitch Calculations
    if (state.aberrationSpeed > 0) {
      const pulseWave = Math.sin(time * state.aberrationSpeed * 3);
      metrics.currentSplit = Math.abs(pulseWave) * state.aberrationAmount;

      if (state.aberrationGlitch > 0 && Math.random() < (0.008 * state.aberrationGlitch)) {
        metrics.currentSplit = state.aberrationAmount * (1.5 + Math.random() * 1.5);
        metrics.isGlitched = true;
      }
    }
    this.rgbSplitFilter.red = { x: metrics.currentSplit, y: 0 };
    this.rgbSplitFilter.blue = { x: -metrics.currentSplit, y: 0 };

    // 2. Color Matrix / Strobe Calculations
    if (this.targets.baseSprite) {
      if (state.flickerIntensity > 0) {
        const strobeTime = time * state.flickerSpeed * 45;
        const waveValue = Math.sin(strobeTime) * Math.sin(strobeTime * 2.3) * Math.cos(strobeTime * 0.85);
        const triggerThreshold = 1.0 - state.flickerIntensity;
        this.colorMatrix.reset();

        if (waveValue > triggerThreshold) {
          this.colorMatrix.brightness(1.8, false);
          this.colorMatrix.contrast(1.5, true);
        } else if (waveValue < -triggerThreshold) {
          this.colorMatrix.brightness(0.05, false);
        } else {
          const randoB = 1.0 + (Math.random() - 0.5) * 0.15 * state.flickerIntensity;
          this.colorMatrix.brightness(randoB, false);
        }
      } else {
        this.colorMatrix.reset();
      }
    }

    // 3. Aura Blur / Dimension Pulse Calculations
    if (this.targets.auraSprite) {
      const auraPulse = Math.sin(time * state.auraPulseSpeed * 2.0) * 0.5 + 0.5;
      this.auraBlurFilter.strength = state.auraBlur + (auraPulse * 10);
      this.targets.auraSprite.scale.set(state.auraScale + (auraPulse * 0.02));
      this.targets.auraSprite.alpha = state.auraOpacity;
      
      this.targets.auraSprite.tint = 
        (Math.floor(state.auraColorR) << 16) + 
        (Math.floor(state.auraColorG) << 8) + 
        Math.floor(state.auraColorB);
    }

    return metrics;
  }
}
```

---
### `src\engine\systems\EyeSystem.js`
```javascript
// src/engine/systems/EyeSystem.js
import { Sprite } from 'pixi.js';

export class EyeSystem {
  constructor(headContainer, options = {}) {
    this.headContainer = headContainer;
    this.discoveredEyes = options.discoveredEyes || [];
    this.hasEyelids = options.hasEyelids ?? false;
    this.eyelidsTopAlias = options.eyelidsTopAlias || null;
    this.eyelidsBottomAlias = options.eyelidsBottomAlias || null;

    this.blinkTimer = 0;
    this.isBlinking = false;
    this.blinkDurationTimer = 0;
    this.eyelidProgress = 1.0; 

    this.time = 0;

    this.eyeContainers = [];
    this.eyelidTopSprite = null;
    this.eyelidBottomSprite = null;

    this.buildSystem();
  }

  buildSystem() {
    const createSprite = (alias) => {
      const s = Sprite.from(alias);
      s.anchor.set(0.5);
      return s;
    };

    // 1. Render eyeballs & Pupils dynamically
    for (const eye of this.discoveredEyes) {
      const eyeGroup = {
        sclera: null,
        pupil: null
      };

      if (eye.scleraAlias) {
        eyeGroup.sclera = createSprite(eye.scleraAlias);
        this.headContainer.addChild(eyeGroup.sclera);
      }

      if (eye.pupilAlias) {
        eyeGroup.pupil = createSprite(eye.pupilAlias);
        this.headContainer.addChild(eyeGroup.pupil);
      }

      this.eyeContainers.push(eyeGroup);
    }

    // 2. Render Eyelids on top of all eye elements
    if (this.hasEyelids && this.eyelidsTopAlias && this.eyelidsBottomAlias) {
      this.eyelidBottomSprite = createSprite(this.eyelidsBottomAlias);
      this.eyelidTopSprite = createSprite(this.eyelidsTopAlias);

      this.headContainer.addChild(this.eyelidBottomSprite);
      this.headContainer.addChild(this.eyelidTopSprite);
    }
  }

  update(deltaTime, state) {
    const dtSeconds = deltaTime / 60;
    this.time += dtSeconds;

    // 1. EYELID BLINKING CYCLE
    if (state.autoBlink) {
      if (!this.isBlinking) {
        this.blinkTimer += dtSeconds;
        if (this.blinkTimer >= state.blinkInterval) {
          this.isBlinking = true;
          this.blinkDurationTimer = 0;
        }
        this.eyelidProgress = 1.0;
      } else {
        const blinkDuration = 0.22 / state.blinkSpeed; 
        this.blinkDurationTimer += dtSeconds;
        const phase = this.blinkDurationTimer / blinkDuration;

        if (phase >= 1.0) {
          this.isBlinking = false;
          this.blinkTimer = (Math.random() - 0.5) * 1.5; 
          this.eyelidProgress = 1.0;
        } else {
          this.eyelidProgress = 1.0 - Math.sin(phase * Math.PI);
        }
      }
    } else {
      this.eyelidProgress = state.eyelidManualProgress;
    }

    if (this.hasEyelids && this.eyelidTopSprite && this.eyelidBottomSprite) {
      const travel = state.eyelidTravel;
      const topEyelidY = -(this.eyelidProgress * travel);
      const bottomEyelidY = (this.eyelidProgress * travel);
      
      this.eyelidTopSprite.position.set(0, topEyelidY);
      this.eyelidBottomSprite.position.set(0, bottomEyelidY);
    }

    // 2. ORGANIC DYNAMIC EYE TRACKING
    const driftSpeed = 0.7;
    const driftX = Math.sin(this.time * driftSpeed) * 6 * state.pupilWander;
    const driftY = Math.cos(this.time * driftSpeed * 0.65) * 4 * state.pupilWander;

    const mouseX = state.mousePos.x * 24 * state.pupilMouseInfluence;
    const mouseY = state.mousePos.y * 14 * state.pupilMouseInfluence;

    const sharedTargetX = mouseX + driftX;
    const sharedTargetY = mouseY + driftY;

    const saccadeChance = Math.sin(this.time * 2.8) * Math.cos(this.time * 0.85);
    const triggerTwitch = saccadeChance > 0.72;

    this.eyeContainers.forEach((group, index) => {
      const seed = index * 3.5;
      const saccadeX = triggerTwitch ? Math.sin(this.time * 22.0 + seed) * 3 * state.pupilSaccade : 0;
      const saccadeY = triggerTwitch ? Math.cos(this.time * 26.0 + seed) * 2 * state.pupilSaccade : 0;

      const targetX = sharedTargetX + saccadeX;
      const targetY = sharedTargetY + saccadeY;

      if (group.pupil) {
        group.pupil.x += (targetX - group.pupil.x) * 0.16;
        group.pupil.y += (targetY - group.pupil.y) * 0.16;
      }

      if (group.sclera) {
        group.sclera.x += (targetX * 0.3 - group.sclera.x) * 0.12;
        group.sclera.y += (targetY * 0.3 - group.sclera.y) * 0.12;
      }
    });
  }

  destroy() {
    for (const group of this.eyeContainers) {
      if (group.sclera) group.sclera.destroy();
      if (group.pupil) group.pupil.destroy();
    }
    this.eyeContainers = [];

    if (this.eyelidTopSprite) {
      this.eyelidTopSprite.destroy();
      this.eyelidTopSprite = null;
    }
    if (this.eyelidBottomSprite) {
      this.eyelidBottomSprite.destroy();
      this.eyelidBottomSprite = null;
    }
  }
}
```

---
### `src\engine\systems\FogSystem.js`
```javascript
// src/engine/systems/FogSystem.js
import { Filter, Sprite, Texture, defaultFilterVert } from 'pixi.js';
import { FOG_FRAGMENT_SHADER } from '../shaders/FogShader.js';

export class FogSystem {
  constructor(targetContainer, bgHeight, isForeground = false) {
    this.targetContainer = targetContainer;
    this.isForeground = isForeground;
    
    // Create a mesh-like sprite that covers the background area
    this.sprite = new Sprite(Texture.WHITE);
    this.sprite.anchor.set(0.5);
    this.sprite.width = bgHeight; 
    this.sprite.height = bgHeight;
    this.sprite.alpha = 1.0; 

    this.filter = Filter.from({
      gl: {
        vertex: defaultFilterVert,
        fragment: FOG_FRAGMENT_SHADER
      },
      resources: {
        fogUniforms: {
          uTime: { value: 0, type: 'f32' },
          uOpacity: { value: 0.5, type: 'f32' },
          uColor: { value: [1, 1, 1], type: 'vec3<f32>' },
          uSpeed: { value: 1.0, type: 'f32' }
        }
      }
    });

    this.sprite.filters = [this.filter];
    this.targetContainer.addChild(this.sprite);
  }

  update(time, config) {
    if (!this.filter) return;

    const unis = this.filter.resources.fogUniforms.uniforms;
    unis.uTime = time;
    
    // Foreground fog is slightly thinner to avoid obscuring character details
    const baseOpacity = this.isForeground ? config.fogOpacity * 0.55 : config.fogOpacity;
    unis.uOpacity = baseOpacity;
    
    // Foreground fog scrolls faster (simulating spatial overlay depth)
    const velocityScale = this.isForeground ? 1.45 : 0.85;
    unis.uSpeed = config.fogSpeed * 0.01 * velocityScale;
    
    // Normalize color output
    unis.uColor = [
        config.fogColorR / 255,
        config.fogColorG / 255,
        config.fogColorB / 255
    ];

    // Horizontal/Phase offsetting between the two layers prevents overlapping synchronized bobbing
    const phaseOffset = this.isForeground ? 1.6 : 0.0;
    const sway = Math.sin((time * config.fogSwaySpeed) + phaseOffset) * config.fogSwayAmp;
    
    // Sit foreground fog slightly lower on screen to overlay the lower skull fangs/chin
    const verticalCenter = this.isForeground ? (this.sprite.height * 0.28) : (this.sprite.height * 0.12);
    this.sprite.y = verticalCenter + sway;
  }

  destroy() {
    if (this.sprite) {
      this.sprite.destroy(true);
    }
  }
}
```

---
### `src\engine\systems\ParticleSystem.js`
```javascript
// src/engine/systems/ParticleSystem.js
import { Container, Sprite, Graphics, Assets, Texture } from 'pixi.js';

export class ParticleSystem {
  constructor(renderer, targetContainer, bgSize) {
    this.renderer = renderer;
    this.targetContainer = targetContainer;
    this.bgSize = bgSize; // Sourced from square background height scale (e.g. 1000px)

    // Dedicated particles container added to the visual stage hierarchy
    this.particleContainer = new Container();
    this.targetContainer.addChild(this.particleContainer);

    // 1. Generate Texture A: Jagged 4-pointed ash shard
    const gAsh = new Graphics().star(0, 0, 4, 8, 3).fill({ color: 0xffffff });
    this.ashTexture = this.renderer.generateTexture(gAsh);
    gAsh.destroy();

    // 2. Generate Texture B: Wispy, soft atmospheric soot/tomb dust mote
    const gWispy = new Graphics().circle(0, 0, 24).fill({ color: 0xffffff, alpha: 0.3 });
    this.wispyTexture = this.renderer.generateTexture(gWispy);
    gWispy.destroy();

    this.particles = [];
  }

  /**
   * Main updates frame logic including particle properties, fluttering, drifting, and color blending.
   * @param {number} deltaTime - Current update tick step size.
   * @param {Object} state - State from useStore.
   */
  update(deltaTime, state) {
    const dtSeconds = deltaTime / 60;
    const halfSize = this.bgSize / 2;

    // Retrieve active visual variables from the store (falls back to a default bone-white if missing)
    const rTint = state.auraColorR ?? 235;
    const gTint = state.auraColorG ?? 200;
    const bTint = state.auraColorB ?? 150;

    // Pool expansion: Spawn particles to meet targeted configuration count
    while (this.particles.length < state.particleCount) {
      // Distribute types: 75% small jagged ash flakes, 25% large wispy soot motes
      const isMote = Math.random() < 0.25;
      const texture = isMote ? this.wispyTexture : this.ashTexture;
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5);
      sprite.blendMode = 'normal'; // Standard blending for dusty, opaque air current occlusion

      // Type-specific baseline aesthetics
      let size, targetOpacity, type, speedY, speedX, swayFreq, swayWidth;
      let grayscale; // Base monotone value used to blend from soot black to bone white

      if (isMote) {
        // Large, suffocating wispy soot/tomb dust motes
        type = 'mote';
        size = Math.random() * 1.5 + 1.2; // Large, drifting scales
        targetOpacity = Math.random() * 0.15 + 0.10; // Soft but visible opacity range (10% to 25%)
        speedY = -(Math.random() * 1.5 + 0.5); // Crawl upward extremely slowly
        speedX = Math.random() * 2.0 - 1.0; 
        swayFreq = Math.random() * 0.5 + 0.1; // Slow, lazy sway
        swayWidth = Math.random() * 15 + 10;
        // Grayscale set to dark charcoal gray so it is visible against the background
        grayscale = Math.random() * 0.20 + 0.25; // 25% to 45% gray
      } else {
        // Small, fluttering jagged ash shards
        type = 'ash';
        size = Math.random() * 0.8 + 0.3; // Small granular ash shards
        targetOpacity = Math.random() * 0.30 + 0.25; // Good visibility range (25% to 55%)
        speedY = -(Math.random() * 10 + 4); // Gravity-defying upward drift speed
        speedX = Math.random() * 8 - 4;
        swayFreq = Math.random() * 2.5 + 1.0; // High-frequency fluttering representing asymmetric flakes
        swayWidth = Math.random() * 8 + 4; // Tight, chaotic movements
        
        // Distribution of soot gray, ash gray, and pale bone-white grayscale properties
        const paletteRoll = Math.random();
        if (paletteRoll < 0.35) {
          grayscale = Math.random() * 0.15 + 0.25; // Soot Gray (25% to 40% - visible on dark BG)
        } else if (paletteRoll < 0.75) {
          grayscale = Math.random() * 0.30 + 0.40; // Ash Gray (40% to 70%)
        } else {
          grayscale = Math.random() * 0.20 + 0.75; // Pale Bone-White (75% to 95%)
        }
      }

      sprite._custom = {
        type: type,
        x: (Math.random() - 0.5) * this.bgSize, // Spawn strictly within master artwork layout frame
        y: halfSize + Math.random() * 200,     // Spawn just beneath cropped canvas viewport limits
        size: size,
        speedY: speedY,
        speedX: speedX,
        targetOpacity: targetOpacity,
        swayFreq: swayFreq,
        swayWidth: swayWidth,
        birthTime: Math.random() * 100,
        grayscale: grayscale
      };

      sprite.scale.set(size * state.particleSize);
      sprite.alpha = 0; // Starts completely faded out, soft boundary fading handles transition

      this.particles.push(sprite);
      this.particleContainer.addChild(sprite);
    }

    // Pool contraction: Safely prune extra sprites
    while (this.particles.length > state.particleCount) {
      const p = this.particles.pop();
      this.particleContainer.removeChild(p);
      p.destroy();
    }

    // Physics propagation, color blending, and boundary calculations
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const c = p._custom;
      c.birthTime += dtSeconds;

      // Depth Parallax: Larger foreground objects float and drift faster than background ones
      const parallaxFactor = c.size;
      c.y += c.speedY * state.particleSpeed * parallaxFactor * deltaTime;

      // Motion dynamics: Erratic fluttering for flat ash flakes, slow crawlings for soot motes
      let sway;
      if (c.type === 'ash') {
        // Asymmetric fluttering math
        sway = Math.sin(c.birthTime * c.swayFreq * 2.8) * c.swayWidth * 1.5 * state.particleSway;
      } else {
        // Slow crawling
        sway = Math.sin(c.birthTime * c.swayFreq) * c.swayWidth * state.particleSway;
      }

      const drift = (c.speedX * state.particleSpeed * parallaxFactor * deltaTime) + (state.particleWind * deltaTime) + sway;
      c.x += drift;

      // Eerie Unified Tinting: Blends the default monotone grayscale with the active state color
      const finalR = Math.floor(rTint * c.grayscale);
      const finalG = Math.floor(gTint * c.grayscale);
      const finalB = Math.floor(bTint * c.grayscale);
      p.tint = (finalR << 16) + (finalG << 8) + finalB;

      // Soft Boundary Fading relative to background boundaries (150px fade zones)
      let fadeAlpha = c.targetOpacity;

      // Vertical bottom edge fading (spawn boundary)
      const bottomFadeLimit = halfSize - 150;
      if (c.y > bottomFadeLimit) {
        const bottomFactor = Math.max(0, Math.min(1, (halfSize - c.y) / 150));
        fadeAlpha *= bottomFactor;
      }
      // Vertical top edge fading (exit boundary)
      const topFadeLimit = -halfSize + 150;
      if (c.y < topFadeLimit) {
        const topFactor = Math.max(0, Math.min(1, (c.y - (-halfSize)) / 150));
        fadeAlpha *= topFactor;
      }
      // Horizontal edge fading
      const absX = Math.abs(c.x);
      const sideFadeLimit = halfSize - 150;
      if (absX > sideFadeLimit) {
        const edgeFactor = Math.max(0, Math.min(1, (halfSize - absX) / 150));
        fadeAlpha *= edgeFactor;
      }

      // Apply modifiers from user panel sliders
      p.alpha = Math.max(0, Math.min(1, fadeAlpha * state.particleOpacity));
      p.scale.set(c.size * state.particleSize);
      p.position.set(c.x, c.y);

      // Reset particle when reaching the boundaries of the scene bounds
      if (c.y < -halfSize - 50 || c.x < -halfSize - 50 || c.x > halfSize + 50) {
        c.y = halfSize + Math.random() * 200;
        c.x = (Math.random() - 0.5) * this.bgSize;
        c.birthTime = Math.random() * 100; // Reset offset to keep patterns diverse
      }
    }
  }

  /**
   * Clears active sprite lists, references and generated textures on component destruction.
   */
  destroy() {
    if (this.particles) {
      for (const p of this.particles) {
        p.destroy();
      }
      this.particles = [];
    }
    if (this.ashTexture) {
      this.ashTexture.destroy(true);
    }
    if (this.wispyTexture) {
      this.wispyTexture.destroy(true);
    }
    if (this.particleContainer) {
      this.particleContainer.destroy({ children: true });
    }
  }
}
```

---
### `src\engine\systems\RenderTextureManager.js`
```javascript
// src/engine/systems/RenderTextureManager.js
import { Container, Sprite, RenderTexture, Assets } from 'pixi.js';
import { createWarpFilters } from '../filters/WarpFilterFactory.js';

export class RenderTextureManager {
  constructor(options = {}) {
    this.time = 0;

    this.discoveredPatterns = options.discoveredPatterns || [];
    this.bgPat1Alias = options.bgPat1Alias || null;
    this.bgPat2Alias = options.bgPat2Alias || null;
    this.hasBgPat1 = options.hasBgPat1 ?? false;
    this.hasBgPat2 = options.hasBgPat2 ?? false;

    this.warpFilter = null;
    this.bgWarpFilter = null;

    this.localPatternContainer = null;
    this.localBgPatternContainer = null;

    this.bgPatternRenderTexture = null;
    this.patternRenderTexture = null;

    this.bgPatternSprite = null;
    this.patternSprite = null;

    this.buildManager();
  }

  buildManager() {
    const { warpFilter, bgWarpFilter } = createWarpFilters();
    this.warpFilter = warpFilter;
    this.bgWarpFilter = bgWarpFilter;

    // --- BACKGROUND PATTERNS ---
    const hasAnyBgPat = this.hasBgPat1 || this.hasBgPat2;
    if (hasAnyBgPat) {
      const sampleTex = Assets.get(this.bgPat1Alias || this.bgPat2Alias);
      const bgW = sampleTex ? sampleTex.width : 2000;
      const bgH = sampleTex ? sampleTex.height : 2000;

      this.localBgPatternContainer = new Container();
      this.localBgPatternContainer.filters = [this.bgWarpFilter];

      // Pattern 2 is bottom, Pattern 1 is top
      if (this.hasBgPat2 && this.bgPat2Alias) {
        const sp2 = Sprite.from(this.bgPat2Alias);
        sp2.anchor.set(0.5);
        sp2.position.set(bgW / 2, bgH / 2);
        this.localBgPatternContainer.addChild(sp2);
      }
      if (this.hasBgPat1 && this.bgPat1Alias) {
        const sp1 = Sprite.from(this.bgPat1Alias);
        sp1.anchor.set(0.5);
        sp1.position.set(bgW / 2, bgH / 2);
        this.localBgPatternContainer.addChild(sp1);
      }

      this.bgPatternRenderTexture = RenderTexture.create({ width: bgW, height: bgH });
      this.bgPatternSprite = new Sprite(this.bgPatternRenderTexture);
    } else {
      this.bgPatternRenderTexture = RenderTexture.create({ width: 1, height: 1 });
      this.bgPatternSprite = new Sprite(this.bgPatternRenderTexture);
      this.bgPatternSprite.visible = false;
    }
    this.bgPatternSprite.anchor.set(0.5);

    // --- FOREGROUND CHARACTER PATTERNS ---
    if (this.discoveredPatterns.length > 0) {
      const sampleTex = Assets.get(this.discoveredPatterns[0]);
      const patW = sampleTex ? sampleTex.width : 2000;
      const patH = sampleTex ? sampleTex.height : 2000;

      this.localPatternContainer = new Container();
      this.localPatternContainer.filters = [this.warpFilter];

      for (const patternAlias of this.discoveredPatterns) {
        const sp = Sprite.from(patternAlias);
        sp.anchor.set(0.5);
        sp.position.set(patW / 2, patH / 2);
        this.localPatternContainer.addChild(sp);
      }

      this.patternRenderTexture = RenderTexture.create({ width: patW, height: patH });
      this.patternSprite = new Sprite(this.patternRenderTexture);
    } else {
      this.patternRenderTexture = RenderTexture.create({ width: 1, height: 1 });
      this.patternSprite = new Sprite(this.patternRenderTexture);
      this.patternSprite.visible = false;
    }
    this.patternSprite.anchor.set(0.5);
  }

  update(deltaTime, state, renderer) {
    const dtSeconds = deltaTime / 60;
    this.time += dtSeconds;

    if (this.localPatternContainer && this.localPatternContainer.children.length > 0) {
      const kids = this.localPatternContainer.children;
      if (kids.length === 1) {
        kids[0].scale.set(state.patternTopScale);
      } else if (kids.length > 1) {
        kids[0].scale.set(state.patternBottomScale);
        kids[kids.length - 1].scale.set(state.patternTopScale);
        for (let i = 1; i < kids.length - 1; i++) {
          kids[i].scale.set((state.patternBottomScale + state.patternTopScale) / 2);
        }
      }

      if (this.warpFilter && this.warpFilter.resources.warpUniforms) {
        this.warpFilter.resources.warpUniforms.uniforms.uTime = this.time * state.warpSpeed;
        this.warpFilter.resources.warpUniforms.uniforms.uWarpIntensity = state.warpIntensity;
      }

      renderer.render({
        container: this.localPatternContainer,
        target: this.patternRenderTexture
      });
    }

    if (this.localBgPatternContainer && this.localBgPatternContainer.children.length > 0) {
      const kids = this.localBgPatternContainer.children;
      if (kids.length === 1) {
        kids[0].scale.set(state.bgPatternTopScale);
      } else if (kids.length > 1) {
        kids[0].scale.set(state.bgPatternBottomScale);
        kids[1].scale.set(state.bgPatternTopScale);
      }

      if (this.bgWarpFilter && this.bgWarpFilter.resources.warpUniforms) {
        this.bgWarpFilter.resources.warpUniforms.uniforms.uTime = this.time * state.bgWarpSpeed;
        this.bgWarpFilter.resources.warpUniforms.uniforms.uWarpIntensity = state.bgWarpIntensity;
      }

      renderer.render({
        container: this.localBgPatternContainer,
        target: this.bgPatternRenderTexture
      });
    }
  }

  destroy() {
    if (this.patternRenderTexture) {
      this.patternRenderTexture.destroy(true);
    }
    if (this.bgPatternRenderTexture) {
      this.bgPatternRenderTexture.destroy(true);
    }
    if (this.localPatternContainer) {
      this.localPatternContainer.destroy({ children: true });
    }
    if (this.localBgPatternContainer) {
      this.localBgPatternContainer.destroy({ children: true });
    }
    if (this.patternSprite) {
      this.patternSprite.destroy();
    }
    if (this.bgPatternSprite) {
      this.bgPatternSprite.destroy();
    }
  }
}
```

---
### `src\hooks\useArtworkReactions.js`
```javascript
// src/hooks/useArtworkReactions.js
import { useCallback, useRef, useEffect } from "react";
import { useStore } from "../store/useStore";
import { useLsp1Events } from "./useLsp1Events";

export function useArtworkReactions() {
  const setParameter = useStore((s) => s.setParameter);
  const store = useStore; 
  const frameRef = useRef(null);

  const triggerReaction = useCallback((event) => {
    console.log("💀 Real-Time Gothic Reaction Triggered for:", event.type);
    
    const state = store.getState();
    const originalPreset = {
      aberrationAmount: state.aberrationAmount,
      warpIntensity: state.warpIntensity,
      particleCount: state.particleCount,
      particleSpeed: state.particleSpeed,
      auraOpacity: state.auraOpacity,
      auraScale: state.auraScale,
      glitchShakeIntensity: state.glitchShakeIntensity,
      flickerIntensity: state.flickerIntensity,
      aberrationSpeed: state.aberrationSpeed,
      aberrationGlitch: state.aberrationGlitch
    };

    setParameter("activeReaction", event.type);
    setParameter("reactionProgress", 1.0);

    if (event.type === "lyx_received") {
      // SPIKE: Blazing ember burst + glowing aura explosion
      setParameter("particleCount", 280);
      setParameter("particleSpeed", 4.5);
      setParameter("auraOpacity", 1.0);
      setParameter("auraScale", 1.35);
      setParameter("warpIntensity", 50.0);
    } 
    else if (event.type === "lsp7_received" || event.type === "lsp8_received") {
      // SPIKE: Extreme digital gothic glitch split
      setParameter("aberrationAmount", 30.0);
      setParameter("aberrationSpeed", 8.0);
      setParameter("aberrationGlitch", 4.5);
      setParameter("glitchShakeIntensity", 22);
      setParameter("warpIntensity", 90.0);
      setParameter("flickerIntensity", 0.90);
    }

    let progress = 0;
    const animateDecay = () => {
      progress += 0.007; // Restoration duration (~2.5s)
      
      setParameter("reactionProgress", 1.0 - progress);

      if (progress >= 1.0) {
        // Safe restoration back to baseline
        setParameter("particleCount", originalPreset.particleCount);
        setParameter("particleSpeed", originalPreset.particleSpeed);
        setParameter("auraOpacity", originalPreset.auraOpacity);
        setParameter("auraScale", originalPreset.auraScale);
        setParameter("aberrationAmount", originalPreset.aberrationAmount);
        setParameter("aberrationSpeed", originalPreset.aberrationSpeed);
        setParameter("aberrationGlitch", originalPreset.aberrationGlitch);
        setParameter("warpIntensity", originalPreset.warpIntensity);
        setParameter("glitchShakeIntensity", originalPreset.glitchShakeIntensity);
        setParameter("flickerIntensity", originalPreset.flickerIntensity);
        setParameter("activeReaction", null);
        setParameter("reactionProgress", 0.0);
        
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
        return;
      }

      const invProgress = 1.0 - progress;
      if (event.type === "lyx_received") {
        setParameter("particleCount", Math.floor(originalPreset.particleCount + (300 - originalPreset.particleCount) * invProgress));
        setParameter("particleSpeed", originalPreset.particleSpeed + (4.5 - originalPreset.particleSpeed) * invProgress);
        setParameter("auraOpacity", originalPreset.auraOpacity + (1.0 - originalPreset.auraOpacity) * invProgress);
        setParameter("auraScale", originalPreset.auraScale + (1.35 - originalPreset.auraScale) * invProgress);
      } 
      else if (event.type === "lsp7_received" || event.type === "lsp8_received") {
        setParameter("aberrationAmount", originalPreset.aberrationAmount + (30.0 - originalPreset.aberrationAmount) * invProgress);
        setParameter("warpIntensity", originalPreset.warpIntensity + (90.0 - originalPreset.warpIntensity) * invProgress);
        setParameter("glitchShakeIntensity", Math.floor(originalPreset.glitchShakeIntensity + (25 - originalPreset.glitchShakeIntensity) * invProgress));
        setParameter("flickerIntensity", originalPreset.flickerIntensity + (0.85 - originalPreset.flickerIntensity) * invProgress);
      }

      frameRef.current = requestAnimationFrame(animateDecay);
    };

    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(animateDecay);

  }, [setParameter, store]);

  useEffect(() => {
    window.simulateGothicEvent = (type) => {
      triggerReaction({ type, from: "0xTestSender", value: "100", timestamp: Date.now() });
    };
    return () => {
      delete window.simulateGothicEvent;
    };
  }, [triggerReaction]);

  useLsp1Events(triggerReaction);
}
```

---
### `src\hooks\useLsp1Events.js`
```javascript
// src/hooks/useLsp1Events.js
import { useEffect, useRef } from "react";
import LSP1EventService from "../services/LSP1EventService";
import { useWalletStore } from "../store/useWalletStore";

export function useLsp1Events(onEventReceived) {
  const hostProfileAddress = useWalletStore((s) => s.hostProfileAddress);
  const serviceRef = useRef(null);
  const unsubscribeRef = useRef(null);
  const onEventReceivedRef = useRef(onEventReceived);

  // Keep callback reference synchronized to avoid stale react closure captures
  useEffect(() => {
    onEventReceivedRef.current = onEventReceived;
  }, [onEventReceived]);

  useEffect(() => {
    if (!hostProfileAddress) return;

    // Instantiate fresh, decoupled event service
    const service = new LSP1EventService();
    serviceRef.current = service;

    const startListener = async () => {
      await service.initialize();
      
      // Setup WebSockets stream
      const success = await service.setupEventListeners(hostProfileAddress);
      
      // Bind event callback to the stream emitter
      if (success) {
        unsubscribeRef.current = service.onEvent((event) => {
          if (onEventReceivedRef.current) {
            onEventReceivedRef.current(event);
          }
        });
      }
    };

    startListener();

    // Clean teardown during profile swaps or component unmounts
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      if (serviceRef.current) {
        serviceRef.current.cleanupListeners();
      }
    };
  }, [hostProfileAddress]);
}
```

---
### `src\index.css`
```css
/* src/index.css */
:root {
  --bg-color: #050505;
  --panel-bg: #121212;
  --border-color: #2a2a2a;
  --text-main: #e0e0e0;
  --text-muted: #666666;
  --accent-color: #8b0000;
  --accent-hover: #a50000;
  
  --font-sans: "Helvetica Neue", Helvetica, Arial, sans-serif;
  --font-mono: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body {
  width: 100%;
  height: 100%;
  background-color: var(--bg-color);
  color: var(--text-main);
  font-family: var(--font-sans);
  overflow: hidden;
  -webkit-font-smoothing: antialiased;
}

#root {
  width: 100%;
  height: 100%;
  position: relative;
}

/* Brutalist Scrollbar */
::-webkit-scrollbar {
  width: 8px;
}
::-webkit-scrollbar-track {
  background: var(--bg-color);
}
::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 0;
}
::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}
```

---
### `src\main.jsx`
```javascript
// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

---
### `src\services\LSP1EventService.js`
```javascript
// src/services/LSP1EventService.js
import {
  createPublicClient,
  webSocket,
  isAddress,
  decodeEventLog,
  getAddress,
  decodeAbiParameters,
  parseAbiParameters,
} from "viem";
import { lukso } from "viem/chains";

const DEFAULT_LUKSO_WSS_RPC_URL = "wss://ws-rpc.mainnet.lukso.network";
const WSS_RPC_URL = import.meta.env.VITE_LUKSO_WSS_RPC_URL || DEFAULT_LUKSO_WSS_RPC_URL;
const MAX_RECENT_EVENTS = 10; 
const MAX_RECONNECT_ATTEMPTS = 5;

// Unified ABI Decoders sourced directly from LSP standards
const LSP1_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "from", type: "address" },
      { indexed: true, internalType: "uint256", name: "value", type: "uint256" },
      { indexed: true, internalType: "bytes32", name: "typeId", type: "bytes32" },
      { internalType: "bytes", name: "receivedData", type: "bytes" },
      { internalType: "bytes", name: "returnedValue", type: "bytes" },
    ],
    name: "UniversalReceiver",
    type: "event",
  },
];

const LSP7_RECEIVED_DATA_ABI = parseAbiParameters(
  "address caller, address from, address to, uint256 amount, bytes data"
);

const LSP8_RECEIVED_DATA_ABI = parseAbiParameters(
  "address caller, address from, address to, bytes32 tokenId, bytes data"
);

export const EVENT_TYPE_MAP = {
  lyx_received: "0x6bb56a14d5963264663f293c4aa2e5a916669537ec6c77fe66ea595fabc2d51a", // Standard Value Received
  follower_gained: "0x71e02f9f05bcd5816ec4f3134aa2e5a916669537ec6c77fe66ea595fabc2d51a", // Custom
  follower_lost: "0x9d3c0b4012b69658977b099bdaa51eff0f0460f421fba96d15669506c00d1c4f",  // Custom
  lsp7_received: "0x20804611b3e2ea21c480dc465142210acf4a2485947541770ec1fb87dee4a55c", // Custom
  lsp8_received: "0x0b084a55ebf70fd3c06fd755269dac2212c4d3f0f4d09079780bfa50c1b2984d", // Custom
};

export const TYPE_ID_TO_EVENT_MAP = Object.fromEntries(
  Object.entries(EVENT_TYPE_MAP).map(([eventName, typeId]) => [
    typeId.toLowerCase(),
    eventName,
  ])
);

export default class LSP1EventService {
  constructor() {
    this.eventCallbacks = [];
    this.viemClient = null;
    this.unwatchEvent = null;
    this.listeningAddress = null;
    this.initialized = false;
    this.isSettingUp = false;
    this.shouldBeConnected = false;
    this.recentEvents = [];
    this.reconnectAttempts = 0;
  }

  async initialize() {
    if (this.initialized) return true;
    this.initialized = true;
    return true;
  }

  async setupEventListeners(address) {
    const logPrefix = `[LSP1 Setup Addr:${address?.slice(0, 6)}]`;
    
    if (this.isSettingUp) {
      if (import.meta.env.DEV) console.warn(`${logPrefix} Setup already in progress...`);
      return false;
    }
    
    if (!address || !isAddress(address)) {
      this.shouldBeConnected = false;
      return false;
    }

    if (this.listeningAddress?.toLowerCase() === address.toLowerCase() && this.unwatchEvent) {
      this.shouldBeConnected = true;
      return true;
    }

    this.isSettingUp = true;
    this.shouldBeConnected = true;
    this.cleanupListeners(); 
    this.listeningAddress = address;

    try {
      console.log(`${logPrefix} Connecting WebSocket to watch updates on RPC: ${WSS_RPC_URL}`);
      this.viemClient = createPublicClient({
        chain: lukso,
        transport: webSocket(WSS_RPC_URL, {
          keepAlive: true,
          retryCount: 3,
          timeout: 40000, 
        }),
      });

      this.unwatchEvent = this.viemClient.watchContractEvent({
        address: this.listeningAddress,
        abi: LSP1_ABI,
        eventName: "UniversalReceiver",
        onLogs: (logs) => {
          this.reconnectAttempts = 0; // Clear connection errors
          if (import.meta.env.DEV) console.log(`${logPrefix} Received ${logs.length} contract events.`);
          
          logs.forEach((log) => {
            if (log.removed) return;
            try {
              const decodedLog = decodeEventLog({
                abi: LSP1_ABI,
                data: log.data,
                topics: log.topics,
              });

              if (decodedLog.eventName === "UniversalReceiver" && decodedLog.args) {
                this.handleUniversalReceiver(decodedLog.args);
              }
            } catch (e) {
              if (import.meta.env.DEV) console.error(`Log decode error:`, e);
            }
          });
        },
        onError: (error) => {
          console.error(`${logPrefix} WebSocket Stream dropped:`, error);
          this.handleReconnect(address);
        },
      });

      if (import.meta.env.DEV) console.log(`${logPrefix} WebSocket event service active.`);
      this.isSettingUp = false;
      return true;
    } catch (error) {
      console.error(`${logPrefix} WebSocket Stream initialization failed:`, error);
      this.handleReconnect(address);
      this.isSettingUp = false;
      this.shouldBeConnected = false;
      return false;
    }
  }

  handleReconnect(address) {
    if (!this.shouldBeConnected) return;

    if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      
      console.log(`[LSP1] Reconnecting stream (${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}) in ${delay}ms...`);

      setTimeout(() => {
        if (this.shouldBeConnected) {
          this.setupEventListeners(address);
        }
      }, delay);
    } else {
      console.error("[LSP1] Critical: Maximum reconnection attempts reached. Listener inactive.");
    }
  }

  cleanupListeners() {
    this.shouldBeConnected = false;
    this.isSettingUp = false;

    if (this.unwatchEvent) {
      try {
        this.unwatchEvent();
      } catch (e) {}
      this.unwatch = null;
    }
    this.viemClient = null;
    this.recentEvents = [];
  }

  handleUniversalReceiver(eventArgs) {
    if (!eventArgs || typeof eventArgs !== "object" || !eventArgs.typeId) return;

    const { from, value, typeId, receivedData } = eventArgs;
    const lowerCaseTypeId = typeId?.toLowerCase();

    if (!lowerCaseTypeId) return;

    const stringValue = value?.toString() ?? "0";
    const eventTypeName = TYPE_ID_TO_EVENT_MAP[lowerCaseTypeId] || "unknown_event";

    // Deduplication filter
    if (this.isDuplicateEvent(typeId, from, stringValue, receivedData)) {
      return;
    }

    let actualSender = from || "0xUNKNOWN";
    let decodedPayload = {};

    // Standard LSP7/LSP8 sender decoding
    if (
      (eventTypeName === "lsp7_received" || eventTypeName === "lsp8_received") &&
      typeof receivedData === "string" &&
      receivedData !== "0x"
    ) {
      const abiToUse = eventTypeName === "lsp7_received" ? LSP7_RECEIVED_DATA_ABI : LSP8_RECEIVED_DATA_ABI;
      try {
        const decodedDataArray = decodeAbiParameters(abiToUse, receivedData);
        if (decodedDataArray && decodedDataArray.length > 1 && isAddress(decodedDataArray[1])) {
          actualSender = getAddress(decodedDataArray[1]);
        }
      } catch (decodeError) {
        if (import.meta.env.DEV) console.error(`[LSP1] receivedData decode failed:`, decodeError);
      }
    }

    // Custom follower decoding
    if (eventTypeName === "follower_gained" || eventTypeName === "follower_lost") {
      if (typeof receivedData === "string" && isAddress(receivedData)) {
        decodedPayload.followerAddress = getAddress(receivedData);
      }
    }

    const eventObj = {
      id: `event_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      timestamp: Date.now(),
      type: eventTypeName,
      typeId: lowerCaseTypeId,
      data: receivedData || "0x",
      sender: actualSender,
      value: stringValue,
      read: false,
      decodedPayload: decodedPayload,
    };

    this.notifyEventListeners(eventObj);
  }

  isDuplicateEvent(typeId, from, value, data) {
    const eventIdentifier = `${typeId}-${from}-${value}-${data || "0x"}`;
    if (this.recentEvents.includes(eventIdentifier)) {
      return true;
    }
    this.recentEvents.push(eventIdentifier);
    if (this.recentEvents.length > MAX_RECENT_EVENTS) {
      this.recentEvents.shift();
    }
    return false;
  }

  onEvent(callback) {
    if (typeof callback === "function") {
      if (!this.eventCallbacks.includes(callback)) {
        this.eventCallbacks.push(callback);
      }
    }
    return () => {
      this.eventCallbacks = this.eventCallbacks.filter((cb) => cb !== callback);
    };
  }

  notifyEventListeners(event) {
    if (!event || !event.type) return;
    this.eventCallbacks.slice().forEach((callback) => {
      try {
        callback(event);
      } catch (e) {
        console.error(`Error in event callback:`, e);
      }
    });
  }

  async simulateEvent(eventType) {
    if (!eventType || typeof eventType !== "string") return false;
    const normalizedEventType = eventType.toLowerCase().replace(/[-_\s]/g, "");

    let typeId;
    let readableName;

    const typeIdEntryByName = Object.entries(EVENT_TYPE_MAP).find(
      ([key]) => key.toLowerCase().replace(/[-_\s]/g, "") === normalizedEventType
    );

    if (typeIdEntryByName) {
      readableName = typeIdEntryByName[0];
      typeId = typeIdEntryByName[1];
    } else {
      const typeIdEntryById = Object.entries(TYPE_ID_TO_EVENT_MAP).find(
        ([id]) => id.toLowerCase() === normalizedEventType
      );
      if (typeIdEntryById) {
        typeId = typeIdEntryById[0];
        readableName = typeIdEntryById[1];
      } else {
        return false;
      }
    }

    const simulatedArgs = {
      from: "0xf01103E5a9909Fc0DBe8166dA7085e0285daDDcA",
      value: readableName.includes("lyx") ? 1000000000000000000n : 0n,
      typeId: typeId,
      receivedData: readableName.includes("follower") ? "0xd8dA6Bf26964AF9D7eed9e03e53415D37aA96045" : "0x",
      returnedValue: "0x",
    };

    try {
      this.handleUniversalReceiver(simulatedArgs);
      return true;
    } catch (error) {
      return false;
    }
  }
}
```

---
### `src\store\useStore.js`
```javascript
// src/store/useStore.js
import { create } from 'zustand';

export const useStore = create((set) => ({
  isUiVisible: true,
  toggleUi: () => set((state) => ({ isUiVisible: !state.isUiVisible })),

  mousePos: { x: 0, y: 0 },
  setMousePos: (x, y) => set({ mousePos: { x, y } }),

  // Rig-Aligned Stage & Actor Selection
  characterId: "skull_reaper", // Text identifier matching actor folder name
  bgClippingMaskId: "black",   // Backdrop color name suffix
  bgPatternStyle: "bubble",     // Pattern style prefix
  bgMountainId: 1,             // Mountain asset sequential ID

  // 1. Motion Dynamics
  floatSpeed: 1.0,
  floatAmpX: 30,
  floatAmpY: 15,
  floatRotation: 2.0,

  // 2. Skull Pattern & Warp (Foreground)
  patternBottomScale: 1.0,
  patternTopScale: 1.0,
  warpIntensity: 20.0,
  warpSpeed: 1.0,

  // 3. Background Pattern & Warp (Independent)
  bgPatternBottomScale: 1.0,
  bgPatternTopScale: 1.0,
  bgWarpIntensity: 20.0,
  bgWarpSpeed: 1.0,

  // 4. Aura / Glow
  auraOpacity: 0.5,
  auraScale: 1.05,
  auraBlur: 20,
  auraPulseSpeed: 1.0,
  auraColorR: 235,
  auraColorG: 200,
  auraColorB: 150,

  // 5. Atmosphere (Particles)
  particleCount: 80,
  particleSpeed: 1.0,
  particleWind: 0,
  particleSway: 1.0,
  particleSize: 1.0,
  particleOpacity: 1.0,

  // 6. Atmospheric Parallax Layers
  bgScrollSpeed: 30.0,      
  bg2ParallaxSpeed: 1.8,    

  // 7. Screen Overlay
  scanlineOpacity: 0.15,
  vignetteOpacity: 0.5,

  // 8. Corruption / Glitch
  aberrationAmount: 0.0,
  aberrationSpeed: 0.0,
  aberrationGlitch: 0.0,
  glitchShakeIntensity: 0,
  flickerIntensity: 0.0,
  flickerSpeed: 1.0,

  // 9. Eye & Lid Dynamics
  eyelidTravel: 20.0,         
  blinkInterval: 5.0,        
  blinkSpeed: 1.0,           
  autoBlink: true,           
  eyelidManualProgress: 1.0, 
  pupilWander: 1.0,          
  pupilSaccade: 1.0,         
  pupilMouseInfluence: 1.0,  

  // 10. Web3 LSP1 Reaction State Parameters
  activeReaction: null,      
  reactionProgress: 0.0,     

  setParameter: (key, value) => set({ [key]: value }),
}));
```

---
### `src\store\useWalletStore.js`
```javascript
// src/store/useWalletStore.js
import { create } from 'zustand';
import { createClientUPProvider } from "@lukso/up-provider";
import { createWalletClient, createPublicClient, custom, http, numberToHex, getAddress, isAddress } from "viem";
import { lukso, luksoTestnet } from "viem/chains";
import { ERC725 } from '@erc725/erc725.js';
import lsp3ProfileSchema from '@erc725/erc725.js/schemas/LSP3ProfileMetadata.json';

const LUKSO_MAINNET_RPC = "https://rpc.lukso.network";
const LUKSO_TESTNET_RPC = "https://rpc.testnet.lukso.network";
const IPFS_GATEWAY = "https://api.universalprofile.cloud/ipfs/";

// Module-level singletons to survive React StrictMode concurrently
let globalProviderInstance = null;
let isInitializing = false;

const normalizeChainId = (chainId) => {
  if (chainId === null || chainId === undefined) return null;
  if (typeof chainId === "number") return numberToHex(chainId);
  if (typeof chainId === "string") {
    const lower = chainId.toLowerCase().trim();
    if (/^0x[0-9a-f]+$/.test(lower)) return lower;
    try {
      const num = parseInt(lower, 10);
      if (!isNaN(num) && num >= 0) return numberToHex(num);
    } catch (_) {}
    if (/^[0-9a-f]+$/.test(lower)) return `0x${lower}`;
  }
  return null;
};

const VIEM_CHAINS = {
  [normalizeChainId(lukso.id)]: lukso,
  [normalizeChainId(luksoTestnet.id)]: luksoTestnet,
};

const RPC_URLS = {
  [normalizeChainId(lukso.id)]: LUKSO_MAINNET_RPC,
  [normalizeChainId(luksoTestnet.id)]: LUKSO_TESTNET_RPC,
};

export const useWalletStore = create((set, get) => ({
  provider: null,
  walletClient: null,
  publicClient: null,
  chainId: null,
  accounts: [],
  contextAccounts: [],
  hostProfileAddress: null, 
  loggedInUserUPAddress: null,
  isWalletConnected: false,
  isHostProfileOwner: false,
  initializationError: null,

  initWallet: async () => {
    // 1. Synchronous singleton lock to catch concurrent strict-mode execution threads
    if (globalProviderInstance || get().provider || isInitializing) {
      console.log("⚡ [UP Wallet] Singleton initialization guarded. Exiting duplicate thread.");
      return;
    }
    
    isInitializing = true;
    console.log("🔌 [UP Wallet] Initializing UP Provider...");
    await new Promise(r => setTimeout(r, 100));

    if (typeof window !== "undefined") {
      try {
        globalProviderInstance = createClientUPProvider();
        console.log("✅ [UP Wallet] Singleton provider instance created successfully:", globalProviderInstance);
        set({ provider: globalProviderInstance });
      } catch (error) {
        console.error("❌ [UP Wallet] Client provider generation failed:", error);
        isInitializing = false;
        set({ initializationError: error });
        return;
      }
    } else {
      isInitializing = false;
      set({ initializationError: new Error("Window environment not found.") });
      return;
    }

    const provider = globalProviderInstance;

    // Handshake Event Listeners
    const handleAccountsChanged = (rawAccounts) => {
      console.log("🔔 [UP Wallet] Event triggered: accountsChanged ->", rawAccounts);
      const accounts = (rawAccounts || []).map(a => getAddress(a));
      set({ accounts });
      get()._updateConnectionStatus();
    };

    const handleChainChanged = (rawChainId) => {
      console.log("🔔 [UP Wallet] Event triggered: chainChanged ->", rawChainId);
      const normalized = normalizeChainId(rawChainId);
      const isValid = !!normalized && !!VIEM_CHAINS[normalized];
      
      set({ chainId: isValid ? normalized : null });
      if (!isValid) {
        console.warn("⚠️ [UP Wallet] Context is connected to unsupported chain:", rawChainId);
        set({ accounts: [], contextAccounts: [] });
      }
      
      get()._recreateClients();
      get()._updateConnectionStatus();
    };

    const handleContextAccountsChanged = (rawContext) => {
      console.log("🔔 [UP Wallet] Event triggered: contextAccountsChanged ->", rawContext);
      const contextAccounts = (rawContext || []).map(a => getAddress(a));
      set({ contextAccounts });
      get()._updateConnectionStatus();
    };

    try {
      provider.on("accountsChanged", handleAccountsChanged);
      provider.on("chainChanged", handleChainChanged);
      provider.on("contextAccountsChanged", handleContextAccountsChanged);
      console.log("✅ [UP Wallet] Handshake postMessage event listeners attached.");
    } catch (e) {
      console.warn("⚠️ [UP Wallet] Failed to attach handshake handlers:", e);
    }

    console.log("🕒 [UP Wallet] Querying eth_accounts and eth_chainId...");
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Handshake timeout")), 6000)
    );

    const fetchPromise = Promise.all([
      provider.request({ method: "eth_accounts" }),
      provider.request({ method: "eth_chainId" })
    ]);

    try {
      const [initialAccounts, initialChainId] = await Promise.race([
          fetchPromise,
          timeoutPromise
      ]);

      console.log("✅ [UP Wallet] Handshake completed successfully. Accounts:", initialAccounts, "Chain ID:", initialChainId);

      const normalizedChainId = normalizeChainId(initialChainId);
      const isValidChain = !!normalizedChainId && !!VIEM_CHAINS[normalizedChainId];

      set({
        accounts: (initialAccounts || []).map(a => getAddress(a)),
        contextAccounts: (provider.contextAccounts || []).map(a => getAddress(a)),
        chainId: isValidChain ? normalizedChainId : null
      });

      get()._recreateClients();
      get()._updateConnectionStatus();

    } catch (err) {
      console.warn("⚠️ [UP Wallet] Handshake timed out or failed standalone context check. Applying fallback default chain state.", err.message);
      
      set({
        accounts: [],
        contextAccounts: (provider.contextAccounts || []).map(a => getAddress(a)),
        chainId: null
      });
      get()._recreateClients();
      get()._updateConnectionStatus();
    } finally {
      isInitializing = false;
    }
  },

  // Manual Development Override action
  setHostProfileAddress: (address) => {
    if (!address || !isAddress(address)) {
      console.error("❌ [UP Wallet Override] Invalid Universal Profile address.");
      return;
    }
    const cleaned = getAddress(address);
    console.log("🛠️ [UP Wallet Override] Manually assigning profile address:", cleaned);
    set({ hostProfileAddress: cleaned });
    get()._recreateClients();
    get()._checkPermissions();
  },

  _recreateClients: () => {
    const { provider, chainId, accounts, initializationError } = get();
    const activeChainId = chainId || "0x2a";
    console.log("⚙️ [UP Wallet] Generating Viem clients for active chain context:", activeChainId);

    const currentChain = VIEM_CHAINS[activeChainId] || lukso;
    const rpcUrl = RPC_URLS[activeChainId] || LUKSO_MAINNET_RPC;

    try {
      const publicClient = createPublicClient({
        chain: currentChain,
        transport: http(rpcUrl, { timeout: 30000 })
      });
      set({ publicClient });
      console.log("✅ [UP Wallet] Public Viem reader successfully connected.");
    } catch (err) {
      console.error("❌ [UP Wallet] Viem Public initialization failed:", err);
      set({ publicClient: null });
    }

    if (!initializationError && provider && accounts.length > 0) {
      try {
        const walletClient = createWalletClient({
          chain: currentChain,
          transport: custom(provider),
          account: accounts[0]
        });
        set({ walletClient });
        console.log("✅ [UP Wallet] Wallet write-client active for address:", accounts[0]);
      } catch (err) {
        console.error("❌ [UP Wallet] Viem Wallet initialization failed:", err);
        set({ walletClient: null });
      }
    } else {
      set({ walletClient: null });
    }
  },

  _updateConnectionStatus: async () => {
    const { chainId, accounts, contextAccounts } = get();
    const isConnected = !!chainId && accounts.length > 0 && contextAccounts.length > 0;
    
    const hostProfileAddress = (contextAccounts && contextAccounts.length > 0) 
      ? contextAccounts[0] 
      : null;

    console.log("📊 [UP Wallet] Status refresh executed:", {
      isWalletConnected: isConnected,
      hostProfileAddress,
      activeAccount: accounts[0] || "None"
    });

    set({ 
      isWalletConnected: isConnected,
      hostProfileAddress 
    });

    await get()._checkPermissions();
  },

  _checkPermissions: async () => {
    const { accounts, hostProfileAddress, publicClient } = get();
    const controllerAddress = accounts[0];

    if (!controllerAddress || !hostProfileAddress || !publicClient) {
      console.log("🔒 [UP Wallet] Standard permissions bypass: missing active connection elements.");
      set({ isHostProfileOwner: false, loggedInUserUPAddress: null });
      return;
    }

    console.log(`🔐 [UP Wallet] Fetching ERC725 permissions from key supervisor for ${controllerAddress}...`);
    let isOwner = false;

    if (controllerAddress.toLowerCase() === hostProfileAddress.toLowerCase()) {
      isOwner = true;
      console.log("👑 [UP Wallet] Verified: connected controller is the host profile owner.");
    } else {
      try {
        const erc725 = new ERC725(
          lsp3ProfileSchema, 
          hostProfileAddress, 
          publicClient.transport.url, 
          { ipfsGateway: IPFS_GATEWAY }
        );
        const permissions = await erc725.getPermissions(controllerAddress);
        if (typeof permissions === 'string') {
           const decoded = ERC725.decodePermissions(permissions);
           isOwner = decoded.SUPER_SETDATA;
        } else if (typeof permissions === 'object') {
           isOwner = permissions.SUPER_SETDATA;
        }
        console.log("🔑 [UP Wallet] ERC725 Permissions resolved (SUPER_SETDATA):", isOwner);
      } catch (e) {
        console.warn("⚠️ [UP Wallet] Key supervisor check bypassed or failed:", e.message);
        isOwner = false;
      }
    }

    set({ 
      isHostProfileOwner: isOwner, 
      loggedInUserUPAddress: isOwner ? hostProfileAddress : null
    });
  }
}));

// Bind store to window object in browser development settings for diagnostic queries
if (typeof window !== "undefined") {
  window.useWalletStore = useWalletStore;
}
```

---
### `vite.config.js`
```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
```
