import { createContext, useContext, useMemo } from 'react';

const Presentation = createContext(null);
export const useReceptionPresentation = () => useContext(Presentation);

// Receives already-authorized immutable snapshots. It has no storage, editor,
// account or publication capabilities. The caller owns which snapshot is read.
export default function ReceptionPresentation({ snapshot, profile, onOpenSource, children }) {
  const value = useMemo(() => snapshot ? { snapshot, profile, onOpenSource } : null,
    [snapshot, profile, onOpenSource]);
  return <Presentation.Provider value={value}>{children}</Presentation.Provider>;
}
