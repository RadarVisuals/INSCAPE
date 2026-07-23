import { useEffect, useState } from 'react';
import './categoryNavigationCard.css';

export default function CategoryNavigationCard({ items = [], activeId = null, visible = false, onSelect }) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!visible) setExpanded(false);
  }, [visible]);

  useEffect(() => {
    if (!expanded) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [expanded]);

  const expandedHeight = 50 + Math.max(1, items.length) * 44;

  return <section
    className="category-navigation-card"
    aria-label="Profile categories"
    aria-hidden={!visible}
    data-visible={visible || undefined}
    data-expanded={expanded || undefined}
    style={{ '--category-expanded-height': `${expandedHeight}px` }}
    onPointerDown={(event) => event.stopPropagation()}
    onClick={(event) => event.stopPropagation()}
  >
    <header>
      <button
        type="button"
        tabIndex={visible ? 0 : -1}
        aria-expanded={expanded}
        aria-label={expanded ? 'Close profile categories' : 'Open profile categories'}
        onClick={() => setExpanded((current) => !current)}
      >
        <strong>CATEGORIES</strong>
        <i aria-hidden="true">{expanded ? '×' : '›'}</i>
      </button>
    </header>
    <nav aria-label="Published categories">
      {items.length > 0 ? items.map((item, index) => <button
        key={item.id}
        type="button"
        data-active={activeId === item.id || undefined}
        tabIndex={expanded ? 0 : -1}
        onClick={() => onSelect?.(item)}
      >
        <small>{String(index + 1).padStart(2, '0')}</small>
        <span>{item.label}</span>
        <i aria-hidden="true">↗</i>
      </button>) : <p>NO PUBLIC CATEGORIES</p>}
    </nav>
  </section>;
}
