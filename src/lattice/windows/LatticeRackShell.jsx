import { useRef } from 'react';
import { MoreVertical, X } from 'lucide-react';
import './latticeRackShell.css';

export function LatticeRackModule({
  children,
  contentClassName = '',
  contentHeight = 40,
  expanded,
  expandable = true,
  faceplateAccessory = null,
  fill = false,
  label,
  onExpandedChange,
  signal,
}) {
  const heading = <>
    <strong>{label}</strong>
    <MoreVertical aria-hidden="true" className="lattice-rack-grip" size={14} strokeWidth={2} />
  </>;
  return <section className="lattice-rack-module" data-expanded={expanded || undefined} data-fill={fill || undefined}
    data-signal={signal} data-static={!expandable || undefined}
    style={!fill ? { '--lattice-rack-module-content-height': `${contentHeight}px` } : undefined}>
    <header className="lattice-rack-module__faceplate"
      onClick={expandable ? () => onExpandedChange?.(!expanded) : undefined}>
      {expandable ? <button className="lattice-rack-module__toggle" aria-expanded={expanded}
        onClick={(event) => { event.stopPropagation(); onExpandedChange?.(!expanded); }} type="button">{heading}</button>
        : <div className="lattice-rack-module__toggle">{heading}</div>}
      {faceplateAccessory && <div className="lattice-rack-module__accessory"
        onPointerDown={(event) => event.stopPropagation()}>{faceplateAccessory}</div>}
    </header>
    {expandable && <div aria-hidden={!expanded || undefined} className={`lattice-rack-module__content${contentClassName ? ` ${contentClassName}` : ''}`}
      hidden={!expanded} inert={!expanded ? '' : undefined}>{children}</div>
    }
  </section>;
}

export default function LatticeRackShell({
  children,
  expanded = true,
  label = 'THE RACK',
  masterAccessory = null,
  move,
  onClose,
  onExpandedChange,
  onMenuRequest,
}) {
  const masterPointer = useRef(null);
  const beginMasterPointer = (event) => {
    masterPointer.current = { moved: false, x: event.clientX, y: event.clientY };
    move?.begin?.(event);
  };
  const updateMasterPointer = (event) => {
    const pointer = masterPointer.current;
    if (pointer && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 4) pointer.moved = true;
    move?.update?.(event);
  };
  const toggleFromMaster = (event) => {
    if (event.target.closest?.('button,input,select,textarea,a,[data-rack-master-control]')) return;
    if (masterPointer.current?.moved) { masterPointer.current = null; return; }
    masterPointer.current = null;
    onExpandedChange?.(!expanded);
  };
  return <>
    <header aria-expanded={expanded} className="lattice-rack-masterbar"
      onClick={toggleFromMaster}
      onLostPointerCapture={move?.finish} onPointerCancel={move?.finish}
      onPointerDown={beginMasterPointer} onPointerMove={updateMasterPointer} onPointerUp={move?.finish}>
      <span aria-hidden="true" className="lattice-rack-masterbar__rail" />
      <strong>{label}</strong>
      {masterAccessory && <div className="lattice-rack-masterbar__accessory" data-rack-master-control
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}>{masterAccessory}</div>}
      <button aria-label={`${label} options`} className="lattice-rack-masterbar__menu" data-rack-master-control
        onClick={onMenuRequest} type="button">
        <MoreVertical aria-hidden="true" size={14} strokeWidth={2} />
      </button>
      <button aria-label={`Close ${label}`} data-rack-master-control onClick={onClose} type="button">
        <X aria-hidden="true" size={18} strokeWidth={2.4} />
      </button>
    </header>
    {children}
  </>;
}
