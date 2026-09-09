import { useEffect, useState } from 'react';
import {
  createOwnerShellSystemPresentationSession,
  updateOwnerShellSystemPresentationSession,
} from './ownerShellSystemPresentation.js';

export default function useOwnerShellSystemPresentation({ onNotice }) {
  const [presentationSession, setPresentationSession] = useState(null);

  const beginPresentation = (placement) => {
    const session = createOwnerShellSystemPresentationSession(placement);
    if (session) setPresentationSession(session);
  };
  const cancelPresentation = () => setPresentationSession(null);
  const updatePresentation = (patch) => setPresentationSession((current) => (
    updateOwnerShellSystemPresentationSession(current, patch)
  ));
  const applyPresentation = () => {
    setPresentationSession(null);
    onNotice('FRAME & MAT CONTROLS / NOT CONNECTED');
  };

  useEffect(() => {
    if (!presentationSession) return undefined;
    const cancelContextOnEscape = (event) => {
      if (event.key === 'Escape') cancelPresentation();
    };
    globalThis.addEventListener('keydown', cancelContextOnEscape, true);
    return () => globalThis.removeEventListener('keydown', cancelContextOnEscape, true);
  }, [presentationSession]);

  return {
    applyPresentation,
    beginPresentation,
    cancelPresentation,
    presentationSession,
    updatePresentation,
  };
}
