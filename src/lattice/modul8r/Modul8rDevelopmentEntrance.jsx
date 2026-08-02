import { useRef, useState } from 'react';
import Modul8rShell from './Modul8rShell.jsx';

const THEMES = Object.freeze(['carbon', 'graphite', 'slate', 'ash', 'mist', 'paper']);

export default function Modul8rDevelopmentEntrance() {
  const [menuSurfaceId, setMenuSurfaceId] = useState('carbon');
  const [open, setOpen] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const reopenRef = useRef(null);

  return <main
    className="modul8r-development-entrance"
    data-lattice-menu-surface
    data-menu-surface={menuSurfaceId}
    data-reduced-motion={reducedMotion || undefined}
  >
    <aside aria-label="MODUL-8R development review controls" className="modul8r-development-controls">
      <strong>TASK 2 / OWNER REVIEW</strong>
      <label>THEME<select onChange={(event) => setMenuSurfaceId(event.target.value)} value={menuSurfaceId}>
        {THEMES.map((theme) => <option key={theme} value={theme}>{theme.toUpperCase()}</option>)}
      </select></label>
      <label>REDUCED MOTION<input checked={reducedMotion} onChange={(event) => setReducedMotion(event.target.checked)} type="checkbox" /></label>
      <a href="/prototype/modul-8r">OPEN ACCEPTED PROTOTYPE</a>
    </aside>
    {open ? <Modul8rShell
      menuSurfaceId={menuSurfaceId}
      onRequestClose={() => setOpen(false)}
      returnFocusRef={reopenRef}
    /> : <button className="modul8r-development-reopen" onClick={() => setOpen(true)} ref={reopenRef} type="button">
      OPEN MODUL-8R
    </button>}
  </main>;
}
