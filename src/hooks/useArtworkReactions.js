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