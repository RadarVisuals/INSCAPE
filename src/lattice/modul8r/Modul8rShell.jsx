import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, MoreVertical, X } from 'lucide-react';
import useLatticeFloatingWindow from '../windows/useLatticeFloatingWindow.js';
import {
  DEFAULT_MODUL8R_OPEN_MODULE,
  MODUL8R_MODULE_LABELS,
  MODUL8R_MODULE_ORDER,
  createModul8rShellState,
  toggleModul8rMaster,
  toggleModul8rModule,
} from './modul8rShellModel.js';
import '../rendering/latticeMenuSurface.css';
import './modul8rShell.css';

const TRANSITION_FALLBACK_MS = 260;
const INITIAL_SHELL_SIZE = Object.freeze({ height: 630, width: 980 });

function Modul8rModule({ active, children, expanded, faceplateAccessoryRef, id, onToggle }) {
  const [transitioning, setTransitioning] = useState(false);
  const previousExpandedRef = useRef(expanded);

  useEffect(() => {
    if (previousExpandedRef.current === expanded) return undefined;
    previousExpandedRef.current = expanded;
    setTransitioning(true);
    const timeout = globalThis.setTimeout(() => setTransitioning(false), TRANSITION_FALLBACK_MS);
    return () => globalThis.clearTimeout(timeout);
  }, [expanded]);

  return <section
    className="modul8r-module"
    data-expanded={expanded || undefined}
    data-module={id}
    data-transitioning={transitioning || undefined}
  >
    <header className="modul8r-module__faceplate">
      <button
        aria-controls={`modul8r-${id}-content`}
        aria-expanded={expanded}
        className="modul8r-module__toggle"
        onClick={() => onToggle(id)}
        type="button"
      >
        <strong>{MODUL8R_MODULE_LABELS[id]}</strong>
        <MoreVertical aria-hidden="true" className="modul8r-module__grip" size={14} strokeWidth={2} />
        <span aria-hidden="true" className="modul8r-module__state">
          {expanded ? <ChevronUp size={13} strokeWidth={2} /> : <ChevronDown size={13} strokeWidth={2} />}
        </span>
      </button>
      {faceplateAccessoryRef && <div className="modul8r-module__faceplate-accessory" ref={faceplateAccessoryRef} />}
    </header>
    <div
      aria-hidden={!expanded}
      className="modul8r-module__reveal"
      inert={!expanded ? '' : undefined}
      onTransitionEnd={(event) => {
        if (event.target === event.currentTarget && event.propertyName === 'grid-template-rows') {
          setTransitioning(false);
        }
      }}
    >
      <div className="modul8r-module__body">
        <div className="modul8r-module__content" id={`modul8r-${id}-content`}>
          {typeof children === 'function' ? children({ active }) : children}
        </div>
      </div>
    </div>
  </section>;
}

function StructureOnlyModule({ id }) {
  return <div className="modul8r-structure-only" role="status">
    <strong>{MODUL8R_MODULE_LABELS[id]} MODULE</strong>
    <span>STRUCTURE ONLY / CONTENT IS NOT CONNECTED</span>
  </div>;
}

export default function Modul8rShell({
  initialOpenModule = DEFAULT_MODUL8R_OPEN_MODULE,
  masterAccessory = null,
  menuSurfaceId = 'carbon',
  moduleContent = {},
  moduleFaceplateAccessoryRefs = {},
  moduleRequest = null,
  onEscape,
  onModuleStateChange,
  onRequestClose,
  onSettingsRequest,
  returnFocusRef,
}) {
  const [shellState, setShellState] = useState(() => createModul8rShellState({
    openModule: initialOpenModule,
  }));
  const [masterTransitioning, setMasterTransitioning] = useState(false);
  const [masterMenuOpen, setMasterMenuOpen] = useState(false);
  const rootRef = useRef(null);
  const masterToggleRef = useRef(null);
  const masterMenuButtonRef = useRef(null);
  const floatingWindow = useLatticeFloatingWindow({ initialSize: INITIAL_SHELL_SIZE });

  useEffect(() => {
    if (!moduleRequest?.requestId || !MODUL8R_MODULE_ORDER.includes(moduleRequest.moduleId)) return;
    setMasterTransitioning(true);
    setShellState(createModul8rShellState({ masterExpanded: true, openModule: moduleRequest.moduleId }));
  }, [moduleRequest]);

  useEffect(() => {
    onModuleStateChange?.(shellState);
  }, [onModuleStateChange, shellState]);

  const requestClose = useCallback(() => {
    onRequestClose?.();
    globalThis.requestAnimationFrame?.(() => returnFocusRef?.current?.focus({ preventScroll: true }));
  }, [onRequestClose, returnFocusRef]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      if (onEscape?.()) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (masterMenuOpen) {
        event.preventDefault();
        event.stopPropagation();
        setMasterMenuOpen(false);
        globalThis.requestAnimationFrame?.(() => masterMenuButtonRef.current?.focus({ preventScroll: true }));
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      requestClose();
    };
    globalThis.addEventListener?.('keydown', onKeyDown, true);
    return () => globalThis.removeEventListener?.('keydown', onKeyDown, true);
  }, [masterMenuOpen, onEscape, requestClose]);

  useEffect(() => {
    if (!masterMenuOpen) return undefined;
    const close = (event) => {
      if (event.target.closest?.('.modul8r-master-menu,.modul8r-master__menu-button')) return;
      setMasterMenuOpen(false);
    };
    globalThis.addEventListener?.('pointerdown', close, true);
    return () => globalThis.removeEventListener?.('pointerdown', close, true);
  }, [masterMenuOpen]);

  useEffect(() => {
    if (!masterTransitioning) return undefined;
    const timeout = globalThis.setTimeout(() => setMasterTransitioning(false), TRANSITION_FALLBACK_MS);
    return () => globalThis.clearTimeout(timeout);
  }, [masterTransitioning]);

  const toggleMaster = () => {
    if (shellState.masterExpanded && rootRef.current?.contains(document.activeElement)
      && document.activeElement !== masterToggleRef.current) {
      masterToggleRef.current?.focus({ preventScroll: true });
    }
    setMasterTransitioning(true);
    setShellState((current) => toggleModul8rMaster(current));
  };

  const toggleModule = (moduleId) => {
    setShellState((current) => toggleModul8rModule(current, moduleId));
  };

  return <section
    aria-label="Modulator"
    className="modul8r-shell"
    data-collapsed={!shellState.masterExpanded || undefined}
    data-lattice-chrome
    data-lattice-menu-surface
    data-master-transitioning={masterTransitioning || undefined}
    data-menu-surface={menuSurfaceId}
    ref={rootRef}
    style={{
      '--modul8r-left': `${floatingWindow.windowPosition.left}px`,
      '--modul8r-top': `${floatingWindow.windowPosition.top}px`,
      '--modul8r-width': `${floatingWindow.windowSize.width}px`,
    }}
  >
    <header
      className="modul8r-master"
      onLostPointerCapture={floatingWindow.move.finish}
      onPointerCancel={floatingWindow.move.finish}
      onPointerDown={floatingWindow.move.begin}
      onPointerMove={floatingWindow.move.update}
      onPointerUp={floatingWindow.move.finish}
    >
      <span aria-hidden="true" className="modul8r-master__rail" />
      <button
        aria-expanded={shellState.masterExpanded}
        className="modul8r-master__collapse"
        onClick={() => {
          if (floatingWindow.move.consumeClickSuppression()) return;
          toggleMaster();
        }}
        onLostPointerCapture={(event) => {
          event.stopPropagation();
          floatingWindow.move.cancel(event);
        }}
        onPointerCancel={(event) => {
          event.stopPropagation();
          floatingWindow.move.cancel(event);
        }}
        onPointerDown={(event) => floatingWindow.move.begin(event, { allowInteractiveTarget: true })}
        onPointerMove={(event) => {
          event.stopPropagation();
          floatingWindow.move.update(event);
        }}
        onPointerUp={(event) => {
          event.stopPropagation();
          floatingWindow.move.finish(event);
        }}
        ref={masterToggleRef}
        type="button"
      ><span>MODUL-8R</span></button>
      {masterAccessory && <div className="modul8r-master__accessory">{masterAccessory}</div>}
      {onSettingsRequest && <button aria-expanded={masterMenuOpen} aria-haspopup="menu" aria-label="Modulator options"
        className="modul8r-master__menu-button" onClick={() => setMasterMenuOpen((open) => !open)} ref={masterMenuButtonRef} type="button">
        <MoreVertical aria-hidden="true" size={14} strokeWidth={2} />
      </button>}
      <button aria-label="Close Modulator" className="modul8r-master__close" onClick={requestClose} type="button">
        <X aria-hidden="true" size={16} strokeWidth={2} />
      </button>
      {masterMenuOpen && <div aria-label="Modulator options" className="modul8r-master-menu" role="menu">
        <button onClick={() => { setMasterMenuOpen(false); onSettingsRequest?.(masterMenuButtonRef.current); }} role="menuitem" type="button">
          <i aria-hidden="true" />SETTINGS
        </button>
      </div>}
    </header>
    <div
      aria-hidden={!shellState.masterExpanded}
      className="modul8r-shell__modules-reveal"
      inert={!shellState.masterExpanded ? '' : undefined}
      onTransitionEnd={(event) => {
        if (event.target === event.currentTarget && event.propertyName === 'grid-template-rows') {
          setMasterTransitioning(false);
        }
      }}
    >
      <div className="modul8r-modules">
        {MODUL8R_MODULE_ORDER.map((id) => <Modul8rModule
          active={shellState.masterExpanded && shellState.openModule === id}
          expanded={shellState.openModule === id}
          faceplateAccessoryRef={moduleFaceplateAccessoryRefs[id]}
          id={id}
          key={id}
          onToggle={toggleModule}
        >{moduleContent[id] ?? (import.meta.env.DEV ? <StructureOnlyModule id={id} /> : null)}</Modul8rModule>)}
      </div>
    </div>
    {shellState.masterExpanded && <button
      aria-label="Resize Modulator width"
      className="modul8r-shell__width-resize"
      onKeyDown={floatingWindow.rackWidthResize.keyDown}
      onLostPointerCapture={floatingWindow.rackWidthResize.finish}
      onPointerCancel={floatingWindow.rackWidthResize.finish}
      onPointerDown={floatingWindow.rackWidthResize.begin}
      onPointerMove={floatingWindow.rackWidthResize.update}
      onPointerUp={floatingWindow.rackWidthResize.finish}
      role="separator"
      title="Drag or use Left and Right Arrow to resize MODUL-8R"
      type="button"
    />}
  </section>;
}
