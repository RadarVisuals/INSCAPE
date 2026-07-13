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
    <title>UNDERNEATH_OS</title>
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
  "name": "underneath-os",
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

  useEffect(() => {
    initWallet();
  }, [initWallet]);

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
  
  const scanlineOpacity = useStore((state) => state.scanlineOpacity);
  const vignetteOpacity = useStore((state) => state.vignetteOpacity);

  useEffect(() => {
    if (engineRef.current || !containerRef.current) return;

    // Inject state reading and subscription mechanisms as decoupled dependencies
    engineRef.current = new PixiEngine(containerRef.current, {
      getState: useStore.getState,
      subscribe: useStore.subscribe
    });

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
    if (engineRef.current) {
      engineRef.current.updateMousePos(e.clientX, e.clientY);
    }
  };

  const handleMouseClick = (e) => {
    if (engineRef.current) {
      engineRef.current.updateMouseClick(e.clientX, e.clientY);
    }
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      
      {/* PixiJS Canvas Layer */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onClick={handleMouseClick}
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
        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Volumetric Cave Fog</h4>
        <CompactSlider label="Fog Opacity" storeKey="fogOpacity" min="0" max="1" step="0.05" />
        <CompactSlider label="Fog Drift Speed" storeKey="fogSpeed" min="0" max="5" step="0.1" />
        <CompactSlider label="Fog Color: Red" storeKey="fogColorR" min="0" max="255" step="1" />
        <CompactSlider label="Fog Color: Green" storeKey="fogColorG" min="0" max="255" step="1" />
        <CompactSlider label="Fog Color: Blue" storeKey="fogColorB" min="0" max="255" step="1" />

        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '12px', marginBottom: '8px', color: 'var(--text-muted)' }}>Screen Overlay & Post</h4>
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
  const searchlightActive = useStore((state) => state.searchlightActive);
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
        
        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '10px', marginBottom: '8px', color: 'var(--text-muted)' }}>Pupil Tracking</h4>
        <CompactSlider label="Manual Eyelid Openness" storeKey="eyelidManualProgress" min="0" max="1" step="0.05" />
        <CompactSlider label="Pupil Mouse Influence" storeKey="pupilMouseInfluence" min="0" max="2" step="0.1" />
        <CompactSlider label="Pupil Drift (Wander)" storeKey="pupilWander" min="0" max="3" step="0.1" />
        <CompactSlider label="Pupil Saccade Jitter" storeKey="pupilSaccade" min="0" max="3" step="0.1" />
      </div>

      {/* Customizable Searchlight Column [3] */}
      <div>
        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Searchlight Rig</h4>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', height: '18px' }}>
          <input
            type="checkbox"
            id="searchlightActive"
            checked={searchlightActive}
            onChange={(e) => setParameter('searchlightActive', e.target.checked)}
            style={{
              cursor: 'pointer',
              accentColor: 'var(--accent-color)',
              width: '12px',
              height: '12px',
              background: 'none',
              border: '1px solid var(--border-color)'
            }}
          />
          <label htmlFor="searchlightActive" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-main)', cursor: 'pointer', userSelect: 'none' }}>
            Enable Beams
          </label>
        </div>

        <CompactSlider label="Emit Orbit Radius" storeKey="searchlightRadius" min="0" max="300" step="1" />
        <CompactSlider label="Beam Width" storeKey="searchlightWidth" min="0.1" max="3.0" step="0.05" />
        <CompactSlider label="Beam Length" storeKey="searchlightLength" min="0.2" max="2.0" step="0.05" />

        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '10px', marginBottom: '8px', color: 'var(--text-muted)' }}>Beam Color Tints</h4>
        <CompactSlider label="Beam Color: Red" storeKey="searchlightColorR" min="0" max="255" step="1" />
        <CompactSlider label="Beam Color: Green" storeKey="searchlightColorG" min="0" max="255" step="1" />
        <CompactSlider label="Beam Color: Blue" storeKey="searchlightColorB" min="0" max="255" step="1" />
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

```

---
### `src\components\UI\tabs\SkullTab.jsx`
```javascript
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
    <div style={{ display: 'grid', gridTemplateColumns: subjectMode === 'creator' ? '1fr 1fr 1fr' : '1fr 1fr', gap: '15px' }}>
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

      {subjectMode === 'creator' && (
        <div>
          <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-muted)' }}>Creator Mutation Test</h4>

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

          <label style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Pattern Behavior</label>
          <select value={mutationPatternMode} onChange={(e) => setParameter('mutationPatternMode', e.target.value)} style={{ ...selectStyle, marginBottom: '8px' }}>
            <option value="symbiosis">Continuous / Symbiosis</option>
            <option value="mirrored">Mirror With Geometry</option>
          </select>

          <CompactSlider label="Vertical Axis" storeKey="mutationAxisX" min="0.05" max="0.95" step="0.001" />
          <CompactSlider label="Horizontal Axis" storeKey="mutationAxisY" min="0.05" max="0.95" step="0.001" />
        </div>
      )}
    </div>
  );
}

```

---
### `src\components\UI\tabs\Web3Tab.jsx`
```javascript
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
            Decaying: <ReactionProgressDisplay activeReaction={activeReaction} />
          </div>
        )}
      </div>
    </div>
  );
}
```

---
### `src\engine\entities\ActorEntity.js`
```javascript
// src/engine/entities/ActorEntity.js
import { Assets, Container, Sprite } from 'pixi.js';
import { EyeSystem } from '../systems/EyeSystem.js';
import { FlightDynamics } from '../systems/FlightDynamics.js';
import { createSymmetryFilter } from '../filters/SymmetryFilterFactory.js';
import { createMutationCompositeFilter } from '../filters/MutationCompositeFilterFactory.js';

const MUTATION_MODE_VALUES = {
  none: 0,
  mirrorX: 1,
  mirrorY: 2,
  quad: 3
};

export class ActorEntity {
  constructor(id, assets, renderTextureManager) {
    this.id = id;
    this.assets = assets;
    this.renderTextureManager = renderTextureManager;

    this.container = new Container();
    this.container.label = `actor_${id}`;
    this.visualContainer = new Container();
    this.visualContainer.label = `actor_visual_${id}`;

    this.baseActorScale = 0.5;

    this.baselinePosition = { x: 0, y: 0 };
    this.targetPosition = { x: 0, y: 0 };
    this.isMovingToTarget = false;
    this.facingDirection = 1.0;
    this.currentFlipScale = 1.0;
    this.time = 0;

    this.flightDynamics = new FlightDynamics();
    this.eyeSystem = null;
    this.layers = {};
    this.mutationFilters = {};
    this.mutationEnabled = assets.isCreatorRig === true;
    this.headState = { x: 0, y: 0, scale: 1, scaleX: 1, rotation: 0 };
    
    this.characterContentContainer = null;

    this.build();
  }

  build() {
    const createSprite = (alias) => {
      const s = Sprite.from(alias);
      s.anchor.set(0.5);
      return s;
    };

    const attachMutationFilter = (sprite, key) => {
      if (!this.mutationEnabled || !sprite) return;
      const filter = createSymmetryFilter();
      this.mutationFilters[key] = filter;
      sprite.filters = [filter];
    };

    if (this.assets.char_clipping_mask) {
      this.layers.aura = createSprite(this.assets.char_clipping_mask);
      attachMutationFilter(this.layers.aura, 'aura');
      this.container.addChild(this.layers.aura);
    }

    this.container.addChild(this.visualContainer);

    if (this.assets.char_clipping_mask && !this.mutationEnabled) {
      const charMaskSprite = createSprite(this.assets.char_clipping_mask);
      this.layers.mask = charMaskSprite;
      this.visualContainer.addChild(charMaskSprite);

      this.characterContentContainer = new Container();
      
      // Standard native mask assignment with explicit alpha channel decoding.
      // PixiJS v8 default sprite mask behavior samples the red channel (great for grayscale, 
      // but fails if the mask uses high alpha transparency with negligible red values).
      this.characterContentContainer.setMask({
        mask: charMaskSprite,
        channel: 'alpha'
      });
      this.visualContainer.addChild(this.characterContentContainer);

      this.layers.base = createSprite(this.assets.char_base || this.assets.char_clipping_mask);
      this.characterContentContainer.addChild(this.layers.base);
    } else if (this.assets.char_clipping_mask) {
      this.characterContentContainer = new Container();
      this.visualContainer.addChild(this.characterContentContainer);

      const maskTexture = Assets.get(this.assets.char_clipping_mask);
      const lineartTexture = Assets.get(this.assets.char_lineart);
      const compositeFilter = createMutationCompositeFilter(maskTexture, lineartTexture);
      this.mutationFilters.composite = compositeFilter;
      this.characterContentContainer.filters = [compositeFilter];

      this.layers.base = createSprite(this.assets.char_base || this.assets.char_clipping_mask);
      this.characterContentContainer.addChild(this.layers.base);
    }

    if (
      this.characterContentContainer &&
      this.assets.discoveredPatterns &&
      this.assets.discoveredPatterns.length > 0 &&
      this.renderTextureManager
    ) {
      const patternSprite = new Sprite(this.renderTextureManager.patternRenderTexture);
      patternSprite.anchor.set(0.5);
      this.layers.pattern = patternSprite;
      this.characterContentContainer.addChild(patternSprite);
    }

    if (this.assets.char_lineart && !this.mutationEnabled) {
      this.layers.lineart = createSprite(this.assets.char_lineart);
      this.visualContainer.addChild(this.layers.lineart);
    }

    if (this.assets.discoveredEyes && this.assets.discoveredEyes.length > 0) {
      this.eyeSystem = new EyeSystem(this.visualContainer, {
        discoveredEyes: this.assets.discoveredEyes,
        hasEyelids: !!this.assets.eyelids_top,
        eyelidsTopAlias: this.assets.eyelids_top || null,
        eyelidsBottomAlias: this.assets.eyelids_bottom || null
      });
    }
  }

  moveTo(localX, localY) {
    this.targetPosition.x = localX;
    this.targetPosition.y = localY;
    this.isMovingToTarget = true;
  }

  updateMutation(config) {
    if (!this.mutationEnabled) return;

    const mode = MUTATION_MODE_VALUES[config.mutationMode] ?? 0;
    const axisX = Math.max(0.01, Math.min(0.99, config.mutationAxisX ?? 0.5));
    const axisY = Math.max(0.01, Math.min(0.99, config.mutationAxisY ?? 0.5));
    const sourceX = config.mutationSourceX === 'right' ? 1.0 : 0.0;
    const sourceY = config.mutationSourceY === 'bottom' ? 1.0 : 0.0;

    for (const filter of Object.values(this.mutationFilters)) {
      const uniforms = filter.resources.symmetryUniforms?.uniforms;
      if (!uniforms) continue;
      uniforms.uMode = mode;
      uniforms.uAxisX = axisX;
      uniforms.uAxisY = axisY;
      uniforms.uSourceX = sourceX;
      uniforms.uSourceY = sourceY;
    }

    const compositeFilter = this.mutationFilters.composite;
    if (compositeFilter) {
      const uniforms = compositeFilter.resources.mutationUniforms.uniforms;
      uniforms.uMode = mode;
      uniforms.uAxisX = axisX;
      uniforms.uAxisY = axisY;
      uniforms.uSourceX = sourceX;
      uniforms.uSourceY = sourceY;
      uniforms.uMirrorPattern = mode !== 0 && config.mutationPatternMode === 'mirrored' ? 1.0 : 0.0;
    }
  }

  update(deltaTime, config, isGlitchActive, canvasHeight) {
    const dtSeconds = deltaTime / 60;
    this.time += dtSeconds;

    if (this.isMovingToTarget) {
      const dx = this.targetPosition.x - this.baselinePosition.x;
      const dy = this.targetPosition.y - this.baselinePosition.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 15) {
        this.isMovingToTarget = false;
      } else {
        this.baselinePosition.x += dx * 0.0071 * deltaTime;
        this.baselinePosition.y += dy * 0.0071 * deltaTime;
        this.facingDirection = dx > 0 ? 1.0 : -1.0;
      }
    }

    this.currentFlipScale += (this.facingDirection - this.currentFlipScale) * 0.2 * deltaTime;

    const headState = this.flightDynamics.calculate(
      this.time,
      config,
      isGlitchActive,
      this.baselinePosition,
      this.currentFlipScale,
      canvasHeight
    );

    this.headState = headState;

    this.container.position.set(headState.x, headState.y);
    this.container.scale.set(
      headState.scale * this.baseActorScale,
      headState.scale * this.baseActorScale
    );
    this.container.rotation = 0;
    this.visualContainer.scale.set(this.currentFlipScale, 1);
    this.visualContainer.rotation = headState.rotation;

    this.updateMutation(config);

    if (this.eyeSystem) {
      this.eyeSystem.update(deltaTime, config);
    }
  }

  getEffectsTargets() {
    return {
      headContainer: this.visualContainer,
      auraSprite: this.layers.aura || null,
      baseSprite: this.layers.base || null
    };
  }

  destroy() {
    if (this.characterContentContainer) {
      this.characterContentContainer.mask = null;
      this.characterContentContainer = null;
    }
    if (this.eyeSystem?.destroy) {
      this.eyeSystem.destroy();
    }
    for (const filter of Object.values(this.mutationFilters)) {
      filter.destroy();
    }
    this.mutationFilters = {};
    this.container.destroy({ children: true });
  }
}

```

---
### `src\engine\entities\StageEntity.js`
```javascript
// src/engine/entities/StageEntity.js
import { Container, Sprite, Texture, Assets } from 'pixi.js';
import { MirroredScrollLayer } from '../systems/MirroredScrollLayer.js';
import { FogSystem } from '../systems/FogSystem.js';
import { ParticleSystem } from '../systems/ParticleSystem.js';

export class StageEntity {
  /**
   * @param {string} id - Unique identifier for the stage
   * @param {Object} keys - Resolved stage asset keys
   * @param {Object} flags - State flags determining layer rendering options
   * @param {number} bgHeightScale - Height boundary for scaling
   * @param {RenderTextureManager} renderTextureManager - Reference to the global texture pass
   * @param {Renderer} renderer - The PixiJS WebGL renderer
   */
  constructor(id, keys, flags, bgHeightScale, renderTextureManager, renderer) {
    this.id = id;
    this.keys = keys;
    this.flags = flags;
    this.bgHeightScale = bgHeightScale;
    this.renderTextureManager = renderTextureManager;
    this.renderer = renderer;

    this.bgContainer = new Container();
    this.bgContainer.label = `stage_bg_${id}`;

    this.fgContainer = new Container();
    this.fgContainer.label = `stage_fg_${id}`;

    this.layers = {};
    this.bgFog = null;
    this.fgFog = null;
    this.particleSystem = null;

    this.build();
  }

  build() {
    if (this.flags.isPanoramaMode) {
      const bgTexture = Assets.get('bg');
      if (bgTexture && bgTexture !== Texture.EMPTY) {
        this.layers.bg = new MirroredScrollLayer(bgTexture, this.bgHeightScale, 1.0);
        this.bgContainer.addChild(this.layers.bg);
      }

      if (this.flags.hasBg2) {
        const bg2Texture = Assets.get('bg2');
        if (bg2Texture && bg2Texture !== Texture.EMPTY) {
          this.layers.bg2 = new MirroredScrollLayer(bg2Texture, this.bgHeightScale, this.flags.bg2ParallaxSpeed || 1.8);
          this.bgContainer.addChild(this.layers.bg2);
        }
      }
    } else {
      if (this.flags.hasBgClippingMask) {
        const bgClipTex = Assets.get(this.keys.bg_clipping_mask);
        if (bgClipTex && bgClipTex !== Texture.EMPTY) {
          this.layers.bg_clip = new MirroredScrollLayer(bgClipTex, this.bgHeightScale, 0.0);
          this.bgContainer.addChild(this.layers.bg_clip);
        }
      }

      const hasAnyBgPat = this.flags.hasBgPat1 || this.flags.hasBgPat2;
      if (hasAnyBgPat && this.renderTextureManager) {
        this.bgContainer.addChild(this.renderTextureManager.bgPatternSprite);

        this.layers.bg_pattern_reflect = new MirroredScrollLayer(
          this.renderTextureManager.bgPatternRenderTexture, 
          this.bgHeightScale, 
          0.0
        );
        this.layers.bg_pattern_reflect.blendMode = 'screen';
        this.bgContainer.addChild(this.layers.bg_pattern_reflect);
      }

      if (this.flags.hasBgMountainBack) {
        const mountainBackTex = Assets.get(this.keys.bg_mountain_back);
        if (mountainBackTex && mountainBackTex !== Texture.EMPTY) {
          this.layers.bg_mountain_back = new MirroredScrollLayer(mountainBackTex, this.bgHeightScale, 0.18);
          this.layers.bg_mountain_back.position.y = -35; 
          this.layers.bg_mountain_back.alpha = 0.75; 
          this.bgContainer.addChild(this.layers.bg_mountain_back);

          this.layers.bg_mountain_back_reflect = new MirroredScrollLayer(mountainBackTex, this.bgHeightScale, 0.18);
          this.layers.bg_mountain_back_reflect.position.y = -35;
          this.layers.bg_mountain_back_reflect.blendMode = 'screen';
          this.bgContainer.addChild(this.layers.bg_mountain_back_reflect);
        }
      }

      if (this.flags.hasBgMountain) {
        const mountainTex = Assets.get(this.keys.bg_mountain);
        if (mountainTex && mountainTex !== Texture.EMPTY) {
          this.layers.bg_mountain = new MirroredScrollLayer(mountainTex, this.bgHeightScale, 0.4);
          this.bgContainer.addChild(this.layers.bg_mountain);

          this.layers.bg_mountain_reflect = new MirroredScrollLayer(mountainTex, this.bgHeightScale, 0.4);
          this.layers.bg_mountain_reflect.blendMode = 'screen';
          this.bgContainer.addChild(this.layers.bg_mountain_reflect);
        }
      }
    }

    this.bgFog = new FogSystem(this.bgContainer, this.bgHeightScale, false);
    this.particleSystem = new ParticleSystem(this.renderer, this.bgContainer, this.bgHeightScale);
    this.fgFog = new FogSystem(this.fgContainer, this.bgHeightScale, true);
  }

  /**
   * Resizes all internal layers and atmospheric entities dynamically.
   */
  resize(localW, localH) {
    // Resize scrolling layers
    for (const key in this.layers) {
      if (this.layers[key] && typeof this.layers[key].resize === 'function') {
        this.layers[key].resize(localW, localH);
      }
    }

    // Resize fog meshes
    if (this.bgFog) this.bgFog.resize(localW, localH);
    if (this.fgFog) this.fgFog.resize(localW, localH);

    // Propagate down to the render texture pattern container if applicable
    if (this.renderTextureManager && typeof this.renderTextureManager.resize === 'function') {
      this.renderTextureManager.resize(localW, localH);
    }
  }

  update(deltaTime, config, time) {
    const dtSeconds = deltaTime / 60;
    const baseSpeed = config.bgScrollSpeed;
    const backParallax = config.bg2ParallaxSpeed;

    if (this.bgFog) {
      this.bgFog.update(time, config);
    }
    if (this.fgFog) {
      this.fgFog.update(time, config);
    }
    if (this.particleSystem) {
      this.particleSystem.update(deltaTime, config);
    }

    if (this.flags.isPanoramaMode) {
      if (this.layers.bg) {
        this.layers.bg.updatePositions(dtSeconds, baseSpeed, 1.0);
      }
      if (this.layers.bg2) {
        this.layers.bg2.updatePositions(dtSeconds, baseSpeed, backParallax);
      }
    } else {
      if (this.layers.bg_clip) {
        this.layers.bg_clip.updatePositions(dtSeconds, baseSpeed, 0.0);
      }
      if (this.renderTextureManager && this.renderTextureManager.bgPatternSprite) {
        this.renderTextureManager.bgPatternSprite.updatePositions(dtSeconds, baseSpeed, 0.0);
      }
      if (this.layers.bg_pattern_reflect) {
        this.layers.bg_pattern_reflect.updatePositions(dtSeconds, baseSpeed, 0.0);
      }

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

  getEffectsTargets() {
    return {
      mountainReflector: this.layers.bg_mountain_reflect || null,
      mountainBackReflector: this.layers.bg_mountain_back_reflect || null,
      ceilingReflector: this.layers.bg_pattern_reflect || null
    };
  }

  destroy() {
    if (this.particleSystem?.destroy) {
      this.particleSystem.destroy();
    }
    if (this.bgFog?.destroy) {
      this.bgFog.destroy();
    }
    if (this.fgFog?.destroy) {
      this.fgFog.destroy();
    }
    this.bgContainer.destroy({ children: true });
    this.fgContainer.destroy({ children: true });
  }
}
```

---
### `src\engine\filters\EffectFactory.js`
```javascript
// src/engine/filters/EffectFactory.js
import { Filter, BlurFilter, ColorMatrixFilter, defaultFilterVert, UniformGroup } from 'pixi.js';
import { RGBSplitFilter } from 'pixi-filters';
import { FOG_FRAGMENT_SHADER } from '../shaders/FogShader.js';
import { SHOCKWAVE_FRAGMENT_SHADER } from '../shaders/ShockwaveShader.js';

export class EffectFactory {
  /**
   * Generates a pre-configured RGBSplit chromatic aberration filter
   */
  static createChromaticAberration() {
    return new RGBSplitFilter({
      red: { x: 0, y: 0 },
      green: { x: 0, y: 0 },
      blue: { x: 0, y: 0 }
    });
  }

  /**
   * Generates a pre-configured Blur filter with safety padding to prevent edge cuts
   * @param {number} initialStrength - Starting blur intensity
   */
  static createAuraBlur(initialStrength = 20) {
    const filter = new BlurFilter({ strength: initialStrength });
    filter.padding = 100; // Protect against hard bounding box clips during large pulses
    return filter;
  }

  /**
   * Generates a standard Color Matrix Filter
   */
  static createColorMatrix() {
    return new ColorMatrixFilter();
  }

  /**
   * Compiles and instantiates the custom WebGL Fog/Atmosphere shader using a typed UniformGroup UBO
   */
  static createFogFilter() {
    const fogUniformGroup = new UniformGroup({
      uTime: { value: 0, type: 'f32' },
      uOpacity: { value: 0.5, type: 'f32' },
      uColor: { value: [1, 1, 1], type: 'vec3<f32>' },
      uSpeed: { value: 1.0, type: 'f32' }
    }, false, true);

    return Filter.from({
      gl: {
        vertex: defaultFilterVert,
        fragment: FOG_FRAGMENT_SHADER
      },
      resources: {
        fogUniforms: fogUniformGroup
      }
    });
  }

  /**
   * Compiles and instantiates the custom WebGL Shockwave shader.
   * Sets the third parameter of UniformGroup (useUbo) to false to prevent std140 stride alignment issues.
   */
  static createShockwaveFilter() {
    const shockwaveUniformGroup = new UniformGroup({
      uCenter: { value: [0.0, 0.0], type: 'vec2<f32>' },
      uScreenSize: { value: [1.0, 1.0], type: 'vec2<f32>' },
      uRadii: { value: new Float32Array([0, 0, 0, 0, 0]), type: 'f32', size: 5 },
      uActiveWaveCount: { value: 0.0, type: 'f32' },
      uThickness: { value: 160.0, type: 'f32' },
      uAmplitude: { value: 30.0, type: 'f32' }
    }, false, false); // Disabled UBO to ensure correct scalar packing structure in WebGL2

    return Filter.from({
      gl: {
        vertex: defaultFilterVert,
        fragment: SHOCKWAVE_FRAGMENT_SHADER
      },
      resources: {
        shockwaveUniforms: shockwaveUniformGroup
      }
    });
  }
}
```

---
### `src\engine\filters\MutationCompositeFilterFactory.js`
```javascript
import { Filter, UniformGroup, defaultFilterVert } from 'pixi.js';
import { MUTATION_COMPOSITE_FRAGMENT_SHADER } from '../shaders/MutationCompositeShader.js';

const MUTATION_PADDING = 1000;

export function createMutationCompositeFilter(maskTexture, lineartTexture) {
  const mutationUniforms = new UniformGroup({
    uMode: { value: 0.0, type: 'f32' },
    uAxisX: { value: 0.5, type: 'f32' },
    uAxisY: { value: 0.5, type: 'f32' },
    uSourceX: { value: 0.0, type: 'f32' },
    uSourceY: { value: 0.0, type: 'f32' },
    uMirrorPattern: { value: 0.0, type: 'f32' },
    uPadding: { value: MUTATION_PADDING, type: 'f32' }
  }, false, true);

  const filter = Filter.from({
    gl: {
      vertex: defaultFilterVert,
      fragment: MUTATION_COMPOSITE_FRAGMENT_SHADER
    },
    resources: {
      mutationUniforms,
      uMaskTexture: maskTexture.source,
      uLineartTexture: lineartTexture.source
    }
  });

  filter.padding = MUTATION_PADDING;
  return filter;
}

```

---
### `src\engine\filters\SymmetryFilterFactory.js`
```javascript
import { Filter, UniformGroup, defaultFilterVert } from 'pixi.js';
import { SYMMETRY_FRAGMENT_SHADER } from '../shaders/SymmetryShader.js';

const MUTATION_PADDING = 1000;

export function createSymmetryFilter() {
  const symmetryUniforms = new UniformGroup({
    uMode: { value: 0.0, type: 'f32' },
    uAxisX: { value: 0.5, type: 'f32' },
    uAxisY: { value: 0.5, type: 'f32' },
    uSourceX: { value: 0.0, type: 'f32' },
    uSourceY: { value: 0.0, type: 'f32' },
    uPadding: { value: MUTATION_PADDING, type: 'f32' }
  }, false, true);

  const filter = Filter.from({
    gl: {
      vertex: defaultFilterVert,
      fragment: SYMMETRY_FRAGMENT_SHADER
    },
    resources: {
      symmetryUniforms
    }
  });

  filter.padding = MUTATION_PADDING;
  return filter;
}

```

---
### `src\engine\filters\WarpFilterFactory.js`
```javascript
// src/engine/filters/WarpFilterFactory.js
import { Filter, defaultFilterVert, UniformGroup } from 'pixi.js';
import { WARP_FRAGMENT_SHADER } from '../shaders/WarpShader';

/**
 * Creates an instance of the custom WebGL warp filter.
 * @param {number} initialIntensity - The starting warp intensity value.
 * @returns {Filter} A configured PixiJS v8 Filter instance.
 */
export function createWarpFilter(initialIntensity = 20.0) {
  const warpUniformGroup = new UniformGroup({
    uTime: { value: 0.0, type: 'f32' },
    uWarpIntensity: { value: initialIntensity, type: 'f32' }
  }, false, true);

  const filter = Filter.from({
    gl: {
      vertex: defaultFilterVert,
      fragment: WARP_FRAGMENT_SHADER
    },
    resources: {
      warpUniforms: warpUniformGroup
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
  Texture,
  Graphics
} from 'pixi.js';
import { EffectsSystem } from './systems/EffectsSystem.js';
import { RenderTextureManager } from './systems/RenderTextureManager.js';
import { AssetResolver } from './assets/AssetResolver.js';
import { CreatorAssetResolver } from './assets/CreatorAssetResolver.js';
import { ShockwaveSystem } from './systems/ShockwaveSystem.js';
import { TrailSystem } from './systems/TrailSystem.js';
import { SearchlightSystem } from './systems/SearchlightSystem.js';
import { ActorEntity } from './entities/ActorEntity.js';
import { StageEntity } from './entities/StageEntity.js';

export class PixiEngine {
  /**
   * @param {HTMLDivElement} containerElement - Canvas wrapper element
   * @param {Object} storeInterface - Decoupled store methods
   * @param {Function} storeInterface.getState - State reader
   * @param {Function} storeInterface.subscribe - State change subscription handler
   */
  constructor(containerElement, storeInterface = {}) {
    this.container = containerElement;
    
    // Assign fallback handlers to maintain stability when running without a store
    this.getState = storeInterface.getState || (() => ({}));
    this.subscribe = storeInterface.subscribe || (() => () => {});

    this.app = new Application();
    this.layers = {};
    this.time = 0;
    this.isReady = false;
    this.isDestroyed = false;

    // Load sequence counter to prevent overlapping asynchronous loading glitches
    this.loadSequence = 0;

    // Active modular entities
    this.actor = null;
    this.stage = null;
    
    // Unified container for loaded asset keys and metadata
    this.loadedRig = null; 

    // Systems Allocation
    this.effectsSystem = new EffectsSystem();
    this.renderTextureManager = null;
    
    // Track dynamic visible canvas height coordinate range
    this.canvasHeight = 1000; 
    
    // Subsystem Coordinators
    this.shockwaveSystem = null;
    this.trailSystem = null;
    this.searchlightSystem = null;

    this.lastGlitchPeak = false;

    // Double Mouse Tracker: Separate absolute screen-coords and normalized [-1, 1] scales
    this.absoluteMousePos = { x: 0, y: 0 };
    this.normalizedMousePos = { x: 0, y: 0 };

    // Set up a list to collect selector-based subscriptions
    this.unsubscribers = [];

    // Trigger explicit asset loading only when setup properties modify
    const reloadTriggerKeys = [
      'subjectMode',
      'characterId',
      'creatorCharacterId',
      'creatorPatternId',
      'creatorPaletteId',
      'bgClippingMaskId',
      'bgPatternStyle',
      'bgMountainId',
      'bgMountainBackId'
    ];

    reloadTriggerKeys.forEach(key => {
      this.unsubscribers.push(
        this.subscribe(
          state => state[key],
          () => this.reloadAssetsAndScene().catch(err => console.error("Re-init assets failed:", err))
        )
      );
    });

    // Detect transaction trigger reactions using explicit selectors
    this.unsubscribers.push(
      this.subscribe(
        state => state.activeReaction,
        (nextReaction, prevReaction) => {
          const nextProgress = this.getState().reactionProgress;

          if (nextReaction !== null && (prevReaction !== nextReaction || nextProgress === 1.0)) {
            this.startLocalReaction(nextReaction);
          }
        }
      )
    );
  }

  /**
   * Tracks target coordinates relative to the screen dimensions.
   * @param {number} clientX - World horizontal position.
   * @param {number} clientY - World vertical position.
   */
  updateMousePos(clientX, clientY) {
    this.absoluteMousePos.x = clientX;
    this.absoluteMousePos.y = clientY;

    // Normalize coordinates to [-1, 1] range to avoid breaking pupil wander scripts
    this.normalizedMousePos.x = (clientX / window.innerWidth) * 2 - 1;
    this.normalizedMousePos.y = (clientY / window.innerHeight) * 2 - 1;
  }

  /**
   * Commands the active actor to float smoothly toward clicked coordinates.
   * @param {number} clientX - Absolute canvas click horizontal position.
   * @param {number} clientY - Absolute canvas click vertical position.
   */
  updateMouseClick(clientX, clientY) {
    if (!this.masterContainer || !this.actor) return;
    
    // Convert global screen pixel coordinates into master relative coordinates
    const localTarget = this.masterContainer.toLocal({ x: clientX, y: clientY });
    this.actor.moveTo(localTarget.x, localTarget.y);
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
      console.error("[PixiEngine] Init Error:", err);
    }
  }

  async loadAssets() {
    console.log(`%c🔍 [PixiEngine] Rig Loader: Locating Stage Assets`, 'color: #00f3ff; font-weight: bold;');
    
    // Resolve active asset configurations and store in a single property
    const currentStore = this.getState();
    const results = await this.resolveConfiguredRig(currentStore);
    this.loadedRig = results;

    if (results.verifiedLoadQueue.length > 0) {
      try {
        await Assets.load(results.verifiedLoadQueue);
        console.log("%c✅ [PixiEngine] Dynamic asset payload cached!", 'color: #00ff80; font-weight: bold;');
      } catch (err) {
        console.error("❌ [PixiEngine] Critical Loader Exception:", err);
      }
    }
  }

  async resolveConfiguredRig(config) {
    const isCreatorMode = config.subjectMode === 'creator';
    const sceneRig = await AssetResolver.resolveRig(config, {
      includeActor: !isCreatorMode
    });

    if (!isCreatorMode) return sceneRig;

    const creatorRig = await CreatorAssetResolver.resolve(config);
    return {
      ...sceneRig,
      keys: {
        ...sceneRig.keys,
        ...creatorRig.keys
      },
      verifiedLoadQueue: [
        ...sceneRig.verifiedLoadQueue,
        ...creatorRig.verifiedLoadQueue
      ],
      hasCharClippingMask: creatorRig.hasCharClippingMask,
      hasLineart: creatorRig.hasLineart,
      hasCharBase: creatorRig.hasCharBase,
      hasEyelids: creatorRig.hasEyelids,
      discoveredPatterns: creatorRig.discoveredPatterns,
      discoveredEyes: creatorRig.discoveredEyes,
      isCreatorRig: true,
      creatorSelection: creatorRig.selected
    };
  }

  buildSceneGraph() {
    const { stage } = this.app;
    const rig = this.loadedRig;
    if (!rig) return;

    const currentStore = this.getState();

    this.masterContainer = new Container();
    stage.addChild(this.masterContainer);

    let clipTex = Assets.get(rig.keys.char_clipping_mask);
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

    // Initialize Shockwave System
    this.shockwaveSystem = new ShockwaveSystem();

    // Initialize the off-screen RenderTextureManager to flatten warp patterns
    this.renderTextureManager = new RenderTextureManager({
      discoveredPatterns: rig.discoveredPatterns,
      bgPat1Alias: rig.hasBgPat1 ? rig.keys.bg_pat_1 : null,
      bgPat2Alias: rig.hasBgPat2 ? rig.keys.bg_pat_2 : null,
      hasBgPat1: rig.hasBgPat1,
      hasBgPat2: rig.hasBgPat2
    });

    // --- ENCAPSULATED STAGE CREATION ---
    const stageFlags = {
      isPanoramaMode: rig.isPanoramaMode,
      hasBg2: rig.hasBg2,
      bg2ParallaxSpeed: currentStore.bg2ParallaxSpeed,
      hasBgClippingMask: rig.hasBgClippingMask,
      hasBgPat1: rig.hasBgPat1,
      hasBgPat2: rig.hasBgPat2,
      hasBgMountainBack: rig.hasBgMountainBack,
      hasBgMountain: rig.hasBgMountain
    };
    this.stage = new StageEntity(
      currentStore.bgClippingMaskId, 
      rig.keys, 
      stageFlags, 
      this.bgHeightScale, 
      this.renderTextureManager, 
      this.app.renderer
    );
    this.bgAtmosphereContainer.addChild(this.stage.bgContainer);

    // Initialize Ghost Coordinates System
    this.trailSystem = new TrailSystem(this.masterContainer, rig.keys.char_clipping_mask);

    // Initialize Volumetric Searchlight System
    this.searchlightSystem = new SearchlightSystem(this.masterContainer);

    // --- ENCAPSULATED ACTOR CREATION ---
    const actorAssets = {
      char_clipping_mask: rig.hasCharClippingMask ? rig.keys.char_clipping_mask : null,
      char_lineart: rig.hasLineart ? rig.keys.char_lineart : null,
      char_base: rig.hasCharBase ? rig.keys.char_base : null,
      eyelids_top: rig.hasEyelids ? rig.keys.eyelids_top : null,
      eyelids_bottom: rig.hasEyelids ? rig.keys.eyelids_bottom : null,
      discoveredEyes: rig.discoveredEyes,
      discoveredPatterns: rig.discoveredPatterns,
      isCreatorRig: rig.isCreatorRig === true
    };
    this.actor = new ActorEntity("active_character", actorAssets, this.renderTextureManager);
    this.masterContainer.addChild(this.actor.container);

    // Add stage foreground overlay container on top of the character
    this.masterContainer.addChild(this.stage.fgContainer);

    // Extract effect targets cleanly from both entities and attach lighting/shaders
    const stageTargets = this.stage.getEffectsTargets();
    const effectsTarget = this.actor.getEffectsTargets();
    
    this.effectsSystem.attach({
      headContainer: effectsTarget.headContainer,
      auraSprite: effectsTarget.auraSprite,
      baseSprite: effectsTarget.baseSprite,
      mountainReflector: stageTargets.mountainReflector,
      mountainBackReflector: stageTargets.mountainBackReflector,
      ceilingReflector: stageTargets.ceilingReflector
    });
  }

  async reloadAssetsAndScene() {
    const currentSeq = ++this.loadSequence;

    // Pre-resolve and load assets first, before destroying active display blocks
    const currentStore = this.getState();
    const nextRig = await this.resolveConfiguredRig(currentStore);

    if (this.isDestroyed || currentSeq !== this.loadSequence) return;

    if (nextRig.verifiedLoadQueue.length > 0) {
      try {
        await Assets.load(nextRig.verifiedLoadQueue);
      } catch (err) {
        console.error("❌ [PixiEngine] Preloading error:", err);
      }
    }

    if (this.isDestroyed || currentSeq !== this.loadSequence) return;

    this.isReady = false;

    // Detect if stage properties modified. If background setup values did not change, 
    // we bypass stage entity resets to keep fogs and scrolling mountain environments running.
    const stageChanged = !this.loadedRig ||
      this.loadedRig.keys.bg_clipping_mask !== nextRig.keys.bg_clipping_mask ||
      this.loadedRig.keys.bg_mountain !== nextRig.keys.bg_mountain ||
      this.loadedRig.keys.bg_mountain_back !== nextRig.keys.bg_mountain_back ||
      this.loadedRig.isPanoramaMode !== nextRig.isPanoramaMode ||
      this.loadedRig.hasBgPat1 !== nextRig.hasBgPat1 ||
      this.loadedRig.hasBgPat2 !== nextRig.hasBgPat2;

    // Clean up current actor structures
    if (this.actor) {
      if (this.actor.characterContentContainer) {
        this.actor.characterContentContainer.mask = null;
      }
      this.actor.destroy();
      this.actor = null;
    }

    // Always reset tracking and searchlight systems
    if (this.trailSystem?.destroy) {
      this.trailSystem.destroy();
      this.trailSystem = null;
    }
    if (this.searchlightSystem?.destroy) {
      this.searchlightSystem.destroy();
      this.searchlightSystem = null;
    }

    // Tear down stage and render textures only if stage setups changed
    if (stageChanged) {
      if (this.stage?.destroy) {
        this.stage.destroy();
        this.stage = null;
      }
      if (this.renderTextureManager?.destroy) {
        this.renderTextureManager.destroy();
        this.renderTextureManager = null;
      }
    }

    this.loadedRig = nextRig;

    if (!this.masterContainer) {
      this.masterContainer = new Container();
      this.app.stage.addChild(this.masterContainer);
    }

    let clipTex = Assets.get(nextRig.keys.char_clipping_mask);
    if (!clipTex || clipTex === Texture.EMPTY) {
      clipTex = Assets.get('bg');
    }
    this.bgHeightScale = (clipTex && clipTex !== Texture.EMPTY) ? clipTex.height : 1000;

    if (stageChanged || !this.masterClipMask) {
      if (this.masterClipMask) this.masterClipMask.destroy();
      this.masterClipMask = new Graphics()
        .rect(-this.bgHeightScale / 2, -this.bgHeightScale / 2, this.bgHeightScale, this.bgHeightScale)
        .fill({ color: 0xffffff });
      this.masterContainer.addChild(this.masterClipMask);
    }

    if (stageChanged || !this.bgAtmosphereContainer) {
      if (this.bgAtmosphereContainer) this.bgAtmosphereContainer.destroy();
      this.bgAtmosphereContainer = new Container();
      this.bgAtmosphereContainer.mask = this.masterClipMask;
      this.masterContainer.addChild(this.bgAtmosphereContainer);
    }

    if (!this.shockwaveSystem) {
      this.shockwaveSystem = new ShockwaveSystem();
    }

    // Reinitialize or update actor patterns on the active texture manager
    if (!this.renderTextureManager) {
      this.renderTextureManager = new RenderTextureManager({
        discoveredPatterns: nextRig.discoveredPatterns,
        bgPat1Alias: nextRig.hasBgPat1 ? nextRig.keys.bg_pat_1 : null,
        bgPat2Alias: nextRig.hasBgPat2 ? nextRig.keys.bg_pat_2 : null,
        hasBgPat1: nextRig.hasBgPat1,
        hasBgPat2: nextRig.hasBgPat2
      });
    } else {
      this.renderTextureManager.updateActorPatterns(nextRig.discoveredPatterns);
    }

    // Rebuild stage layer templates if required
    if (stageChanged || !this.stage) {
      const stageFlags = {
        isPanoramaMode: nextRig.isPanoramaMode,
        hasBg2: nextRig.hasBg2,
        bg2ParallaxSpeed: currentStore.bg2ParallaxSpeed,
        hasBgClippingMask: nextRig.hasBgClippingMask,
        hasBgPat1: nextRig.hasBgPat1,
        hasBgPat2: nextRig.hasBgPat2,
        hasBgMountainBack: nextRig.hasBgMountainBack,
        hasBgMountain: nextRig.hasBgMountain
      };
      this.stage = new StageEntity(
        currentStore.bgClippingMaskId, 
        nextRig.keys, 
        stageFlags, 
        this.bgHeightScale, 
        this.renderTextureManager, 
        this.app.renderer
      );
      this.bgAtmosphereContainer.addChild(this.stage.bgContainer);
    }

    this.trailSystem = new TrailSystem(this.masterContainer, nextRig.keys.char_clipping_mask);
    this.searchlightSystem = new SearchlightSystem(this.masterContainer);

    const actorAssets = {
      char_clipping_mask: nextRig.hasCharClippingMask ? nextRig.keys.char_clipping_mask : null,
      char_lineart: nextRig.hasLineart ? nextRig.keys.char_lineart : null,
      char_base: nextRig.hasCharBase ? nextRig.keys.char_base : null,
      eyelids_top: nextRig.hasEyelids ? nextRig.keys.eyelids_top : null,
      eyelids_bottom: nextRig.hasEyelids ? nextRig.keys.eyelids_bottom : null,
      discoveredEyes: nextRig.discoveredEyes,
      discoveredPatterns: nextRig.discoveredPatterns,
      isCreatorRig: nextRig.isCreatorRig === true
    };
    this.actor = new ActorEntity("active_character", actorAssets, this.renderTextureManager);
    this.masterContainer.addChild(this.actor.container);

    if (this.stage.fgContainer.parent) {
      this.stage.fgContainer.parent.removeChild(this.stage.fgContainer);
    }
    this.masterContainer.addChild(this.stage.fgContainer);

    const stageTargets = this.stage.getEffectsTargets();
    const effectsTarget = this.actor.getEffectsTargets();
    
    this.effectsSystem.attach({
      headContainer: effectsTarget.headContainer,
      auraSprite: effectsTarget.auraSprite,
      baseSprite: effectsTarget.baseSprite,
      mountainReflector: stageTargets.mountainReflector,
      mountainBackReflector: stageTargets.mountainBackReflector,
      ceilingReflector: stageTargets.ceilingReflector
    });

    this.resize();
    this.isReady = true;
  }

  /**
   * Assigns local animation preferences to transition visually during triggered reactions.
   */
  startLocalReaction(reactionType) {
    this.currentLocalReaction = reactionType;
    this.localReactionProgress = 1.0;

    // Direct WebGL ripples trigger centered on active character position
    if (this.shockwaveSystem && this.actor) {
      this.shockwaveSystem.trigger(
        this.actor.container.position,
        this.masterContainer.scale.x,
        this.app.screen.width,
        this.app.screen.height
      );
    }
  }

  update(deltaTime) {
    if (!this.isReady) return;
    const dtSeconds = deltaTime / 60;
    this.time += dtSeconds;

    // Decay the dynamic reaction progression metrics
    if (this.currentLocalReaction) {
      this.localReactionProgress -= 0.007 * deltaTime;

      if (this.localReactionProgress <= 0) {
        this.localReactionProgress = 0;
        this.currentLocalReaction = null;

        // Broadcast final boundary progress cleanly via native CustomEvent before resetting store
        window.dispatchEvent(new CustomEvent('gothic-reaction-progress', { detail: { progress: 0.0 } }));

        // Reset the store values once when the decay concludes using decoupled state setter
        const setParameter = this.getState().setParameter;
        if (typeof setParameter === 'function') {
          setParameter("activeReaction", null);
          setParameter("reactionProgress", 0.0);
        }
      } else {
        // Dispatch custom event to avoid triggering high-frequency React state updates
        window.dispatchEvent(new CustomEvent('gothic-reaction-progress', { detail: { progress: this.localReactionProgress } }));
      }
    }

    // Synchronously fetch latest live properties to completely bypass full store copy callbacks
    const liveStore = this.getState();

    // Synthesize latest coordinates and decay flags dynamically
    const config = { 
      ...liveStore, 
      mousePos: this.normalizedMousePos,
      activeReaction: this.currentLocalReaction,
      reactionProgress: this.localReactionProgress
    };

    const { isGlitched, currentSplit } = this.effectsSystem.update(this.time, config);

    // Glitch status and shake factor calculated cleanly relative to active parameters
    const glitchShakeIntensity = config.activeReaction === "lyx_received" || config.activeReaction === "lsp8_received"
      ? config.glitchShakeIntensity + (25 - config.glitchShakeIntensity) * config.reactionProgress
      : config.glitchShakeIntensity;

    const isGlitchActive = (isGlitched || currentSplit > (config.aberrationAmount * 1.15));
    
    // 1. Update Environment Stage (parallax backgrounds, fogs, particles)
    if (this.stage) {
      this.stage.update(deltaTime, config, this.time);
    }

    // 2. Update Actor Entity
    if (this.actor) {
      this.actor.update(deltaTime, config, isGlitchActive, this.canvasHeight);
    }

    // 3. Update Volumetric Searchlight (Tracking mouse around active character)
    if (this.searchlightSystem && this.actor) {
      this.searchlightSystem.update(this.actor.container.position, this.absoluteMousePos, deltaTime, config);
    }

    // 4. WebGL Portal Refraction Ripple Subsystem updates
    if (this.shockwaveSystem && this.actor) {
      const hasActiveWaves = this.shockwaveSystem.update(
        dtSeconds, 
        this.app.screen.width, 
        this.app.screen.height, 
        config
      );

      if (hasActiveWaves) {
        if (!this.masterContainer.filters || this.masterContainer.filters.length === 0) {
          this.masterContainer.filters = [this.shockwaveSystem.filter];
        }
      } else {
        this.masterContainer.filters = null;
      }
    }

    // Detect visual shakes to auto-fire WebGL ripples on active character position
    const glitchTriggered = isGlitchActive && glitchShakeIntensity > 15;
    if (glitchTriggered && !this.lastGlitchPeak && this.shockwaveSystem && this.actor) {
      this.shockwaveSystem.trigger(
        this.actor.container.position,
        this.masterContainer.scale.x,
        this.app.screen.width,
        this.app.screen.height
      );
    }
    this.lastGlitchPeak = glitchTriggered;

    // Update off-screen RenderTextureManager pass for warp filters
    if (this.renderTextureManager) {
      this.renderTextureManager.update(deltaTime, config, this.app.renderer);
    }

    // --- Echoing Phase Trails Subsystem calculations (Reading active actor state) ---
    if (this.trailSystem && this.actor) {
      const configForTrails = { ...config, glitchShakeIntensity };
      this.trailSystem.update(this.actor.headState, configForTrails, isGlitchActive);
    }
  }

  resize() {
    if(!this.app || !this.app.renderer || !this.masterContainer) return;
    this.app.renderer.resize(window.innerWidth, window.innerHeight);
    const { screen } = this.app;
    
    // 1. Center the camera container on screen
    this.masterContainer.position.set(screen.width / 2, screen.height / 2);
    
    // 2. Define a stable logical height baseline for side-scrollers.
    const logicalHeight = 1200; 
    
    // 3. Proportional height scaling: scale depends only on the screen's height
    const scale = screen.height / logicalHeight;
    this.masterContainer.scale.set(scale);

    // 4. Calculate the resulting visible local bounds
    const localW = screen.width / scale;
    const localH = screen.height / scale;
    
    // Save the actual coordinate viewport height inside the engine loop
    this.canvasHeight = localH;

    if (this.masterClipMask) {
      this.masterClipMask.clear()
        .rect(-localW / 2, -localH / 2, localW, localH)
        .fill({ color: 0xffffff });
    }

    // Propagate the new visible layout bounds to the stage layers to prevent edge-cutoffs
    if (this.stage && typeof this.stage.resize === 'function') {
      this.stage.resize(localW, localH);
    }
  }

  destroy() {
    this.isDestroyed = true;

    if (this.unsubscribers) {
      this.unsubscribers.forEach(unsub => {
        if (typeof unsub === 'function') unsub();
      });
      this.unsubscribers = [];
    }

    if (this.isReady && this.app) {
      try { 
        if (this.actor) {
          if (this.actor.characterContentContainer) {
            this.actor.characterContentContainer.mask = null;
          }
          this.actor.destroy();
          this.actor = null;
        }
        if (this.stage?.destroy) {
          this.stage.destroy();
          this.stage = null;
        }

        if (this.renderTextureManager?.destroy) {
          this.renderTextureManager.destroy();
          this.renderTextureManager = null;
        }
        if (this.trailSystem?.destroy) {
          this.trailSystem.destroy();
          this.trailSystem = null;
        }
        if (this.shockwaveSystem?.destroy) {
          this.shockwaveSystem.destroy();
          this.shockwaveSystem = null;
        }
        if (this.searchlightSystem?.destroy) {
          this.searchlightSystem.destroy();
          this.searchlightSystem = null;
        }

        // Only release textures from cache when the app is completely unmounted/unloaded
        if (this.loadedRig && this.loadedRig.verifiedLoadQueue && this.loadedRig.verifiedLoadQueue.length > 0) {
          Assets.unload(this.loadedRig.verifiedLoadQueue).catch(() => {});
          this.loadedRig = null;
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

// 2D Random
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
    
    vec2 p = st;
    for (int i = 0; i < 4; i++) {
        value += amplitude * noise(p);
        p *= 2.02;
        amplitude *= 0.5;
    }
    return value;
}

void main() {
    vec2 uv = vTextureCoord;
    
    // Volumetric Horizontal Band Mask with smooth edge fade-out at boundaries
    float band = smoothstep(0.12, 0.45, uv.y) * (1.0 - smoothstep(0.55, 0.88, uv.y));
    
    // Vector shift driven by wind speed and slow rising heat
    vec2 shift = vec2(uTime * uSpeed, uTime * -0.05);
    
    // Scale coordinate mapping (12x horizontally, 6x vertically) to create detailed wind-swept clouds
    vec2 noiseUV = uv * vec2(12.0, 6.0);
    
    // Compute layered dynamic noise
    float n1 = fbm(noiseUV + shift);
    float n2 = fbm(noiseUV * 2.1 - shift * 0.85) * 0.45;
    float n = n1 * 0.65 + n2 * 0.35;
    
    // Apply contrast and thresholding curves to sculpt flat haze into distinct wisps of smoke
    n = clamp(n * 1.5 - 0.25, 0.0, 1.0); // Shift dark values down
    n = pow(n, 2.2) * 1.7;               // Sharpen the cloud edges and deepen shadows
    
    float alpha = n * band * uOpacity;
    
    finalColor = vec4(uColor * alpha, alpha);
}
`;
```

---
### `src\engine\shaders\MutationCompositeShader.js`
```javascript
export const MUTATION_COMPOSITE_FRAGMENT_SHADER = `
precision highp float;

in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform sampler2D uMaskTexture;
uniform sampler2D uLineartTexture;
uniform vec4 uInputClamp;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform float uMode;
uniform float uAxisX;
uniform float uAxisY;
uniform float uSourceX;
uniform float uSourceY;
uniform float uMirrorPattern;
uniform float uPadding;

float reflectCoordinate(float outputCoordinate, float axis, float sourceSide) {
  if (sourceSide < 0.5) {
    return outputCoordinate <= axis ? outputCoordinate : 2.0 * axis - outputCoordinate;
  }
  return outputCoordinate >= axis ? outputCoordinate : 2.0 * axis - outputCoordinate;
}

void main() {
  vec2 inputPixel = vTextureCoord * uInputSize.xy;
  vec2 contentSize = max(uOutputFrame.zw - vec2(uPadding * 2.0), vec2(1.0));
  vec2 localUv = (inputPixel - vec2(uPadding)) / contentSize;
  vec2 geometryUv = localUv;

  bool mirrorX = uMode > 0.5 && (uMode < 1.5 || uMode > 2.5);
  bool mirrorY = uMode > 1.5;

  if (mirrorX) {
    geometryUv.x = reflectCoordinate(localUv.x, uAxisX, uSourceX);
  }
  if (mirrorY) {
    geometryUv.y = reflectCoordinate(localUv.y, uAxisY, uSourceY);
  }

  if (geometryUv.x < 0.0 || geometryUv.x > 1.0 ||
      geometryUv.y < 0.0 || geometryUv.y > 1.0) {
    finalColor = vec4(0.0);
    return;
  }

  vec2 contentUv = uMirrorPattern > 0.5 ? geometryUv : localUv;
  vec2 inputUv = (vec2(uPadding) + contentUv * contentSize) * uInputSize.zw;
  vec4 content = texture(uTexture, clamp(inputUv, uInputClamp.xy, uInputClamp.zw));
  float maskAlpha = texture(uMaskTexture, geometryUv).a;
  vec4 lineart = texture(uLineartTexture, geometryUv);
  vec4 clippedContent = content * maskAlpha;

  finalColor = lineart + clippedContent * (1.0 - lineart.a);
}
`;

```

---
### `src\engine\shaders\ShockwaveShader.js`
```javascript
// src/engine/shaders/ShockwaveShader.js

export const SHOCKWAVE_FRAGMENT_SHADER = `
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
```

---
### `src\engine\shaders\SymmetryShader.js`
```javascript
export const SYMMETRY_FRAGMENT_SHADER = `
precision highp float;

in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec4 uInputClamp;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform float uMode;
uniform float uAxisX;
uniform float uAxisY;
uniform float uSourceX;
uniform float uSourceY;
uniform float uPadding;

float reflectCoordinate(float outputCoordinate, float axis, float sourceSide) {
  if (sourceSide < 0.5) {
    return outputCoordinate <= axis ? outputCoordinate : 2.0 * axis - outputCoordinate;
  }
  return outputCoordinate >= axis ? outputCoordinate : 2.0 * axis - outputCoordinate;
}

void main() {
  vec2 inputPixel = vTextureCoord * uInputSize.xy;
  vec2 contentSize = max(uOutputFrame.zw - vec2(uPadding * 2.0), vec2(1.0));
  vec2 localUv = (inputPixel - vec2(uPadding)) / contentSize;
  vec2 sampleLocalUv = localUv;

  bool mirrorX = uMode > 0.5 && (uMode < 1.5 || uMode > 2.5);
  bool mirrorY = uMode > 1.5;

  if (mirrorX) {
    sampleLocalUv.x = reflectCoordinate(localUv.x, uAxisX, uSourceX);
  }
  if (mirrorY) {
    sampleLocalUv.y = reflectCoordinate(localUv.y, uAxisY, uSourceY);
  }

  if (sampleLocalUv.x < 0.0 || sampleLocalUv.x > 1.0 ||
      sampleLocalUv.y < 0.0 || sampleLocalUv.y > 1.0) {
    finalColor = vec4(0.0);
    return;
  }

  vec2 sampleUv = (vec2(uPadding) + sampleLocalUv * contentSize) * uInputSize.zw;
  finalColor = texture(uTexture, clamp(sampleUv, uInputClamp.xy, uInputClamp.zw));
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
import { EffectFactory } from '../filters/EffectFactory.js';

export class EffectsSystem {
  constructor() {
    // 1. Instantiate filter instances via the central factory
    this.rgbSplitFilter = EffectFactory.createChromaticAberration();
    this.auraBlurFilter = EffectFactory.createAuraBlur(20);
    this.colorMatrix = EffectFactory.createColorMatrix();

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
   */
  attach(targets) {
    this.targets = { ...this.targets, ...targets };

    if (this.targets.headContainer) {
      this.targets.headContainer.filters = [this.rgbSplitFilter];
    }
    if (this.targets.auraSprite) {
      const hasMutationFilter = (this.targets.auraSprite.filters || []).length > 0;
      this.auraBlurFilter.padding = hasMutationFilter ? 0 : 100;
      this.targets.auraSprite.filters = [
        ...(this.targets.auraSprite.filters || []),
        this.auraBlurFilter
      ];
    }
    if (this.targets.baseSprite) {
      this.targets.baseSprite.filters = [
        ...(this.targets.baseSprite.filters || []),
        this.colorMatrix
      ];
    }
  }

  /**
   * Updates visual parameters on a per-frame basis.
   * @param {number} time - Elapsed time in seconds.
   * @param {Object} state - State from useStore.
   * @returns {Object} Glitch state metrics for the main engine.
   */
  update(time, state) {
    const metrics = {
      isGlitched: false,
      currentSplit: state.aberrationAmount
    };

    // Calculate transition multipliers/modifiers cleanly on top of baseline slider values
    let aberrationAmountModifier = 0.0;
    let aberrationSpeedOverride = state.aberrationSpeed;
    let auraOpacityMultiplier = 0.0;
    let auraScaleMultiplier = 0.0;
    let flickerIntensityModifier = 0.0;

    const reaction = state.activeReaction;
    const progress = state.reactionProgress ?? 0.0;

    if (reaction === "lyx_received") {
      auraOpacityMultiplier = (1.0 / Math.max(0.01, state.auraOpacity) - 1.0) * progress;
      auraScaleMultiplier = (1.35 / Math.max(0.1, state.auraScale) - 1.0) * progress;
    } else if (reaction === "lsp7_received" || reaction === "lsp8_received") {
      aberrationAmountModifier = (30.0 - state.aberrationAmount) * progress;
      flickerIntensityModifier = (0.85 - state.flickerIntensity) * progress;
      aberrationSpeedOverride = 8.0;
    }

    const currentAberrationAmount = state.aberrationAmount + aberrationAmountModifier;
    const currentAuraOpacity = state.auraOpacity * (1.0 + auraOpacityMultiplier);
    const currentAuraScale = state.auraScale * (1.0 + auraScaleMultiplier);
    const currentFlickerIntensity = state.flickerIntensity + flickerIntensityModifier;

    // 1. RGB Split / Glitch Calculations
    if (aberrationSpeedOverride > 0) {
      const pulseWave = Math.sin(time * aberrationSpeedOverride * 3);
      metrics.currentSplit = Math.abs(pulseWave) * currentAberrationAmount;

      const activeGlitchChance = (reaction === "lsp7_received" || reaction === "lsp8_received") 
        ? 0.0 
        : state.aberrationGlitch;

      if (activeGlitchChance > 0 && Math.random() < (0.008 * activeGlitchChance)) {
        metrics.currentSplit = currentAberrationAmount * (1.5 + Math.random() * 1.5);
        metrics.isGlitched = true;
      }
    }
    this.rgbSplitFilter.red = { x: metrics.currentSplit, y: 0 };
    this.rgbSplitFilter.blue = { x: -metrics.currentSplit, y: 0 };

    // 2. Color Matrix / Strobe Calculations
    let flickerFactor = 1.0;
    if (this.targets.baseSprite) {
      if (currentFlickerIntensity > 0) {
        const strobeTime = time * state.flickerSpeed * 45;
        const waveValue = Math.sin(strobeTime) * Math.sin(strobeTime * 2.3) * Math.cos(strobeTime * 0.85);
        const triggerThreshold = 1.0 - currentFlickerIntensity;
        this.colorMatrix.reset();

        if (waveValue > triggerThreshold) {
          this.colorMatrix.brightness(1.8, false);
          this.colorMatrix.contrast(1.5, true);
          flickerFactor = 1.8;
        } else if (waveValue < -triggerThreshold) {
          this.colorMatrix.brightness(0.05, false);
          flickerFactor = 0.05;
        } else {
          const randoB = 1.0 + (Math.random() - 0.5) * 0.15 * currentFlickerIntensity;
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
      this.targets.auraSprite.scale.set(currentAuraScale + (auraPulse * 0.02));
      this.targets.auraSprite.alpha = currentAuraOpacity;
      
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

    const baseReflectAlpha = currentAuraOpacity * (0.12 + auraPulse * 0.28) * (state.cavernLightIntensity ?? 1.0);
    const reflectionAlpha = Math.max(0, Math.min(1.0, baseReflectAlpha * flickerFactor));

    if (this.targets.mountainReflector) {
      this.targets.mountainReflector.tint = reflectionTint;
      this.targets.mountainReflector.alpha = reflectionAlpha;
    }

    if (this.targets.mountainBackReflector) {
      this.targets.mountainBackReflector.tint = reflectionTint;
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

  /**
   * Resolves the current global screen coordinates of all active eye components.
   * This is used to accurately anchor searchlight emissions dynamically.
   * @returns {Array<{x: number, y: number}>} Global coordinate positions.
   */
  getEyeGlobalPositions() {
    return this.eyeContainers
      .map(group => {
        if (group.pupil) {
          return group.pupil.getGlobalPosition();
        } else if (group.sclera) {
          return group.sclera.getGlobalPosition();
        }
        return null;
      })
      .filter(pos => pos !== null);
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
### `src\engine\systems\FlightDynamics.js`
```javascript
// src/engine/systems/FlightDynamics.js

export class FlightDynamics {
  /**
   * Compiles coordinates, rotation tilts, and scale modifications on a per-frame basis.
   * @param {number} time - Elapsed execution time in seconds.
   * @param {Object} config - Normalized application state variables.
   * @param {boolean} isGlitchActive - Flag denoting if a peak glitch state is occurring.
   * @param {{x: number, y: number}} baselinePos - Dynamic target coordinates currently centered on the head.
   * @param {number} currentFlipScale - Horizontal scale factor supporting smooth rotational flipping.
   * @param {number} canvasHeight - Total visible viewport height in local coordinate units.
   * @returns {Object} Target positions, rotation angles, and horizontal/vertical scales.
   */
  calculate(time, config, isGlitchActive, baselinePos, currentFlipScale, canvasHeight = 1000) {
    const tFloat = time * config.floatSpeed;

    // Generate smooth hover pauses (plateaus) at wave extrema using smoothstep interpolation
    const rawWave = Math.sin(tFloat) * config.flyHoverPause;
    const clampedWave = Math.max(-1.0, Math.min(1.0, rawWave));
    
    // Map wave region down to [0.0, 1.0] for step translation
    const normProgress = clampedWave * 0.5 + 0.5; 
    const smoothProgress = normProgress * normProgress * (3.0 - 2.0 * normProgress);

    // Apply vertical displacement boundaries relative to the dynamic baseline
    let y = baselinePos.y - (smoothProgress * config.floatAmpY * 1.5);
    
    // Apply horizontal sway relative to the dynamic baseline
    let x = baselinePos.x + Math.cos(tFloat * 0.5) * config.floatAmpX;

    // Apply erratic noise coordinates if a screen shake action is active
    if (config.glitchShakeIntensity > 0 && isGlitchActive) {
      x += (Math.random() - 0.5) * config.glitchShakeIntensity;
      y += (Math.random() - 0.5) * config.glitchShakeIntensity;
    }

    // --- Dynamic Height-Based Scaling ---
    // The top of the visible screen is at -halfHeight, and the bottom is at +halfHeight
    const halfHeight = canvasHeight / 2;
    const clampedY = Math.max(-halfHeight, Math.min(halfHeight, baselinePos.y));
    
    // Convert coordinate to a clean normalized [0.0, 1.0] ratio 
    // -halfHeight (top of screen) maps to 0.0, halfHeight (bottom of screen) maps to 1.0
    const heightRatio = (clampedY + halfHeight) / canvasHeight;

    // Interpolate: flyMaxScale (smaller, further away / top) up to flyMinScale (closer / bottom)
    const scale = config.flyMaxScale + heightRatio * (config.flyMinScale - config.flyMaxScale);

    // Process dynamic tilt (persistent bias angles + swaying)
    const tiltRad = config.flyTiltBias * (Math.PI / 180.0);
    const swayOsc = Math.sin(tFloat * 0.7) * (config.floatRotation * 0.5) * (Math.PI / 180.0);
    const rotation = tiltRad + swayOsc;

    return { 
      x, 
      y, 
      scale, 
      scaleX: scale * currentFlipScale, // Apply the horizontal rotation flip factor
      rotation 
    };
  }
}
```

---
### `src\engine\systems\FogSystem.js`
```javascript
// src/engine/systems/FogSystem.js
import { Sprite, Texture } from 'pixi.js';
import { EffectFactory } from '../filters/EffectFactory.js';

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

    // Delegate compilation to the central factory
    this.filter = EffectFactory.createFogFilter();

    this.sprite.filters = [this.filter];
    this.targetContainer.addChild(this.sprite);
  }

  /**
   * Rescales the fog mesh width to cover ultra-wide screen borders.
   */
  resize(localW, localH) {
    if (this.sprite) {
      this.sprite.width = localW;
    }
  }

  update(time, config) {
    if (!this.filter) return;

    // Apply strict fallback baselines to safeguard the shader uniforms from NaN corruptions
    const fogOpacity = config.fogOpacity ?? 0.4;
    const fogSpeed = config.fogSpeed ?? 1.0;
    const fogColorR = config.fogColorR ?? 140;
    const fogColorG = config.fogColorG ?? 120;
    const fogColorB = config.fogColorB ?? 180;
    const fogSwaySpeed = config.fogSwaySpeed ?? 0.5;
    const fogSwayAmp = config.fogSwayAmp ?? 20.0;

    const unis = this.filter.resources.fogUniforms.uniforms;
    unis.uTime = time;
    
    const baseOpacity = this.isForeground ? fogOpacity * 0.55 : fogOpacity;
    unis.uOpacity = baseOpacity;
    
    const velocityScale = this.isForeground ? 1.45 : 0.85;
    unis.uSpeed = fogSpeed * 0.01 * velocityScale;
    
    unis.uColor = [
        fogColorR / 255,
        fogColorG / 255,
        fogColorB / 255
    ];

    const phaseOffset = this.isForeground ? 1.6 : 0.0;
    const sway = Math.sin((time * fogSwaySpeed) + phaseOffset) * fogSwayAmp;
    
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
    this.localW = 2000; // Default fallback width
    
    this.rebuildSprites();
  }

  setPatternScale(scaleFactor) {
    this.customScaleFactor = scaleFactor;
  }

  /**
   * Resizes the layer and adjusts the sprite pool count dynamically to prevent seams.
   */
  resize(localW, localH) {
    this.localW = localW;
    this.rebuildSprites();
  }

  /**
   * Calculates the exact number of sprites needed to tile the current screen width seamlessly.
   */
  rebuildSprites() {
    const scaleFactorToUse = this.customScaleFactor !== undefined ? this.customScaleFactor : 1.0;
    const finalScale = this.spriteScale * scaleFactorToUse;
    const w = this.textureWidth * finalScale;

    // Determine the pool size: visible viewport divided by sprite width, plus 2 padding sprites
    const needed = Math.max(4, Math.ceil(this.localW / w) + 2);

    if (this.items.length !== needed) {
      // Safely clear old child nodes to avoid leaks
      this.items.forEach(item => {
        if (item.sprite) {
          this.removeChild(item.sprite);
          item.sprite.destroy({ children: true, texture: false }); // Safely clean up sprite references while preserving shared source textures
        }
      });
      this.items = [];

      // Re-populate sprite pool centered horizontally
      const startIdx = -Math.floor(needed / 2);
      for (let i = 0; i < needed; i++) {
        const baseIndex = startIdx + i;
        const sprite = new Sprite(this.texture);
        sprite.anchor.set(0.5);
        sprite.y = 0;
        this.addChild(sprite);
        this.items.push({ sprite, baseIndex });
      }
    }
  }

  updatePositions(dtSeconds, baseSpeed = 0, dynamicSpeedFactor) {
    const activeSpeedFactor = dynamicSpeedFactor !== undefined ? dynamicSpeedFactor : this.speedFactor;
    this.scrollX -= baseSpeed * activeSpeedFactor * dtSeconds;

    const scaleFactorToUse = this.customScaleFactor !== undefined ? this.customScaleFactor : 1.0;
    const finalScale = this.spriteScale * scaleFactorToUse;
    const w = this.textureWidth * finalScale;

    const totalWidth = this.items.length * w;
    const halfTotalWidth = totalWidth / 2;

    this.items.forEach(item => {
      let localX = (item.baseIndex * w) + this.scrollX;

      // Wrap local coordinates based on the total width of the active sprite pool
      while (localX < -halfTotalWidth) {
        localX += totalWidth;
      }
      while (localX > halfTotalWidth) {
        localX -= totalWidth;
      }

      item.sprite.position.set(localX, 0);

      // Apply mirroring flips to ensure seamless transitions at texture boundaries
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

    // Calculate transition multipliers cleanly on top of baseline slider values
    let activeReactionMultiplier = 0.0;
    let particleSpeedMultiplier = 0.0;

    if (state.activeReaction === "lyx_received") {
      const progress = state.reactionProgress ?? 0.0;
      activeReactionMultiplier = (300 / Math.max(1, state.particleCount) - 1.0) * progress;
      particleSpeedMultiplier = (4.5 / Math.max(0.1, state.particleSpeed) - 1.0) * progress;
    }

    const currentParticleCount = Math.floor(state.particleCount * (1.0 + activeReactionMultiplier));
    const currentParticleSpeed = state.particleSpeed * (1.0 + particleSpeedMultiplier);

    // Pool expansion: Spawn particles to meet targeted configuration count on demand
    while (this.particles.length < currentParticleCount) {
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
      sprite.visible = true;
      sprite.renderable = true;

      this.particles.push(sprite);
      this.particleContainer.addChild(sprite);
    }

    // Toggle visibility and renderability properties of cached sprites to prevent GC thrashing
    for (let i = 0; i < this.particles.length; i++) {
      const sprite = this.particles[i];
      if (i < currentParticleCount) {
        if (!sprite.visible) {
          sprite.visible = true;
          sprite.renderable = true;
        }
      } else {
        if (sprite.visible) {
          sprite.visible = false;
          sprite.renderable = false;
        }
      }
    }

    // Physics propagation, color blending, and boundary calculations for active pool items
    for (let i = 0; i < currentParticleCount; i++) {
      const p = this.particles[i];
      if (!p) continue;

      const c = p._custom;
      c.birthTime += dtSeconds;

      // Depth Parallax: Larger foreground objects float and drift faster than background ones
      const parallaxFactor = c.size;
      c.y += c.speedY * currentParticleSpeed * parallaxFactor * deltaTime;

      // Motion dynamics: Erratic fluttering for flat ash flakes, slow crawlings for soot motes
      let sway;
      if (c.type === 'ash') {
        // Asymmetric fluttering math
        sway = Math.sin(c.birthTime * c.swayFreq * 2.8) * c.swayWidth * 1.5 * state.particleSway;
      } else {
        // Slow crawling
        sway = Math.sin(c.birthTime * c.swayFreq) * c.swayWidth * state.particleSway;
      }

      const drift = (c.speedX * currentParticleSpeed * parallaxFactor * deltaTime) + (state.particleWind * deltaTime) + sway;
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
      this.bgPatternSprite = new MirroredScrollLayer(this.bgPatternRenderTexture, bgH, 0.0);
    } else {
      this.bgPatternRenderTexture = RenderTexture.create({ width: 1, height: 1 });
      this.bgPatternSprite = new MirroredScrollLayer(this.bgPatternRenderTexture, 1, 0.0);
      this.bgPatternSprite.visible = false;
    }

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

  /**
   * Swaps the active character's textures dynamically.
   * This avoids destroying the background render textures so fogs and mountain
   * layers remain unaffected during updates.
   */
  updateActorPatterns(discoveredPatterns) {
    this.discoveredPatterns = discoveredPatterns || [];

    if (this.localPatternContainer) {
      this.localPatternContainer.destroy({ children: true });
      this.localPatternContainer = null;
    }
    if (this.patternRenderTexture) {
      this.patternRenderTexture.destroy(true); // Reclaims the underlying GPU TextureSource during swaps
      this.patternRenderTexture = null;
    }

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
      
      if (this.patternSprite) {
        this.patternSprite.texture = this.patternRenderTexture;
        this.patternSprite.visible = true;
      } else {
        this.patternSprite = new Sprite(this.patternRenderTexture);
        this.patternSprite.anchor.set(0.5);
      }
    } else {
      this.patternRenderTexture = RenderTexture.create({ width: 1, height: 1 });
      if (this.patternSprite) {
        this.patternSprite.texture = this.patternRenderTexture;
        this.patternSprite.visible = false;
      }
    }
  }

  resize(localW, localH) {
    if (this.bgPatternSprite && typeof this.bgPatternSprite.resize === 'function') {
      this.bgPatternSprite.resize(localW, localH);
    }
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

      let warpIntensityMultiplier = 0.0;
      const reaction = state.activeReaction;
      const progress = state.reactionProgress ?? 0.0;

      if (reaction === "lyx_received") {
        warpIntensityMultiplier = (50.0 / Math.max(0.1, state.warpIntensity) - 1.0) * progress;
      } else if (reaction === "lsp7_received" || reaction === "lsp8_received") {
        warpIntensityMultiplier = (90.0 / Math.max(0.1, state.warpIntensity) - 1.0) * progress;
      }

      const currentWarpIntensity = state.warpIntensity * (1.0 + warpIntensityMultiplier);

      if (this.warpFilter && this.warpFilter.resources.warpUniforms) {
        this.warpFilter.resources.warpUniforms.uniforms.uTime = this.time * state.warpSpeed;
        this.warpFilter.resources.warpUniforms.uniforms.uWarpIntensity = currentWarpIntensity;
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
      this.patternRenderTexture.destroy(true); // Force-disposes of the GPU TextureSource
    }
    if (this.bgPatternRenderTexture) {
      this.bgPatternRenderTexture.destroy(true); // Reclaims the WebGL framebuffer allocation
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
### `src\engine\systems\SearchlightSystem.js`
```javascript
// src/engine/systems/SearchlightSystem.js
import { Container, Graphics, FillGradient } from 'pixi.js';

export class SearchlightSystem {
  /**
   * Initializes the searchlight.
   * @param {Container} parentContainer - Target node (usually masterContainer).
   */
  constructor(parentContainer) {
    this.parentContainer = parentContainer;

    this.container = new Container();
    this.container.zIndex = 4; // Renders on top of character graphics but below overlays
    this.parentContainer.addChild(this.container);

    // Create a native Graphics instance instead of drawing to an HTML Canvas
    this.beamGraphics = new Graphics();
    this.container.addChild(this.beamGraphics);
  }

  /**
   * Translates start coordinates onto the character's custom perimeter orbit and scales length dynamically.
   * @param {{x: number, y: number}} characterPos - World coordinates of the head container.
   * @param {{x: number, y: number}} targetGlobalPos - Focal target coordinates (absolute mouse cursor).
   * @param {number} deltaTime - Frame step timing factor.
   * @param {Object} config - State config containing active visual preferences.
   */
  update(characterPos, targetGlobalPos, deltaTime, config) {
    if (!config.searchlightActive || !characterPos) {
      this.container.visible = false;
      return;
    }

    this.container.visible = true;

    // Convert screen targets into local space [3]
    const localCenter = characterPos; 
    const localTarget = this.container.toLocal(targetGlobalPos);

    const dx = localTarget.x - localCenter.x;
    const dy = localTarget.y - localCenter.y;
    const distToCenter = Math.sqrt(dx * dx + dy * dy);

    // Determine target vector angle
    const angle = Math.atan2(dy, dx);

    // Pull custom orbit radius parameter from UI [3]
    const orbitRadius = config.searchlightRadius ?? 110;

    // Anchor starting coordinates directly along the circle perimeter pointing towards focus targets [3]
    const startX = localCenter.x + Math.cos(angle) * orbitRadius;
    const startY = localCenter.y + Math.sin(angle) * orbitRadius;

    this.beamGraphics.position.set(startX, startY);
    this.beamGraphics.rotation = angle - Math.PI / 2; // Aligns vertical canvas texture direction

    // Decelerate beam lengths automatically as the mouse gets closer to the center [3]
    const beamDistance = Math.max(0, distToCenter - orbitRadius);

    // Calculate dynamic RGB tints
    const rTint = config.searchlightColorR ?? 255;
    const gTint = config.searchlightColorG ?? 255;
    const bTint = config.searchlightColorB ?? 255;
    this.beamGraphics.tint = (rTint << 16) + (gTint << 8) + bTint;

    const beamLength = beamDistance * (config.searchlightLength ?? 1.0);
    const bottomWidth = Math.max(4, Math.min(beamLength * 0.20, 128) * (config.searchlightWidth ?? 1.0));
    const topWidth = bottomWidth / 6;

    this.beamGraphics.clear();

    if (beamLength > 1) {
      // Create volumetric linear gradient matching the original canvas texture
      const gradient = new FillGradient(0, 0, 0, beamLength);
      gradient.addColorStop(0.0, 'rgba(255, 255, 255, 0.0)');  // Starts transparent at 0%
      gradient.addColorStop(0.06, 'rgba(255, 255, 255, 1.0)'); // Short 6% fade-in to 100% opacity
      gradient.addColorStop(0.94, 'rgba(255, 255, 255, 1.0)'); // Stays 100% opaque
      gradient.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');  // Short 6% fade-out at the tip

      const halfTop = topWidth / 2;
      const halfBottom = bottomWidth / 2;

      // Draw tapered cone geometry procedurally
      this.beamGraphics
        .moveTo(-halfTop, 0)
        .lineTo(halfTop, 0)
        .lineTo(halfBottom, beamLength)
        .lineTo(-halfBottom, beamLength)
        .closePath()
        .fill({ fill: gradient });
    }
  }

  destroy() {
    if (this.container) {
      this.parentContainer.removeChild(this.container);
      this.container.destroy({ children: true });
      this.container = null;
    }
    this.beamGraphics = null;
  }
}
```

---
### `src\engine\systems\ShockwaveSystem.js`
```javascript
// src/engine/systems/ShockwaveSystem.js
import { EffectFactory } from '../filters/EffectFactory.js';

export class ShockwaveSystem {
  constructor() {
    this.isActive = false;
    this.time = 0;

    // Delegate compilation to the central factory
    this.filter = EffectFactory.createShockwaveFilter();
  }

  /**
   * Resets progress and targets expanding ripples relative to coordinate center.
   * @param {Object} headPosition - Source coordinate origin.
   * @param {number} scale - Global canvas master container scale factor.
   * @param {number} screenWidth - Active canvas width.
   * @param {number} screenHeight - Active canvas height.
   */
  trigger(headPosition, scale, screenWidth, screenHeight) {
    this.isActive = true;
    this.time = 0;

    const unis = this.filter.resources.shockwaveUniforms.uniforms;
    const screenX = screenWidth / 2 + headPosition.x * scale;
    const screenY = screenHeight / 2 + headPosition.y * scale;

    unis.uCenter = [screenX, screenHeight - screenY];
    unis.uScreenSize = [screenWidth, screenHeight];

    unis.uRadii = new Float32Array([0, 0, 0, 0, 0]);
    unis.uActiveWaveCount = 0.0;
  }

  /**
   * Updates wave progression and manipulates WebGL uniforms.
   * @param {number} dtSeconds - Delta frame time in seconds.
   * @param {number} screenWidth - Active canvas width.
   * @param {number} screenHeight - Active canvas height.
   * @param {Object} config - Normalized application state variables.
   * @returns {boolean} True if WebGL filters should remain attached to the container.
   */
  update(dtSeconds, screenWidth, screenHeight, config) {
    if (!this.isActive) return false;

    this.time += dtSeconds;
    const maxScreenRadius = Math.max(screenWidth, screenHeight) * 1.15;

    const duration = config.shockwaveDuration ?? 1.8;
    const pulseCount = Math.max(1, Math.min(5, config.shockwavePulseCount ?? 2));
    const strength = config.shockwaveStrength ?? 1.0;
    const thickness = config.shockwaveThickness ?? 160.0;
    const waveDelay = 0.35;

    const unis = this.filter.resources.shockwaveUniforms.uniforms;
    unis.uScreenSize = [screenWidth, screenHeight];
    unis.uThickness = thickness;
    unis.uAmplitude = strength * 45.0; 

    let activeCount = 0;
    const radii = new Float32Array([0, 0, 0, 0, 0]);

    for (let i = 0; i < pulseCount; i++) {
      const waveStartTime = i * waveDelay;
      if (this.time >= waveStartTime) {
        const waveAge = this.time - waveStartTime;
        const waveProgress = waveAge / duration;

        if (waveProgress < 1.0) {
          radii[i] = waveProgress * maxScreenRadius;
          activeCount++;
        }
      }
    }

    unis.uRadii = radii;
    unis.uActiveWaveCount = activeCount;

    if (activeCount === 0 && this.time > (pulseCount * waveDelay)) {
      this.isActive = false;
      return false;
    }

    return true;
  }

  destroy() {
    if (this.filter) {
      this.filter.destroy();
      this.filter = null;
    }
    this.isActive = false;
  }
}
```

---
### `src\engine\systems\TrailSystem.js`
```javascript
// src/engine/systems/TrailSystem.js
import { Container, Sprite } from 'pixi.js';

export class TrailSystem {
  /**
   * Initializes the trail container and prepares color-shifted ghost elements.
   * @param {Container} parentContainer - Parent display node.
   * @param {string|null} textureAlias - Cached visual sprite resource.
   */
  constructor(parentContainer, textureAlias) {
    this.parentContainer = parentContainer;
    this.textureAlias = textureAlias;
    
    this.trailContainer = new Container();
    this.parentContainer.addChild(this.trailContainer);

    this.trailSprites = [];
    this.trailHistory = [];

    if (this.textureAlias) {
      // Allocate three coordinate trailing elements
      for (let i = 0; i < 3; i++) {
        const s = Sprite.from(this.textureAlias);
        s.anchor.set(0.5);
        s.alpha = 0;
        s.visible = false;
        s.blendMode = 'screen'; // Screen blending gives bright, spectral energy

        // Assign visual shifts: Cyan, Magenta, and Flame Orange
        if (i === 0) s.tint = 0x00f3ff;
        else if (i === 1) s.tint = 0xff00ff;
        else s.tint = 0xff5500;

        this.trailContainer.addChild(s);
        this.trailSprites.push(s);
      }
    }
  }

  /**
   * Steers position mappings, scale expansions, and boundary alpha transitions.
   * @param {Object} headState - Target configuration offsets computed for the head.
   * @param {Object} config - Normalized application state variables.
   * @param {boolean} isGlitchActive - Flag denoting if a peak glitch state is occurring.
   */
  update(headState, config, isGlitchActive) {
    this.trailHistory.unshift({
      x: headState.x,
      y: headState.y,
      scaleX: headState.scale,
      scaleY: headState.scale,
      rotation: headState.rotation
    });

    const spacing = Math.max(2, config.trailSpacing ?? 5);
    const maxHistoryNeeded = spacing * 3 + 2;
    if (this.trailHistory.length > maxHistoryNeeded) {
      this.trailHistory.pop();
    }

    const trailCount = Math.max(0, Math.min(3, config.trailCount ?? 3));
    const manualAlpha = config.trailManualAlpha ?? 0.0;
    const glitchInfluence = config.trailGlitchInfluence ?? 0.6;

    // Scale trail visibility during visual shocks
    const shakeIntensity = config.glitchShakeIntensity ?? 0;
    const activeReactionProgress = config.reactionProgress ?? 0;
    const motionPulse = (shakeIntensity / 30) * (isGlitchActive ? 1.0 : 0.25);
    const dynamicAlpha = Math.max(motionPulse, activeReactionProgress) * glitchInfluence;

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
        
        // Spectral scale expansion: ensures older nodes peak out as outlines
        const scaleExpansion = 1.0 + (index + 1) * 0.04; 
        
        // Vertical drift offset: simulates rising spectral smoke currents
        const driftOffsetY = (index + 1) * -8;

        sprite.position.set(historyState.x, historyState.y + driftOffsetY);
        sprite.scale.set(historyState.scaleX * scaleExpansion, historyState.scaleY * scaleExpansion);
        sprite.rotation = historyState.rotation;

        // Progressively fade coordinates of older trails
        const stepDecay = 1.0 - (index * 0.25); 
        sprite.alpha = Math.max(0, Math.min(1.0, targetBaseAlpha * stepDecay));
      } else {
        sprite.visible = false;
        sprite.alpha = 0;
      }
    });
  }

  destroy() {
    if (this.trailContainer) {
      this.parentContainer.removeChild(this.trailContainer);
      this.trailContainer.destroy({ children: true });
      this.trailContainer = null;
    }
    this.trailSprites = [];
    this.trailHistory = [];
  }
}
```

---
### `src\hooks\useArtworkReactions.js`
```javascript
// src/hooks/useArtworkReactions.js
import { useCallback, useEffect } from "react";
import { useStore } from "../store/useStore";
import { useLsp1Events } from "./useLsp1Events";

export function useArtworkReactions() {
  const setParameter = useStore((s) => s.setParameter);

  const triggerReaction = useCallback((event) => {
    console.log("💀 Real-Time Gothic Reaction Triggered for:", event.type);
    
    // Reset state triggers to guarantee subsequent identical events execute correctly
    setParameter("activeReaction", null);
    
    // Register the trigger event in the store.
    // The PixiEngine ticker will detect this configuration shift and execute 
    // the smooth visual decay math internally inside the rendering thread.
    setParameter("reactionProgress", 1.0);
    setParameter("activeReaction", event.type);
  }, [setParameter]);

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
    this.currentSetupId = 0;
    this.abortController = null;
  }

  async initialize() {
    if (this.initialized) return true;
    this.initialized = true;
    return true;
  }

  async setupEventListeners(address) {
    const logPrefix = `[LSP1 Setup Addr:${address?.slice(0, 6)}]`;
    
    if (!address || !isAddress(address)) {
      this.shouldBeConnected = false;
      return false;
    }

    if (this.listeningAddress?.toLowerCase() === address.toLowerCase() && this.unwatchEvent) {
      this.shouldBeConnected = true;
      return true;
    }

    // 1. Increment setup sequence ID to prevent race conditions during fast toggles
    const setupId = ++this.currentSetupId;

    // 2. Tear down the previous connection instance, abort pending requests, and close active sockets
    this.cleanupListeners(); 

    // 3. Initialize the new AbortController for the current setup attempt
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    this.isSettingUp = true;
    this.shouldBeConnected = true;
    this.listeningAddress = address;

    if (signal.aborted || setupId !== this.currentSetupId) {
      this.isSettingUp = false;
      return false;
    }

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

      if (signal.aborted || setupId !== this.currentSetupId) {
        this.isSettingUp = false;
        return false;
      }

      // Verify that the address contains bytecode (valid contract check to avoid EOA listener crashes)
      const bytecode = await this.viemClient.getBytecode({ address });
      if (signal.aborted || setupId !== this.currentSetupId) {
        return false;
      }

      if (!bytecode || bytecode === "0x") {
        console.warn(`${logPrefix} Target profile address has no deployed bytecode. UniversalReceiver aborted (EOA or undeployed contract detected).`);
        this.isSettingUp = false;
        this.shouldBeConnected = false;
        return false;
      }

      this.unwatchEvent = this.viemClient.watchContractEvent({
        address: this.listeningAddress,
        abi: LSP1_ABI,
        eventName: "UniversalReceiver",
        onLogs: (logs) => {
          this.reconnectAttempts = 0; // Clear connection error counters
          if (import.meta.env.DEV) console.log(`${logPrefix} Received ${logs.length} contract events.`);
          
          logs.forEach((log) => {
            if (log.removed) return;
            if (signal.aborted || setupId !== this.currentSetupId) return;

            try {
              const decodedLog = decodeEventLog({
                abi: LSP1_ABI,
                data: log.data,
                topics: log.topics,
              });

              if (decodedLog.eventName === "UniversalReceiver" && decodedLog.args) {
                this.handleUniversalReceiver(decodedLog.args, log);
              }
            } catch (e) {
              if (import.meta.env.DEV) console.error(`Log decode error:`, e);
            }
          });
        },
        onError: (error) => {
          if (signal.aborted || setupId !== this.currentSetupId) return;

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
      if (setupId === this.currentSetupId) {
        this.isSettingUp = false;
      }
      return true;
    } catch (error) {
      if (signal.aborted || setupId !== this.currentSetupId) {
        return false;
      }
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
        const activeAddress = this.listeningAddress;
        if (this.shouldBeConnected && activeAddress) {
          this.setupEventListeners(activeAddress);
        }
      }, delay);
    } else {
      console.error("[LSP1] Critical: Maximum reconnection attempts reached. Listener inactive.");
    }
  }

  cleanupListeners() {
    this.shouldBeConnected = false;
    this.isSettingUp = false;

    // Abort active setup processes
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    // Unsubscribe from events
    if (this.unwatchEvent) {
      try {
        this.unwatchEvent();
      } catch (e) {}
      this.unwatchEvent = null;
    }

    // Safely retrieve the underlying socket object and close the connection
    const clientToClose = this.viemClient;
    if (clientToClose && typeof clientToClose.transport?.getSocket === 'function') {
      clientToClose.transport.getSocket()
        .then((socket) => {
          if (socket && typeof socket.close === 'function') {
            if (import.meta.env.DEV) console.log("[LSP1] Disposing of underlying active WebSocket transport...");
            socket.close(); // Cleanly close the connection
          }
        })
        .catch((err) => {
          if (import.meta.env.DEV) {
            console.warn("[LSP1] Error cleaning up transport connection:", err);
          }
        });
    }

    this.viemClient = null;
    this.recentEvents = [];
  }

  handleUniversalReceiver(eventArgs, log = null) {
    if (!eventArgs || typeof eventArgs !== "object" || !eventArgs.typeId) return;

    const { from, value, typeId, receivedData } = eventArgs;
    const lowerCaseTypeId = typeId?.toLowerCase();

    if (!lowerCaseTypeId) return;

    const stringValue = value?.toString() ?? "0";
    const eventTypeName = TYPE_ID_TO_EVENT_MAP[lowerCaseTypeId] || "unknown_event";

    // Deduplication filter
    if (this.isDuplicateEvent(typeId, from, stringValue, receivedData, log)) {
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

  isDuplicateEvent(typeId, from, value, data, log = null) {
    let eventIdentifier;
    if (log && log.transactionHash && log.logIndex !== undefined) {
      const logIdentifier = `${log.transactionHash}-${log.logIndex}`;
      eventIdentifier = logIdentifier;
    } else {
      eventIdentifier = `${typeId}-${from}-${value}-${data || "0x"}`;
    }

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
### `src\store\slices\createActorPhysicsSlice.js`
```javascript
// src/store/slices/createActorPhysicsSlice.js

export const createActorPhysicsSlice = (set, get) => ({
  // 1. Motion & Hover Dynamics
  floatSpeed: 1.0,
  floatAmpX: 30,
  floatAmpY: 50,
  floatRotation: 2.0,

  // Flight & Hover parameters
  flyMinScale: 0.7,       // Scale at lowest point of flight (closer)
  flyMaxScale: 0.2,       // Scale at highest peak of flight (further)
  flyHoverPause: 1.0,     // Hover pause factor (1.0 = smooth sine, 5.0 = flat plateau pauses)
  flyTiltBias: 3.0,       // Persistent tilt bias in degrees

  // 2. Skull Pattern & Warp (Foreground)
  patternBottomScale: 1.0,
  patternTopScale: 1.0,
  warpIntensity: 20.0,
  warpSpeed: 1.0,

  // Creator-only mutation experiment
  mutationMode: 'none',
  mutationAxisX: 0.5,
  mutationAxisY: 0.5,
  mutationSourceX: 'left',
  mutationSourceY: 'top',
  mutationPatternMode: 'symbiosis',

  // 3. Eye & Lid Dynamics
  eyelidTravel: 20.0,         
  blinkInterval: 5.0,        
  blinkSpeed: 1.0,           
  autoBlink: true,           
  eyelidManualProgress: 1.0, 
  pupilWander: 1.0,          
  pupilSaccade: 1.0,         
  pupilMouseInfluence: 1.0,  

  // 4. Searchlight Customisation
  searchlightActive: false,
  searchlightWidth: 0.2,     // Beam width scale
  searchlightLength: 1.0,    // Max beam extension
  searchlightRadius: 150,    // Starting emission radius along character's perimeter
  searchlightColorR: 255,    // RGB values
  searchlightColorG: 255,
  searchlightColorB: 255,
});

```

---
### `src\store\slices\createAtmosphereSlice.js`
```javascript
// src/store/slices/createAtmosphereSlice.js

export const createAtmosphereSlice = (set, get) => ({
  // 1. Aura / Glow & Cavern Reflection Control
  auraOpacity: 0.5,
  auraScale: 1.05,
  auraBlur: 20,
  auraPulseSpeed: 1.0,
  auraColorR: 235,
  auraColorG: 200,
  auraColorB: 150,
  cavernLightIntensity: 0.8, // Slider scale factor for dynamic cavern reflections

  // 2. Particulate Atmosphere (Particles)
  particleCount: 80,
  particleSpeed: 1.0,
  particleWind: 0,
  particleSway: 1.0,
  particleSize: 1.0,
  particleOpacity: 1.0,

  // 3. Volumetric Atmospheric Fog
  fogOpacity: 0.4,           // Starting alpha density for the volumetric noise
  fogSpeed: 1.0,             // Drift wind speed modifier
  fogColorR: 140,            // Fog RGB tint values
  fogColorG: 120,
  fogColorB: 180,
  fogSwaySpeed: 0.5,         // Vertical bobbing velocity
  fogSwayAmp: 20.0,          // Vertical bobbing range in pixels

  // 4. Parallax Background Layers & Scroll Speed
  bgScrollSpeed: 30.0,      
  bg2ParallaxSpeed: 1.8,    

  // 5. Retro Screen Overlays (Post-processing indicators)
  scanlineOpacity: 0.15,
  vignetteOpacity: 0.5,
});
```

---
### `src\store\slices\createGlitchSlice.js`
```javascript
// src/store/slices/createGlitchSlice.js

export const createGlitchSlice = (set, get) => ({
  // 1. Background Pattern Warp (Independent)
  bgPatternBottomScale: 1.0,
  bgPatternTopScale: 1.0,
  bgWarpIntensity: 20.0,
  bgWarpSpeed: 1.0,

  // 2. Chromatic Aberration & Visual Shakes
  aberrationAmount: 0.0,
  aberrationSpeed: 0.0,
  aberrationGlitch: 0.0,
  glitchShakeIntensity: 0,
  flickerIntensity: 0.0,
  flickerSpeed: 1.0,
  
  // 3. Spectral Phase Trail Control
  trailCount: 3,             // Total active spectral trails (0 - 3)
  trailSpacing: 5,           // Delayed spacing of historical coordinates in frames
  trailManualAlpha: 0.0,     // Static override opacity to manually customize/test trails
  trailGlitchInfluence: 0.6, // Relative opacity scaling factor during spikes and shake actions
});
```

---
### `src\store\slices\usePhysicsSlice.js`
```javascript
// src/store/slices/usePhysicsSlice.js

export const createPhysicsSlice = (set, get) => ({
  // 1. Motion Dynamics
  floatSpeed: 1.0,
  floatAmpX: 30,
  floatAmpY: 50,
  floatRotation: 2.0,

  // Custom Flight and Hover parameters
  flyMinScale: 0.7,       // Scale at lowest point of flight
  flyMaxScale: 0.2,      // Scale at highest peak of flight
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

  // 5b. Volumetric Atmospheric Fog (New Default State Variables)
  fogOpacity: 0.4,           // Starting alpha density for the volumetric noise
  fogSpeed: 1.0,             // Drift wind speed modifier
  fogColorR: 140,            // Fog RGB tint values
  fogColorG: 120,
  fogColorB: 180,
  fogSwaySpeed: 0.5,         // Vertical bobbing velocity
  fogSwayAmp: 20.0,          // Vertical bobbing range in pixels

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

  // 10. Eye & Lid Dynamics
  eyelidTravel: 20.0,         
  blinkInterval: 5.0,        
  blinkSpeed: 1.0,           
  autoBlink: true,           
  eyelidManualProgress: 1.0, 
  pupilWander: 1.0,          
  pupilSaccade: 1.0,         
  pupilMouseInfluence: 1.0,  

  // 11. Searchlight Customisation State
  searchlightActive: false,
  searchlightWidth: 0.2,     // Beam width scale
  searchlightLength: 1.0,    // Max beam extension
  searchlightRadius: 150,    // Starting emission radius along character's perimeter
  searchlightColorR: 255,    // RGB values
  searchlightColorG: 255,
  searchlightColorB: 255,
});
```

---
### `src\store\slices\useSetupSlice.js`
```javascript
// src/store/slices/useSetupSlice.js
export const createSetupSlice = (set, get) => ({
  isUiVisible: true,
  toggleUi: () => set((state) => ({ isUiVisible: !state.isUiVisible })),

  subjectMode: "actor",
  characterId: "abyssal_eye", 
  creatorCharacterId: "01",
  creatorPatternId: "patchedzebra",
  creatorPaletteId: "basic_purple",
  bgClippingMaskId: "moonpurple",   
  bgPatternStyle: "digitalblob",    
  bgMountainId: 2,             
  bgMountainBackId: 3,         
});

```

---
### `src\store\slices\useWeb3Slice.js`
```javascript
// src/store/slices/useWeb3Slice.js

export const createWeb3Slice = (set, get) => ({
  // 9. Web3 Shockwave Customization Parameters
  shockwaveStrength: 1.0,     // Max displacement strength multiplier (0.0 - 2.0)
  shockwaveThickness: 160.0,  // Dynamic width of the expanding ring wavefront in pixels
  shockwaveDuration: 1.8,     // Single wave expansion lifetime duration in seconds
  shockwavePulseCount: 2,     // Number of cascading/overlapping waves fired on Web3 triggers (1 - 5)

  // 11. Web3 LSP1 Reaction State Parameters
  activeReaction: null,      
  reactionProgress: 0.0,     
});
```

---
### `src\store\useStore.js`
```javascript
// src/store/useStore.js
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { createSetupSlice } from './slices/useSetupSlice';
import { createActorPhysicsSlice } from './slices/createActorPhysicsSlice';
import { createAtmosphereSlice } from './slices/createAtmosphereSlice';
import { createGlitchSlice } from './slices/createGlitchSlice';
import { createWeb3Slice } from './slices/useWeb3Slice';

export const useStore = create(subscribeWithSelector((set, get) => ({
  // Flatten slice definitions into the combined store
  ...createSetupSlice(set, get),
  ...createActorPhysicsSlice(set, get),
  ...createAtmosphereSlice(set, get),
  ...createGlitchSlice(set, get),
  ...createWeb3Slice(set, get),
  
  /**
   * Central state mutator.
   * Modifies configuration parameters on the flattened store safely.
   * @param {string} key - Parameter field to modify.
   * @param {any} value - Assigned configuration value.
   */
  setParameter: (key, value) => set({ [key]: value }),
})));
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

// LUKSO mainnet and testnet endpoints
const LUKSO_MAINNET_RPC = "https://rpc.mainnet.lukso.network";
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
  
  // Profile Metadata State Variables
  profileMetadata: null,
  isProfileLoading: false,
  lastFetchedAddress: null, // Tracks the currently active request key to block duplication

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
    get().fetchProfileMetadata();
  },

  /**
   * Queries standard LSP3 Profile Metadata from contract storage keys.
   */
  fetchProfileMetadata: async () => {
    const { hostProfileAddress, publicClient } = get();
    if (!hostProfileAddress || !publicClient) {
      set({ profileMetadata: null, isProfileLoading: false, lastFetchedAddress: null });
      return;
    }

    // Intercept back-to-back triggers for the exact same Profile address
    const lastFetched = get().lastFetchedAddress;
    if (lastFetched && lastFetched.toLowerCase() === hostProfileAddress.toLowerCase()) {
      return; // Deduplicate concurrent execution loop
    }

    set({ isProfileLoading: true, lastFetchedAddress: hostProfileAddress });
    console.log(`ℹ️ [UP Wallet] Querying LSP3 metadata for: ${hostProfileAddress}`);

    try {
      const rpcUrl = publicClient.transport.url || LUKSO_MAINNET_RPC;
      const erc725 = new ERC725(
        lsp3ProfileSchema,
        hostProfileAddress,
        rpcUrl,
        { ipfsGateway: IPFS_GATEWAY }
      );

      const profileData = await erc725.fetchData('LSP3Profile');
      
      if (profileData && profileData.value && profileData.value.LSP3Profile) {
        const rawProfile = profileData.value.LSP3Profile;
        
        // Safe IPFS link parsing helper
        const resolveIpfsLink = (urlStr) => {
          if (!urlStr) return "";
          if (urlStr.startsWith("ipfs://")) {
            return urlStr.replace("ipfs://", IPFS_GATEWAY);
          }
          if (urlStr.startsWith("ipfs/")) {
            return urlStr.replace("ipfs/", IPFS_GATEWAY);
          }
          return urlStr;
        };

        // Extract raw profile assets
        let avatarUrl = "";
        if (rawProfile.profileImage && rawProfile.profileImage.length > 0) {
          avatarUrl = resolveIpfsLink(rawProfile.profileImage[0].url);
        }

        let backgroundUrl = "";
        if (rawProfile.backgroundImage && rawProfile.backgroundImage.length > 0) {
          backgroundUrl = resolveIpfsLink(rawProfile.backgroundImage[0].url);
        }

        const parsedMetadata = {
          name: rawProfile.name || "Anonymous profile",
          description: rawProfile.description || "",
          avatarUrl,
          backgroundUrl,
          tags: rawProfile.tags || [],
          links: rawProfile.links || []
        };

        console.log("✅ [UP Wallet] Metadata queried successfully:", parsedMetadata);
        set({ profileMetadata: parsedMetadata, isProfileLoading: false });
      } else {
        set({ profileMetadata: null, isProfileLoading: false });
      }
    } catch (err) {
      console.warn("⚠️ [UP Wallet] Metadata extraction aborted or failed:", err.message);
      set({ profileMetadata: null, isProfileLoading: false });
    }
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
    await get().fetchProfileMetadata(); // Initiate profile metadata updates
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
