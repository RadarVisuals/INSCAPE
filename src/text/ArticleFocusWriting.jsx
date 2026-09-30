import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './textFocus.css';

const relativeLuminance = channels => channels.reduce((sum, channel, index) => {
  const value = channel / 255;
  return sum + (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][index];
}, 0);
const contrast = (first, second) => (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);

// A stable portal target keeps the article, EditorContent and node views mounted.
// Only its DOM location changes; no second editor or document copy is created.
export default function ArticleFocusWriting({ children, active, onClose, editor, returnFocus, title, background, saveError }) {
  const [mount] = useState(() => {
    const element = document.createElement('div');
    element.className = 'text-editor-mount';
    return element;
  });
  const slot = useRef(null), dialog = useRef(null), scroll = useRef(null);
  const wasActive = useRef(false);
  useLayoutEffect(() => {
    const modal = dialog.current;
    if (active) {
      const page = mount.querySelector('.text-editor-page');
      const ink = getComputedStyle(page).color;
      const channels = ink.match(/[\d.]+/g)?.slice(0, 3).map(Number) || [255, 255, 255];
      const luminance = relativeLuminance(channels);
      const darkContrast = contrast(luminance, relativeLuminance([16, 17, 17]));
      const lightContrast = contrast(luminance, relativeLuminance([253, 254, 253]));
      scroll.current.style.color = ink;
      scroll.current.style.background = background || (darkContrast > lightContrast ? '#101111' : '#fdfefd');
      scroll.current.append(mount);
      if (!modal.open) modal.showModal();
      if (!editor.isDestroyed) { editor.view.focus(); editor.commands.scrollIntoView(); }
    } else {
      slot.current.append(mount);
      if (modal.open) modal.close();
      if (wasActive.current && !editor.isDestroyed) editor.commands.scrollIntoView();
      if (wasActive.current && returnFocus.current?.isConnected) returnFocus.current.focus({ preventScroll: true });
    }
    wasActive.current = active;
  }, [active, editor, mount, returnFocus, background]);
  useLayoutEffect(() => () => { mount.remove(); }, [mount]);
  return <>
    <div ref={slot} className="text-focus-slot" />
    {createPortal(<dialog ref={dialog} className="text-focus-dialog text-workbench system-workflow__token-scope" role="dialog" aria-modal="true" aria-label="Focus writing"
      onClick={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}
      onPointerDown={event => event.stopPropagation()} onPointerUp={event => event.stopPropagation()}
      onKeyDown={event => {
        event.stopPropagation();
        if (event.key === 'Escape' && !event.nativeEvent.isComposing) { event.preventDefault(); onClose(); return; }
        if (event.key !== 'Tab') return;
        const targets = [...event.currentTarget.querySelectorAll('button, input, textarea, select, [tabindex], [contenteditable=true]')]
          .filter(element => !element.disabled && element.tabIndex >= 0 && element.getClientRects().length);
        const first = targets[0], last = targets[targets.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}
      onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose(); }}
      onClose={() => { if (active) onClose(); }}>
      <header className="text-focus-header">
        <div><strong>Focus writing</strong><span>{title || 'Untitled article'}</span></div>
        <button type="button" onClick={onClose}>Return to composition</button>
      </header>
      <div className="text-focus-save">
        {saveError ? <p role="alert">{saveError} Return to composition to recover your edits.</p>
          : <p role="status">Saved in this browser</p>}
      </div>
      <div ref={scroll} className="text-focus-scroll" tabIndex={0} role="region" aria-label="Focused article" />
    </dialog>, document.body)}
    {createPortal(children, mount)}
  </>;
}
