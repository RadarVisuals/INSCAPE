import DesktopMenu from './DesktopMenu.jsx';
import './rackMenu.css';

export default function RackMenu({ className = '', ...props }) {
  const classes = ['rack-menu-surface', 'rack-menu-command-surface', className].filter(Boolean).join(' ');
  return <DesktopMenu {...props} className={classes} panelClassName="rack-menu-surface rack-menu-command-surface" />;
}
