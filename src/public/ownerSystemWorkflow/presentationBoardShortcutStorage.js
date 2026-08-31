export const presentationBoardShortcutStorageKey = (profileAddress) =>
  `inscape:workbench:presentation-board:${profileAddress || 'anonymous'}`;

export const DEFAULT_PRESENTATION_BOARD_SHORTCUT_ICON_PRESENTATION = Object.freeze({
  labelSize: 8,
  offsetX: 0,
  offsetY: 0,
  scale: 1,
  size: 60,
});

const boundedNumber = (value, minimum, maximum, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, number)) : fallback;
};

export function normalizePresentationBoardShortcutIconPresentation(value) {
  return {
    labelSize: boundedNumber(value?.labelSize, 7, 12, 8),
    offsetX: boundedNumber(value?.offsetX, -24, 24, 0),
    offsetY: boundedNumber(value?.offsetY, -24, 24, 0),
    scale: boundedNumber(value?.scale, .75, 3, 1),
    size: boundedNumber(value?.size, 40, 150, 60),
  };
}

export function loadPresentationBoardShortcut(profileAddress, storage = globalThis.localStorage) {
  try {
    const value = JSON.parse(storage?.getItem(presentationBoardShortcutStorageKey(profileAddress)) || 'null');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch { return null; }
}
