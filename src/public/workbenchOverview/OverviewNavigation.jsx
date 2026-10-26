import { useEffect, useRef, useState } from 'react';
import { UserRound, Plus, List, LayoutGrid, Repeat, GripVertical } from 'lucide-react';
import { MAX_WORKBENCHES } from '../../systemWorkflow/domain/workbenchCollection.js';

export default function OverviewNavigation({ profile, address, disabled, onAbout, onCanvases, view, onViewChange, count, onCreate, triggerRef, arranging, onArrange, cardSize, onCardSize }) {
  const [avatarFailed, setAvatarFailed] = useState(false), [open, setOpen] = useState(false);
  const root = useRef(null);
  useEffect(() => { setAvatarFailed(false); }, [profile?.avatarUrl]);
  useEffect(() => {
    if (!open) return;
    root.current?.querySelector('.workbench-overview-menu button')?.focus({ preventScroll: true });
    const outside = event => { if (!root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  const name = profile?.name || `${address.slice(0, 6)}…${address.slice(-4)}`;
  const go = action => { setOpen(false); action(); };
  return <header className="workbench-overview-navigation" ref={root} data-open={open || undefined}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
    onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); setOpen(false); triggerRef.current?.focus(); } }}>
    <div className="workbench-overview-menu-fold" inert={open ? undefined : ''} aria-hidden={!open}><section className="workbench-overview-menu" aria-label="Inscape menu">
    <div className="workbench-overview-identity" title={address}>
      <span className="workbench-overview-avatar">{profile?.avatarUrl && !avatarFailed
        ? <img src={profile.avatarUrl} alt="" onError={() => setAvatarFailed(true)} />
        : <UserRound size={18} aria-hidden="true" />}</span>
      <span>{name}</span>
    </div>
    <nav aria-label="Inscape navigation">
      {onAbout && <button type="button" onClick={() => go(onAbout)}>About</button>}
      <button type="button" aria-current="page" onClick={() => go(onCanvases)}>Canvases</button>
    </nav>
    <div className="workbench-overview-view-controls" role="group" aria-label="Overview layout">
      <button type="button" aria-label="List" title="List" aria-pressed={view.layout === 'list'} onClick={() => onViewChange({ ...view, layout: 'list' })}><List size={16} /></button>
      <button type="button" aria-label="Grid" title="Grid" aria-pressed={view.layout === 'grid'} onClick={() => onViewChange({ ...view, layout: 'grid' })}><LayoutGrid size={16} /></button>
      <button type="button" aria-label="Wrap around" title="Wrap around" aria-pressed={view.wrap} disabled={view.layout !== 'grid' || count < 2}
        onClick={() => onViewChange({ ...view, wrap: !view.wrap })}><Repeat size={16} /></button>
    </div>
    {view.layout === 'grid' && <div className="workbench-overview-arrangement">
      <label>Card size<input type="range" aria-label="Card size" min="1" max="3" step="1" value={cardSize}
        onChange={event => onCardSize(Number(event.target.value))} /><span>{['Small', 'Medium', 'Large'][cardSize - 1]}</span></label>
      <button type="button" aria-pressed={arranging} disabled={count < 2} onClick={() => go(onArrange)}><GripVertical size={16} />{arranging ? 'Finish arranging' : 'Arrange canvases'}</button>
    </div>}
    <button className="workbench-overview-menu-create" type="button" disabled={count >= MAX_WORKBENCHES} onClick={() => go(onCreate)}><Plus size={16} />New Workbench</button>
    {count >= MAX_WORKBENCHES && <small>All {MAX_WORKBENCHES} local Workbenches are in use.</small>}
    </section></div>
    <button ref={triggerRef} className="workbench-overview-menu-trigger" type="button" disabled={disabled} aria-label="Inscape menu" aria-expanded={open}
      onClick={() => setOpen(!open)}><span>INSCAPE</span><span className="workbench-overview-menu-icon" aria-hidden="true"><i /><i /></span></button>
  </header>;
}
