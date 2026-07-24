import { SPATIAL_WORLD_LEVEL } from './spatialWorldLevels.js';
import './spatialLevelNavigation.css';

export default function SpatialLevelNavigation({ level = SPATIAL_WORLD_LEVEL.HOME, disabled = false, arranging = false, onUp, onDown, onFinishArranging }) {
  const levelLabel = level === SPATIAL_WORLD_LEVEL.UPPER ? 'Upper level' : level === SPATIAL_WORLD_LEVEL.GALLERY ? 'Gallery level' : 'Home level';
  const levels = [SPATIAL_WORLD_LEVEL.UPPER, SPATIAL_WORLD_LEVEL.HOME, SPATIAL_WORLD_LEVEL.GALLERY];
  const activeIndex = levels.indexOf(level);
  return <>
    <nav className="spatial-level-navigation" aria-label="Spatial level navigation" data-disabled={disabled || undefined}>
      <div className="spatial-level-navigation__indicator" aria-label={levelLabel}>
        {levels.map((candidate, index) => {
          const distance = index - activeIndex;
          const adjacent = Math.abs(distance) === 1;
          const label = candidate === SPATIAL_WORLD_LEVEL.UPPER ? 'Upper level' : candidate === SPATIAL_WORLD_LEVEL.GALLERY ? 'Gallery level' : 'Home level';
          return <button
            key={candidate}
            type="button"
            data-active={candidate === level || undefined}
            data-available={adjacent || undefined}
            aria-current={candidate === level ? 'page' : undefined}
            aria-label={candidate === level ? `${label}, current level` : `Move to ${label}`}
            disabled={disabled || !adjacent}
            tabIndex={adjacent ? 0 : -1}
            onClick={distance < 0 ? onUp : onDown}
          ><i aria-hidden="true" /></button>;
        })}
      </div>
    </nav>
    {arranging && <button className="spatial-arrange-done" type="button" onClick={onFinishArranging}><span>ARRANGING</span>DONE</button>}
  </>;
}
