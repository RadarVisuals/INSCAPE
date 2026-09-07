// Declarative INSCAPE Identity settings, distinct from official profile metadata.
// Shared by draft, publication and rendering; accepts no executable shader code.
export const IDENTITY_CARD_LIMITS = Object.freeze({ fields: 16, label: 60, text: 2000, items: 16, item: 160 });
const exact = (value, keys) => Boolean(value && typeof value === 'object' && !Array.isArray(value))
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const text = (value, max, multiline = false) => typeof value === 'string' && value.length <= max
  && !(multiline ? /[\u0000-\u0009\u000b-\u001f\u007f]/u : /[\u0000-\u001f\u007f]/u).test(value);

export function isValidIdentityCard(value, { published = false } = {}) {
  if (!exact(value, ['version', 'background', 'fields']) || value.version !== 1) return false;
  const background = value.background;
  if (!exact(background, ['type', 'color', 'speed']) || !['plain', 'clouds'].includes(background.type)
    || !(background.color === null || typeof background.color === 'string' && /^#[0-9a-f]{6}$/iu.test(background.color))
    || !Number.isFinite(background.speed) || background.speed < 0 || background.speed > 2) return false;
  if (!Array.isArray(value.fields) || value.fields.length > IDENTITY_CARD_LIMITS.fields) return false;
  const ids = new Set();
  return value.fields.every(field => {
    if (!exact(field, ['id', 'label', 'type', 'value']) || typeof field.id !== 'string'
      || !/^field:[A-Za-z0-9_-]{1,64}$/u.test(field.id) || ids.has(field.id)
      || !text(field.label, IDENTITY_CARD_LIMITS.label)) return false;
    ids.add(field.id);
    if (field.type === 'text') return text(field.value, IDENTITY_CARD_LIMITS.text, true)
      && (!published || Boolean(field.label.trim() && field.value.trim()));
    if (field.type === 'list') return Array.isArray(field.value) && field.value.length <= IDENTITY_CARD_LIMITS.items
      && field.value.every(item => text(item, IDENTITY_CARD_LIMITS.item) && (!published || Boolean(item.trim())))
      && (!published || Boolean(field.label.trim() && field.value.length));
    return false;
  });
}

export function resolveIdentityCard(presentation = {}) {
  if (Object.hasOwn(presentation, 'card')) {
    if (!isValidIdentityCard(presentation.card)) throw new TypeError('Invalid Identity card settings');
    return structuredClone(presentation.card);
  }
  return { version: 1, background: { type: presentation.avatar?.mode === 'inscape' ? 'clouds' : 'plain', color: null, speed: 1 }, fields: [] };
}

export function projectIdentityCard(card) {
  if (!isValidIdentityCard(card)) throw new TypeError('Invalid Identity card settings');
  return { ...structuredClone(card), fields: card.fields.map(field => ({ ...field, label: field.label.trim(),
    value: field.type === 'list' ? field.value.map(item => item.trim()).filter(Boolean) : field.value.trim(),
  })).filter(field => field.label && field.value.length) };
}
