import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

const KeeperDock = forwardRef(function KeeperDock({ actorId, residentHandoff, reducedMotion = false, onDockStateChange }, ref) {
  const rootRef = useRef(null);
  const startedRef = useRef(false);
  const [phase, setPhase] = useState('empty');
  const [menuOpen, setMenuOpen] = useState(false);
  const docked = phase !== 'empty' && phase !== 'releasing';

  const dock = () => {
    if (phase !== 'empty') return;
    const bounds = rootRef.current?.getBoundingClientRect();
    if (!bounds) return;
    startedRef.current = true;
    setPhase('approaching');
    onDockStateChange?.(true);
    residentHandoff?.start?.(bounds, {
      reducedMotion,
      targetMode: 'center',
      keepVisible: true,
      residentScale: 0.8,
      residentFacing: -1,
      onEntering: () => setPhase('entering'),
      onEntered: () => setPhase('docked')
    });
  };

  const release = (options = {}) => {
    if (!startedRef.current || phase === 'releasing') return;
    const releaseOptions = typeof options === 'function' ? { onReleased: options } : (options || {});
    setMenuOpen(false);
    setPhase('releasing');
    const bounds = rootRef.current?.getBoundingClientRect();
    residentHandoff?.exit?.(bounds, {
      reducedMotion,
      screenTarget: releaseOptions.screenTarget,
      onComplete: () => {
        startedRef.current = false;
        setPhase('empty');
        onDockStateChange?.(false);
        releaseOptions.onReleased?.();
      }
    });
  };

  useImperativeHandle(ref, () => ({ release }));

  useEffect(() => {
    const resize = () => {
      if (startedRef.current) residentHandoff?.updateBounds?.(rootRef.current?.getBoundingClientRect());
    };
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      if (startedRef.current) {
        residentHandoff?.cancel?.();
        onDockStateChange?.(false);
      }
    };
  }, [onDockStateChange,residentHandoff]);

  return <aside ref={rootRef} className="keeper-dock" data-phase={phase} aria-label="Keeper Dock">
    <span className="keeper-dock__label">Keeper Dock</span>
    {phase === 'empty'
      ? <button className="keeper-dock__empty" type="button" onClick={dock}><span>Dock</span><small>{actorId.replaceAll('_',' ')}</small></button>
      : <button className="keeper-dock__resident" type="button" onClick={() => release()} aria-label="Release Keeper from dock" />}
    <button className="keeper-dock__menu-button" type="button" aria-label="Keeper options" aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}>•••</button>
    {menuOpen && <div className="keeper-dock__menu" role="dialog" aria-label="Keeper options">
      <strong>Keeper</strong>
      <button type="button" onClick={docked ? () => release() : dock}>{docked ? 'Release from Dock' : 'Dock Keeper'}</button>
      <button type="button" disabled>Size <span>Later</span></button>
      <button type="button" disabled>Voice / Audio <span>Later</span></button>
      <button type="button" disabled>Speech Scale <span>Later</span></button>
      <button type="button" disabled>Swap Keeper <span>Later</span></button>
    </div>}
  </aside>;
});

export default KeeperDock;
