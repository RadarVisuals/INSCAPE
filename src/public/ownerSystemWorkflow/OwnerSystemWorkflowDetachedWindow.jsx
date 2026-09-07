import { forwardRef } from 'react';

const OwnerSystemWorkflowDetachedWindow = forwardRef(function OwnerSystemWorkflowDetachedWindow({
  ariaLabel,
  children,
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
  return <aside aria-label={ariaLabel} className={rootClassName} data-detached-window data-floating ref={ref} style={style}>
    <header className="system-workflow__detached-window-titlebar" {...headerPointerProps}>
      {titleContent ?? <strong title={title}>{title}</strong>}
      <span className="system-workflow__detached-window-controls">{controls}</span>
    </header>
    <div className={contentClassName}>{children}</div>
    {resizeHandleProps && <div {...resizeHandleProps} className="system-workflow__detached-window-resize" />}
  </aside>;
});

export default OwnerSystemWorkflowDetachedWindow;
