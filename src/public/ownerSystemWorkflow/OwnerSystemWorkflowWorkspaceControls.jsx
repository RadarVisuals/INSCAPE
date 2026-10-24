import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronUp, Search, X } from 'lucide-react';
import useDeferredFocusReturn from '../useDeferredFocusReturn.js';

export function OwnerSystemWorkflowSelectMenu({ flat = false, compact = false, defaultValue, label, menuSurface, onChange, options, triggerPrefix, value }) {
  const [open, setOpen] = useState(false); const [position, setPosition] = useState(null); const [activeIndex, setActiveIndex] = useState(0);
  const triggerRef = useRef(null); const menuRef = useRef(null); const optionRefs = useRef([]);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value)); const selectedLabel = options[selectedIndex]?.label || label;
  const { restoreFocus, cancelFocusReturn } = useDeferredFocusReturn();
  const close = useCallback((focus = false) => { cancelFocusReturn(); setOpen(false); if (focus) restoreFocus(triggerRef.current); }, [cancelFocusReturn, restoreFocus]);
  const show = () => {
    cancelFocusReturn();
    const rect = triggerRef.current?.getBoundingClientRect(); if (!rect) return;
    const width = Math.min(252, innerWidth - 24), above = rect.top - 18, below = innerHeight - rect.bottom - 18;
    const upward = above >= below;
    setPosition({ ...(upward ? { bottom: innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
      left: Math.max(12, Math.min(rect.right - width, innerWidth - width - 12)), width,
      maxHeight: Math.max(0, Math.min(360, upward ? above : below)) });
    setActiveIndex(selectedIndex); setOpen(true);
  };
  useLayoutEffect(() => { if (open) optionRefs.current[activeIndex]?.focus(); }, [activeIndex, open]);
  useEffect(() => { if (!open) return undefined; const dismiss = (event) => { if (!triggerRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) close(); }; addEventListener('pointerdown', dismiss, true); return () => removeEventListener('pointerdown', dismiss, true); }, [open, close]);
  useEffect(() => {
    if (!open) return undefined;
    const dismiss = event => { if (!menuRef.current?.contains(event.target)) close(); };
    addEventListener('resize', dismiss); document.addEventListener('scroll', dismiss, true);
    return () => { removeEventListener('resize', dismiss); document.removeEventListener('scroll', dismiss, true); };
  }, [open, close]);
  const triggerLabel = compact
    ? value === defaultValue && triggerPrefix ? triggerPrefix : selectedLabel
    : `${triggerPrefix ? `${triggerPrefix}: ` : ''}${selectedLabel}`;
  return <><button aria-expanded={open} aria-haspopup="listbox" aria-label={`${label}: ${selectedLabel}`} className="system-workflow__rail-select" onClick={() => open ? close() : show()} ref={triggerRef} type="button"><span>{triggerLabel}</span><ChevronUp size={12} /></button>
    {open && position && createPortal(<div className="system-workflow__select-popover" data-workflow-menu={flat || undefined} data-workflow-material={flat ? "tactile" : undefined} data-workflow-finish={flat ? "flat" : undefined} data-lattice-menu-surface data-menu-surface={menuSurface} data-system-workflow-overlay onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex((index) => (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length); } }} ref={menuRef} role="listbox" style={position}>{!compact && <header>{label}</header>}{options.map((option, index) => <button aria-selected={option.value === value} key={option.value} onClick={() => { onChange(option.value); close(true); }} onFocus={() => setActiveIndex(index)} ref={(node) => { optionRefs.current[index] = node; }} role="option" tabIndex={index === activeIndex ? 0 : -1} type="button"><span>{option.label}</span></button>)}</div>, document.body)}
  </>;
}

export function OwnerSystemWorkflowFilterMenu({ flat = false, menuSurface, onChange, options, value }) {
  const [open, setOpen] = useState(false); const [position, setPosition] = useState(null); const triggerRef = useRef(null); const menuRef = useRef(null);
  const { restoreFocus, cancelFocusReturn } = useDeferredFocusReturn();
  const active = value !== 'all'; const selected = options.find((option) => option.value === value)?.label || 'All';
  const close = useCallback((focus = false) => {
    cancelFocusReturn(); setOpen(false);
    if (focus) restoreFocus(triggerRef.current);
  }, [cancelFocusReturn, restoreFocus]);
  const leave = event => { if (!triggerRef.current?.contains(event.relatedTarget) && !menuRef.current?.contains(event.relatedTarget)) close(); };
  const keyDown = event => { if (open && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); } };
  const locate = () => { const rect = triggerRef.current?.getBoundingClientRect(); if (!rect) return; const workspaceTop = triggerRef.current?.closest('.system-workflow__workspace-window')?.getBoundingClientRect().top ?? 0; const width = Math.min(252, innerWidth - 24); setPosition({ bottom: innerHeight - rect.top + 6, left: Math.max(12, Math.min(rect.right - width, innerWidth - width - 12)), maxHeight: Math.max(36, rect.top - workspaceTop - 24), width }); };
  const show = () => { cancelFocusReturn(); locate(); setOpen(true); };
  useLayoutEffect(() => { if (open) menuRef.current?.querySelector('[aria-checked="true"]')?.focus({ preventScroll: true }); }, [open]);
  useLayoutEffect(() => { if (open) menuRef.current?.querySelector('[aria-checked="true"]')?.scrollIntoView({ block: 'nearest' }); }, [open, position?.maxHeight]);
  useEffect(() => { if (!open) return undefined; addEventListener('resize', locate); return () => removeEventListener('resize', locate); }, [open]);
  useEffect(() => { if (!open) return undefined; const dismiss = (event) => { if (!triggerRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) close(); }; addEventListener('pointerdown', dismiss, true); return () => removeEventListener('pointerdown', dismiss, true); }, [open, close]);
  return <><button aria-expanded={open} aria-haspopup="dialog" aria-label={`Filters: ${selected}`} className="system-workflow__rail-select" data-active={active || undefined} onBlur={leave} onClick={() => open ? close() : show()} onKeyDown={keyDown} ref={triggerRef} type="button"><span>{active ? selected : 'Filters'}</span><ChevronUp size={12} /></button>
    {open && position && createPortal(<div aria-label="Filters" className="system-workflow__filter-popover" data-workflow-menu={flat || undefined} data-workflow-material={flat ? "tactile" : undefined} data-workflow-finish={flat ? "flat" : undefined} data-lattice-menu-surface data-menu-surface={menuSurface} data-system-workflow-overlay onBlur={leave} onKeyDown={keyDown} ref={menuRef} role="dialog" style={position}><div className="system-workflow__filter-options" role="radiogroup">{options.map((option) => <button aria-checked={option.value === value} key={option.value} onClick={() => onChange(option.value)} role="radio" type="button"><span>{option.label}</span></button>)}</div></div>, document.body)}
  </>;
}

export default function OwnerSystemWorkflowWorkspaceRail({ menuSurface, onClose, workspace }) {
  const collections = [{ label: 'All', value: 'all' }, ...workspace.collections.map((collection) => ({ label: collection, value: collection }))];
  const sorts = [{ label: 'A–Z', value: 'title-asc' }, { label: 'Z–A', value: 'title-desc' }, { label: 'Collection', value: 'collection' }];
  return <div className="system-workflow__workspace-rail-controls">
    <label className="system-workflow__workspace-search"><Search size={13} /><input aria-label="Search" onChange={(event) => workspace.setQuery(event.target.value)} placeholder="Search" type="search" value={workspace.query} /></label>
    <label className="system-workflow__workspace-labels"><input checked={!workspace.hideLabels} onChange={(event) => workspace.setHideLabels(!event.target.checked)} type="checkbox" /><span>Labels</span></label>
    <label className="system-workflow__workspace-size"><span>Size</span><input aria-label="Card size" max={workspace.assetSizeBounds.MAXIMUM} min={workspace.assetSizeBounds.MINIMUM} onChange={(event) => workspace.setAssetSize(Number(event.target.value))} type="range" value={workspace.assetSize} /></label>
    <OwnerSystemWorkflowFilterMenu flat menuSurface={menuSurface} onChange={workspace.setCollection} options={collections} value={workspace.collection} />
    <OwnerSystemWorkflowSelectMenu flat compact label="Sort assets" menuSurface={menuSurface} onChange={workspace.setSort} options={sorts} value={workspace.sort} />
    <button aria-label="Close workspace" className="system-workflow__workspace-close" onClick={onClose} title="Close workspace" type="button"><X size={13} /></button>
  </div>;
}
