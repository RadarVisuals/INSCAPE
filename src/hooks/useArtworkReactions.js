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