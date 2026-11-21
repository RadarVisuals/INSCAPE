import { createContext, useContext, useSyncExternalStore } from 'react';

const PickerPreference = createContext(null), empty = Object.freeze([]), noop = () => () => {}, snapshot = () => empty;
export const useInspectorColourPreference = () => useContext(PickerPreference);

// Lightweight host state: importing the Inspector must not preload the picker.
export default function InspectorColourPreferences({ preference, children }) {
  const pinned = useSyncExternalStore(preference?.subscribe || noop, preference?.getSnapshot || snapshot) || empty;
  return <PickerPreference.Provider value={preference ? { pinned, update: preference.update } : null}>{children}</PickerPreference.Provider>;
}
