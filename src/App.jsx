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