export const presentationBoardShortcutStorageKey = (profileAddress) =>
  `inscape:workbench:presentation-board:${profileAddress || 'anonymous'}`;

export function loadPresentationBoardShortcut(profileAddress, storage = globalThis.localStorage) {
  try {
    const value = JSON.parse(storage?.getItem(presentationBoardShortcutStorageKey(profileAddress)) || 'null');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch { return null; }
}
