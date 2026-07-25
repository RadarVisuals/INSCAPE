import { useCallback, useEffect, useRef, useState } from 'react';
import './categoryNavigationCard.css';

export default function CategoryNavigationCard({ items = [], emptyLabel = 'NO PUBLIC CATEGORIES', activeId = null, visible = false, onSelect, onContext, onExpandedChange, collapseRequested = false }) {
  const [expanded, setExpanded] = useState(false);
  const onExpandedChangeRef = useRef(onExpandedChange);
  onExpandedChangeRef.current = onExpandedChange;

  const changeExpanded = useCallback((value) => {
    if (value === expanded) return;
    setExpanded(value);
    onExpandedChangeRef.current?.(value);
  }, [expanded]);

  useEffect(() => {
    if (!visible) changeExpanded(false);
  }, [changeExpanded, visible]);

  useEffect(() => {
    if (collapseRequested) changeExpanded(false);
  }, [changeExpanded, collapseRequested]);

  useEffect(() => {
    if (!expanded) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') changeExpanded(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [changeExpanded, expanded]);

  const expandedHeight = items.length ? 50 + items.length * 44 : 88;

  return <section
    className="category-navigation-card"
    aria-label="Profile categories"
    aria-hidden={!visible}
    data-visible={visible || undefined}
    data-expanded={expanded || undefined}
    data-empty={!items.length || undefined}
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
        onClick={() => changeExpanded(!expanded)}
      >
        <strong>CATEGORIES</strong>
        <i aria-hidden="true">›</i>
      </button>
    </header>
    <nav aria-label="Published categories" style={!items.length ? { overflowY: 'hidden' } : undefined}>
      {items.length > 0 ? items.map((item, index) => <button
        key={item.id}
        type="button"
        data-active={activeId === item.id || undefined}
        tabIndex={expanded ? 0 : -1}
        onClick={() => onSelect?.(item)}
        onContextMenu={onContext ? (event) => onContext(event, item) : undefined}
      >
        <small>{String(index + 1).padStart(2, '0')}</small>
        <span>{item.label}{typeof item.public === 'boolean' && <small> / {item.public ? 'PUBLIC' : 'PRIVATE'}</small>}</span>
        <i aria-hidden="true">↗</i>
      </button>) : <p>{emptyLabel}</p>}
    </nav>
  </section>;
}
