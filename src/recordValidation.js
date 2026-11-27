// Shared strict-record checks; callers own their allowed fields and value rules.
export const isRecord = value => Boolean(value && typeof value === 'object' && !Array.isArray(value));
export const hasExactKeys = (value, keys) => isRecord(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
export const hasAllowedKeys = (value, required, optional = []) => isRecord(value)
  && required.every(key => Object.hasOwn(value, key))
  && Object.keys(value).every(key => required.includes(key) || optional.includes(key));
