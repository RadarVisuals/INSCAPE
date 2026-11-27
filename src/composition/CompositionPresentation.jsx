import { createContext, useContext, useMemo } from 'react';

const Presentation = createContext(null);
export const useCompositionPresentation = () => useContext(Presentation);

// Receives already-authorized immutable snapshots. It has no storage, editor,
// account or publication capabilities. The caller owns which snapshot is read.
export default function CompositionPresentation({ snapshot, onOpenSource, children }) {
  const value = useMemo(() => snapshot ? { snapshot, onOpenSource } : null,
    [snapshot, onOpenSource]);
  return <Presentation.Provider value={value}>{children}</Presentation.Provider>;
}
