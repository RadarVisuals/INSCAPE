import { receptionLight } from './receptionAtmosphere.js';
import './receptionAtmosphere.css';

// The header owns the source position; this paint follows its actual bottom edge.
// No animation loop, canvas, or input interception belongs to this layer.
export default function ReceptionAtmosphere({ reception }) {
  const light = receptionLight(reception);
  if (!light.enabled) return null;
  return <div className="reception-atmosphere" aria-hidden="true" data-light-direction={light.direction} style={{
    '--reception-light-color': light.color, '--reception-light-strength': light.strength,
    '--reception-light-position': `${light.position * 100}%`, '--reception-light-spread': `${30 + light.spread * 70}%`,
  }}>{light.direction !== 'up' && <div className="reception-atmosphere-light" data-side="down" />}
    {light.direction !== 'down' && <div className="reception-atmosphere-light" data-side="up" />}
    <div className="reception-atmosphere-bar" /></div>;
}
