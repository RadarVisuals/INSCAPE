import { useRef } from 'react';

import { LATTICE_COORDINATES } from '../domain/latticeProfile.js';
import {
  latticeCardinalDestinations,
  latticeMapFocusDestination,
} from '../controller/latticeNavigation.js';
import './latticeNavigationOverlay.css';

const DIRECTION_CONTROL_LABELS = Object.freeze({
  left: 'Navigate to table on the left',
  right: 'Navigate to table on the right',
  up: 'Navigate to table above',
  down: 'Navigate to table below',
});

export default function LatticeNavigationOverlay({ active, onNavigate, onReturnFocus }) {
  const mapRef = useRef(null);
  const neighbors = latticeCardinalDestinations(active);

  const focusMapCoordinate = (coordinate) => {
    mapRef.current
      ?.querySelector(`[data-coordinate="${coordinate.x}:${coordinate.y}"]`)
      ?.focus({ preventScroll: true });
  };

  const handleMapKeyDown = (event, coordinate) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onReturnFocus();
      return;
    }
    const destination = latticeMapFocusDestination(coordinate, event.key);
    if (!destination) return;
    event.preventDefault();
    event.stopPropagation();
    focusMapCoordinate(destination);
  };

  return (
    <div className="lattice-navigation-overlay" data-lattice-chrome>
      {Object.entries(neighbors).map(([direction, destination]) => destination && (
        <button
          aria-label={DIRECTION_CONTROL_LABELS[direction]}
          className={`lattice-direction-chevron is-${direction}`}
          key={direction}
          onClick={() => onNavigate(destination)}
          onPointerDown={(event) => event.stopPropagation()}
          type="button"
        />
      ))}
      <div className="lattice-coordinate-map" ref={mapRef} role="group" aria-label="Lattice table navigator">
        {LATTICE_COORDINATES.map((coordinate) => {
          const isActive = coordinate.x === active.x && coordinate.y === active.y;
          return (
            <button
              aria-current={isActive ? 'location' : undefined}
              aria-label={isActive ? 'Current table' : `Navigate to table ${coordinate.x + 2}, ${coordinate.y + 2}`}
              className={isActive ? 'is-active' : ''}
              data-coordinate={`${coordinate.x}:${coordinate.y}`}
              key={`${coordinate.x}:${coordinate.y}`}
              onClick={() => onNavigate(coordinate)}
              onKeyDown={(event) => handleMapKeyDown(event, coordinate)}
              onPointerDown={(event) => event.stopPropagation()}
              type="button"
            />
          );
        })}
      </div>
    </div>
  );
}
