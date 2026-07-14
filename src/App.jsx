// src/App.jsx
import React, { useEffect } from 'react';
import ArtCanvas from './components/Canvas/ArtCanvas';
import ControlPanel from './components/UI/ControlPanel';
import { useWalletStore } from './store/useWalletStore';
import { useArtworkReactions } from './hooks/useArtworkReactions';
import { useStore } from './store/useStore';

function App() {
  const initWallet = useWalletStore((s) => s.initWallet);
  const grapplePrototypeEnabled = useStore((state) => state.grapplePrototypeEnabled);
  const showDebugUi = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug');

  useEffect(() => {
    initWallet();
  }, [initWallet]);

  useArtworkReactions();

  return (
    <>
      <ArtCanvas />
      {(!grapplePrototypeEnabled || showDebugUi) && <ControlPanel />}
    </>
  );
}

export default App;
