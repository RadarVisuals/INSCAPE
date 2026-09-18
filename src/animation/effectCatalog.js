import float from './floatEffect.js';
import flicker from './flickerEffect.js';

// Explicit local catalog shared by validation, editing and rendering.
export const EFFECTS = Object.freeze([float, flicker].map(effect => Object.freeze({ ...effect,
  parameters: Object.freeze(effect.parameters.map(parameter => Object.freeze(parameter))),
})));
export const effectDefaults = effect => Object.fromEntries(effect.parameters.map(({ key, initial }) => [key, initial]));
export const activeEffects = animation => EFFECTS.filter(effect => animation?.[effect.id] && animation[effect.id].enabled !== false);
export const hasActiveEffects = animation => activeEffects(animation).length > 0;
