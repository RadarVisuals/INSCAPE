import { lazy, Suspense, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Settings2, X } from 'lucide-react';

const KeeperAIConversation = import.meta.env.DEV ? lazy(() => import('./KeeperAIConversation.jsx')) : null;

export function KeeperConversation({ asset, name, anchor, onClose, conversationScope, captureReaction, cancelReaction, onPosition }) {
  const panel = useRef(null), passage = useRef(null), closeButton = useRef(null), titleId = useId();
  const [attempt, setAttempt] = useState(0), [state, setState] = useState({ status: 'loading' });
  const [mode, setMode] = useState('dialogue');
  const [settings, setSettings] = useState(false);
  const anchorBox = useRef(null);
  const localAI = KeeperAIConversation && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const reposition = useCallback(() => {
    const bubble = panel.current, head = anchor.current;
    if (!bubble || !head) return;
    const box = anchorBox.current ||= head.getBoundingClientRect(), width = bubble.offsetWidth, height = bubble.offsetHeight;
    const margin = 12, gap = 22;
    let tail = 'bottom', left = box.left + box.width * .3 - width, top = box.top - gap - height;
    if (top < margin && box.left - gap - width >= margin) {
      tail = 'right'; left = box.left - gap - width; top = box.top + box.height / 2 - height / 2;
    } else if (top < margin && box.right + gap + width <= innerWidth - margin) {
      tail = 'left'; left = box.right + gap; top = box.top + box.height / 2 - height / 2;
    } else if (top < margin) { tail = 'top'; top = box.bottom + gap; }
    const x = Math.max(margin, Math.min(innerWidth - width - margin, left));
    const y = Math.max(margin, Math.min(innerHeight - height - 58, top));
    bubble.style.left = `${x}px`; bubble.style.top = `${y}px`;
    bubble.dataset.tail = tail;
    bubble.style.setProperty('--keeper-tail-x', `${Math.max(18, Math.min(width - 40, box.left + box.width * .4 - x))}px`);
    bubble.style.setProperty('--keeper-tail-y', `${Math.max(24, Math.min(height - 24, box.top + box.height / 2 - y))}px`);
  }, [anchor]);
  useLayoutEffect(() => { reposition(); }, [state, mode, reposition]);
  useEffect(() => {
    closeButton.current?.focus({ preventScroll: true });
    let frame;
    let position = null;
    // The existing motion loop reports travel. Ignore idle bob/rotation and
    // translate the captured head box, avoiding layout reads on every frame.
    const move = state => {
      if (position && anchorBox.current && Math.hypot(state.x - position.x, state.y - position.y) > .5) {
        const dx = state.x - position.x, dy = state.y - position.y, box = anchorBox.current;
        anchorBox.current = { left: box.left + dx, right: box.right + dx, top: box.top + dy, bottom: box.bottom + dy, width: box.width, height: box.height };
        reposition(); position = { x: state.x, y: state.y };
      } else if (!position) position = { x: state.x, y: state.y };
    };
    if (onPosition) onPosition.current = move;
    const resize = () => { anchorBox.current = null; cancelAnimationFrame(frame); frame = requestAnimationFrame(reposition); };
    const observer = new ResizeObserver(reposition);
    if (panel.current) observer.observe(panel.current);
    window.addEventListener('resize', resize);
    return () => { if (onPosition?.current === move) onPosition.current = null; observer.disconnect(); cancelAnimationFrame(frame); window.removeEventListener('resize', resize); };
  }, [reposition, onPosition]);
  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    const timer = setTimeout(() => {
      controller.abort(); setState({ status: 'failed', error: 'The dialogue took too long to load. Try again.' });
    }, 25_000);
    // Optional token lookup and dialogue parsing load only when someone talks.
    import('./loadKeeperDialogue.js').then(({ loadKeeperDialogue }) => {
      controller.signal.throwIfAborted();
      return loadKeeperDialogue(asset, { signal: controller.signal });
    }).then(document => {
      if (!controller.signal.aborted) setState(document
        ? { status: 'ready', document, node: document.start } : { status: 'empty' });
    }).catch(error => {
      if (!controller.signal.aborted) setState({ status: 'failed', error: error.code === 'METADATA_HASH_MISMATCH'
        ? 'The dialogue does not match the file attached to this token. Try again.'
        : 'The attached dialogue could not be read. Check its format or try again.' });
    }).finally(() => clearTimeout(timer));
    return () => { clearTimeout(timer); controller.abort(); };
  }, [asset.stableAssetId, attempt]);
  const node = state.document?.nodes[state.node];
  return <section ref={panel} className={`keeper-conversation${mode === 'ai' ? ' keeper-conversation--ai' : ''}`} role="dialog" aria-labelledby={titleId}
    onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); } }}>
    <svg className="keeper-conversation__tail" width="32" height="24" aria-hidden="true"><path d="M1 0H21Q12 14 31 23Q4 20 1 0Z" /></svg>
    <header><span id={titleId}>{name}</span>
      {mode === 'ai' && <button type="button" aria-label="Chat settings" aria-pressed={settings} onClick={() => setSettings(value => !value)}><Settings2 aria-hidden="true" /></button>}
      <button ref={closeButton} type="button" aria-label="Close conversation" onClick={onClose}><X aria-hidden="true" /></button></header>
    {localAI && <nav className="keeper-conversation__modes" aria-label="Conversation mode">
      <button type="button" aria-pressed={mode === 'dialogue'} onClick={() => setMode('dialogue')}>Dialogue</button>
      <button type="button" aria-pressed={mode === 'ai'} onClick={() => setMode('ai')}>AI chat</button>
    </nav>}
    {mode === 'ai' && localAI ? <div className="keeper-conversation__content"><Suspense fallback={<p role="status">Loading chat…</p>}>
      <KeeperAIConversation scope={conversationScope || asset.stableAssetId} name={name} document={state.document} captureReaction={captureReaction} cancelReaction={cancelReaction} settings={settings} onBack={() => setSettings(false)} />
    </Suspense></div> :
    <div className="keeper-conversation__content" lang={state.document?.language}>
      {state.status === 'loading' && <p role="status">One moment…</p>}
      {state.status === 'empty' && <><p role="status">This character has no attached Keeper dialogue yet.</p><button type="button" onClick={() => setAttempt(value => value + 1)}>Check again</button></>}
      {state.status === 'failed' && <><p role="alert">{state.error}</p><button type="button" onClick={() => setAttempt(value => value + 1)}>Retry dialogue</button></>}
      {node && <>
        <p ref={passage} tabIndex={-1} className="keeper-conversation__passage" aria-live="polite">{node.text}</p>
        <div className="keeper-conversation__replies">
          {node.choices.map((choice, index) => <button key={`${state.node}:${index}`} type="button" onClick={() => {
            setState(current => ({ ...current, node: choice.next }));
            passage.current?.focus({ preventScroll: true });
            panel.current?.querySelector('.keeper-conversation__content')?.scrollTo(0, 0);
          }}>{choice.label}</button>)}
          {!node.choices.length && <button type="button" onClick={onClose}>Leave him to it</button>}
        </div>
      </>}
    </div>}
  </section>;
}
