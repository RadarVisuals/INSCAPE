import { EFFECTS, effectDefaults } from '../../animation/effectCatalog.js';
// Omitted enabled means on, preserving old authored effects without rewriting.
export const ANIMATION_DEFAULTS = Object.freeze(Object.fromEntries(EFFECTS.map(effect => [effect.id, Object.freeze(effectDefaults(effect))])));
const record = value => value && typeof value === 'object' && !Array.isArray(value);
export function validPlacementAnimation(value) {
  if (!record(value) || !Object.keys(value).length || Object.keys(value).some(key => !EFFECTS.some(effect => effect.id === key))) return false;
  for (const definition of EFFECTS) {
    if (!Object.hasOwn(value, definition.id)) continue;
    const effect = value[definition.id];
    if (!record(effect) || Object.keys(effect).some(key => key !== 'enabled' && !definition.parameters.some(parameter => parameter.key === key))
      || (Object.hasOwn(effect, 'enabled') && typeof effect.enabled !== 'boolean')
      || !definition.parameters.every(({ key, min, max }) => Object.hasOwn(effect, key) && Number.isFinite(effect[key]) && effect[key] >= min && effect[key] <= max)) return false;
  }
  return true;
}
