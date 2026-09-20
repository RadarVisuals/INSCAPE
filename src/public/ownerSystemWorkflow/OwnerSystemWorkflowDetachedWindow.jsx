import { forwardRef } from 'react';
import './workbenchWindowChrome.css';

const OwnerSystemWorkflowDetachedWindow = forwardRef(function OwnerSystemWorkflowDetachedWindow({
  ariaLabel,
  viewId,
  as: Element = 'aside',
  children,
  background,
  compactContent,
  chrome,
  menuSurface,
  className = '',
  controls,
  headerPointerProps,
  resizeHandleProps,
  style,
  surfaceClassName = '',
  title,
  titleContent,
}, ref) {
  const rootClassName = `system-workflow__detached-window${className ? ` ${className}` : ''}`;
  const contentClassName = `system-workflow__detached-window-surface${surfaceClassName ? ` ${surfaceClassName}` : ''}`;
  return <Element aria-label={ariaLabel} className={rootClassName} data-workbench-view-id={viewId} data-window-chrome={chrome} data-menu-surface={menuSurface} data-detached-window data-floating ref={ref} style={style}>
    {background}
    <header style={compactContent ? { display: 'none' } : undefined} className="system-workflow__detached-window-titlebar" {...headerPointerProps}>
      {titleContent ?? <strong title={title}>{title}</strong>}
      <span className="system-workflow__detached-window-controls">{controls}</span>
    </header>
    <div style={compactContent ? { display: 'none' } : undefined} className={contentClassName}>{children}</div>
    {compactContent}
    {resizeHandleProps && <div {...resizeHandleProps} className="system-workflow__detached-window-resize" />}
  </Element>;
});

export default OwnerSystemWorkflowDetachedWindow;
