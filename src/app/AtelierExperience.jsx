import { useEffect } from 'react';
import ControlPanel from '../components/UI/ControlPanel';
import { useArtworkReactions } from '../hooks/useArtworkReactions';
import { useWalletStore } from '../store/useWalletStore';

export default function AtelierExperience({ onRequestPublic }) {
  const initWallet = useWalletStore((state) => state.initWallet);

  useEffect(() => {
    initWallet();
  }, [initWallet]);

  useArtworkReactions();

  return (
    <div className="atelier-experience" data-application-mode="atelier">
      <button
        className="mode-switch mode-switch--atelier"
        type="button"
        onClick={onRequestPublic}
        aria-label="Leave Atelier and open the public UNDERNEATH.OS experience"
      >
        <span aria-hidden="true">←</span> Public world
      </button>
      <ControlPanel />
    </div>
  );
}
