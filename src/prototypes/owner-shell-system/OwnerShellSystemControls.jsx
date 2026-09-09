import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronUp, Search, X } from 'lucide-react';

export function OwnerShellSystemSelectMenu({ className = '', label, menuSurface, onChange, options, triggerLabel, triggerPrefix, value }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const optionRefs = useRef([]);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const selectedLabel = options[selectedIndex]?.label || label;

  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  };
  const updatePosition = () => {
    const rectangle = triggerRef.current?.getBoundingClientRect();
    if (!rectangle) return;
    const width = Math.min(252, globalThis.innerWidth - 24);
    setPosition({
      bottom: globalThis.innerHeight - rectangle.top + 6,
      left: Math.max(12, Math.min(rectangle.right - width, globalThis.innerWidth - width - 12)),
      width,
    });
  };
  const show = (index = selectedIndex) => {
    setActiveIndex(index);
    updatePosition();
    setOpen(true);
  };
  const select = (option) => {
    onChange(option.value);
    close(true);
  };

  useLayoutEffect(() => {
    if (!open) return undefined;
    optionRefs.current[activeIndex]?.focus();
    return undefined;
  }, [activeIndex, open]);

  useEffect(() => {
    if (!open) return undefined;
    const dismiss = (event) => {
      if (triggerRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return;
      close(false);
    };
    const reposition = () => updatePosition();
    globalThis.addEventListener('pointerdown', dismiss, true);
    globalThis.addEventListener('resize', reposition);
    globalThis.addEventListener('scroll', reposition, true);
    return () => {
      globalThis.removeEventListener('pointerdown', dismiss, true);
      globalThis.removeEventListener('resize', reposition);
      globalThis.removeEventListener('scroll', reposition, true);
    };
  }, [open]);

  const moveActive = (offset) => setActiveIndex((current) => (current + offset + options.length) % options.length);
  const handleMenuKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveActive(event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      setActiveIndex(event.key === 'Home' ? 0 : options.length - 1);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    }
  };

  return <>
    <button aria-expanded={open} aria-haspopup="listbox" aria-label={`${label}: ${selectedLabel}`}
      className={`owner-shell-system__rail-select ${className}`.trim()} onClick={() => open ? close(false) : show()} onKeyDown={(event) => {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      event.preventDefault();
      show(event.key === 'ArrowDown' ? selectedIndex : (selectedIndex - 1 + options.length) % options.length);
    }} ref={triggerRef} type="button">
      <span>{triggerLabel || (triggerPrefix ? `${triggerPrefix}: ${selectedLabel}` : selectedLabel)}</span><ChevronUp aria-hidden="true" size={12} />
    </button>
    {open && position && createPortal(<div className="owner-shell-system__select-popover" data-lattice-menu-surface data-menu-surface={menuSurface}
      onKeyDown={handleMenuKeyDown} ref={menuRef} role="listbox" style={position}>
      <header>{label}</header>
      {options.map((option, index) => <button aria-selected={option.value === value} key={option.value}
        onClick={() => select(option)} onFocus={() => setActiveIndex(index)} ref={(node) => { optionRefs.current[index] = node; }} role="option" tabIndex={index === activeIndex ? 0 : -1} type="button">
        <Check aria-hidden="true" size={13} /><span>{option.label}</span>
      </button>)}
    </div>, document.body)}
  </>;
}

export function OwnerShellSystemFilterMenu({ active, accessibleLabel, menuSurface, onChange, onReset, options, value }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  };
  const updatePosition = () => {
    const rectangle = triggerRef.current?.getBoundingClientRect();
    if (!rectangle) return;
    const width = Math.min(252, globalThis.innerWidth - 24);
    setPosition({
      bottom: globalThis.innerHeight - rectangle.top + 6,
      left: Math.max(12, Math.min(rectangle.right - width, globalThis.innerWidth - width - 12)),
      width,
    });
  };
  const show = () => {
    updatePosition();
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return undefined;
    const dismiss = (event) => {
      if (triggerRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return;
      close(false);
    };
    const reposition = () => updatePosition();
    globalThis.addEventListener('pointerdown', dismiss, true);
    globalThis.addEventListener('resize', reposition);
    globalThis.addEventListener('scroll', reposition, true);
    return () => {
      globalThis.removeEventListener('pointerdown', dismiss, true);
      globalThis.removeEventListener('resize', reposition);
      globalThis.removeEventListener('scroll', reposition, true);
    };
  }, [open]);

  return <>
    <button aria-expanded={open} aria-haspopup="dialog" aria-label="Filters"
      className="owner-shell-system__rail-select" data-active={active || undefined}
      onClick={() => open ? close(false) : show()} ref={triggerRef} type="button">
      <span>FILTERS</span><ChevronUp aria-hidden="true" size={12} />
    </button>
    {open && position && createPortal(<div aria-label="Filters" className="owner-shell-system__filter-popover"
      data-lattice-menu-surface data-menu-surface={menuSurface} onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        close(true);
      }} ref={menuRef} role="dialog" style={position}>
      <header><span>FILTERS</span>{active && <button onClick={onReset} type="button">RESET</button>}</header>
      <div aria-label={accessibleLabel} className="owner-shell-system__filter-options" role="radiogroup">
        {options.map((option) => <button aria-checked={option.value === value} key={option.value}
          onClick={() => onChange(option.value)} role="radio" type="button">
          <Check aria-hidden="true" size={13} /><span>{option.label}</span>
        </button>)}
      </div>
    </div>, document.body)}
  </>;
}

export function OwnerShellSystemSearch({ onChange, placeholder = '', value }) {
  return <label className="owner-shell-system__workspace-search">
    <Search aria-hidden="true" size={13} /><span>SEARCH</span>
    <input aria-label="Search" onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type="search" value={value} />
  </label>;
}

export function OwnerShellSystemWorkspaceRail({
  filterMenu,
  labelsVisible,
  menuSurface,
  onClose,
  onLabelsVisibleChange,
  onQueryChange,
  onSizeChange,
  query,
  secondaryMenu,
  size,
  sizeBounds,
}) {
  return <div className="owner-shell-system__workspace-rail-controls">
    <OwnerShellSystemSearch onChange={onQueryChange} value={query} />
    <label className="owner-shell-system__workspace-size">
      <span>SIZE</span><input aria-label="Card size" max={sizeBounds.maximum} min={sizeBounds.minimum}
        onChange={(event) => onSizeChange(Number(event.target.value))} type="range" value={size} />
      <output>{size}</output>
    </label>
    <OwnerShellSystemFilterMenu menuSurface={menuSurface} {...filterMenu} />
    <OwnerShellSystemSelectMenu menuSurface={menuSurface} {...secondaryMenu} />
    <label className="owner-shell-system__workspace-labels"><input checked={labelsVisible}
      onChange={(event) => onLabelsVisibleChange(event.target.checked)} type="checkbox" /><span>LABELS</span></label>
    <button aria-label="Close workspace" className="owner-shell-system__workspace-close"
      onClick={onClose} title="Close workspace" type="button"><X aria-hidden="true" size={13} /></button>
  </div>;
}
