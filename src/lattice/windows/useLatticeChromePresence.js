import { useEffect, useRef, useState } from 'react';

export default function useLatticeChromePresence(activeValue) {
  const activeRef = useRef(activeValue);
  const [presence, setPresence] = useState(() => ({
    contentMotion: false,
    phase: activeValue == null ? 'closed' : 'entering',
    renderedValue: activeValue,
  }));
  activeRef.current = activeValue;

  useEffect(() => {
    setPresence((current) => {
      if (activeValue != null) {
        if (current.renderedValue == null || current.phase === 'exiting') return { contentMotion: false, phase: 'entering', renderedValue: activeValue };
        if (current.renderedValue !== activeValue) return { contentMotion: true, phase: 'open', renderedValue: activeValue };
        return current;
      }
      return current.renderedValue == null ? current : { ...current, phase: 'exiting' };
    });
  }, [activeValue]);

  const completeAnimation = () => setPresence((current) => {
    if (current.phase === 'entering') return { ...current, contentMotion: false, phase: 'open' };
    if (current.phase !== 'exiting') return current;
    return activeRef.current == null
      ? { contentMotion: false, phase: 'closed', renderedValue: null }
      : { contentMotion: false, phase: 'entering', renderedValue: activeRef.current };
  });

  return { ...presence, completeAnimation };
}
