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