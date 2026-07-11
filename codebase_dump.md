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
import { useStore } from './store/useStore';
import { useWalletStore } from './store/useWalletStore';
import { useArtworkReactions } from './hooks/useArtworkReactions';

function App() {
  const initWallet = useWalletStore((s) => s.initWallet);
  const gameState = useStore((s) => s.gameState);

  // Initialize wallet hooks and postMessage channels
  useEffect(() => {
    initWallet();
  }, [initWallet]);

  // Start the background reaction watcher
  useArtworkReactions();

  return (
    <>
      {/* Mount full-screen flight viewport only when actively descending */}
      {gameState === 'gameplay' && <ArtCanvas />}
      
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
    // Pass raw screen coordinates. PixiEngine converts these into local targets [3].
    if (engineRef.current) {
      engineRef.current.updateMousePos(e.clientX, e.clientY);
    }
  };

  const handleMouseClick = (e) => {
    // Pass click position to drift the character to the destination [3]
    if (engineRef.current) {
      engineRef.current.updateMouseClick(e.clientX, e.clientY);
    }
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      
      {/* PixiJS Container */}
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
import React, { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { useWalletStore } from '../../store/useWalletStore';
import ArtCanvas from '../Canvas/ArtCanvas';
import { PixiEngine } from '../../engine/PixiEngine';
import { Assets, Texture } from 'pixi.js';

// Monkey-patch PixiEngine initialization to inject transparency parameters
// before WebGL context generation occurs in PixiJS v8.
const originalInit = PixiEngine.prototype.init;
PixiEngine.prototype.init = async function() {
  const app = this.app;
  if (app) {
    const originalAppInit = app.init;
    app.init = async function(options) {
      // Force transparent canvas clear-buffers from the start
      const transparentOptions = {
        ...options,
        backgroundAlpha: 0,
        backgroundColor: undefined
      };
      return originalAppInit.call(this, transparentOptions);
    };
  }
  return originalInit.call(this);
};

const originalBuild = PixiEngine.prototype.buildSceneGraph;
PixiEngine.prototype.buildSceneGraph = function() {
  originalBuild.call(this);
  
  if (this.config.gameState === 'gameplay') {
    return;
  }
  
  // Hide background scene assets so the diagnostic interface remains isolated
  if (this.bgAtmosphereContainer) {
    this.bgAtmosphereContainer.visible = false;
  }
  if (this.fgFog && this.fgFog.sprite) {
    this.fgFog.sprite.visible = false;
  }
  if (this.searchlightSystem && this.searchlightSystem.container) {
    this.searchlightSystem.container.visible = false;
  }
};

const originalUpdate = PixiEngine.prototype.update;
PixiEngine.prototype.update = function(deltaTime) {
  originalUpdate.call(this, deltaTime);
  
  if (this.config.gameState === 'gameplay') {
    return;
  }
  
  if (this.searchlightSystem && this.searchlightSystem.container) {
    this.searchlightSystem.container.visible = false;
  }
  
  // Extract theme color variables
  const rTint = this.config.auraColorR ?? 255;
  const gTint = this.config.auraColorG ?? 170;
  const bTint = this.config.auraColorB ?? 60;
  const tintColor = (rTint << 16) + (gTint << 8) + bTint;
  
  const applyTint = (node) => {
    if (node.tint !== undefined) {
      node.tint = tintColor;
    }
    if (node.children) {
      node.children.forEach(applyTint);
    }
  };
  
  if (this.headContainer) {
    applyTint(this.headContainer);
  }
};

const originalResize = PixiEngine.prototype.resize;
PixiEngine.prototype.resize = function() {
  // If in gameplay flight, execute original cover scale layout sizing
  if (this.config && this.config.gameState === 'gameplay') {
    originalResize.call(this);
    return;
  }

  // Otherwise scale and center to fit the terminal items pane bounds
  if (!this.app || !this.app.renderer || !this.masterContainer) return;
  
  const parent = this.container;
  const width = parent ? parent.clientWidth : window.innerWidth;
  const height = parent ? parent.clientHeight : window.innerHeight;
  
  this.app.renderer.resize(width, height);
  const { screen } = this.app;
  
  this.masterContainer.position.set(screen.width / 2, screen.height / 2 + 10);
  
  // FIX: Sourced clipTex from this.assetKeys instead of this.keys to avoid WASD key collisions [3]
  const clipTex = Assets.get(this.assetKeys?.char_clipping_mask) || Assets.get('bg');
  const bgWidth = (clipTex && clipTex !== Texture.EMPTY) ? clipTex.width : 1000;
  const bgHeight = (clipTex && clipTex !== Texture.EMPTY) ? clipTex.height : 1000;

  const scaleX = screen.width / bgWidth;
  const scaleY = screen.height / bgHeight;
  
  const scale = Math.min(scaleX, scaleY);
  this.masterContainer.scale.set(scale * 3.8);

  if (this.masterClipMask) {
    const localW = screen.width / scale;
    const localH = screen.height / scale;
    this.masterClipMask.clear()
      .rect(-localW / 2, -localH / 2, localW, localH)
      .fill({ color: 0xffffff });
  }
};

export default function ControlPanel() {
  // Terminal power state
  const [isEntered, setIsEntered] = useState(false);
  const [isFlickering, setIsFlickering] = useState(false);

  // Tab selections
  const [activeTab, setActiveTab] = useState('items'); // items, stats, quests, misc, radio
  const [activeStatsTab, setActiveStatsTab] = useState('cnd'); // cnd, rad, eff
  const [activeMiscTab, setActiveMiscTab] = useState('misc-1'); // misc-1, misc-2, misc-3

  // Zustand Store variables
  const gameState = useStore((state) => state.gameState);
  const playerHP = useStore((state) => state.playerHP);
  const playerShield = useStore((state) => state.playerShield);
  const gameScore = useStore((state) => state.gameScore);
  const gameActiveWave = useStore((state) => state.gameActiveWave);

  const characterId = useStore((state) => state.characterId);
  const floatSpeed = useStore((state) => state.floatSpeed);
  const warpIntensity = useStore((state) => state.warpIntensity);
  const particleCount = useStore((state) => state.particleCount);
  const aberrationAmount = useStore((state) => state.aberrationAmount);
  const flickerIntensity = useStore((state) => state.flickerIntensity);
  const scanlineOpacity = useStore((state) => state.scanlineOpacity);
  const vignetteOpacity = useStore((state) => state.vignetteOpacity);
  const searchlightActive = useStore((state) => state.searchlightActive);
  const setParameter = useStore((state) => state.setParameter);

  // Web3 Wallet Store variables
  const hostProfileAddress = useWalletStore((state) => state.hostProfileAddress);
  const isWalletConnected = useWalletStore((state) => state.isWalletConnected);

  // Toggle gameplay-active document class to handle CSS transitions and filter bypasses
  useEffect(() => {
    if (isEntered && gameState === 'gameplay') {
      document.documentElement.classList.add('gameplay-active');
    } else {
      document.documentElement.classList.remove('gameplay-active');
    }
  }, [gameState, isEntered]);

  // Handle backlight color updating
  const handleColorChange = (colorValue) => {
    document.documentElement.className = colorValue;

    const colorMaps = {
      amber: { r: 255, g: 170, b: 60 },
      red: { r: 255, g: 40, b: 0 },
      green: { r: 0, g: 230, b: 50 },
      blue: { r: 50, g: 150, b: 255 },
      white: { r: 245, g: 245, b: 245 },
      black: { r: 200, g: 220, b: 250 } // Science!
    };

    const rgb = colorMaps[colorValue] || colorMaps.amber;

    setParameter('auraColorR', rgb.r);
    setParameter('auraColorG', rgb.g);
    setParameter('auraColorB', rgb.b);
    setParameter('searchlightColorR', rgb.r);
    setParameter('searchlightColorG', rgb.g);
    setParameter('searchlightColorB', rgb.b);
    setParameter('fogColorR', rgb.r);
    setParameter('fogColorG', rgb.g);
    setParameter('fogColorB', rgb.b);
  };

  useEffect(() => {
    handleColorChange('amber');
  }, []);

  const handleEnter = () => {
    setIsFlickering(true);
    setTimeout(() => {
      setIsEntered(true);
      setIsFlickering(false);
    }, 1000);
  };

  return (
    <div className={`terminal-wrapper ${gameState === 'gameplay' ? 'gameplay-active' : ''}`}>
      
      <style dangerouslySetInnerHTML={{ __html: `
        /* Fetch full weights from 300 to 700 to enable dense monospace display */
        @import url("https://fonts.googleapis.com/css2?family=Roboto+Mono:ital,wght@0,300..700;1,300..700&display=swap");

        * {
          box-sizing: border-box;
          scrollbar-width: thin;
          scrollbar-color: rgb(var(--alt)) transparent;
        }

        *::-webkit-scrollbar {
          width: 8px;
        }
        *::-webkit-scrollbar-track {
          background: transparent;
        }
        *::-webkit-scrollbar-thumb {
          background-color: rgb(var(--alt));
          border-radius: 0;
        }

        :root {
          --main: 255, 170, 60;
          --alt: 120, 75, 20;
          --black: #12100d;
        }

        .terminal-wrapper {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: #050505;
          display: grid;
          align-content: center;
          margin: 0;
          font-family: "Roboto Mono", monospace;
          font-size: 14px;
          color: rgb(var(--main));
          overflow: hidden;
          z-index: 1000;
          transition: background 0.8s ease;
        }

        /* Bypass the background and let the flight canvas show through */
        .terminal-wrapper.gameplay-active {
          background: transparent !important;
          pointer-events: none;
        }

        /* Ensure HUD and inner active buttons handle pointer clicks */
        .terminal-wrapper.gameplay-active .widescreen-hud {
          pointer-events: auto !important;
        }
        .terminal-wrapper.gameplay-active .widescreen-hud * {
          pointer-events: auto !important;
        }

        .noclick {
          pointer-events: none;
        }

        .piece {
          display: block;
          height: 100%;
          left: 0;
          top: 0;
          width: 100%;
        }

        .frame {
          background-color: transparent;
          border-radius: 30px;
          border: 20px solid;
          border-bottom-color: #0f0e0d;
          border-left-color: #080807;
          border-right-color: #080807;
          border-top-color: #020202;
          box-shadow: inset 0 0 24rem black, inset 0 0 5rem black, 0 0 16rem black;
          pointer-events: none;
          max-width: 950px;
          height: 580px;
          width: 96%;
          max-height: calc(100vh - 20px);
          margin: 0 auto;
          overflow: hidden;
          position: relative;
          min-height: 350px;
          transition: transform 0.8s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.8s ease;
        }

        /* Slide away the bulky Pip-boy frame when gameplay is active */
        .gameplay-active .frame {
          transform: translateY(120%) scale(0.9);
          opacity: 0;
          pointer-events: none;
        }

        /* Widescreen Gameplay HUD */
        .widescreen-hud {
          position: fixed;
          top: 30px;
          left: 50%;
          transform: translateX(-50%);
          width: 90%;
          max-width: 1000px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(18, 16, 13, 0.9);
          border: 1.5px solid rgb(var(--main));
          padding: 15px 30px;
          font-family: "Roboto Mono", monospace;
          font-size: 14px;
          color: rgb(var(--main));
          z-index: 1010;
          box-shadow: 0 0 25px rgba(0, 0, 0, 0.85), inset 0 0 10px rgba(var(--main), 0.1);
          backdrop-filter: blur(8px);
          letter-spacing: 0.05em;
        }

        .hud-metric {
          text-shadow: 0 0 8px currentColor;
        }

        .glow-text {
          font-weight: 700;
        }

        .exit-hud-btn {
          background: transparent;
          border: 1px solid rgb(var(--main));
          color: rgb(var(--main));
          padding: 6px 16px;
          font-family: inherit;
          font-size: 11px;
          cursor: pointer;
          text-transform: uppercase;
          transition: all 0.2s ease;
        }

        .exit-hud-btn:hover {
          background: rgb(var(--main));
          color: #000;
          font-weight: bold;
        }

        /* Complete monochrome filter bypass for gameplay mode */
        .gameplay-active canvas {
          filter: none !important;
        }

        .blinking-btn {
          animation: blink-button-border 1.5s infinite ease-in-out;
        }

        @keyframes blink-button-border {
          0%, 100% { opacity: 1; border-color: rgb(var(--main)); }
          50% { opacity: 0.5; border-color: rgba(var(--main), 0.2); }
        }

        .output {
          animation: crt-output 10ms infinite;
          background-color: var(--black);
          position: absolute;
          padding: 25px 30px;
          pointer-events: auto;
          text-shadow: 0rem 0.1rem 0.6rem currentColor;
          z-index: -1;
          display: flex;
          flex-direction: column;
          justify-content: stretch;
          height: 100%;
          width: 100%;
          overflow: hidden;
        }
        
        .frame * {
          font-weight: normal;
        }

        @keyframes crt-output {
          0% { opacity: 0.94; }
          50% { opacity: 1; }
        }

        .scanlines {
          background: linear-gradient(
            to bottom,
            rgba(255, 255, 255, 0),
            rgba(255, 255, 255, 0) 50%,
            rgba(0, 0, 0, 0.2) 70%,
            rgba(0, 0, 0, 0.45)
          );
          background-size: 100% 0.4rem;
          border-radius: 30px;
          position: absolute;
          z-index: 99;
        }

        .glow {
          animation: crt-glow 60s infinite;
          background: radial-gradient(
            circle at center,
            rgb(var(--main)) 0%,
            rgba(var(--alt), 0.78) 58%,
            rgba(var(--alt), 0.55) 80%,
            rgba(var(--alt), 0.27) 93%,
            rgba(var(--alt), 0) 100%
          );
          opacity: 0.12;
          pointer-events: none;
          position: absolute;
          z-index: 98;
        }

        @keyframes crt-glow {
          0%, 100% { opacity: 0.08; }
          50% { opacity: 0.16; }
        }

        .flicker-active {
          animation: monitor-power-on 0.8s steps(1) infinite !important;
        }

        @keyframes monitor-power-on {
          0%, 100% { background-color: #000000; filter: brightness(1) invert(0); }
          15% { background-color: #ffffff; filter: brightness(3.5) contrast(2); }
          30% { background-color: #12100d; }
          45% { background-color: #ffffff; }
          60% { background-color: #050505; }
          75% { background-color: #ffffff; }
          90% { background-color: #1a1a1a; }
        }

        .boot-screen {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: #1a1a1a;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          cursor: pointer;
          user-select: none;
          z-index: 100;
          padding: 20px;
        }

        /* Cohesive dense-monospace formatting for the landing title */
        .landing-title {
          font-family: "Roboto Mono", monospace;
          font-weight: 700;
          font-size: clamp(1.8rem, 4.8vw, 3.8rem);
          letter-spacing: -0.05em;
          color: rgb(var(--main)) !important;
          margin: 0;
          line-height: 1.1;
          text-transform: uppercase;
          text-align: center;
          text-shadow: 0 0 15px rgba(var(--main), 0.7);
        }

        .landing-subtitle {
          font-family: "Roboto Mono", monospace;
          font-size: clamp(0.8rem, 1.8vw, 1.1rem);
          color: rgba(var(--main), 0.5) !important;
          margin-top: 1.5rem;
          text-transform: uppercase;
          letter-spacing: 0.25em;
          animation: textPulse 1.8s infinite ease-in-out;
          text-align: center;
          text-shadow: 0 0 8px rgba(var(--main), 0.4);
        }

        @keyframes textPulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }

        .pipboy {
          position: relative;
          height: 100%;
          width: 100%;
          border: 3px solid rgb(var(--main));
          border-width: 2px 0;
          padding: 16px;
          z-index: 1;
        }

        .pipboy::before,
        .pipboy::after {
          position: absolute;
          content: "";
          width: 2px;
          height: 100%;
          background: linear-gradient(
            to bottom,
            rgb(var(--main)) 0%,
            rgba(0, 0, 0, 0) 35%,
            rgba(0, 0, 0, 0) 65%,
            rgb(var(--main)) 100%
          );
          top: 0;
        }

        .pipboy::before { left: 0; }
        .pipboy::after { right: 0; }

        .pip-title {
          font-size: 20px;
          font-weight: 900 !important;
          background: none;
          border: none;
          color: rgb(var(--main));
          position: absolute;
          padding: 0 8px;
          text-transform: uppercase;
          top: -15px;
          left: 35px;
          z-index: 2;
          letter-spacing: 0.08em;
        }

        .pip-title::after {
          background: #111;
          content: "";
          height: 3px;
          width: 100%;
          left: 0;
          top: 13px;
          position: absolute;
          z-index: -1;
        }

        .pip-head {
          position: absolute;
          top: 0;
          right: 0;
          width: max-content;
          max-width: 100%;
          text-align: right;
          background: linear-gradient(
            to bottom,
            var(--black) 0%,
            rgba(0, 0, 0, 0) 100%);
          z-index: 1;
        }

        .pip-head li {
          float: left;
          margin-left: 10px;
          padding: 5px 12px;
          min-width: 110px;
          position: relative;
        }
        
        .pip-head li::before {
          content: "";
          position: absolute;
          background: var(--black);
          width: 10px;
          height: 2px;
          top: -2px;
          left: -10px;
        }
        
        .pip-head li::after {
          content: "";
          position: absolute;
          right: 0;
          top: 0;
          height: 100%;
          width: 2px;
          background: linear-gradient(
            to bottom,
            rgb(var(--main)) 0%,
            rgba(0, 0, 0, 0) 100%
          );
        }

        .pip-head li b {
          float: left;
          margin-right: 0.6em;
          font-weight: bold !important;
        }

        .pipboy a, .pipboy label {
          color: inherit;
          text-decoration: none;
          cursor: pointer;
        }

        .pipboy ul {
          margin: 0;
          padding: 0;
          list-style: none;
        }

        .pipboy > .tab-content {
          line-height: 1.25em;
          overflow: hidden;
          display: block;
          height: 100%;
        }

        .pipboy > .tab-content > .tab-pane {
          padding-left: 10px;
          height: 100%;
          overflow-y: auto;
        }

        #items, #stats {
          margin-top: 15px;
        }

        .pip-body {
          position: relative;
          z-index: 0;
          display: flex;
          gap: 15px;
          height: calc(100% - 30px);
        }

        .options {
          display: block;
          width: 280px;
          max-width: 35%;
        }

        .colors {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 5px;
          margin-top: 10px;
        }

        .colors label {
          outline: 1px solid rgb(var(--main));
          padding: 8px 4px;
          text-align: center;
          transition: all 0.1s ease;
          font-size: 11px;
          text-transform: uppercase;
        }

        .options input,
        .colors input {
          position: absolute;
          width: 0;
          height: 0;
          opacity: 0;
          pointer-events: none;
        }

        .options label, .options a {
          display: block;
          padding: 6px 10px 6px 30px;
          margin: 4px 0;
          position: relative;
          outline: 1px solid transparent;
          width: 100%;
          text-transform: uppercase;
          font-size: 13px;
        }

        .frame label:hover, .options a:hover,
        .frame label:focus {
          outline: 2px solid currentColor;
          background: rgba(var(--alt), 0.25);
        }

        .colors input:checked + label {
          color: #000;
          background: rgb(var(--main));
          font-weight: bold;
        }

        .options label::before, .options a::before {
          content: "";
          position: absolute;
          width: 10px;
          height: 10px;
          left: 10px;
          top: 10px;
          outline: 1.5px solid transparent;
        }

        .options label:hover::before, .options a:hover::before {
          outline-color: currentColor;
        }

        .options input:checked + label::before, .options .active a::before {
          background: currentColor;
          outline-color: currentColor;
        }

        .pip-foot {
          display: flex;
          justify-content: space-between;
          position: absolute;
          bottom: -14px;
          width: calc(100% - 60px);
          left: 30px;
          z-index: 10;
        }

        .pip-foot li {
          flex: 1;
        }

        .pip-foot a {
          display: block;
          text-align: center;
          height: 28px;
          line-height: 25px;
          text-transform: uppercase;
          font-size: 13px;
          letter-spacing: 0.05em;
          position: relative;
          border: 1.5px solid transparent;
        }

        .pip-foot a::after {
          content: "";
          position: absolute;
          background: var(--black);
          width: 100%;
          height: 2.5px;
          left: 0;
          bottom: 11px;
          z-index: -1;
        }

        .pip-foot li.active a {
          outline: 2px solid currentColor;
          background: var(--black);
          font-weight: bold !important;
        }

        .pipboy .side-menu {
          width: 75px;
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .side-menu a {
          display: block;
          line-height: 25px;
          padding: 2px 10px;
          text-align: center;
          text-transform: uppercase;
          font-size: 12px;
          border: 1px solid rgba(var(--main), 0.3);
        }

        .side-menu li.active a {
          outline: 2px solid currentColor;
          background: rgba(var(--alt), 0.2);
          font-weight: bold;
        }

        .stats-page {
          flex: 1;
          padding-left: 15px;
        }

        .stats-page h4 {
          border-bottom: 2px solid rgba(var(--main),0.25);
          margin: 0 0 10px 0;
          padding-bottom: 6px;
          text-transform: uppercase;
          font-size: 15px;
        }

        .stats-page li {
          padding: 8px 0;
          border-bottom: 1.5px solid rgba(var(--main),0.2);
        }

        .stats-page .right-options {
          margin-top: 10px;
        }

        .right-options {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 10px;
        }

        .right-options a, .right-options button {
          display: block;
          text-align: left;
          padding: 6px 12px;
          border: 1px solid rgb(var(--main));
          background: transparent;
          color: inherit;
          font-family: inherit;
          text-transform: uppercase;
          font-size: 11px;
          cursor: pointer;
        }

        .right-options a::after, .right-options button::after {
          content: " »";
          float: right;
        }

        .frame .disabled {
          color: rgb(var(--alt));
          pointer-events: none;
          opacity: 0.5;
        }

        .info {
          flex: 1;
          padding-top: 5px;
          display: flex;
          flex-direction: column;
        }

        .right-options {
          display: block;
          float: right;
          padding-right: 1px;
          max-width: 33%;
          white-space: nowrap;
          align-self: flex-end;
          margin-bottom: 15px;
        }

        .right-options a {
          display: block;
          text-align: right;
          padding: 3px 5px;
          margin-bottom: 3px;
        }

        .right-options a::after {
          content: "»";
          padding-left: 5px;
        }

        .info-body {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          height: 100%;
          width: 100%;
          margin-top: 5px;
        }

        .art-canvas-portrait-container {
          width: 100%;
          height: 250px;
          position: relative;
          overflow: hidden;
          background: transparent;
          margin-bottom: 8px;
        }

        /* AGGRESSIVE CSS RULE TO REMOVE ANY OPAQUE BACKGROUND COLORS ACROSS ENTIRE NESTED CHAIN */
        .art-canvas-portrait-container,
        .art-canvas-portrait-container *,
        .art-canvas-portrait-container canvas,
        .art-canvas-portrait-container div {
          background: transparent !important;
          background-color: transparent !important;
          box-shadow: none !important;
          border-color: transparent !important;
        }

        .art-canvas-portrait-container > div {
          width: 100% !important;
          height: 100% !important;
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          overflow: hidden !important;
        }

        /* Prevent secondary scanline filters overlay inside the nested thumbnail box */
        .art-canvas-portrait-container div[style*="mix-blend-mode"] {
          display: none !important;
        }

        .art-canvas-portrait-container canvas {
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
        }

        .info-table {
          margin-top: 0px;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px;
          width: 100%;
        }

        .info-table li {
          border-top: 2px solid;
          padding: 4px 6px;
          font-size: 11px;
          text-align: right;
          position: relative;
        }

        .info-table li b {
          float: left;
          margin-right: 6px;
          font-weight: bold !important;
        }

        .info-table li.span-2 {
          grid-column: span 2;
          text-align: left;
        }

        .condition {
          display: block;
          background: rgba(var(--alt), 0.25);
          float: right;
          height: 12px;
          width: 60px;
          position: relative;
          margin-top: 2px;
        }

        .condition .fill {
          display: block;
          position: absolute;
          left: 0;
          top: 0;
          height: 100%;
          background: rgb(var(--main));
        }

        .extra {
          border-top: 2px solid;
          float: left;
          clear: both;
          width: 100%;
          position: relative;
          padding: 5px 6px;
          margin: 4px 0 0 0;
          padding-left: 15%;
          font-size: 11px;
        }

        .extra b {
          position: absolute;
          left: 6px;
          font-weight: bold !important;
        }

        .info-table li::after,
        .extra::after {
          content: "";
          position: absolute;
          right: 0;
          top: 0;
          height: 100%;
          width: 2px;
          background: linear-gradient(
            to bottom,
            rgb(var(--main)) 0%,
            rgba(0, 0, 0, 0) 100%
          );
        }

        .post {
          line-height: 1.4em;
          font-size: 12px;
          max-height: 150px;
          overflow-y: auto;
          border: 1px solid rgba(var(--main), 0.2);
          padding: 8px;
          background: rgba(0, 0, 0, 0.3);
        }

        .fade-a {
          animation: fade-swap 8s infinite;
          animation-delay: -4s;
        }

        .fade-b {
          position: absolute;
          right: 30px;
          opacity: 0;
          animation: fade-swap 8s infinite;
        }

        @keyframes fade-swap {
          0%, 100% { opacity: 0; color: rgb(var(--alt)); }
          30%, 65% { opacity: 1; color: rgb(var(--main)); }
        }

        .calibration-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          margin-top: 10px;
        }
        .calibration-control {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .calibration-control label {
          font-size: 10px;
          text-transform: uppercase;
          color: rgba(var(--main), 0.7);
        }
        .calibration-control input[type="range"] {
          appearance: none;
          height: 2px;
          background: rgba(var(--main), 0.3);
          outline: none;
          width: 100%;
        }
        .calibration-control input[type="range"]::-webkit-slider-thumb {
          appearance: none;
          width: 10px;
          height: 10px;
          background: rgb(var(--main));
          cursor: pointer;
        }

        .radio-grid {
          display: grid;
          grid-template-columns: 1.2fr 0.8fr;
          gap: 15px;
          width: 100%;
        }

        html.amber { --main: 255,170,60; --alt: 120,75,20; }
        html.white { --main: 245,245,245; --alt: 130,130,130; }
        html.red { --main: 255,40,0; --alt: 160,20,0; }
        html.green { --main: 0,230,50; --alt: 0,160,30; }
        html.blue { --main: 50,150,255; --alt: 20,80,160; }
        html.black { --main: 200,220,250; --alt: 90,100,150; }
      `}} />

      {/* Sleek Widescreen HUD for Gameplay overlay */}
      {isEntered && gameState === 'gameplay' && (
        <div className="widescreen-hud">
          <div className="hud-metric">CND: <span className="glow-text">HP {playerHP}/100</span></div>
          <div className="hud-metric">SHIELD: <span className="glow-text">{playerShield}/100</span></div>
          <div className="hud-metric">WAVE: <span className="glow-text">{gameActiveWave}</span></div>
          <div className="hud-metric">DEPTH: <span className="glow-text">{gameScore}m</span></div>
          <button className="exit-hud-btn" onClick={() => setParameter('gameState', 'menu')}>
            EXIT VOYAGE
          </button>
        </div>
      )}

      <div id="frame" className="frame">
        <div className={`piece output container ${isFlickering ? 'flicker-active' : ''}`}>
          
          {!isEntered ? (
            <div className="boot-screen" onClick={handleEnter}>
              <h1 className="landing-title">UNDERNEATH_OS</h1>
              <p className="landing-subtitle">CLICK TO ENTER_</p>
            </div>
          ) : (
            
            <div className="pipboy">
              <h3 className="pip-title">UNDERNEATH_OS</h3>

              <div className="tab-content">

                {/* ITEMS TAB - Conditionally mounts the items-tab canvas only when activeTab === 'items' [3] */}
                <div className="tab-pane" style={{ display: activeTab === 'items' ? 'block' : 'none', height: '100%' }}>
                  <ul className="pip-head">
                    <li><b>Wg</b> {particleCount}/300</li>
                    <li><b>HP</b> 100/100</li>
                    <li><span className="fade-a"><b>DT</b> 24</span><span className="fade-b"><b>DR</b> 15</span></li>
                    <li><b>Caps</b> {isWalletConnected ? '9999+' : '1721'}</li>
                  </ul>
                  
                  <div className="pip-body">
                    <ul className="options">
                      <li>
                        <input 
                          type="radio" 
                          id="radio1" 
                          name="radio" 
                          checked={characterId === 'skull_reaper'}
                          onChange={() => setParameter('characterId', 'skull_reaper')} 
                        />
                        <label htmlFor="radio1">Skull Reaper</label>
                      </li>
                      <li>
                        <input 
                          type="radio" 
                          id="radio2" 
                          name="radio" 
                          checked={characterId === 'abyssal_eye'}
                          onChange={() => setParameter('characterId', 'abyssal_eye')} 
                        />
                        <label htmlFor="radio2">Abyssal Eye</label>
                      </li>
                      <li>
                        <input 
                          type="checkbox" 
                          id="radio3" 
                          checked={searchlightActive}
                          onChange={(e) => setParameter('searchlightActive', e.target.checked)} 
                        />
                        <label htmlFor="radio3">Beam Rig</label>
                      </li>
                      <li>
                        <input 
                          type="checkbox" 
                          id="radio4" 
                          checked={useStore.getState().autoBlink}
                          onChange={(e) => setParameter('autoBlink', e.target.checked)} 
                        />
                        <label htmlFor="radio4">Auto Blink</label>
                      </li>
                    </ul>

                    <div className="info">
                      <div className="right-options">
                        <a href="#" className="disabled">Maintain</a>
                        <a href="#" onClick={(e) => { e.preventDefault(); setParameter('warpIntensity', warpIntensity === 20 ? 80 : 20); }}>Mod</a>
                      </div>
                      
                      <div className="info-body">
                        
                        {/* Isolated tall portrait box container for 3D model - Only rendered when items tab is selected [3] */}
                        <div className="art-canvas-portrait-container">
                          {gameState === 'menu' && activeTab === 'items' && <ArtCanvas />}
                        </div>
                        
                        <ul className="info-table">
                          <li><b>STR</b> {floatSpeed.toFixed(0)}</li>
                          <li><b>WG</b> {particleCount}</li>
                          <li><b>VAL</b> {characterId === 'skull_reaper' ? '2528' : '4120'}</li>
                          <li className="span-2"><b>CND</b> 
                            <span className="condition">
                              <span className="fill" style={{ width: `${Math.max(10, 100 - flickerIntensity * 100)}%` }}></span>
                            </span>
                          </li>
                        </ul>
                        
                        <p className="extra"><b>MODS</b> Holographic Interface Link</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* STATS TAB */}
                <div className="tab-pane" style={{ display: activeTab === 'stats' ? 'block' : 'none' }}>
                  <ul className="pip-head">
                    <li><b>LVL</b> 11</li>
                    <li><b>HP</b> 100/100</li>
                    <li><b>AP</b> 40/40</li>
                    <li><b>XP</b> 82.4%</li>
                  </ul>

                  <div className="pip-body">
                    <ul className="side-menu">
                      <li className={activeStatsTab === 'cnd' ? 'active' : ''}>
                        <a href="#cnd" onClick={(e) => { e.preventDefault(); setActiveStatsTab('cnd'); }}>CND</a>
                      </li>
                      <li className={activeStatsTab === 'rad' ? 'active' : ''}>
                        <a href="#rad" onClick={(e) => { e.preventDefault(); setActiveStatsTab('rad'); }}>RAD</a>
                      </li>
                      <li className={activeStatsTab === 'eff' ? 'active' : ''}>
                        <a href="#eff" onClick={(e) => { e.preventDefault(); setActiveStatsTab('eff'); }}>EFF</a>
                      </li>
                      <li className="disabled"><a href="#">H2O</a></li>
                      <li className="disabled"><a href="#">FOD</a></li>
                      <li className="disabled"><a href="#">SLP</a></li>
                    </ul>

                    {activeStatsTab === 'cnd' && (
                      <div className="stats-page">
                        <h4>Rig Diagnostics</h4>
                        <div className="post">
                          <p>Core WebGL systems normal. Floating kinematics enabled.</p>
                          <p>Manual Diagnostic Ripple controls are available below to calibrate portal shockwaves:</p>
                        </div>
                        <div className="right-options">
                          <button onClick={() => window.simulateGothicEvent && window.simulateGothicEvent('lyx_received')}>
                            Trigger LYX shockwave
                          </button>
                          <button onClick={() => window.simulateGothicEvent && window.simulateGothicEvent('lsp8_received')}>
                            Trigger NFT shockwave
                          </button>
                        </div>
                      </div>
                    )}

                    {activeStatsTab === 'rad' && (
                      <div className="stats-page">
                        <h4>Universal Connection</h4>
                        <ul>
                          <li><b>Connection Status:</b> {isWalletConnected ? 'CONNECTED' : 'OFFLINE'}</li>
                          <li style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            <b>Universal Profile:</b> {hostProfileAddress || 'NO PROFILE BOUND'}
                          </li>
                          <li><b>LSP1 Event Watcher:</b> Active</li>
                        </ul>
                      </div>
                    )}

                    {activeStatsTab === 'eff' && (
                      <div className="stats-page">
                        <h4>Active Effects</h4>
                        <ul>
                          <li><b>Kinematic Drift:</b> Height sway of {useStore.getState().floatAmpY}px</li>
                          <li><b>Atmospheric Shards:</b> Particle rate set to {particleCount}</li>
                          <li><b>Volumetric Beams:</b> Orbit boundaries normal</li>
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {/* QUESTS TAB - Updated Chapter 1 catacomb descent objective and initiate descent voyage button */}
                <div className="tab-pane" style={{ display: activeTab === 'quests' ? 'block' : 'none' }}>
                  <div className="pip-body" style={{ width: '100%' }}>
                    <ul className="options" style={{ width: '30%' }}>
                      <li className="active"><a href="#">Active Signals</a></li>
                      <li className="disabled"><label>// No other signals</label></li>
                    </ul>
                    <div style={{ flex: 1, paddingLeft: '15px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <h4 style={{ textTransform: 'uppercase', borderBottom: '2px solid rgba(var(--main), 0.25)', paddingBottom: '6px', margin: 0 }}>
                        CHAPTER 1: CATACOMB DESCENT
                      </h4>
                      <div className="post" style={{ maxHeight: '110px', overflowY: 'auto', margin: 0 }}>
                        <p><b>ENVIRONMENT OBJECTIVE:</b> Float down into the ancient sub-cavern passages of LUKSO. Pilot the mechanical skull using <b style={{ color: 'rgb(var(--main))' }}>W-A-S-D</b> or <b style={{ color: 'rgb(var(--main))' }}>ARROWS</b>. Dodge incoming cavern borders and monitor your shield status.</p>
                        <p style={{ marginTop: '6px', color: 'rgba(var(--main), 0.6)' }}>
                          Descent kinematics calibrated. Connect your Web3 UP extension to align tactical sensory data.
                        </p>
                      </div>
                      
                      <button 
                        onClick={() => setParameter('gameState', 'gameplay')}
                        className="blinking-btn"
                        style={{
                          alignSelf: 'flex-start',
                          background: 'transparent',
                          border: '1.5px solid rgb(var(--main))',
                          color: 'rgb(var(--main))',
                          padding: '8px 18px',
                          fontFamily: 'inherit',
                          fontSize: '11px',
                          textTransform: 'uppercase',
                          cursor: 'pointer',
                          marginTop: '4px'
                        }}
                      >
                        INITIATE DESCENT VOYAGE ▾
                      </button>
                    </div>
                  </div>
                </div>

                {/* MISC TAB */}
                <div className="tab-pane" style={{ display: activeTab === 'misc' ? 'block' : 'none' }}>
                  <div className="pip-body" style={{ width: '100%', flexDirection: 'column' }}>
                    
                    <div style={{ display: 'flex', gap: '10px', borderBottom: '1.5px solid rgba(var(--main), 0.2)', paddingBottom: '5px' }}>
                      <button 
                        onClick={() => setActiveMiscTab('misc-1')}
                        style={{ 
                          background: activeMiscTab === 'misc-1' ? 'rgb(var(--main))' : 'transparent',
                          color: activeMiscTab === 'misc-1' ? '#000' : 'inherit',
                          border: '1px solid rgb(var(--main))',
                          padding: '4px 10px', textTransform: 'uppercase', fontSize: '11px', cursor: 'pointer'
                        }}
                      >
                        Color Calibration
                      </button>
                      <button 
                        onClick={() => setActiveMiscTab('misc-2')}
                        style={{ 
                          background: activeMiscTab === 'misc-2' ? 'rgb(var(--main))' : 'transparent',
                          color: activeMiscTab === 'misc-2' ? '#000' : 'inherit',
                          border: '1px solid rgb(var(--main))',
                          padding: '4px 10px', textTransform: 'uppercase', fontSize: '11px', cursor: 'pointer'
                        }}
                      >
                        Environmental Tuning
                      </button>
                    </div>

                    {activeMiscTab === 'misc-1' && (
                      <div style={{ marginTop: '10px' }}>
                        <p style={{ fontSize: '12px' }}>SELECT HUD / VOLUMETRIC BACKLIGHT COLOR:</p>
                        <form className="colors" onChange={(e) => handleColorChange(e.target.value)}>
                          <input id="b-amber" type="radio" name="colors" value="amber" defaultChecked />
                          <label htmlFor="b-amber">Amber</label>
                          <input id="b-red" type="radio" name="colors" value="red" />
                          <label htmlFor="b-red">Red</label>
                          <input id="b-green" type="radio" name="colors" value="green" />
                          <label htmlFor="b-green">Green</label>
                          <input id="b-blue" type="radio" name="colors" value="blue" />
                          <label htmlFor="b-blue">Blue</label>
                          <input id="b-white" type="radio" name="colors" value="white" />
                          <label htmlFor="b-white">White</label>
                          <input id="b-black" type="radio" name="colors" value="black" />
                          <label htmlFor="b-black">Science!</label>
                        </form>
                      </div>
                    )}

                    {activeMiscTab === 'misc-2' && (
                      <div className="calibration-grid">
                        <div className="calibration-control">
                          <label>Dust Intensity ({particleCount})</label>
                          <input 
                            type="range" 
                            min="0" max="300" step="10" 
                            value={particleCount} 
                            onChange={(e) => setParameter('particleCount', parseInt(e.target.value))}
                          />
                        </div>
                        <div className="calibration-control">
                          <label>Vignette Shadow ({vignetteOpacity.toFixed(2)})</label>
                          <input 
                            type="range" 
                            min="0" max="1" step="0.05" 
                            value={vignetteOpacity} 
                            onChange={(e) => setParameter('vignetteOpacity', parseFloat(e.target.value))}
                          />
                        </div>
                        <div className="calibration-control">
                          <label>Scanline Filter ({scanlineOpacity.toFixed(2)})</label>
                          <input 
                            type="range" 
                            min="0" max="1" step="0.05" 
                            value={scanlineOpacity} 
                            onChange={(e) => setParameter('scanlineOpacity', parseFloat(e.target.value))}
                          />
                        </div>
                        <div className="calibration-control">
                          <label>Warp Velocity ({useStore.getState().warpSpeed.toFixed(1)})</label>
                          <input 
                            type="range" 
                            min="0.1" max="5" step="0.1" 
                            value={useStore.getState().warpSpeed} 
                            onChange={(e) => setParameter('warpSpeed', parseFloat(e.target.value))}
                          />
                        </div>
                      </div>
                    )}

                  </div>
                </div>

                {/* RADIO TAB */}
                <div className="tab-pane" style={{ display: activeTab === 'radio' ? 'block' : 'none' }}>
                  <div className="pip-body">
                    <div className="radio-grid">
                      <ul className="options">
                        <li>
                          <input type="checkbox" id="check-hum" defaultChecked />
                          <label htmlFor="check-hum">00_ambient_hum</label>
                        </li>
                        <li className="disabled"><label>// Mojave Static</label></li>
                      </ul>
                      <div className="info">
                        <div className="post">
                          <pre style={{ fontFamily: 'monospace', fontSize: '9px', lineHeight: '1.1em' }}>
{` ______   ______  _____  __   _ _______   _______ _______
 |     \ |_____/ |     | | \  | |______   |______ |  |  |
 |_____/ |    \_ |_____| |  \_| |______ . |       |  |  |
                                                         `}
                          </pre>
                          <p style={{ marginTop: '10px', fontSize: '11px' }}>Frequency tuned to low range cosmic static hum.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              <ul className="pip-foot">
                <li className={activeTab === 'items' ? 'active' : ''}>
                  <a href="#items" onClick={(e) => { e.preventDefault(); setActiveTab('items'); }}>Items</a>
                </li>
                <li className={activeTab === 'stats' ? 'active' : ''}>
                  <a href="#stats" onClick={(e) => { e.preventDefault(); setActiveTab('stats'); }}>Stats</a>
                </li>
                <li className={activeTab === 'quests' ? 'active' : ''}>
                  <a href="#quests" onClick={(e) => { e.preventDefault(); setActiveTab('quests'); }}>Quests</a>
                </li>
                <li className={activeTab === 'misc' ? 'active' : ''}>
                  <a href="#misc" onClick={(e) => { e.preventDefault(); setActiveTab('misc'); }}>Misc</a>
                </li>
                <li className={activeTab === 'radio' ? 'active' : ''}>
                  <a href="#radio" onClick={(e) => { e.preventDefault(); setActiveTab('radio'); }}>Radio</a>
                </li>
              </ul>

            </div>
          )}

        </div>

        <div className="piece glow noclick"></div>
        <div className="piece scanlines noclick"></div>
      </div>

    </div>
  );
}
```

---
### `src\components\UI\DialogueOverlay.jsx`
```javascript
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
import { Filter, defaultFilterVert, UniformGroup } from 'pixi.js';
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
      warpUniforms: new UniformGroup({
        uTime: { value: 0.0, type: 'f32' },
        uWarpIntensity: { value: initialIntensity, type: 'f32' }
      }, false, true) // isStatic = false, isUbo = true
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
  Graphics
} from 'pixi.js';
import { useStore } from '../store/useStore.js';
import { EffectsSystem } from './systems/EffectsSystem.js';
import { ParticleSystem } from './systems/ParticleSystem.js';
import { EyeSystem } from './systems/EyeSystem.js';
import { FogSystem } from './systems/FogSystem.js';
import { RenderTextureManager } from './systems/RenderTextureManager.js';
import { MirroredScrollLayer } from './systems/MirroredScrollLayer.js';
import { AssetResolver } from './assets/AssetResolver.js';
import { FlightDynamics } from './systems/FlightDynamics.js';
import { ShockwaveSystem } from './systems/ShockwaveSystem.js';
import { TrailSystem } from './systems/TrailSystem.js';
import { SearchlightSystem } from './systems/SearchlightSystem.js';

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

    // Direct canvas DOM reference cache to prevent nullified getter calls on destroy
    this.canvasElement = null;

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
    
    // Decoupled keys mapping: this.assetKeys preserves assets loading references while
    // this.keys processes WASD & Arrow keyboard coordinate flight tracking safely
    this.assetKeys = {}; 
    this.keys = { 
      KeyW: false, 
      KeyA: false, 
      KeyS: false, 
      KeyD: false, 
      ArrowUp: false, 
      ArrowDown: false, 
      ArrowLeft: false, 
      ArrowRight: false 
    };

    // Phase 2C Custom Speed Parameter
    this.playerSpeed = 500; // Modify this value to adjust character WASD movement speed

    // Phase 2B & 2C: Weapon, Swarm Mechanics, Particles & Progression Variables
    this.playerProjectiles = [];
    this.enemies = [];
    this.impactParticles = [];
    
    this.recoilOffset = { x: 0, y: 0 };
    this.recoilGlitch = 0.0;
    this.lastSpawnTime = 0;

    this.enemySpawnTimer = 0.0;
    this.spawnInterval = 1.8; // Base interval in seconds
    
    this.enemiesSpawnedInWave = 0;
    this.totalEnemiesToSpawnInWave = 0;
    this.enemiesDefeatedInWave = 0;
    
    this.isWaveTransitionActive = false;
    this.waveTransitionTimer = 0.0;

    // Phase 2C Mouse Button holding state trackers
    this.isPointerDown = false;
    this.pointerPosition = { x: 0, y: 0 };
    this.fireCooldown = 0.0;

    // Systems Allocation
    this.effectsSystem = new EffectsSystem();
    this.eyeSystem = null;
    this.particleSystem = null;
    this.renderTextureManager = null;
    this.bgFog = null;
    this.fgFog = null;
    
    // Subsystem Coordinators
    this.flightDynamics = new FlightDynamics();
    this.shockwaveSystem = null;
    this.trailSystem = null;
    this.searchlightSystem = null;

    this.lastGlitchPeak = false;

    // Double Mouse Tracker: Separate absolute screen-coords and normalized [-1, 1] scales
    this.absoluteMousePos = { x: 0, y: 0 };
    this.normalizedMousePos = { x: 0, y: 0 };

    // Spring Drift Navigation State Variables
    this.baselinePosition = { x: 0, y: 0 };   // The floating anchor position
    this.targetPosition = { x: 0, y: 0 };     // The destination coordinates set on click
    this.isMovingToTarget = false;            // Movement status flag
    this.facingDirection = 1.0;               // Target flip direction (1.0 = right, -1.0 = left)
    this.currentFlipScale = 1.0;              // Smoothly interpolated flip scale ratio

    this.config = { ...useStore.getState() };

    // Setup clear window key event listeners
    this.handleKeyDown = (e) => {
      if (e.code in this.keys) {
        this.keys[e.code] = true;
      }
    };

    this.handleKeyUp = (e) => {
      if (e.code in this.keys) {
        this.keys[e.code] = false;
      }
    };

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);

    // Native mouse/pointer event listeners to support seamless auto-firing on hold
    this.handlePointerDown = (e) => {
      this.isPointerDown = true;
      this.pointerPosition = { x: e.clientX, y: e.clientY };
    };

    this.handlePointerUp = () => {
      this.isPointerDown = false;
    };

    this.handlePointerMove = (e) => {
      this.pointerPosition = { x: e.clientX, y: e.clientY };
    };

    this.unsubscribeStore = useStore.subscribe((state) => {
      const prevChar = this.config.characterId;
      const prevBgClip = this.config.bgClippingMaskId;
      const prevBgStyle = this.config.bgPatternStyle;
      const prevBgMountain = this.config.bgMountainId;
      const prevBgMountainBack = this.config.bgMountainBackId;
      const prevGameState = this.config.gameState;

      const prevReaction = this.config.activeReaction;
      const nextReaction = state.activeReaction;
      const prevProgress = this.config.reactionProgress;
      const nextProgress = state.reactionProgress;

      this.config = state;

      // Detect transaction start or restart trigger signals
      if (nextReaction !== null && (prevReaction !== nextReaction || nextProgress === 1.0)) {
        this.startLocalReaction(nextReaction);
      }

      // Check transition states for gameplay mode shifts
      if (prevGameState !== state.gameState) {
        this.handleGameStateTransition(state.gameState);
      }

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

  /**
   * Orchestrates visual parameters and assets visibility changes between menu and descent flight viewports.
   */
  handleGameStateTransition(gameState) {
    const setParameter = useStore.getState().setParameter;

    if (gameState === "gameplay") {
      this.isMovingToTarget = false;

      // Reset coordinates to clear old arrays [3]
      this.clearGameplayObjects();

      // Reset Player Statistics
      setParameter("playerHP", 100);
      setParameter("playerShield", 100);
      setParameter("gameScore", 0);
      setParameter("gameActiveWave", 1);

      // Compute total spawning thresholds for Chapter 1
      this.enemiesSpawnedInWave = 0;
      this.enemiesDefeatedInWave = 0;
      this.totalEnemiesToSpawnInWave = 5; 
      this.isWaveTransitionActive = false;
      this.waveTransitionTimer = 0.0;

      // Pivot mechanical skull to a left-side offset starting position scaled appropriately
      const screenWidth = this.app.screen.width;
      const currentScale = this.masterContainer?.scale.x || 1.0;
      const localLeftX = -(screenWidth * 0.35) / currentScale;

      this.baselinePosition = { x: localLeftX, y: 0 };
      this.recoilOffset = { x: 0, y: 0 };
      this.facingDirection = 1.0;
      this.currentFlipScale = 1.0;

      // Transition to fast active flight scrolling velocity
      setParameter("bgScrollSpeed", 220.0);

      // Restore cavern background elements
      if (this.bgAtmosphereContainer) {
        this.bgAtmosphereContainer.visible = true;
      }
      if (this.searchlightSystem) {
        this.searchlightSystem.setActive(this.config.searchlightActive);
      }
      if (this.bgFog && this.bgFog.sprite) {
        this.bgFog.sprite.visible = true;
      }
      if (this.fgFog && this.fgFog.sprite) {
        this.fgFog.sprite.visible = true;
      }
    } else if (gameState === "menu") {
      this.baselinePosition = { x: 0, y: 0 };
      this.recoilOffset = { x: 0, y: 0 };
      this.facingDirection = 1.0;
      this.currentFlipScale = 1.0;

      this.isPointerDown = false;

      // Revert to slow background idle scroll speed
      setParameter("bgScrollSpeed", 30.0);

      // Cleanly prune active gameplay arrays
      this.clearGameplayObjects();

      // Cleanly isolate character view inside the terminal
      if (this.bgAtmosphereContainer) {
        this.bgAtmosphereContainer.visible = false;
      }
      if (this.searchlightSystem) {
        this.searchlightSystem.setActive(false);
      }
      if (this.bgFog && this.bgFog.sprite) {
        this.bgFog.sprite.visible = false;
      }
      if (this.fgFog && this.fgFog.sprite) {
        this.fgFog.sprite.visible = false;
      }
    }
  }

  /**
   * Tracks target coordinates relative to the active canvas bounding dimensions.
   */
  updateMousePos(localX, localY, canvasWidth, canvasHeight) {
    const w = canvasWidth || window.innerWidth;
    const h = canvasHeight || window.innerHeight;

    this.absoluteMousePos.x = localX;
    this.absoluteMousePos.y = localY;

    // Normalize coordinates relative to local canvas dimensions to keep pupil tracking stable [3]
    this.normalizedMousePos.x = (localX / w) * 2 - 1;
    this.normalizedMousePos.y = (localY / h) * 2 - 1;
  }

  /**
   * Fires weapon structures when user interaction click events occur.
   */
  updateMouseClick(localX, localY) {
    if (this.config.gameState === 'gameplay') {
      this.spawnProjectile(localX, localY);
    }
  }

  /**
   * Spawns a physical tracer round from orbital coordinate positions towards the screen cursor.
   * Modulates a transient recoil offset to execute spring-back mechanical kickbacks and brief visual glitch flashes.
   */
  spawnProjectile(clientX, clientY) {
    const now = Date.now();
    // Debounce to safeguard against overlapping browser click dispatch threads
    if (now - this.lastSpawnTime < 15) return;
    this.lastSpawnTime = now;

    if (!this.masterContainer || !this.headContainer || !this.isReady) return;

    // Translate global screen interaction points to local coordinates inside master container bounds [3]
    const localTarget = this.masterContainer.toLocal({ x: clientX, y: clientY });
    const localCenter = this.headContainer.position;

    const dx = localTarget.x - localCenter.x;
    const dy = localTarget.y - localCenter.y;
    const angle = Math.atan2(dy, dx);

    // Retrieve active orbital tracking radius [3]
    const orbitRadius = this.config.searchlightRadius ?? 110;

    // Calculate spawning position matching searchlight base on orbital perimeter bounds
    const startX = localCenter.x + Math.cos(angle) * orbitRadius;
    const startY = localCenter.y + Math.sin(angle) * orbitRadius;

    // Memoize the high-visibility tracer texture [3]
    if (!SearchlightSystem.tracerTexture) {
      SearchlightSystem.tracerTexture = SearchlightSystem.generateTracerTexture();
    }

    const bullet = new Sprite(SearchlightSystem.tracerTexture);
    bullet.anchor.set(0.5, 0.5);
    bullet.position.set(startX, startY);
    bullet.rotation = angle; // Symmetrically align bullet rotation around its center

    // Add directly to masterContainer to inherit global stage scaling and remain visible
    this.masterContainer.addChild(bullet);

    // Solid, visible velocity rate: 950 pixels per second
    this.playerProjectiles.push({
      sprite: bullet,
      vx: Math.cos(angle) * 950,
      vy: Math.sin(angle) * 950
    });

    // Apply recoil kickback force directly to transient recoilOffset (recoil force of 12px)
    this.recoilOffset.x -= Math.cos(angle) * 12;
    this.recoilOffset.y -= Math.sin(angle) * 12;

    // Single-frame CRT electromagnetic distortion spike mimicking muzzle flash
    this.recoilGlitch = 10.0;
  }

  /**
   * Spawns spark particle groups representing bullet impacts or hostile destructions.
   * @param {number} x - Local coordinate horizontal center.
   * @param {number} y - Local coordinate vertical center.
   * @param {number} count - Total particle dots to instantiate.
   * @param {boolean} isExplosion - Flag denoting if a larger, slower flame orange blast occurs.
   */
  spawnSparks(x, y, count, isExplosion = false) {
    for (let i = 0; i < count; i++) {
      const spark = new Graphics()
        .circle(0, 0, isExplosion ? Math.random() * 4 + 2 : Math.random() * 3 + 1)
        .fill({ color: isExplosion ? 0xff4d00 : 0xffaa00 });
      
      spark.position.set(x, y);

      const angle = Math.random() * Math.PI * 2;
      const velocity = isExplosion ? Math.random() * 260 + 100 : Math.random() * 180 + 80;

      this.masterContainer.addChild(spark);
      
      this.impactParticles.push({
        graphic: spark,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        alpha: 1.0,
        life: isExplosion ? 0.6 : 0.4,
        maxLife: isExplosion ? 0.6 : 0.4
      });
    }
  }

  /**
   * Cleanly prunes and destroys active projectiles.
   */
  clearProjectiles() {
    if (this.playerProjectiles && this.playerProjectiles.length > 0) {
      this.playerProjectiles.forEach(proj => {
        if (proj.sprite) {
          if (this.masterContainer) {
            this.masterContainer.removeChild(proj.sprite);
          }
          proj.sprite.destroy();
        }
      });
      this.playerProjectiles = [];
    }
  }

  /**
   * Clears and destroys active gameplay entities, particles, and swarm components safely.
   */
  clearGameplayObjects() {
    this.clearProjectiles();

    if (this.enemies && this.enemies.length > 0) {
      this.enemies.forEach(enemy => {
        if (enemy.sprite) {
          if (this.masterContainer) {
            this.masterContainer.removeChild(enemy.sprite);
          }
          enemy.sprite.destroy();
        }
      });
      this.enemies = [];
    }

    if (this.impactParticles && this.impactParticles.length > 0) {
      this.impactParticles.forEach(part => {
        if (part.graphic) {
          if (this.masterContainer) {
            this.masterContainer.removeChild(part.graphic);
          }
          part.graphic.destroy();
        }
      });
      this.impactParticles = [];
    }

    this.enemiesSpawnedInWave = 0;
    this.enemiesDefeatedInWave = 0;
    this.isWaveTransitionActive = false;
    this.waveTransitionTimer = 0.0;
    this.isPointerDown = false;
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

      // Cache a direct reference to the canvas element before unmount cycles occur
      this.canvasElement = this.app.canvas;

      this.container.appendChild(this.canvasElement);

      // Setup native canvas-level pointer down continuous auto-firing listeners on the cached element
      this.canvasElement.addEventListener('pointerdown', this.handlePointerDown);
      window.addEventListener('pointerup', this.handlePointerUp);
      this.canvasElement.addEventListener('pointermove', this.handlePointerMove);
      
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
      console.error("Failed to boot PixiEngine:", err);
    }
  }

  async loadAssets() {
    console.log(`%c🔍 [PixiEngine] Rig Loader: Locating Stage Assets`, 'color: #00f3ff; font-weight: bold;');
    
    const results = await AssetResolver.resolveRig(this.config);
    
    this.assetKeys = results.keys;
    this.hasBgClippingMask = results.hasBgClippingMask;
    this.hasBgPat1 = results.hasBgPat1;
    this.hasBgPat2 = results.hasBgPat2;
    this.hasBgMountain = results.hasBgMountain;
    this.hasBgMountainBack = results.hasBgMountainBack;
    this.hasCharClippingMask = results.hasCharClippingMask;
    this.hasLineart = results.hasLineart;
    this.hasEyelids = results.hasEyelids;
    this.isPanoramaMode = results.isPanoramaMode;
    this.hasBg2 = results.hasBg2;
    this.discoveredPatterns = results.discoveredPatterns;
    this.discoveredEyes = results.discoveredEyes;

    if (results.verifiedLoadQueue.length > 0) {
      try {
        await Assets.load(results.verifiedLoadQueue);
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

    let clipTex = Assets.get(this.assetKeys.char_clipping_mask);
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

    // Initialise Shockwave System
    this.shockwaveSystem = new ShockwaveSystem();

    // Initialize the off-screen RenderTextureManager to flatten warp patterns
    this.renderTextureManager = new RenderTextureManager({
      discoveredPatterns: this.discoveredPatterns,
      bgPat1Alias: this.hasBgPat1 ? this.assetKeys.bg_pat_1 : null,
      bgPat2Alias: this.hasBgPat2 ? this.assetKeys.bg_pat_2 : null,
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
        this.layers.bg_clip = createSprite(this.assetKeys.bg_clipping_mask);
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
        const mountainBackTex = Assets.get(this.assetKeys.bg_mountain_back);
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
        const mountainTex = Assets.get(this.assetKeys.bg_mountain);
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
    
    // Initialise Ghost Coordinates System
    this.trailSystem = new TrailSystem(this.masterContainer, this.hasCharClippingMask ? this.assetKeys.char_clipping_mask : null);

    // Initialize Volumetric Searchlight System
    this.searchlightSystem = new SearchlightSystem(this.masterContainer);
    this.searchlightSystem.isActiveOverride = true;
    this.searchlightSystem.setActive = (active) => {
      this.searchlightSystem.isActiveOverride = active;
      if (this.searchlightSystem.container) {
        this.searchlightSystem.container.visible = active;
      }
    };

    // 2. Head Container
    this.headContainer = new Container();
    this.masterContainer.addChild(this.headContainer);

    // Blurry shadow glow container (renders underneath head lineart/features)
    if (this.hasCharClippingMask) {
      this.layers.aura = createSprite(this.assetKeys.char_clipping_mask);
      this.headContainer.addChild(this.layers.aura);
    }

    // Nested composition to decouple filters from the mask sprite
    if (this.hasCharClippingMask) {
      // The mask sprite (must be set as renderable=false so it does not draw as a solid colored block)
      const charMaskSprite = createSprite(this.assetKeys.char_clipping_mask);
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
      this.layers.base = createSprite(this.assetKeys.char_clipping_mask);
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
      this.layers.lineart = createSprite(this.assetKeys.char_lineart);
      this.headContainer.addChild(this.layers.lineart);
    }

    // Render eyeballs and lids
    this.eyeSystem = new EyeSystem(this.headContainer, {
      discoveredEyes: this.discoveredEyes,
      hasEyelids: this.hasEyelids,
      eyelidsTopAlias: this.hasEyelids ? this.assetKeys.eyelids_top : null,
      eyelidsBottomAlias: this.hasEyelids ? this.assetKeys.eyelids_bottom : null
    });

    // Decoupled Foreground Fog Layer (placed on top of character but below overlays)
    this.fgFog = new FogSystem(this.masterContainer, this.bgHeightScale, true);

    // Call the game state handler to establish initial isolated scenery visibility settings correctly
    this.handleGameStateTransition(this.config.gameState);
  }

  update(deltaTime) {
    if (!this.isReady) return;
    const dtSeconds = deltaTime / 60;
    this.time += dtSeconds;

    const screenWidth = this.app.screen.width;
    const screenHeight = this.app.screen.height;
    const currentScale = this.masterContainer.scale.x;

    // Smoothly decay transient recoil offset back to zero on every frame
    this.recoilOffset.x += (0 - this.recoilOffset.x) * 0.15 * deltaTime;
    this.recoilOffset.y += (0 - this.recoilOffset.y) * 0.15 * deltaTime;

    // --- Phase 2: Internal Reaction Decay Step ---
    if (this.currentLocalReaction && this.originalPreset) {
      this.localReactionProgress -= 0.007 * deltaTime;

      if (this.localReactionProgress <= 0) {
        this.localReactionProgress = 0;
        this.currentLocalReaction = null;
        this.originalPreset = null;

        // Reset the store values once when the decay concludes
        const setParameter = useStore.getState().setParameter;
        setParameter("activeReaction", null);
        setParameter("reactionProgress", 0.0);
      } else {
        // Sync progress dynamically to the store so the Tab indicator updates
        useStore.getState().setParameter("reactionProgress", this.localReactionProgress);
      }
    }

    // --- Active Gameplay Flight Navigation vs. Spring Menu Drift ---
    // --- Active Gameplay Flight Navigation vs. Spring Menu Drift ---
    if (this.config.gameState === "gameplay") {
      // WASD / Arrow keyboard vector mapping utilizing custom speed parameter
      const speed = this.playerSpeed * dtSeconds;
      let moveX = 0;
      let moveY = 0;

      if (this.keys.KeyW || this.keys.ArrowUp) moveY -= 1;
      if (this.keys.KeyS || this.keys.ArrowDown) moveY += 1;
      if (this.keys.KeyA || this.keys.ArrowLeft) moveX -= 1;
      if (this.keys.KeyD || this.keys.ArrowRight) moveX += 1;

      // Normalize diagonal vectors to prevent speed boosting mechanics
      if (moveX !== 0 && moveY !== 0) {
        const length = Math.sqrt(moveX * moveX + moveY * moveY);
        moveX /= length;
        moveY /= length;
      }

      this.baselinePosition.x += moveX * speed;
      this.baselinePosition.y += moveY * speed;

      const localHalfW = (screenWidth / currentScale) / 2;
      const localHalfH = (screenHeight / currentScale) / 2;

      // Clamp coordinates to allow movement across the complete width / canvas height
      const minX = -localHalfW + 60;
      const maxX = localHalfW - 60; // Expanded to full screen boundary width

      const minY = -localHalfH + 60; // Expanded to full screen boundary height
      const maxY = localHalfH - 60;

      this.baselinePosition.x = Math.max(minX, Math.min(maxX, this.baselinePosition.x));
      this.baselinePosition.y = Math.max(minY, Math.min(maxY, this.baselinePosition.y));

      // Dynamically flip character based on relative cursor position to head container
      const localMouse = this.masterContainer.toLocal({ x: this.absoluteMousePos.x, y: this.absoluteMousePos.y });
      this.facingDirection = localMouse.x >= this.headContainer.position.x ? 1.0 : -1.0;
      this.currentFlipScale += (this.facingDirection - this.currentFlipScale) * 0.2 * deltaTime;
    } else {
      // Menu Mode: Force stationary central positioning inside terminal items window
      this.baselinePosition.x = 0;
      this.baselinePosition.y = 0;

      // Smooth 3D rotational flipping based on mouse hover position
      this.facingDirection = this.normalizedMousePos.x >= 0 ? 1.0 : -1.0;
      this.currentFlipScale += (this.facingDirection - this.currentFlipScale) * 0.2 * deltaTime;
    }

    // Synthesize latest coordinates dynamically so that EyeSystem and nested modules receive updates
    const config = { ...this.config, mousePos: this.normalizedMousePos };

    // Continuous weapon auto-firing when holding down the mouse button
    if (this.fireCooldown > 0) {
      this.fireCooldown -= dtSeconds;
    }
    if (config.gameState === "gameplay" && this.isPointerDown && this.fireCooldown <= 0) {
      this.spawnProjectile(this.pointerPosition.x, this.pointerPosition.y);
      this.fireCooldown = 0.18; // Fires continuous stream at comfortable 180ms intervals
    }

    // Apply recoil muzzle flash distortion spikes
    if (this.recoilGlitch > 0) {
      config.aberrationAmount += this.recoilGlitch;
      this.recoilGlitch = 0; // Return to standard settings immediately on the next frame
    }

    // Apply internal decay overrides over baseline configurations
    if (this.currentLocalReaction && this.originalPreset) {
      const invProgress = this.localReactionProgress;

      if (this.currentLocalReaction === "lyx_received") {
        config.particleCount = Math.floor(this.originalPreset.particleCount + (300 - this.originalPreset.particleCount) * invProgress);
        config.particleSpeed = this.originalPreset.particleSpeed + (4.5 - this.originalPreset.particleSpeed) * invProgress;
        config.auraOpacity = this.originalPreset.auraOpacity + (1.0 - this.originalPreset.auraOpacity) * invProgress;
        config.auraScale = this.originalPreset.auraScale + (1.35 - this.originalPreset.auraScale) * invProgress;
        config.warpIntensity = this.originalPreset.warpIntensity + (50.0 - this.originalPreset.warpIntensity) * invProgress;
      } 
      else if (this.currentLocalReaction === "lsp7_received" || this.currentLocalReaction === "lsp8_received") {
        config.aberrationAmount = this.originalPreset.aberrationAmount + (30.0 - this.originalPreset.aberrationAmount) * invProgress;
        config.warpIntensity = this.originalPreset.warpIntensity + (90.0 - this.originalPreset.warpIntensity) * invProgress;
        config.glitchShakeIntensity = Math.floor(this.originalPreset.glitchShakeIntensity + (25 - this.originalPreset.glitchShakeIntensity) * invProgress);
        config.flickerIntensity = this.originalPreset.flickerIntensity + (0.85 - this.originalPreset.flickerIntensity) * invProgress;
        
        config.aberrationSpeed = 8.0;
        config.aberrationGlitch = 0;
      }
    }

    config.reactionProgress = this.localReactionProgress;

    const { isGlitched, currentSplit } = this.effectsSystem.update(this.time, config);

    // --- Phase 2B: Glitch Active Evaluation ---
    const isGlitchActive = (isGlitched || currentSplit > (config.aberrationAmount * 1.15));

    // --- Phase 2C: Cavern Swarm Spawner Logic ---
    if (config.gameState === "gameplay" && !this.isWaveTransitionActive) {
      this.enemySpawnTimer += dtSeconds;

      if (this.enemiesSpawnedInWave < this.totalEnemiesToSpawnInWave && this.enemySpawnTimer >= this.spawnInterval) {
        this.enemySpawnTimer = 0.0;

        // Spawn from right edge of screen bounds in local container coordinates
        const spawnX = (screenWidth / 2 + 80) / currentScale;
        const spawnY = ((Math.random() - 0.5) * (screenHeight - 240)) / currentScale;

        // Retrieve mapped striped enemy skull texture
        const enemyTexture = Assets.get('enemy_skull_striped');
        const enemySprite = new Sprite(enemyTexture);
        enemySprite.anchor.set(0.5);
        enemySprite.scale.set(0.38);

        // Adjust coloration slightly to represent hostile alignment
        enemySprite.tint = 0xff5533;
        enemySprite.position.set(spawnX, spawnY);

        this.masterContainer.addChild(enemySprite);

        // Dynamically scale parameters based on the store's current active wave
        const waveMultiplier = config.gameActiveWave;
        const enemyHP = 1 + Math.floor(waveMultiplier * 0.4);
        const enemySpeed = 160 + (waveMultiplier * 15);

      this.enemies.push({
          sprite: enemySprite,
          hp: enemyHP,
          maxHp: enemyHP,
          speed: enemySpeed,
          facingDirection: -1.0, // Default to facing left (spawns on the right)
          currentFlipScale: -1.0
        });

        this.enemiesSpawnedInWave++;
      }
    }

    // --- Phase 2B: Tracer Projectile Propagation & Boundary Cleanups ---
    if (this.playerProjectiles && this.playerProjectiles.length > 0) {
      for (let i = this.playerProjectiles.length - 1; i >= 0; i--) {
        const proj = this.playerProjectiles[i];
        proj.sprite.x += proj.vx * dtSeconds;
        proj.sprite.y += proj.vy * dtSeconds;

        const globalPos = proj.sprite.getGlobalPosition();
        if (
          globalPos.x < -100 || 
          globalPos.x > screenWidth + 100 || 
          globalPos.y < -100 || 
          globalPos.y > screenHeight + 100
        ) {
          if (this.masterContainer) {
            this.masterContainer.removeChild(proj.sprite);
          }
          proj.sprite.destroy();
          this.playerProjectiles.splice(i, 1);
        }
      }
    }

    // --- Phase 2C: Enemy Swarm Processing (Active 2D vector pursuit tracking & scale flips) ---
    if (this.enemies && this.enemies.length > 0) {
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const enemy = this.enemies[i];
        
        // Active pursuit tracking vector calculations
        const playerX = this.headContainer.position.x;
        const playerY = this.headContainer.position.y;

        const dx = playerX - enemy.sprite.x;
        const dy = playerY - enemy.sprite.y;
        const distanceToPlayer = Math.sqrt(dx * dx + dy * dy);

        if (distanceToPlayer > 0) {
          // Direct 2D movement towards player coordinates (keeps chasing endlessly)
          enemy.sprite.x += (dx / distanceToPlayer) * enemy.speed * dtSeconds;
          enemy.sprite.y += (dy / distanceToPlayer) * enemy.speed * dtSeconds;
        }

       // Dynamic visual flip calculation based on player relative position
        const baseScale = 0.38;
        enemy.facingDirection = dx >= 0 ? 1.0 : -1.0;

        // Smoothly interpolate the enemy's scale using the same formula as the player
        enemy.currentFlipScale += (enemy.facingDirection - enemy.currentFlipScale) * 0.2 * deltaTime;
        enemy.sprite.scale.x = baseScale * enemy.currentFlipScale;

        // Off-screen boundary checks (only prunes extreme outliers far outside the play area)
        const outerBoundaryLimit = (screenWidth / currentScale) * 1.5;
        if (Math.abs(enemy.sprite.x) > outerBoundaryLimit || Math.abs(enemy.sprite.y) > outerBoundaryLimit) {
          if (this.masterContainer) {
            this.masterContainer.removeChild(enemy.sprite);
          }
          enemy.sprite.destroy();
          this.enemies.splice(i, 1);
          
          this.enemiesDefeatedInWave++;
        }
      }
    }

    // --- Phase 2C: Dual-Layer Collision Matrices & Particles ---
    if (config.gameState === "gameplay") {
      const shieldRadius = config.searchlightRadius ?? 110;
      const collisionRadius = 35.0; // Dynamic overlapping radius target boundary

      // 1. PROJECTILE-TO-ENEMY COLLISIONS
      for (let pIdx = this.playerProjectiles.length - 1; pIdx >= 0; pIdx--) {
        const proj = this.playerProjectiles[pIdx];

        for (let eIdx = this.enemies.length - 1; eIdx >= 0; eIdx--) {
          const enemy = this.enemies[eIdx];

          const dx = proj.sprite.x - enemy.sprite.x;
          const dy = proj.sprite.y - enemy.sprite.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < collisionRadius) {
            // Spawn fast impact burst of golden spark particles
            this.spawnSparks(proj.sprite.x, proj.sprite.y, Math.floor(Math.random() * 4) + 5, false);

            // Destroy Projectile
            if (this.masterContainer) {
              this.masterContainer.removeChild(proj.sprite);
            }
            proj.sprite.destroy();
            this.playerProjectiles.splice(pIdx, 1);

            // Deduct Enemy Hit Points
            enemy.hp--;

            if (enemy.hp <= 0) {
              // Trigger larger 15-particle explosion burst
              this.spawnSparks(enemy.sprite.x, enemy.sprite.y, 15, true);

              // Remove enemy from stage
              if (this.masterContainer) {
                this.masterContainer.removeChild(enemy.sprite);
              }
              enemy.sprite.destroy();
              this.enemies.splice(eIdx, 1);

              this.enemiesDefeatedInWave++;

              // Increment Score State
              const currentScore = useStore.getState().gameScore;
              useStore.getState().setParameter("gameScore", currentScore + 100);
            }

            break; // Bullet consumed, advance outer projectile queue
          }
        }
      }

      // 2. ENEMY-TO-PLAYER (Shield Boundary) COLLISIONS
      for (let eIdx = this.enemies.length - 1; eIdx >= 0; eIdx--) {
        const enemy = this.enemies[eIdx];

        const dx = enemy.sprite.x - this.headContainer.position.x;
        const dy = enemy.sprite.y - this.headContainer.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < shieldRadius) {
          // Instantly destroy hitting swarm enemy
          if (this.masterContainer) {
            this.masterContainer.removeChild(enemy.sprite);
          }
          enemy.sprite.destroy();
          this.enemies.splice(eIdx, 1);

          this.enemiesDefeatedInWave++;

          // Spawn heavy fiery splash particles
          this.spawnSparks(enemy.sprite.x, enemy.sprite.y, 12, true);

          // Deduct Shield / HP metrics
          const currentShield = useStore.getState().playerShield;
          const currentHP = useStore.getState().playerHP;
          const impactDamage = 15;

          if (currentShield > 0) {
            const nextShield = Math.max(0, currentShield - impactDamage);
            useStore.getState().setParameter("playerShield", nextShield);
          } else {
            const nextHP = Math.max(0, currentHP - impactDamage);
            useStore.getState().setParameter("playerHP", nextHP);

            // Handle Game Over transition resets
            if (nextHP <= 0) {
              useStore.getState().setParameter("gameState", "menu");
            }
          }

          // Visceral gameplay impact camera shake feedback
          this.recoilOffset.x = (Math.random() - 0.5) * 45;
          this.recoilOffset.y = (Math.random() - 0.5) * 45;

          // Spike visual glitch splits
          this.recoilGlitch = 20.0;

          // Momentary screen shake modifier spike
          useStore.getState().setParameter("glitchShakeIntensity", 25);
          setTimeout(() => {
            // Restore previous user/store parameter limits smoothly
            if (!this.isDestroyed) {
              useStore.getState().setParameter("glitchShakeIntensity", 0);
            }
          }, 450);
        }
      }

      // 3. WAVE TIMING & PROGRESSION CHECK
      if (this.enemiesDefeatedInWave >= this.totalEnemiesToSpawnInWave && this.enemies.length === 0) {
        if (!this.isWaveTransitionActive) {
          this.isWaveTransitionActive = true;
          this.waveTransitionTimer = 3.0; // 3 second transition delay
        }
      }
    }

    // Process transition timer delay tick
    if (this.isWaveTransitionActive && config.gameState === "gameplay") {
      this.waveTransitionTimer -= dtSeconds;
      if (this.waveTransitionTimer <= 0.0) {
        this.isWaveTransitionActive = false;

        // Advance Wave level index
        const nextWaveLevel = config.gameActiveWave + 1;
        useStore.getState().setParameter("gameActiveWave", nextWaveLevel);

        this.enemiesSpawnedInWave = 0;
        this.enemiesDefeatedInWave = 0;

        // Increment swarm scale counts
        this.totalEnemiesToSpawnInWave = 5 + (nextWaveLevel * 3);
        this.spawnInterval = Math.max(0.6, 1.8 - (nextWaveLevel * 0.1));
      }
    }

    // --- Phase 2C: Propagation of Spark/Splash Particles ---
    if (this.impactParticles && this.impactParticles.length > 0) {
      for (let i = this.impactParticles.length - 1; i >= 0; i--) {
        const p = this.impactParticles[i];
        p.graphic.x += p.vx * dtSeconds;
        p.graphic.y += p.vy * dtSeconds;
        
        p.life -= dtSeconds;
        p.alpha = Math.max(0, p.life / p.maxLife);
        p.graphic.alpha = p.alpha;

        if (p.life <= 0.0) {
          if (this.masterContainer) {
            this.masterContainer.removeChild(p.graphic);
          }
          p.graphic.destroy();
          this.impactParticles.splice(i, 1);
        }
      }
    }

    // --- Flight & Hover Subsystem Calculations ---
    const headState = this.flightDynamics.calculate(this.time, config, isGlitchActive, this.baselinePosition, this.currentFlipScale);

    // Set head container position combining flight dynamics with elastic spring recoil offsets
    this.headContainer.position.set(
      headState.x + this.recoilOffset.x, 
      headState.y + this.recoilOffset.y
    );
    this.headContainer.scale.set(headState.scaleX, headState.scale); // Independent scale assignment to allow horizontal flip rotations
    this.headContainer.rotation = headState.rotation;

    // --- Searchlight Volumetric System Updates (Orbiting turret tracking mouse) ---
    // (Bypassed / Temporarily unavailable for testing as requested)
    if (this.searchlightSystem) {
      this.searchlightSystem.update(this.headContainer.position, this.absoluteMousePos, deltaTime, config);
    }

    // --- WebGL Portal Refraction Ripple Subsystem updates ---
    if (this.shockwaveSystem) {
      const hasActiveWaves = this.shockwaveSystem.update(
        dtSeconds, 
        screenWidth, 
        screenHeight, 
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

    // Detect visual shakes to auto-fire WebGL ripples
    const glitchTriggered = isGlitchActive && config.glitchShakeIntensity > 15;
    if (glitchTriggered && !this.lastGlitchPeak && this.shockwaveSystem) {
      this.shockwaveSystem.trigger(
        this.headContainer.position,
        this.masterContainer.scale.x,
        screenWidth,
        screenHeight
      );
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

    // --- Echoing Phase Trails Subsystem calculations ---
    if (this.trailSystem) {
      this.trailSystem.update(headState, config, isGlitchActive);
    }

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
    
    const clipTex = Assets.get(this.assetKeys.char_clipping_mask) || Assets.get('bg');
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

    // Remove window keyboard trackers
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);

    if (this.unsubscribeStore) {
      this.unsubscribeStore();
    }

    // Clean up continuous auto-fire pointer tracking using our cached DOM canvas reference
    if (this.canvasElement) {
      try {
        this.canvasElement.removeEventListener('pointerdown', this.handlePointerDown);
        this.canvasElement.removeEventListener('pointermove', this.handlePointerMove);
      } catch (e) {
        // Safe catch
      }
      this.canvasElement = null;
    }
    window.removeEventListener('pointerup', this.handlePointerUp);

    // Clean up active projectiles, swarms, and particle groups
    this.clearGameplayObjects();

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
        
        // Fix standard asset texture cache warnings [3]
        this.app.destroy(true, { children: true, texture: false }); 
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
   * @param {{x: number, y: number}} baselinePos - Dynamic target coordinates currently centered on the head [3].
   * @param {number} currentFlipScale - Horizontal scale factor supporting smooth rotational flipping [3].
   * @returns {Object} Target positions, rotation angles, and horizontal/vertical scales.
   */
  calculate(time, config, isGlitchActive, baselinePos, currentFlipScale) {
    const tFloat = time * config.floatSpeed;

    // Generate smooth hover pauses (plateaus) at wave extrema using smoothstep interpolation
    const rawWave = Math.sin(tFloat) * config.flyHoverPause;
    const clampedWave = Math.max(-1.0, Math.min(1.0, rawWave));
    
    // Map wave region down to [0.0, 1.0] for step translation
    const normProgress = clampedWave * 0.5 + 0.5; 
    const smoothProgress = normProgress * normProgress * (3.0 - 2.0 * normProgress);

    // Apply vertical displacement boundaries relative to the dynamic baseline [3]
    let y = baselinePos.y - (smoothProgress * config.floatAmpY * 1.5);
    
    // Apply horizontal sway relative to the dynamic baseline [3]
    let x = baselinePos.x + Math.cos(tFloat * 0.5) * config.floatAmpX;

    // Apply erratic noise coordinates if a screen shake action is active
    if (config.glitchShakeIntensity > 0 && isGlitchActive) {
      x += (Math.random() - 0.5) * config.glitchShakeIntensity;
      y += (Math.random() - 0.5) * config.glitchShakeIntensity;
    }

    // Process dynamic visual scale based on active coordinate height
    const scale = config.flyMinScale - (smoothProgress * (config.flyMinScale - config.flyMaxScale));

    // Process dynamic tilt (persistent bias angles + swaying)
    const tiltRad = config.flyTiltBias * (Math.PI / 180.0);
    const swayOsc = Math.sin(tFloat * 0.7) * (config.floatRotation * 0.5) * (Math.PI / 180.0);
    const rotation = tiltRad + swayOsc;

    return { 
      x, 
      y, 
      scale, 
      scaleX: scale * currentFlipScale, // Apply the horizontal rotation flip factor [3]
      rotation 
    };
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

      // Proxy-aware validation: ensures the internal setter never runs on unallocated proxy data
      const group = this.warpFilter?.resources?.warpUniforms;
      const isBufferReady = group && group.uniforms && group.uniforms._data;

      if (isBufferReady) {
        try {
          group.uniforms.uTime = this.time * state.warpSpeed;
          group.uniforms.uWarpIntensity = state.warpIntensity;
        } catch (e) {
          // Fallback guard
        }
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

      // Proxy-aware validation: ensures the internal setter never runs on unallocated proxy data
      const bgGroup = this.bgWarpFilter?.resources?.warpUniforms;
      const isBgBufferReady = bgGroup && bgGroup.uniforms && bgGroup.uniforms._data;

      if (isBgBufferReady) {
        try {
          bgGroup.uniforms.uTime = this.time * state.bgWarpSpeed;
          bgGroup.uniforms.uWarpIntensity = state.bgWarpIntensity;
        } catch (e) {
          // Fallback guard
        }
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
### `src\engine\systems\SearchlightSystem.js`
```javascript
// src/engine/systems/SearchlightSystem.js
import { Container, Sprite, Texture } from 'pixi.js';

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

    // Generate our soft gradient beam texture on startup
    if (!SearchlightSystem.beamTexture) {
      SearchlightSystem.beamTexture = SearchlightSystem.generateVolumetricTexture();
    }

    // Allocate 1 single searchlight beam sprite pointing at target coordinates [3]
    this.beamSprite = new Sprite(SearchlightSystem.beamTexture);
    this.beamSprite.anchor.set(0.5, 0.0); // Pivots directly at the tapered top-center of the cone [3]
    
    // Normal blending ensures the beam is 100% opaque and blocks the background [3]
    this.beamSprite.blendMode = 'normal';
    
    this.container.addChild(this.beamSprite);
  }

  /**
   * Programmatically creates a solid conical texture.
   * Features razor-sharp lateral edges and short, snappy linear gradients at 
   * the front and end to smoothly transition the beam [3].
   * @returns {Texture} Memoized volumetric texture.
   */
  static generateVolumetricTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Remove any filters to keep the side edges completely sharp
    ctx.filter = 'none';

    // Linear gradient along the Y-axis (from root to end) [3]
    const grad = ctx.createLinearGradient(64, 0, 64, 512);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 0.0)');  // Starts transparent at 0%
    grad.addColorStop(0.06, 'rgba(255, 255, 255, 1.0)'); // Short 6% fade-in to 100% opacity [3]
    grad.addColorStop(0.94, 'rgba(255, 255, 255, 1.0)'); // Stays 100% opaque [3]
    grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');  // Short 6% fade-out at the tip [3]

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(56, 10);    // Root top-left
    ctx.lineTo(72, 10);    // Root top-right
    ctx.lineTo(112, 502);  // End bottom-right
    ctx.lineTo(16, 502);   // End bottom-left
    ctx.closePath();
    ctx.fill();

    return Texture.from(canvas);
  }

  /**
   * Programmatically generates a high-visibility Tracer Round texture on a 32x8 horizontal canvas.
   * Features a solid hot-orange background with a tight, solid-white superheated lead core in the center.
   * @returns {Texture} Memoized tracer round texture.
   */
  static generateTracerTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 8;
    const ctx = canvas.getContext('2d');

    ctx.filter = 'none';
    ctx.clearRect(0, 0, 32, 8);

    // Fill entire canvas with solid, hot-orange background (#ff9900)
    ctx.fillStyle = '#ff9900';
    ctx.fillRect(0, 0, 32, 8);

    // Overlap tight solid-white rectangle (#ffffff) in the center
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(4, 2, 24, 4);

    return Texture.from(canvas);
  }

  /**
   * Translates start coordinates onto the character's custom perimeter orbit and scales length dynamically.
   * @param {{x: number, y: number}} characterPos - World coordinates of the head container.
   * @param {{x: number, y: number}} targetGlobalPos - Focal target coordinates (absolute mouse cursor).
   * @param {number} deltaTime - Frame step timing factor.
   * @param {Object} config - State config containing active visual preferences.
   */
  update(characterPos, targetGlobalPos, deltaTime, config) {
    // Currently bypassed for testing. Container visibility forced to false.
    this.container.visible = false;
  }

  destroy() {
    if (this.container) {
      this.parentContainer.removeChild(this.container);
      this.container.destroy({ children: true });
      this.container = null;
    }
    this.beamSprite = null;
  }
}
```

---
### `src\engine\systems\ShockwaveSystem.js`
```javascript
// src/engine/systems/ShockwaveSystem.js
import { Filter, defaultFilterVert } from 'pixi.js';
import { SHOCKWAVE_FRAGMENT_SHADER } from '../shaders/ShockwaveShader.js';

export class ShockwaveSystem {
  constructor() {
    this.isActive = false;
    this.time = 0;

    // Instantiate custom cascading portal refraction shader setup
    this.filter = Filter.from({
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

    // Map screen-pixel coordinates to gl_FragCoord space (bottom-left origin)
    unis.uCenter = [screenX, screenHeight - screenY];
    unis.uScreenSize = [screenWidth, screenHeight];

    // Reset wave tracking properties
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
    unis.uAmplitude = strength * 45.0; // Scaled displacement index

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

    // Clean up filter execution overhead once ripples fade past active boundaries
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
### `src\store\slices\usePhysicsSlice.js`
```javascript
// src/store/slices/usePhysicsSlice.js

export const createPhysicsSlice = (set, get) => ({
  // gameplay active metrics and player statistics
  gameState: "menu", // "menu" or "gameplay"
  playerHP: 100,
  playerShield: 100,
  gameScore: 0,
  gameActiveWave: 1,

  // 1. Motion Dynamics
  floatSpeed: 1.0,
  floatAmpX: 30,
  floatAmpY: 15,
  floatRotation: 2.0,

  // Custom Flight and Hover parameters
  flyMinScale: 0.3,       // Scale at lowest point of flight
  flyMaxScale: 0.3,       // Scale at highest peak of flight
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
  bgWarpIntensity: 35.0,
  bgWarpSpeed: 1.0,

  // 4. Aura / Glow & Cavern Reflection Control
  auraOpacity: 0.5,
  auraScale: 0.5,
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
  searchlightActive: true,
  searchlightWidth: 0.2,     // Beam width scale
  searchlightLength: 1.0,    // Max beam extension
  searchlightRadius: 120,    // Starting emission radius along character's perimeter
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

  // Rig-Aligned Stage & Actor Selection
  characterId: "abyssal_eye", // Text identifier matching actor folder name
  bgClippingMaskId: "moonpurple",   // Backdrop color name suffix
  bgPatternStyle: "stone",    // Pattern style prefix
  bgMountainId: 2,             // Front mountain asset ID
  bgMountainBackId: 3,         // Back mountain asset ID
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

  // Phase 2A Game State Updates
  gameState: "menu",          // "menu" or "gameplay"
  gameScore: 0,
  gameActiveWave: 1,
  playerHP: 100,
  playerShield: 100,
});
```

---
### `src\store\useStore.js`
```javascript
// src/store/useStore.js
import { create } from 'zustand';
import { createSetupSlice } from './slices/useSetupSlice';
import { createPhysicsSlice } from './slices/usePhysicsSlice';
import { createWeb3Slice } from './slices/useWeb3Slice';

export const useStore = create((set, get) => ({
  // Flatten slice definitions into the combined store [3]
  ...createSetupSlice(set, get),
  ...createPhysicsSlice(set, get),
  ...createWeb3Slice(set, get),
  
  /**
   * Central state mutator.
   * Modifies configuration parameters on the flattened store safely.
   * @param {string} key - Parameter field to modify.
   * @param {any} value - Assigned configuration value.
   */
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
