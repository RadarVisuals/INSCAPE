import { Home, Plus } from 'lucide-react';
import './keeperDockContent.css';

// Shared by the workspace reference and the live dock; Keeper owns its actions.
export default function KeeperDockContent({ empty, away, label, hint, children }) {
  return <span className="keeper-dock-content">
    <span className={`keeper-dock-artwork${empty ? ' keeper-dock-artwork--empty' : ''}`} aria-hidden="true">
      {empty ? <Plus size={22} /> : children}
    </span>
    <span>{label}</span>
    {hint && <small>{hint}</small>}
    {away && <Home className="keeper-home" aria-hidden="true" />}
  </span>;
}
