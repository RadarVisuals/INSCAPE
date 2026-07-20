// src/hooks/useArtworkReactions.js
import { useCallback } from "react";
import { useLsp1Events } from "./useLsp1Events";
import { developmentLog } from '../diagnostics.js';
import { triggerArtworkReaction } from './artworkReaction.js';

const DEV_DIAGNOSTICS = typeof __DEVELOPMENT_DIAGNOSTICS__ !== 'undefined' && __DEVELOPMENT_DIAGNOSTICS__ === true;

export function useArtworkReactions() {
  const triggerReaction = useCallback((event) => {
    if (DEV_DIAGNOSTICS) developmentLog('[artwork-reaction] triggered', event.type);
    triggerArtworkReaction(event.type);
  }, []);

  useLsp1Events(triggerReaction);
}
