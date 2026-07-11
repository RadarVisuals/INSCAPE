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