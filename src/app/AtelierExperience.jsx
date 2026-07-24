import ControlPanel from '../components/UI/ControlPanel';
import { useArtworkReactions } from '../hooks/useArtworkReactions';

export default function AtelierExperience({ onRequestPublic }) {
  useArtworkReactions();

  return (
    <div className="atelier-experience" data-application-mode="atelier">
      <button
        className="mode-switch mode-switch--atelier"
        type="button"
        onClick={onRequestPublic}
        aria-label="Leave Atelier and open the public INSCAPE experience"
      >
        <span aria-hidden="true">←</span> Public world
      </button>
      <ControlPanel />
    </div>
  );
}
