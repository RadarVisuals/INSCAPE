import { useEffect, useId, useRef, useState } from 'react';

export default function VisitorMenu({ name, trigger, buttonRef, children }) {
  const id = useId(), root = useRef(null), localButton = useRef(null);
  const button = buttonRef || localButton;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const outside = e => { if (!root.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  return <div ref={root} className="visitor-menu" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}
    onKeyDown={e => { if (e.key === 'Escape' && open) { e.preventDefault(); setOpen(false); button.current?.focus(); } }}>
    <button ref={button} type="button" aria-label={name} aria-expanded={open} aria-controls={open ? id : undefined}
      onClick={() => setOpen(!open)}>{trigger}</button>
    {open && <div className="visitor-popover" id={id} onClick={e => { if (e.target.closest('a, button')) { setOpen(false); button.current?.focus(); } }}>{children}</div>}
  </div>;
}
