import { exact } from '../text/domain/article.js';

export const DEFAULT_RECEPTION_LIGHT = Object.freeze({ enabled: true, color: '#c7b58a', strength: .35, spread: .7, position: .5, direction: 'down' });
export const receptionLight = reception => ({ ...DEFAULT_RECEPTION_LIGHT, ...reception?.lighting });
export function validReceptionLight(value) {
  return exact(value, ['color', 'strength', 'spread', 'position'], ['direction', 'enabled'])
    && (!Object.hasOwn(value, 'enabled') || typeof value.enabled === 'boolean')
    && typeof value.color === 'string' && /^#[0-9a-f]{6}$/iu.test(value.color)
    && (!Object.hasOwn(value, 'direction') || ['down', 'up', 'both'].includes(value.direction))
    && ['strength', 'spread', 'position'].every(key => Number.isFinite(value[key]) && value[key] >= 0 && value[key] <= 1);
}
