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
    if (engineRef.current) {
      engineRef.current.updateMousePos(x, y);
    }
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
### `src\components\UI\CompactSlider.jsx`
```javascript
// src/components/UI/CompactSlider.jsx
import React from 'react';
import { useStore } from '../../store/useStore';

export default function CompactSlider({ label, storeKey, min, max, step }) {
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
}
```

---
### `src\components\UI\ControlPanel.jsx`
```javascript
// src/components/UI/ControlPanel.jsx
import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
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

// Sub-Tab Component Imports
import SetupTab from './tabs/SetupTab';
import Web3Tab from './tabs/Web3Tab';
import SkullTab from './tabs/SkullTab';
import BgTab from './tabs/BgTab';
import EyesTab from './tabs/EyesTab';
import AuraTab from './tabs/AuraTab';
import AtmosphereTab from './tabs/AtmosphereTab';
import GlitchTab from './tabs/GlitchTab';

export default function ControlPanel() {
  const isUiVisible = useStore((state) => state.isUiVisible);
  const toggleUi = useStore((state) => state.toggleUi);

  const [activeTab, setActiveTab] = useState('setup');

  const tabs = [
    { id: 'setup', label: 'Setup', icon: <Sliders size={12} />, component: <SetupTab /> },
    { id: 'web3', label: 'Web3', icon: <ShieldCheck size={12} />, component: <Web3Tab /> },
    { id: 'skull', label: 'Skull', icon: <Skull size={12} />, component: <SkullTab /> },
    { id: 'bg', label: 'Background', icon: <Layers size={12} />, component: <BgTab /> },
    { id: 'eyes', label: 'Eyes', icon: <Eye size={12} />, component: <EyesTab /> },
    { id: 'aura', label: 'Aura', icon: <Sparkles size={12} />, component: <AuraTab /> },
    { id: 'atmosphere', label: 'Atmosphere', icon: <Wind size={12} />, component: <AtmosphereTab /> },
    { id: 'glitch', label: 'Glitch', icon: <Zap size={12} />, component: <GlitchTab /> }
  ];

  const currentTab = tabs.find(tab => tab.id === activeTab);

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
        {/* Navigation Tabs List */}
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

        {/* Dynamic Panel Renderer */}
        <div style={{ overflowY: 'auto', flex: 1, paddingRight: '5px' }}>
          {currentTab ? currentTab.component : null}
        </div>
      </div>
    </>
  );
}
```

---
### `src\components\UI\tabs\AtmosphereTab.jsx`
```javascript
// src/components/UI/tabs/AtmosphereTab.jsx
import React from 'react';
import CompactSlider from '../CompactSlider';

export default function AtmosphereTab() {
  return (
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
  );
}
```

---
### `src\components\UI\tabs\AuraTab.jsx`
```javascript
// src/components/UI/tabs/AuraTab.jsx
import React from 'react';
import CompactSlider from '../CompactSlider';

export default function AuraTab() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
      <div>
        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Aura Properties</h4>
        <CompactSlider label="Aura Scale" storeKey="auraScale" min="1.0" max="1.5" step="0.01" />
        <CompactSlider label="Aura Opacity" storeKey="auraOpacity" min="0" max="1" step="0.05" />
        <CompactSlider label="Aura Blur strength" storeKey="auraBlur" min="0" max="50" step="1" />
        <CompactSlider label="Aura Pulse Speed" storeKey="auraPulseSpeed" min="0" max="5" step="0.1" />
      </div>
      <div>
        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Cavern Light & Tint (RGB)</h4>
        <CompactSlider label="Cavern Light Intensity" storeKey="cavernLightIntensity" min="0" max="2" step="0.05" />
        <CompactSlider label="Red Channel" storeKey="auraColorR" min="0" max="255" step="1" />
        <CompactSlider label="Green Channel" storeKey="auraColorG" min="0" max="255" step="1" />
        <CompactSlider label="Blue Channel" storeKey="auraColorB" min="0" max="255" step="1" />
      </div>
    </div>
  );
}
```

---
### `src\components\UI\tabs\BgTab.jsx`
```javascript
// src/components/UI/tabs/BgTab.jsx
import React from 'react';
import CompactSlider from '../CompactSlider';

export default function BgTab() {
  return (
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
        {/* Still point is now at 0.0 in the middle, allowing reverse motion on the left */}
        <CompactSlider label="BG2 Parallax Factor" storeKey="bg2ParallaxSpeed" min="-5.0" max="5.0" step="0.1" />
      </div>
    </div>
  );
}
```

---
### `src\components\UI\tabs\EyesTab.jsx`
```javascript
// src/components/UI/tabs/EyesTab.jsx
import React from 'react';
import { useStore } from '../../../store/useStore';
import CompactSlider from '../CompactSlider';

export default function EyesTab() {
  const autoBlink = useStore((state) => state.autoBlink);
  const setParameter = useStore((state) => state.setParameter);

  return (
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
  );
}
```

---
### `src\components\UI\tabs\GlitchTab.jsx`
```javascript
// src/components/UI/tabs/GlitchTab.jsx
import React from 'react';
import CompactSlider from '../CompactSlider';

export default function GlitchTab() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
      <div>
        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Chromatic Split & Shocks</h4>
        <CompactSlider label="RGB Split Amount" storeKey="aberrationAmount" min="0" max="30" step="0.5" />
        <CompactSlider label="Aberration Speed" storeKey="aberrationSpeed" min="0" max="10" step="0.1" />
        <CompactSlider label="Glitch Burst Chance" storeKey="aberrationGlitch" min="0" max="5" step="0.1" />
        <CompactSlider label="Flicker Intensity" storeKey="flickerIntensity" min="0" max="0.9" step="0.05" />
        <CompactSlider label="Flicker Speed" storeKey="flickerSpeed" min="0" max="5" step="0.1" />
        <CompactSlider label="Screen Shake" storeKey="glitchShakeIntensity" min="0" max="30" step="1" />
      </div>
      <div>
        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Echoing Phase Trails</h4>
        <CompactSlider label="Trail Count" storeKey="trailCount" min="0" max="3" step="1" />
        <CompactSlider label="Frame Step Spacing" storeKey="trailSpacing" min="2" max="15" step="1" />
        <CompactSlider label="Manual Test Alpha" storeKey="trailManualAlpha" min="0" max="1" step="0.05" />
        <CompactSlider label="Glitch/Web3 Influence" storeKey="trailGlitchInfluence" min="0" max="1" step="0.05" />
      </div>
    </div>
  );
}
```

---
### `src\components\UI\tabs\SetupTab.jsx`
```javascript
// src/components/UI/tabs/SetupTab.jsx
import React from 'react';
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
  const characterId = useStore((state) => state.characterId);
  const bgClippingMaskId = useStore((state) => state.bgClippingMaskId);
  const bgPatternStyle = useStore((state) => state.bgPatternStyle);
  const bgMountainId = useStore((state) => state.bgMountainId);
  const bgMountainBackId = useStore((state) => state.bgMountainBackId);
  const setParameter = useStore((state) => state.setParameter);

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
```

---
### `src\components\UI\tabs\SkullTab.jsx`
```javascript
// src/components/UI/tabs/SkullTab.jsx
import React from 'react';
import CompactSlider from '../CompactSlider';

export default function SkullTab() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
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
      </div>
    </div>
  );
}
```

---
### `src\components\UI\tabs\Web3Tab.jsx`
```javascript
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
  Texture,
  Graphics,
  Filter,
  defaultFilterVert
} from 'pixi.js';
import { useStore } from '../store/useStore.js';
import { EffectsSystem } from './systems/EffectsSystem.js';
import { ParticleSystem } from './systems/ParticleSystem.js';
import { EyeSystem } from './systems/EyeSystem.js';
import { FogSystem } from './systems/FogSystem.js';
import { RenderTextureManager } from './systems/RenderTextureManager.js';
import { MirroredScrollLayer } from './systems/MirroredScrollLayer.js';

// --- Custom WebGL 2D Cascading Portal Refraction Shockwave Fragment Shader ---
const SHOCKWAVE_FRAGMENT_SHADER = `
precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec4 uInputClamp;

uniform vec2 uCenter;          // Center in screen pixels (gl_FragCoord space: bottom-left origin)
uniform vec2 uScreenSize;      // Screen dimensions in pixels [width, height]
uniform float uRadii[5];       // Array of active wavefront radii (in pixels)
uniform float uActiveWaveCount;// Number of currently executing wave ripples
uniform float uThickness;      // Width of the refractive wavefront ring (in pixels)
uniform float uAmplitude;      // Displacement amount (in pixels)

void main() {
  vec2 uv = vTextureCoord;
  
  // Isotropic distance calculation in absolute screen pixels
  float dist = distance(gl_FragCoord.xy, uCenter);

  vec2 offset = vec2(0.0);
  int activeCount = int(uActiveWaveCount);

  // Iteratively compute up to 5 overlapping wave fronts within a single pass
  for (int i = 0; i < 5; i++) {
    if (i >= activeCount) {
      break;
    }
    
    float r = uRadii[i];
    
    // Check if the current pixel coordinate falls within this wave's refract ring bounds
    if (dist >= r - uThickness && dist <= r) {
      float progress = (r - dist) / uThickness; // Normalized progress inside ring (0.0 to 1.0)
      float wave = sin(progress * 3.14159265);
      
      // Calculate radial screen space direction
      vec2 dir = normalize(gl_FragCoord.xy - uCenter);
      
      // Map vertical coordinate offset. Y is top-down in UV coordinates, but bottom-up in gl_FragCoord
      vec2 uvDir = vec2(dir.x, -dir.y);
      
      // Attenuate wavefront impact as it expands towards the screen boundaries
      float dampening = 1.0 - clamp(r / (uScreenSize.x * 0.85), 0.0, 1.0);
      
      // Accumulate displacements translated into UV fraction offset
      offset += uvDir * wave * (uAmplitude / uScreenSize) * dampening;
    }
  }

  vec2 clampedUV = clamp(uv - offset, uInputClamp.xy, uInputClamp.zw);
  finalColor = texture(uTexture, clampedUV);
}
`;

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

    // Load sequence counter to prevent overlapping asynchronous loading glitches
    this.loadSequence = 0;

    // Direct existential flags
    this.hasBgClippingMask = false;
    this.hasBgMountain = false;
    this.hasBgMountainBack = false;
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
    this.renderTextureManager = null;
    this.bgFog = null;
    this.fgFog = null;

    // Echoing Phase Trail References
    this.trailContainer = null;
    this.trailSprites = [];
    this.trailHistory = [];

    // Custom Portal Refraction Shockwave State
    this.shockwaveFilter = null;
    this.shockwaveActive = false;
    this.shockwaveTime = 0;
    this.lastReaction = null;
    this.lastGlitchPeak = false;

    // Internal mouse state bypassed from Zustand
    this.mousePos = { x: 0, y: 0 };

    this.config = { ...useStore.getState() };

    this.unsubscribeStore = useStore.subscribe((state) => {
      const prevChar = this.config.characterId;
      const prevBgClip = this.config.bgClippingMaskId;
      const prevBgStyle = this.config.bgPatternStyle;
      const prevBgMountain = this.config.bgMountainId;
      const prevBgMountainBack = this.config.bgMountainBackId;

      this.config = state;

      if (
        prevChar !== state.characterId ||
        prevBgClip !== state.bgClippingMaskId ||
        prevBgStyle !== state.bgPatternStyle ||
        prevBgMountain !== state.bgMountainId ||
        prevBgMountainBack !== state.bgMountainBackId
      ) {
        this.reloadAssetsAndScene().catch(err => console.error("Re-init assets failed:", err));
      }
    });
  }

  updateMousePos(x, y) {
    this.mousePos.x = x;
    this.mousePos.y = y;
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
      
      const currentSeq = ++this.loadSequence;
      await this.loadAssets();

      if (this.isDestroyed || currentSeq !== this.loadSequence) {
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
    const { characterId, bgClippingMaskId, bgPatternStyle, bgMountainId, bgMountainBackId } = this.config;
    const verifiedLoadQueue = [];

    this.discoveredPatterns = [];
    this.discoveredEyes = [];
    this.hasEyelids = false;
    this.isPanoramaMode = false;
    this.hasBg2 = false;
    this.hasBgMountainBack = false;

    console.log(`%c🔍 [PixiEngine] Rig Loader: Locating Stage Assets`, 'color: #00f3ff; font-weight: bold;');

    // Normalize IDs to padded 2-digit strings (e.g. 1 -> "01", 2 -> "02")
    const padId = (id) => typeof id === 'number' ? String(id).padStart(2, '0') : id;
    const formattedMountainId = padId(bgMountainId);
    const formattedMountainBackId = padId(bgMountainBackId);

    this.keys = {
      bg_clipping_mask: `bg_clipping_mask_${bgClippingMaskId}`,
      bg_pat_1: `bg_pat_1_${bgPatternStyle}`,
      bg_pat_2: `bg_pat_2_${bgPatternStyle}`,
      bg_mountain: `bg_mountain_${formattedMountainId}`,
      bg_mountain_back: `bg_mountain_back_${formattedMountainBackId}`,
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

      // 3. Foreground Mountains Layer
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

      // 4. Background Mountains Layer
      let mountainBackPath = `/assets/stage/mountains/mountain_${formattedMountainBackId}.webp`;
      this.hasBgMountainBack = await testImageAsset(mountainBackPath);
      if (!this.hasBgMountainBack) {
        mountainBackPath = `/assets/stage/mountains/mountain_${bgMountainBackId}.webp`;
        this.hasBgMountainBack = await testImageAsset(mountainBackPath);
      }
      if (this.hasBgMountainBack) {
        console.log(`✅ [PixiEngine] Back Mountain Graphic: ${mountainBackPath}`);
        verifiedLoadQueue.push({ alias: this.keys.bg_mountain_back, src: mountainBackPath });
      } else {
        console.warn(`⚠️ [PixiEngine] Missing Back Mountain Asset at: /assets/stage/mountains/mountain_${formattedMountainBackId}.webp`);
        Assets.cache.set(this.keys.bg_mountain_back, Texture.EMPTY);
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

    // --- Foreground Character Patterns ---
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

    // --- Foreground Character Dynamic Eye Sockets ---
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

    // --- Foreground Character Eyelids ---
    const eyelidsTopPath = `/assets/actors/${characterId}/eyes/eyelids_top.webp`;
    const eyelidsBottomPath = `/assets/actors/${characterId}/eyes/eyelids_bottom.webp`;
    const hasEyelidsTop = await testImageAsset(eyelidsTopPath);
    const hasEyelidsBottom = await testImageAsset(eyelidsBottomPath);

    if (hasEyelidsTop && hasEyelidsBottom) {
      console.log("✅ [PixiEngine] Found Flat Eyelid Elements");
      verifiedLoadQueue.push({ alias: this.keys.eyelids_top, src: eyelidsTopPath });
      verifiedLoadQueue.push({ alias: this.keys.eyelids_bottom, src: eyelidsBottomPath });
      this.hasEyelids = true;
    } else {
      console.warn("⚠️ [PixiEngine] Eyelids missing (Expected flat eyelids_top.webp and eyelids_bottom.webp inside eyes/ folder)");
      Assets.cache.set(this.keys.eyelids_top, Texture.EMPTY);
      Assets.cache.set(this.keys.eyelids_bottom, Texture.EMPTY);
    }

    if (verifiedLoadQueue.length > 0) {
      try {
        await Assets.load(verifiedLoadQueue);
        console.log("%c✅ [PixiEngine] Dynamic asset payload cached!", 'color: #00ff80; font-weight: bold;');
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

    // Instantiate custom cascading portal refraction shader setup
    this.shockwaveFilter = Filter.from({
      gl: {
        vertex: defaultFilterVert,
        fragment: SHOCKWAVE_FRAGMENT_SHADER
      },
      resources: {
        shockwaveUniforms: {
          uCenter: { value: [0.0, 0.0], type: 'vec2<f32>' },
          uScreenSize: { value: [1.0, 1.0], type: 'vec2<f32>' },
          uRadii: { value: new Float32Array([0, 0, 0, 0, 0]), type: 'f32', size: 5 },
          uActiveWaveCount: { value: 0.0, type: 'f32' },
          uThickness: { value: 160.0, type: 'f32' },
          uAmplitude: { value: 30.0, type: 'f32' }
        }
      }
    });

    this.shockwaveActive = false;
    this.shockwaveTime = 0;

    // Initialize the off-screen RenderTextureManager to flatten warp patterns
    this.renderTextureManager = new RenderTextureManager({
      discoveredPatterns: this.discoveredPatterns,
      bgPat1Alias: this.hasBgPat1 ? this.keys.bg_pat_1 : null,
      bgPat2Alias: this.hasBgPat2 ? this.keys.bg_pat_2 : null,
      hasBgPat1: this.hasBgPat1,
      hasBgPat2: this.hasBgPat2
    });

    // --- ASSEMBLE BACKGROUND ---
    if (this.isPanoramaMode) {
      const bgTexture = Assets.get('bg');
      if (bgTexture && bgTexture !== Texture.EMPTY) {
        this.layers.bg = new MirroredScrollLayer(bgTexture, this.bgHeightScale, 1.0);
        this.bgAtmosphereContainer.addChild(this.layers.bg);
      }

      if (this.hasBg2) {
        const bg2Texture = Assets.get('bg2');
        if (bg2Texture && bg2Texture !== Texture.EMPTY) {
          this.layers.bg2 = new MirroredScrollLayer(bg2Texture, this.bgHeightScale, this.config.bg2ParallaxSpeed);
          this.bgAtmosphereContainer.addChild(this.layers.bg2);
        }
      }
    } else {
      // 1. Solid Backdrop Color
      if (this.hasBgClippingMask) {
        this.layers.bg_clip = createSprite(this.keys.bg_clipping_mask);
        this.bgAtmosphereContainer.addChild(this.layers.bg_clip);
      }

      // 2. Off-Screen RenderTexture Warp patterns
      const hasAnyBgPat = this.hasBgPat1 || this.hasBgPat2;
      if (hasAnyBgPat && this.renderTextureManager) {
        this.bgAtmosphereContainer.addChild(this.renderTextureManager.bgPatternSprite);

        // Ceiling reflection overlay (screen blended duplicate of offscreen render texture)
        this.layers.bg_pattern_reflect = new Sprite(this.renderTextureManager.bgPatternRenderTexture);
        this.layers.bg_pattern_reflect.anchor.set(0.5);
        this.layers.bg_pattern_reflect.blendMode = 'screen';
        this.bgAtmosphereContainer.addChild(this.layers.bg_pattern_reflect);
      }

      // 3. Back Mountains layer
      if (this.hasBgMountainBack) {
        const mountainBackTex = Assets.get(this.keys.bg_mountain_back);
        if (mountainBackTex && mountainBackTex !== Texture.EMPTY) {
          this.layers.bg_mountain_back = new MirroredScrollLayer(mountainBackTex, this.bgHeightScale, 0.18);
          this.layers.bg_mountain_back.position.y = -35; // Shifts upward to align behind front range
          this.layers.bg_mountain_back.alpha = 0.75; // Atmospheric perspective haze
          this.bgAtmosphereContainer.addChild(this.layers.bg_mountain_back);

          // Dynamic Cavern Lighting: Back Mountain Reflector Duplicate
          this.layers.bg_mountain_back_reflect = new MirroredScrollLayer(mountainBackTex, this.bgHeightScale, 0.18);
          this.layers.bg_mountain_back_reflect.position.y = -35;
          this.layers.bg_mountain_back_reflect.blendMode = 'screen';
          this.bgAtmosphereContainer.addChild(this.layers.bg_mountain_back_reflect);
        }
      }

      // 4. Foreground Mountains layer
      if (this.hasBgMountain) {
        const mountainTex = Assets.get(this.keys.bg_mountain);
        if (mountainTex && mountainTex !== Texture.EMPTY) {
          this.layers.bg_mountain = new MirroredScrollLayer(mountainTex, this.bgHeightScale, 0.4);
          this.bgAtmosphereContainer.addChild(this.layers.bg_mountain);

          // Dynamic Cavern Lighting: Foreground Mountain Reflector Duplicate
          this.layers.bg_mountain_reflect = new MirroredScrollLayer(mountainTex, this.bgHeightScale, 0.4);
          this.layers.bg_mountain_reflect.blendMode = 'screen';
          this.bgAtmosphereContainer.addChild(this.layers.bg_mountain_reflect);
        }
      }
    }

    // Decoupled Background Fog Layer
    this.bgFog = new FogSystem(this.bgAtmosphereContainer, this.bgHeightScale, false);

    // Particles
    this.particleSystem = new ParticleSystem(this.app.renderer, this.bgAtmosphereContainer, this.bgHeightScale);
    
    // --- ASSEMBLE CHARACTER & SPECTRAL TRAILS ---
    
    // 1. Instantiate separate container for historical echoing ghosting trails (placed behind primary nodes)
    this.trailContainer = new Container();
    this.masterContainer.addChild(this.trailContainer);

    this.trailSprites = [];
    this.trailHistory = []; // Flush existing history log on reconstruct

    if (this.hasCharClippingMask) {
      // Allocate up to 3 echoing spectral silhouettes
      for (let i = 0; i < 3; i++) {
        const s = createSprite(this.keys.char_clipping_mask);
        s.alpha = 0;
        s.visible = false;
        s.blendMode = 'screen'; // Use Screen blending to give a bright, spectral energy

        // Assign chromatic offset tints: index 0 (Cyan), index 1 (Magenta), index 2 (Flame Orange/Red)
        if (i === 0) s.tint = 0x00f3ff;
        else if (i === 1) s.tint = 0xff00ff;
        else s.tint = 0xff5500;

        this.trailContainer.addChild(s);
        this.trailSprites.push(s);
      }
    }

    // 2. Head Container
    this.headContainer = new Container();
    this.masterContainer.addChild(this.headContainer);

    // Blurry shadow glow container (renders underneath head lineart/features)
    if (this.hasCharClippingMask) {
      this.layers.aura = createSprite(this.keys.char_clipping_mask);
      this.headContainer.addChild(this.layers.aura);
    }

    // Nested composition to decouple filters from the mask sprite
    if (this.hasCharClippingMask) {
      // The mask sprite (must be set as renderable=false so it does not draw as a solid colored block)
      const charMaskSprite = createSprite(this.keys.char_clipping_mask);
      charMaskSprite.renderable = false; 
      this.headContainer.addChild(charMaskSprite);

      // The wrapped container applying only the clip-mask
      this.characterContentContainer = new Container();
      
      // Use setMask with channel: 'alpha' to bypass color channel processing
      this.characterContentContainer.setMask({
        mask: charMaskSprite,
        channel: 'alpha'
      });
      
      this.headContainer.addChild(this.characterContentContainer);

      // Render base color (clipping mask file acting as character color) inside masked wrapper
      this.layers.base = createSprite(this.keys.char_clipping_mask);
      this.characterContentContainer.addChild(this.layers.base);

      // Render character patterns using flattened textures
      if (this.discoveredPatterns.length > 0 && this.renderTextureManager) {
        this.characterContentContainer.addChild(this.renderTextureManager.patternSprite);
      }
    }

    // Attach glow, dynamic cavern lighting, and filters
    this.effectsSystem.attach({
      headContainer: this.headContainer,
      auraSprite: this.layers.aura,
      baseSprite: this.layers.base,
      mountainReflector: this.layers.bg_mountain_reflect,
      mountainBackReflector: this.layers.bg_mountain_back_reflect,
      ceilingReflector: this.layers.bg_pattern_reflect
    });

    // Render lineart
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

    // Decoupled Foreground Fog Layer (placed on top of character but below overlays)
    this.fgFog = new FogSystem(this.masterContainer, this.bgHeightScale, true);
  }

  async reloadAssetsAndScene() {
    this.isReady = false;

    // Capture sequence to discard out-of-order stale operations
    const currentSeq = ++this.loadSequence;

    // 1. Destroy active subsystems FIRST so they can safely release graphics/WebGL resources
    if (this.eyeSystem?.destroy) {
      this.eyeSystem.destroy();
    }
    if (this.particleSystem?.destroy) {
      this.particleSystem.destroy();
    }
    if (this.renderTextureManager?.destroy) {
      this.renderTextureManager.destroy();
      this.renderTextureManager = null;
    }
    if (this.bgFog?.destroy) {
      this.bgFog.destroy();
      this.bgFog = null;
    }
    if (this.fgFog?.destroy) {
      this.fgFog.destroy();
      this.fgFog = null;
    }

    // 2. Safely dispose of the main rendering display tree
    if (this.masterContainer) {
      this.masterContainer.destroy({ children: true, texture: false });
      this.masterContainer = null;
    }

    await this.loadAssets();

    if (this.isDestroyed || currentSeq !== this.loadSequence) {
      return;
    }

    this.buildSceneGraph();
    this.resize();
    this.isReady = true;
  }

  /**
   * Triggers the WebGL Portal Refraction Shockwave filter.
   */
  triggerShockwave() {
    this.shockwaveActive = true;
    this.shockwaveTime = 0;

    const floatX = this.headContainer ? this.headContainer.position.x : 0;
    const floatY = this.headContainer ? this.headContainer.position.y : 0;

    const unis = this.shockwaveFilter.resources.shockwaveUniforms.uniforms;
    const { screen } = this.app;
    const scale = this.masterContainer.scale.x;

    // Calculate absolute screen-pixel positions relative to the top-left canvas origin
    const screenX = screen.width / 2 + floatX * scale;
    const screenY = screen.height / 2 + floatY * scale;

    // Map screen-pixel coordinates perfectly to gl_FragCoord space (which starts bottom-left in OpenGL)
    unis.uCenter = [screenX, screen.height - screenY];
    unis.uScreenSize = [screen.width, screen.height];

    // Reset multi-radii arrays and wave counters
    unis.uRadii = new Float32Array([0, 0, 0, 0, 0]);
    unis.uActiveWaveCount = 0.0;

    // Apply the filter on the parent masterContainer so it warps BOTH character and environment
    this.masterContainer.filters = [this.shockwaveFilter];
  }

  update(deltaTime) {
    if (!this.isReady) return;
    const dtSeconds = deltaTime / 60;
    this.time += dtSeconds;

    // Synthesize latest coordinates dynamically so that EyeSystem and nested modules receive updates
    const config = { ...this.config, mousePos: this.mousePos };
    const { isGlitched, currentSplit } = this.effectsSystem.update(this.time, config);

    // --- Custom Flight & Hover Calculations ---
    const tFloat = this.time * config.floatSpeed;

    // Employs a smoothstep curve over clamped waves to generate hover pauses (plateaus) at extrema
    const rawWave = Math.sin(tFloat) * config.flyHoverPause;
    const clampedWave = Math.max(-1, Math.min(1, rawWave));
    
    // Normalizes clamped wave range to [0.0, 1.0] for linear progress interpolation
    const normProgress = clampedWave * 0.5 + 0.5; 
    const smoothProgress = normProgress * normProgress * (3 - 2 * normProgress);

    // Apply vertical displacement limits (0 is the lowest, config.floatAmpY is the highest elevation)
    let floatY = -(smoothProgress * config.floatAmpY * 1.5);
    
    // Horizontal sway
    let floatX = Math.cos(tFloat * 0.5) * config.floatAmpX;

    const isGlitchActive = (isGlitched || currentSplit > (config.aberrationAmount * 1.15));
    if (config.glitchShakeIntensity > 0 && isGlitchActive) {
        floatX += (Math.random() - 0.5) * config.glitchShakeIntensity;
        floatY += (Math.random() - 0.5) * config.glitchShakeIntensity;
    }
    this.headContainer.position.set(floatX, floatY);

    // Dynamic scale: transitions from flyMinScale (bottom) to flyMaxScale (peak)
    const currentScale = config.flyMinScale - (smoothProgress * (config.flyMinScale - config.flyMaxScale));
    this.headContainer.scale.set(currentScale);

    // Dynamic rotation: persistent angle bias tilt + slow swaying around bias center
    const tiltRad = config.flyTiltBias * (Math.PI / 180);
    const swayOsc = Math.sin(tFloat * 0.7) * (config.floatRotation * 0.5) * (Math.PI / 180);
    this.headContainer.rotation = tiltRad + swayOsc;

    // --- Custom Portal Refraction Shockwave Lifecycle and Uniform Updates ---
    if (this.shockwaveActive) {
      this.shockwaveTime += dtSeconds;

      const { screen } = this.app;
      // Define total wave expansion threshold in absolute screen pixels
      const maxScreenRadius = Math.max(screen.width, screen.height) * 1.15;

      const duration = config.shockwaveDuration ?? 1.8;
      const pulseCount = Math.max(1, Math.min(5, config.shockwavePulseCount ?? 2));
      const strength = config.shockwaveStrength ?? 1.0;
      const thickness = config.shockwaveThickness ?? 160.0;

      // Spacing delay gap between releasing subsequent overlapping waves (e.g. 0.35 seconds)
      const waveDelay = 0.35;

      const unis = this.shockwaveFilter.resources.shockwaveUniforms.uniforms;
      unis.uScreenSize = [screen.width, screen.height];
      unis.uThickness = thickness;
      unis.uAmplitude = strength * 45.0; // scales user multiplier to maximum pixel translation width

      let activeCount = 0;
      const radii = new Float32Array([0, 0, 0, 0, 0]);

      for (let i = 0; i < pulseCount; i++) {
        const waveStartTime = i * waveDelay;
        if (this.shockwaveTime >= waveStartTime) {
          const waveAge = this.shockwaveTime - waveStartTime;
          const waveProgress = waveAge / duration;

          if (waveProgress < 1.0) {
            radii[i] = waveProgress * maxScreenRadius;
            activeCount++;
          }
        }
      }

      unis.uRadii = radii;
      unis.uActiveWaveCount = activeCount;

      // Safe clean up once all active waves complete expansion
      if (activeCount === 0 && this.shockwaveTime > (pulseCount * waveDelay)) {
        this.shockwaveActive = false;
        this.masterContainer.filters = null; // deactivate completely to restore zero pipeline overhead
      } else {
        if (!this.masterContainer.filters || this.masterContainer.filters.length === 0) {
          this.masterContainer.filters = [this.shockwaveFilter];
        }
      }
    }

    // --- Auto Trigger Detection Logic ---
    // 1. Detect Web3 reaction trigger spikes
    const activeReaction = config.activeReaction;
    if (activeReaction && activeReaction !== this.lastReaction) {
      this.triggerShockwave();
    }
    this.lastReaction = activeReaction;

    // 2. Detect peak chromatic split glitches coupled with screen shake action
    const glitchTriggered = isGlitchActive && config.glitchShakeIntensity > 15;
    if (glitchTriggered && !this.lastGlitchPeak) {
      this.triggerShockwave();
    }
    this.lastGlitchPeak = glitchTriggered;

    // Update off-screen RenderTextureManager pass for warp filters
    if (this.renderTextureManager) {
      this.renderTextureManager.update(deltaTime, config, this.app.renderer);
    }

    // Update decoupled background and foreground fog systems
    if (this.bgFog) {
      this.bgFog.update(this.time, config);
    }
    if (this.fgFog) {
      this.fgFog.update(this.time, config);
    }

    if (this.eyeSystem) {
      this.eyeSystem.update(deltaTime, config);
    }

    if (this.particleSystem) {
      this.particleSystem.update(deltaTime, config);
    }

    // --- Echoing Phase Trails Historical Queue Update ---
    this.trailHistory.unshift({
      x: floatX,
      y: floatY,
      scaleX: currentScale,
      scaleY: currentScale,
      rotation: this.headContainer.rotation
    });

    const spacing = Math.max(2, config.trailSpacing ?? 5);
    const maxHistoryNeeded = spacing * 3 + 2;
    if (this.trailHistory.length > maxHistoryNeeded) {
      this.trailHistory.pop();
    }

    const trailCount = Math.max(0, Math.min(3, config.trailCount ?? 3));
    const manualAlpha = config.trailManualAlpha ?? 0.0;
    const glitchInfluence = config.trailGlitchInfluence ?? 0.6;

    // Visibility trigger: active glitch shakes or Web3 transaction decaying progress
    const shakeIntensity = config.glitchShakeIntensity ?? 0;
    const activeReactionProgress = config.reactionProgress ?? 0;
    const motionPulse = (shakeIntensity / 30) * (isGlitchActive ? 1.0 : 0.25);
    const dynamicAlpha = Math.max(motionPulse, activeReactionProgress) * glitchInfluence;

    // Combine manual override (for custom testing) and dynamic action values
    const targetBaseAlpha = Math.max(manualAlpha, dynamicAlpha);

    this.trailSprites.forEach((sprite, index) => {
      if (index >= trailCount || targetBaseAlpha <= 0.01) {
        sprite.visible = false;
        sprite.alpha = 0;
        return;
      }

      const historyIndex = (index + 1) * spacing - 1;
      const historyState = this.trailHistory[historyIndex];

      if (historyState) {
        sprite.visible = true;
        
        // Spectral scale expansion: expands the size of older trails so they peek out as a halo outline
        const scaleExpansion = 1.0 + (index + 1) * 0.04; // 4%, 8%, 12% scale additions
        
        // Vertical drift offset: offsets the coordinates upward to simulate floating heat haze
        const driftOffsetY = (index + 1) * -8; // shifts older steps upward on screen

        sprite.position.set(historyState.x, historyState.y + driftOffsetY);
        sprite.scale.set(historyState.scaleX * scaleExpansion, historyState.scaleY * scaleExpansion);
        sprite.rotation = historyState.rotation;

        // Fades coordinates of older trails more deeply
        const stepDecay = 1.0 - (index * 0.25); // Trail 0: 100%, Trail 1: 75%, Trail 2: 50% of base alpha
        sprite.alpha = Math.max(0, Math.min(1.0, targetBaseAlpha * stepDecay));
      } else {
        sprite.visible = false;
        sprite.alpha = 0;
      }
    });

    // --- Background Side Scrolling (Double Layer Parallax) ---
    const baseSpeed = config.bgScrollSpeed;
    const backParallax = config.bg2ParallaxSpeed; // The slider value (supports negative ranges)

    if (this.isPanoramaMode) {
      if (this.layers.bg) {
        this.layers.bg.updatePositions(dtSeconds, baseSpeed, 1.0);
      }
      if (this.layers.bg2) {
        this.layers.bg2.updatePositions(dtSeconds, baseSpeed, backParallax);
      }
    } else {
      if (this.layers.bg_mountain_back) {
        this.layers.bg_mountain_back.updatePositions(dtSeconds, baseSpeed, 0.15 * backParallax);
      }
      if (this.layers.bg_mountain_back_reflect) {
        this.layers.bg_mountain_back_reflect.updatePositions(dtSeconds, baseSpeed, 0.15 * backParallax);
      }
      if (this.layers.bg_mountain) {
        this.layers.bg_mountain.updatePositions(dtSeconds, baseSpeed, 0.40);
      }
      if (this.layers.bg_mountain_reflect) {
        this.layers.bg_mountain_reflect.updatePositions(dtSeconds, baseSpeed, 0.40);
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
        if (this.renderTextureManager?.destroy) {
          this.renderTextureManager.destroy();
          this.renderTextureManager = null;
        }
        if (this.bgFog?.destroy) {
          this.bgFog.destroy();
          this.bgFog = null;
        }
        if (this.fgFog?.destroy) {
          this.fgFog.destroy();
          this.fgFog = null;
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
    this.auraBlurFilter.padding = 100; // Prevent harsh bounding box edge clipping during large blur pulses

    this.colorMatrix = new ColorMatrixFilter();

    // Store target references
    this.targets = {
      headContainer: null,
      auraSprite: null,
      baseSprite: null,
      mountainReflector: null,
      mountainBackReflector: null,
      ceilingReflector: null
    };
  }

  /**
   * Connects the initialized filters to their respective target display objects.
   * @param {Object} targets - Target display objects to receive the filters and updates.
   * @param {Container} targets.headContainer - Container for head assets.
   * @param {Sprite} targets.auraSprite - Background glow/aura sprite.
   * @param {Sprite} targets.baseSprite - Skull base color sprite.
   * @param {DisplayObject} targets.mountainReflector - Foreground mountain reflection layer.
   * @param {DisplayObject} targets.mountainBackReflector - Background mountain reflection layer.
   * @param {DisplayObject} targets.ceilingReflector - Background pattern/ceiling reflection layer.
   */
  attach(targets) {
    this.targets = { ...this.targets, ...targets };

    if (this.targets.headContainer) {
      this.targets.headContainer.filters = [this.rgbSplitFilter];
    }
    if (this.targets.auraSprite) {
      // Color matrix is removed here so the aura preserves the rich native colors of mask.webp
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
    let flickerFactor = 1.0;
    if (this.targets.baseSprite) {
      if (state.flickerIntensity > 0) {
        const strobeTime = time * state.flickerSpeed * 45;
        const waveValue = Math.sin(strobeTime) * Math.sin(strobeTime * 2.3) * Math.cos(strobeTime * 0.85);
        const triggerThreshold = 1.0 - state.flickerIntensity;
        this.colorMatrix.reset();

        if (waveValue > triggerThreshold) {
          this.colorMatrix.brightness(1.8, false);
          this.colorMatrix.contrast(1.5, true);
          flickerFactor = 1.8;
        } else if (waveValue < -triggerThreshold) {
          this.colorMatrix.brightness(0.05, false);
          flickerFactor = 0.05;
        } else {
          const randoB = 1.0 + (Math.random() - 0.5) * 0.15 * state.flickerIntensity;
          this.colorMatrix.brightness(randoB, false);
          flickerFactor = randoB;
        }
      } else {
        this.colorMatrix.reset();
      }
    }

    // 3. Aura Blur / Dimension Pulse Calculations
    const auraPulse = Math.sin(time * state.auraPulseSpeed * 2.0) * 0.5 + 0.5;
    if (this.targets.auraSprite) {
      this.auraBlurFilter.strength = state.auraBlur + (auraPulse * 10);
      this.targets.auraSprite.scale.set(state.auraScale + (auraPulse * 0.02));
      this.targets.auraSprite.alpha = state.auraOpacity;
      
      // Standard RGB tinting colorizes the mask's native colors (set sliders to 255 to show original mask color)
      this.targets.auraSprite.tint = 
        (Math.floor(state.auraColorR) << 16) + 
        (Math.floor(state.auraColorG) << 8) + 
        Math.floor(state.auraColorB);
    }

    // 4. Cavern Lighting Reflector Updates
    const reflectionTint = 
      (Math.floor(state.auraColorR) << 16) + 
      (Math.floor(state.auraColorG) << 8) + 
      Math.floor(state.auraColorB);

    // Dynamic Cavern Light Alpha scaling influenced by the aura pulse, user intensity slider, and active screen-flicker
    const baseReflectAlpha = state.auraOpacity * (0.12 + auraPulse * 0.28) * (state.cavernLightIntensity ?? 1.0);
    const reflectionAlpha = Math.max(0, Math.min(1.0, baseReflectAlpha * flickerFactor));

    if (this.targets.mountainReflector) {
      this.targets.mountainReflector.tint = reflectionTint;
      this.targets.mountainReflector.alpha = reflectionAlpha;
    }

    if (this.targets.mountainBackReflector) {
      this.targets.mountainBackReflector.tint = reflectionTint;
      // Background mountains have slightly more subtle reflection due to atmospheric dust/fog layers
      this.targets.mountainBackReflector.alpha = reflectionAlpha * 0.65;
    }

    if (this.targets.ceilingReflector) {
      this.targets.ceilingReflector.tint = reflectionTint;
      this.targets.ceilingReflector.alpha = reflectionAlpha;
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
### `src\engine\systems\MirroredScrollLayer.js`
```javascript
// src/engine/systems/MirroredScrollLayer.js
import { Container, Sprite } from 'pixi.js';

export class MirroredScrollLayer extends Container {
  constructor(texture, targetHeight, speedFactor) {
    super();
    this.texture = texture;
    this.textureWidth = texture.width;
    this.textureHeight = texture.height;

    // Scale to fit the target layout height
    this.spriteScale = targetHeight / this.textureHeight;
    this.speedFactor = speedFactor;
    this.scrollX = 0;
    this.customScaleFactor = 1.0;

    this.items = [];
    // Instantiate 4 sprites to cover ultra-wide viewports comfortably
    for (let i = -1; i <= 2; i++) {
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5);
      sprite.y = 0;
      this.addChild(sprite);
      this.items.push({ sprite, baseIndex: i });
    }
    
    this.updatePositions(0);
  }

  setPatternScale(scaleFactor) {
    this.customScaleFactor = scaleFactor;
  }

  updatePositions(dtSeconds, baseSpeed = 0, dynamicSpeedFactor) {
    // Falls back to constructor's speed factor if no dynamic factor is supplied on tick
    const activeSpeedFactor = dynamicSpeedFactor !== undefined ? dynamicSpeedFactor : this.speedFactor;
    this.scrollX -= baseSpeed * activeSpeedFactor * dtSeconds;

    const scaleFactorToUse = this.customScaleFactor !== undefined ? this.customScaleFactor : 1.0;
    const finalScale = this.spriteScale * scaleFactorToUse;
    const w = this.textureWidth * finalScale; // Recalculate scaled width dynamically to account for runtime pattern scaling
    const halfTotal = w * 2;

    this.items.forEach(item => {
      let localX = (item.baseIndex * w) + this.scrollX;

      // Wrap local X coordinates seamlessly
      while (localX < -halfTotal) {
        localX += w * 4;
      }
      while (localX > halfTotal) {
        localX -= w * 4;
      }

      item.sprite.position.set(localX, 0);

      // Determine absolute grid index to apply correct mirroring flips
      const gridIndex = Math.round((localX - this.scrollX) / w);
      const isEven = Math.abs(gridIndex) % 2 === 0;
      item.sprite.scale.set(finalScale * (isEven ? 1 : -1), finalScale);
    });
  }
}
```

---
### `src\engine\systems\ParticleSystem.js`
```javascript
// src/engine/systems/ParticleSystem.js
import { Container, Sprite, Graphics } from 'pixi.js';

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
    // Destroy the main parent container and let Pixi dispose of all child particle nodes recursively
    if (this.particleContainer) {
      this.particleContainer.destroy({ children: true });
      this.particleContainer = null;
    }
    
    // Safely clear local tracking array references to avoid double-destruction triggers
    this.particles = [];

    if (this.ashTexture) {
      this.ashTexture.destroy(true);
      this.ashTexture = null;
    }
    if (this.wispyTexture) {
      this.wispyTexture.destroy(true);
      this.wispyTexture = null;
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
import { MirroredScrollLayer } from './MirroredScrollLayer.js';

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

    this.bgPat1Layer = null;
    this.bgPat2Layer = null;

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

      // Mirror-repeat wrap arrays applied to clean-rig background patterns
      if (this.hasBgPat2 && this.bgPat2Alias) {
        const tex2 = Assets.get(this.bgPat2Alias);
        this.bgPat2Layer = new MirroredScrollLayer(tex2, bgH, 1.8); 
        this.bgPat2Layer.position.set(bgW / 2, bgH / 2);
        this.localBgPatternContainer.addChild(this.bgPat2Layer);
      }
      if (this.hasBgPat1 && this.bgPat1Alias) {
        const tex1 = Assets.get(this.bgPat1Alias);
        this.bgPat1Layer = new MirroredScrollLayer(tex1, bgH, 1.0); 
        this.bgPat1Layer.position.set(bgW / 2, bgH / 2);
        this.localBgPatternContainer.addChild(this.bgPat1Layer);
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
      const baseSpeed = state.bgScrollSpeed;

      if (this.bgPat2Layer) {
        this.bgPat2Layer.setPatternScale(state.bgPatternBottomScale);
        this.bgPat2Layer.updatePositions(dtSeconds, baseSpeed);
      }
      if (this.bgPat1Layer) {
        this.bgPat1Layer.setPatternScale(state.bgPatternTopScale);
        this.bgPat1Layer.updatePositions(dtSeconds, baseSpeed);
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
      this.patternRenderTexture.destroy();
    }
    if (this.bgPatternRenderTexture) {
      this.bgPatternRenderTexture.destroy();
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
  const originalPresetRef = useRef(null);

  const triggerReaction = useCallback((event) => {
    console.log("💀 Real-Time Gothic Reaction Triggered for:", event.type);
    
    const state = store.getState();

    // Only capture baseline settings if no reaction is actively running or decaying
    if (!state.activeReaction) {
      originalPresetRef.current = {
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
    }

    setParameter("activeReaction", event.type);
    setParameter("reactionProgress", 1.0);

    if (event.type === "lyx_received") {
      // SPIKE: Blazing ember burst + glowing aura explosion
      setParameter("particleCount", 280);
      setParameter("particleSpeed", 4.5);
      setParameter("auraOpacity", 1.0);
      setParameter("auraScale", 0.8);
      setParameter("warpIntensity", 50.0);
    } 
    else if (event.type === "lsp7_received" || event.type === "lsp8_received") {
      // SPIKE: Extreme digital gothic glitch split
      setParameter("aberrationAmount", 0);
      setParameter("aberrationSpeed", 8.0);
      setParameter("aberrationGlitch", 0);
      setParameter("glitchShakeIntensity", 22);
      setParameter("warpIntensity", 90.0);
      setParameter("flickerIntensity", 0.90);
    }

    let progress = 0;
    const animateDecay = () => {
      progress += 0.007; // Restoration duration (~2.5s)
      
      setParameter("reactionProgress", 1.0 - progress);

      const original = originalPresetRef.current;

      if (progress >= 1.0) {
        // Safe restoration back to baseline
        if (original) {
          setParameter("particleCount", original.particleCount);
          setParameter("particleSpeed", original.particleSpeed);
          setParameter("auraOpacity", original.auraOpacity);
          setParameter("auraScale", original.auraScale);
          setParameter("aberrationAmount", original.aberrationAmount);
          setParameter("aberrationSpeed", original.aberrationSpeed);
          setParameter("aberrationGlitch", original.aberrationGlitch);
          setParameter("warpIntensity", original.warpIntensity);
          setParameter("glitchShakeIntensity", original.glitchShakeIntensity);
          setParameter("flickerIntensity", original.flickerIntensity);
        }
        setParameter("activeReaction", null);
        setParameter("reactionProgress", 0.0);
        
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
        return;
      }

      const invProgress = 1.0 - progress;
      if (original) {
        if (event.type === "lyx_received") {
          setParameter("particleCount", Math.floor(original.particleCount + (300 - original.particleCount) * invProgress));
          setParameter("particleSpeed", original.particleSpeed + (4.5 - original.particleSpeed) * invProgress);
          setParameter("auraOpacity", original.auraOpacity + (1.0 - original.auraOpacity) * invProgress);
          setParameter("auraScale", original.auraScale + (1.35 - original.auraScale) * invProgress);
          setParameter("warpIntensity", original.warpIntensity + (50.0 - original.warpIntensity) * invProgress);
        } 
        else if (event.type === "lsp7_received" || event.type === "lsp8_received") {
          setParameter("aberrationAmount", original.aberrationAmount + (30.0 - original.aberrationAmount) * invProgress);
          setParameter("warpIntensity", original.warpIntensity + (90.0 - original.warpIntensity) * invProgress);
          setParameter("glitchShakeIntensity", Math.floor(original.glitchShakeIntensity + (25 - original.glitchShakeIntensity) * invProgress));
          setParameter("flickerIntensity", original.flickerIntensity + (0.85 - original.flickerIntensity) * invProgress);
        }
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
import { useEffect, useRef } from 'react';
import { useWalletStore } from '../store/useWalletStore';
import LSP1EventService from '../services/LSP1EventService';

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

    let isCurrent = true;
    const service = new LSP1EventService();
    serviceRef.current = service;

    const startListener = async () => {
      await service.initialize();
      if (!isCurrent) return;
      
      const success = await service.setupEventListeners(hostProfileAddress);
      if (!isCurrent) {
        // If the context changed while setup was in progress, dismantle the connection immediately
        service.cleanupListeners();
        return;
      }
      
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
      isCurrent = false;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      if (serviceRef.current) {
        serviceRef.current.cleanupListeners();
        serviceRef.current = null;
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
  // Map to the official standard keccak256("LSP0ValueReceived") identifier for UP value drops
  lyx_received: "0x9c4705229491d365fb5434052e12a386d6771d976bea61070a8c694e8affea3d", 
  follower_gained: "0x71e02f9f05bcd5816ec4f3134aa2e5a916669537ec6c77fe66ea595fabc2d51a", 
  follower_lost: "0x9d3c0b4012b69658977b099bdaa51eff0f0460f421fba96d15669506c00d1c4f",  
  lsp7_received: "0x20804611b3e2ea21c480dc465142210acf4a2485947541770ec1fb87dee4a55c", 
  lsp8_received: "0x0b084a55ebf70fd3c06fd755269dac2212c4d3f0f4d09079780bfa50c1b2984d", 
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
          if (this.unwatchEvent) {
            try {
              this.unwatchEvent();
            } catch (e) {}
            this.unwatchEvent = null; 
          }
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
      this.unwatchEvent = null;
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

  // Rig-Aligned Stage & Actor Selection
  characterId: "skull_reaper", // Text identifier matching actor folder name
  bgClippingMaskId: "black",   // Backdrop color name suffix
  bgPatternStyle: "bubble",     // Pattern style prefix
  bgMountainId: 1,             // Front mountain asset ID
  bgMountainBackId: 2,         // Back mountain asset ID

  // 1. Motion Dynamics
  floatSpeed: 1.0,
  floatAmpX: 30,
  floatAmpY: 15,
  floatRotation: 2.0,

  // Custom Flight and Hover parameters
  flyMinScale: 1.0,       // Scale at lowest point of flight
  flyMaxScale: 0.82,      // Scale at highest peak of flight
  flyHoverPause: 1.0,     // Hover pause factor (1.0 = smooth sine, up to 5.0 = flat plateau pauses)
  flyTiltBias: 3.0,       // Persistent tilt bias in degrees

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

  // 4. Aura / Glow & Cavern Reflection Control
  auraOpacity: 0.5,
  auraScale: 1.05,
  auraBlur: 20,
  auraPulseSpeed: 1.0,
  auraColorR: 235,
  auraColorG: 200,
  auraColorB: 150,
  cavernLightIntensity: 0.8, // Slider scale factor for dynamic cavern reflections

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

  // 8. Corruption / Glitch & Echoing Phase Trails
  aberrationAmount: 0.0,
  aberrationSpeed: 0.0,
  aberrationGlitch: 0.0,
  glitchShakeIntensity: 0,
  flickerIntensity: 0.0,
  flickerSpeed: 1.0,
  
  // Phase Trail Control Parameters
  trailCount: 3,             // Total active spectral trails (0 - 3)
  trailSpacing: 5,           // Delayed spacing of historical coordinates in frames
  trailManualAlpha: 0.0,     // Static override opacity to manually customize/test trails
  trailGlitchInfluence: 0.6, // Relative opacity scaling factor during spikes and shake actions

  // 9. Web3 Shockwave Customization Parameters
  shockwaveStrength: 1.0,     // Max displacement strength multiplier (0.0 - 2.0)
  shockwaveThickness: 160.0,  // Dynamic width of the expanding ring wavefront in pixels
  shockwaveDuration: 1.8,     // Single wave expansion lifetime duration in seconds
  shockwavePulseCount: 2,     // Number of cascading/overlapping waves fired on Web3 triggers (1 - 5)

  // 10. Eye & Lid Dynamics
  eyelidTravel: 20.0,         
  blinkInterval: 5.0,        
  blinkSpeed: 1.0,           
  autoBlink: true,           
  eyelidManualProgress: 1.0, 
  pupilWander: 1.0,          
  pupilSaccade: 1.0,         
  pupilMouseInfluence: 1.0,  

  // 11. Web3 LSP1 Reaction State Parameters
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
