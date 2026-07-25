import './floatingWindow.css';

export default function FloatingWindowCloseButton({ onClose, label = 'Close window', className = '' }) {
  return <button
    className={`floating-window-close${className ? ` ${className}` : ''}`}
    type="button"
    aria-label={label}
    onClick={onClose}
  >&times;</button>;
}
