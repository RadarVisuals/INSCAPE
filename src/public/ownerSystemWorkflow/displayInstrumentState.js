export function validInstrumentWindows(value, instruments = ['layers', 'metadata']) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.entries(value).every(([id, rect]) => instruments.includes(id) && rect
      && Object.keys(rect).length === 4 && ['left', 'top', 'width', 'height'].every(key => Number.isFinite(rect[key]))
      && rect.width >= 240 && rect.height >= 180 && rect.width <= 10000 && rect.height <= 10000
      && Math.abs(rect.left) <= 10000 && Math.abs(rect.top) <= 10000);
}
