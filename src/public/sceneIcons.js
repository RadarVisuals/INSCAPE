export const SCENE_ICONS = Object.freeze({ profile: '\u25c9', collection: '\u25a6', signals: '\u25c8', creations: '\u2726', folder: '\u25a1', favorites: '\u2666', search: '\u2315', gallery: '\u25a3', external: '\u2197', music: '\u266b' });
export function normalizeIconKey(value, fallback = 'folder') { return Object.hasOwn(SCENE_ICONS, value) ? value : fallback; }
export function iconGlyph(key) { return SCENE_ICONS[normalizeIconKey(key)]; }
