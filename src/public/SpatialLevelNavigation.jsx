import { SPATIAL_WORLD_LEVEL } from './spatialWorldLevels.js';
import './spatialLevelNavigation.css';

export default function SpatialLevelNavigation({ level = SPATIAL_WORLD_LEVEL.HOME, disabled = false, arranging = false, onUp, onDown, onFinishArranging }) {
  const canMoveUp = level !== SPATIAL_WORLD_LEVEL.UPPER;
  const canMoveDown = level !== SPATIAL_WORLD_LEVEL.GALLERY;
  const levelLabel = level === SPATIAL_WORLD_LEVEL.UPPER ? 'Upper level' : level === SPATIAL_WORLD_LEVEL.GALLERY ? 'Gallery level' : 'Home level';
  return <>
    <nav className="spatial-level-navigation" aria-label="Spatial level navigation" data-disabled={disabled || undefined}>
      <button type="button" data-available={canMoveUp || undefined} aria-hidden={!canMoveUp} aria-label="Move to the world above" disabled={disabled || !canMoveUp} tabIndex={canMoveUp ? 0 : -1} onClick={onUp}><i data-direction="up" aria-hidden="true" /></button>
      <div className="spatial-level-navigation__indicator" role="img" aria-label={levelLabel}>
        {[SPATIAL_WORLD_LEVEL.UPPER, SPATIAL_WORLD_LEVEL.HOME, SPATIAL_WORLD_LEVEL.GALLERY].map((candidate) => <i key={candidate} data-active={candidate === level || undefined} />)}
      </div>
      <button type="button" data-available={canMoveDown || undefined} aria-hidden={!canMoveDown} aria-label="Move to the world below" disabled={disabled || !canMoveDown} tabIndex={canMoveDown ? 0 : -1} onClick={onDown}><i data-direction="down" aria-hidden="true" /></button>
    </nav>
    {arranging && <button className="spatial-arrange-done" type="button" onClick={onFinishArranging}><span>ARRANGING</span>DONE</button>}
  </>;
}
