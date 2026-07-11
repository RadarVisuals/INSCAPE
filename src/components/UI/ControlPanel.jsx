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