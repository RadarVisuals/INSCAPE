import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { keeperChatgptRequest, readKeeperChatStream } from './keeperChatgptClient.js';

export default function KeeperAIConversation({ scope, name, document, captureReaction, cancelReaction, settings, onBack }) {
  const [state, setState] = useState({ status: 'loading', models: [], history: [] });
  const [model, setModel] = useState(''), [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [partial, setPartial] = useState('');
  const [sent, setSent] = useState(''), [authUrl, setAuthUrl] = useState(''), [welcome, setWelcome] = useState(false);
  const live = useRef(false), active = useRef(null), transcript = useRef(null), input = useRef(null);
  const focusAfterReply = useRef(false);
  const polling = useRef(null), statusRequest = useRef(null);
  const inputId = useId();
  const [gestures, setGestures] = useState(true), [shareArtwork, setShareArtwork] = useState(false), [reactionNote, setReactionNote] = useState('');
  const [shareImages, setShareImages] = useState(false), [visionNote, setVisionNote] = useState(''), [historyOpen, setHistoryOpen] = useState(false);
  const [metadataNote, setMetadataNote] = useState('');
  useEffect(() => () => cancelReaction?.(), [cancelReaction]);
  const accept = useCallback(result => {
    setState(result);
    setModel(current => result.models.some(item => item.id === current) ? current : result.models[0]?.id || '');
    if (result.status !== 'connecting') setAuthUrl('');
  }, []);
  const refresh = useCallback(async () => {
    statusRequest.current?.abort();
    const controller = statusRequest.current = new AbortController();
    try {
      const result = await keeperChatgptRequest('status', scope, { signal: controller.signal });
      if (!live.current || controller.signal.aborted) return;
      accept(result); setError('');
      clearTimeout(polling.current);
      if (['connecting', 'loading-models'].includes(result.status)) polling.current = setTimeout(refresh, 1200);
    } catch (failure) {
      if (live.current && !controller.signal.aborted) { setError(failure.message); setState(current => ({ ...current, status: 'unavailable' })); }
    }
  }, [scope, accept]);
  useEffect(() => {
    live.current = true; refresh();
    const focus = () => { if (!active.current) refresh(); };
    window.addEventListener('focus', focus);
    return () => { live.current = false; active.current?.abort(); statusRequest.current?.abort(); clearTimeout(polling.current); window.removeEventListener('focus', focus); };
  }, [refresh]);
  useEffect(() => { transcript.current?.scrollTo({ top: transcript.current.scrollHeight }); }, [partial, state.history, sent]);
  useEffect(() => {
    if (!busy && focusAfterReply.current) { focusAfterReply.current = false; input.current?.focus({ preventScroll: true }); }
  }, [busy]);
  useEffect(() => { if (!settings && state.status === 'connected') input.current?.focus({ preventScroll: true }); }, [settings, state.status]);

  const connect = async () => {
    // Open synchronously for browsers that require a gesture, then isolate the
    // OAuth tab. No credentials cross back through window messaging or storage.
    const popup = window.open('about:blank', '_blank');
    if (popup) popup.opener = null;
    setBusy(true); setError(''); setWelcome(true);
    const controller = active.current = new AbortController();
    try {
      const result = await keeperChatgptRequest('connect', scope, { signal: controller.signal });
      if (!live.current) { popup?.close(); return; }
      const url = new URL(result.url);
      if (url.origin !== 'https://auth.openai.com' || url.pathname !== '/api/accounts/authorize') throw new Error('The sign-in address was not valid.');
      setAuthUrl(url.href); setState(current => ({ ...current, status: 'connecting', history: [] }));
      if (popup) popup.location.replace(url.href);
      refresh();
    } catch (failure) { popup?.close(); if (live.current && !controller.signal.aborted) setError(failure.message); }
    finally { if (active.current === controller) active.current = null; if (live.current) setBusy(false); }
  };
  const command = async action => {
    cancelReaction?.(); setReactionNote('');
    active.current?.abort(); setBusy(true); setError(''); setPartial(''); setSent('');
    const controller = active.current = new AbortController();
    try {
      const result = await keeperChatgptRequest(action, scope, { signal: controller.signal });
      if (live.current) accept(result);
    } catch (failure) { if (live.current && !controller.signal.aborted) setError(failure.message); }
    finally { if (active.current === controller) active.current = null; if (live.current) setBusy(false); }
  };
  const send = async event => {
    event.preventDefault(); if (!message.trim() || busy || !model) return;
    const text = message.trim(), controller = active.current = new AbortController();
    const reaction = captureReaction?.({ gestures, shareArtwork });
    setBusy(true); setError(''); setSent(text); setPartial(''); setReactionNote(''); setVisionNote(''); setMetadataNote('');
    let reply = '';
    try {
      const previews = shareImages && reaction ? await reaction.previews(controller.signal) : null;
      if (!live.current || controller.signal.aborted) return;
      if (previews) setVisionNote(previews.images.length ? `${previews.images.length} artwork preview${previews.images.length === 1 ? '' : 's'} attached${previews.unavailable.length ? '; another unavailable' : ''}.`
        : 'No artwork preview available; using names and positions.');
      const response = await keeperChatgptRequest('message', scope, { signal: controller.signal, message: text, model, name,
        scene: reaction?.scene, ...(previews && { images: previews.images }), passages: Object.values(document?.nodes || {}).slice(0, 8).map(node => node.text) });
      const action = await readKeeperChatStream(response, delta => { reply += delta; if (live.current && !controller.signal.aborted) setPartial(reply); }, async ({ requestId, targets }) => {
        controller.signal.throwIfAborted();
        if (!reaction || targets.some(id => !reaction.scene.artworks.some(art => art.id === id && art.metadata))) throw new Error('Metadata target is unavailable.');
        setMetadataNote('Reading public token metadata…');
        let results;
        try { results = await reaction.metadata(targets, AbortSignal.any([controller.signal, AbortSignal.timeout(25_000)])); }
        catch { controller.signal.throwIfAborted(); results = targets.map(id => ({ id, ...reaction.scene.artworks.find(art => art.id === id).metadata, status: 'failed' })); }
        controller.signal.throwIfAborted();
        await keeperChatgptRequest('metadata-result', scope, { signal: controller.signal, requestId, results });
        if (live.current) {
          const available = results.filter(item => item.status === 'available').length;
          setMetadataNote(available ? `Public metadata read for ${available} artwork${available === 1 ? '' : 's'}${available < results.length ? '; another unavailable' : ''}.` : 'Public metadata unavailable for this request.');
        }
      });
      if (!live.current || controller.signal.aborted) return;
      setState(current => ({ ...current, history: [...current.history, { role: 'user', content: text }, { role: 'assistant', content: reply }].slice(-24) }));
      setMessage('');
      if (action && action.gesture !== 'none') {
        const applied = reaction?.perform(action);
        setReactionNote(applied ? ({ curious: 'Tilts his head, curious.', startled: 'Startles and spreads out.', approach: 'Drifts a little closer.', retreat: 'Slowly backs away.' })[action.gesture]
          : 'Gesture skipped: the character or target is no longer available.');
      }
    } catch (failure) {
      if (live.current) setError(controller.signal.aborted ? 'Reply stopped. Your message is still ready to send.' : failure.message);
    } finally {
      if (active.current === controller) active.current = null;
      if (live.current) { focusAfterReply.current = true; setBusy(false); setPartial(''); setSent(''); }
    }
  };
  const connecting = ['connecting', 'loading-models'].includes(state.status);
  const entries = historyOpen ? state.history : state.history.filter(entry => entry.role === 'assistant').slice(-1);
  return <div className={`keeper-ai${settings ? ' keeper-ai--settings' : ''}`}>
    {state.status === 'loading' && <p role="status">Checking your connection…</p>}
    {state.status === 'connected' ? <>
      {settings ? <div className="keeper-ai__settings">
      <button type="button" onClick={onBack}>Back to chat</button>
      {welcome && <div className="keeper-ai__notice" role="status"><p>You’re using your ChatGPT plan. Eligible replies use your plan allowance or available credits.</p><button type="button" onClick={() => setWelcome(false)}>Got it</button></div>}
      <div className="keeper-ai__account"><span>Using ChatGPT plan</span><span>{state.account?.email || state.account?.name}</span></div>
      <label className="keeper-ai__model">Model<select aria-label="Keeper AI model" value={model} disabled={busy} onChange={event => setModel(event.target.value)}>
        {state.models.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>
      <div className="keeper-ai__options">
        <label><input type="checkbox" checked={gestures} disabled={busy} onChange={event => { setGestures(event.target.checked); cancelReaction?.(); }} />Let Keeper gesture</label>
        <label><input type="checkbox" checked={shareArtwork} disabled={busy} onChange={event => { setShareArtwork(event.target.checked); if (!event.target.checked) setShareImages(false); }} />Share artwork details</label>
        <label><input type="checkbox" checked={shareImages} disabled={busy} onChange={event => { setShareImages(event.target.checked); if (event.target.checked) setShareArtwork(true); }} />Share artwork previews</label>
        <p className="keeper-ai__hint">Details shares up to 8 nearby names, positions and token identities. When asked, Keeper can read public LUKSO NFT metadata for up to 2 artworks and send their descriptions and traits to OpenAI. Previews also sends the 2 nearest source artworks as small stills, up to 512 px. Requires a model that accepts images. These use your plan allowance; raw previews and metadata are not kept in chat history.</p>
      </div>
      <p className="keeper-ai__hint">Keeps the last 12 exchanges in this local session. Closing stops a reply. Server restart clears the conversation and connection.</p>
      <div className="keeper-ai__actions"><button type="button" disabled={busy} onClick={() => command('clear')}>Clear chat</button><button type="button" disabled={busy} onClick={() => command('disconnect')}>Disconnect</button></div>
      <a href="https://chatgpt.com/settings/usage" target="_blank" rel="noreferrer">Manage usage</a>
      </div> : <>
      <div className="keeper-ai__toolbar"><span title="Eligible replies use your ChatGPT plan allowance or available credits.">ChatGPT plan</span><button type="button" aria-pressed={historyOpen} onClick={() => setHistoryOpen(value => !value)}>{historyOpen ? 'Latest reply' : 'History'}</button></div>
      <div className="keeper-ai__transcript" ref={transcript} role="log" aria-label={`Conversation with ${name}`} aria-live="polite" aria-busy={busy}>
        {!state.history.length && !sent && <p>Say something to {name}.</p>}
        {(!sent || historyOpen) && entries.map((entry, index) => <div className="keeper-ai__message" data-speaker={entry.role} key={index}>{historyOpen && <span>{entry.role === 'user' ? 'You' : name}</span>}<p>{entry.content}</p></div>)}
        {sent && <>{historyOpen && <div className="keeper-ai__message" data-speaker="user"><span>You</span><p>{sent}</p></div>}<div className="keeper-ai__message"><p>{partial || (shareImages ? 'Looking, then thinking…' : 'Thinking…')}</p></div></>}
      </div>
      {reactionNote && <p className="keeper-ai__hint" role="status">{reactionNote}</p>}
      {visionNote && <p className="keeper-ai__hint" role="status">{visionNote}</p>}
      {metadataNote && <p className="keeper-ai__hint" role="status">{metadataNote}</p>}
      <form onSubmit={send} className="keeper-ai__composer">
        <label className="keeper-ai__sr" htmlFor={inputId}>Talk to {name}</label>
        <textarea id={inputId} ref={input} aria-label={`Message ${name}`} value={message} maxLength={2000} rows={2} disabled={busy}
          placeholder="Tell him something…" onChange={event => setMessage(event.target.value)} onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form.requestSubmit(); }
          }} />
        <div className="keeper-ai__actions"><button type="submit" disabled={busy || !message.trim() || !model}>Send</button>
          {busy && <button type="button" onClick={() => active.current?.abort()}>Stop reply</button>}</div>
      </form>
      </>}
    </> : <>
      <p>Connect your own ChatGPT plan to talk freely with {name}.</p>
      <p className="keeper-ai__hint">For this local Inscape session. Messages and character dialogue excerpts are sent to OpenAI when you press Send. Your connection ends when the local server restarts.</p>
      {connecting ? <><p role="status">{state.status === 'connecting' ? 'Finish signing in on OpenAI’s page, then return here.' : 'Loading your available models…'}</p>
        {authUrl && <a href={authUrl} target="_blank" rel="noreferrer">Open sign-in page</a>}
        <button type="button" disabled={busy} onClick={() => command('cancel-login')}>Cancel sign-in</button></>
        : <button type="button" disabled={busy} onClick={connect}>Continue with ChatGPT</button>}
      {state.status === 'permission-required' && <p role="alert">Sign-in worked, but ChatGPT plan usage was not enabled. Reconnect and allow it to continue.</p>}
      {state.status === 'failed' && state.account && <button type="button" disabled={busy} onClick={() => command('models')}>Retry available models</button>}
      {state.status === 'unavailable' && <button type="button" disabled={busy} onClick={refresh}>Retry connection</button>}
    </>}
    {(error || state.error) && <p role="alert">{error || state.error}</p>}
    {state.status !== 'connected' && <a href="https://chatgpt.com/settings/usage" target="_blank" rel="noreferrer">Manage usage</a>}
  </div>;
}
