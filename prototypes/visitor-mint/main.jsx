import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { formatEther } from 'viem';
import { createDemoJournal, createMintSession } from './mintSession.js';
import { createSimulation, CREATURE_URL, SOURCE_URL, SCENARIOS } from './simulation.js';
import '../../src/inscapeTokens.css';
import '../../src/lattice/rendering/latticeMenuSurface.css';
import './style.css';

const price = offer => offer.priceWei === '0' ? 'Free' : `${formatEther(BigInt(offer.priceWei))} LYX`;
const buyerName = buyer => buyer === 'visitor-b' ? 'Visitor B' : 'Visitor A';
// Access storage inside the operation so a blocked localStorage getter is also
// handled by the session, instead of crashing the whole preview.
const storage = {
  getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value),
  removeItem: key => localStorage.removeItem(key),
};

function Confirmation({ request, adapter, returnFocus }) {
  const dialog = useRef(null);
  useLayoutEffect(() => {
    const node = dialog.current;
    node.showModal();
    return () => { node.close(); if (returnFocus?.isConnected) returnFocus.focus(); };
  }, [returnFocus]);
  return <dialog ref={dialog} className="mint-confirmation" aria-labelledby="confirmation-title"
    onCancel={event => { event.preventDefault(); adapter.cancelConfirmation(); }}>
    <header><h2 id="confirmation-title">Simulated wallet confirmation</h2></header>
    <div className="mint-confirmation__body">
      <p>Mint one creature for <strong>{buyerName(request.buyer)}</strong>.</p>
      <dl><div><dt>Example price</dt><dd>{price(request.offer)}</dd></div>
        <div><dt>Network fee</dt><dd>Not estimated in this preview</dd></div></dl>
      <p className="mint-secondary">This is a local simulation. No wallet opens and no funds move.</p>
    </div>
    <footer><button autoFocus onClick={() => adapter.cancelConfirmation()}>Cancel</button>
      <button className="mint-primary" onClick={() => adapter.confirm()}>Confirm simulation</button></footer>
  </dialog>;
}

function Preview() {
  const [scenario, setScenario] = useState('standard'), [reset, setReset] = useState(0);
  const [state, setState] = useState({ phase: 'loading', offer: null, buyer: null, record: null, message: '' });
  const [confirmation, setConfirmation] = useState(null), [artFailed, setArtFailed] = useState(false);
  const [artAttempt, setArtAttempt] = useState(0), [resetError, setResetError] = useState('');
  const session = useRef(null), adapter = useRef(null), mintButton = useRef(null);
  const hadConfirmation = useRef(false);
  useEffect(() => {
    let alive = true;
    const simulated = createSimulation({ storage, scenario, onConfirmation: value => { if (alive) setConfirmation(value); } });
    const controller = createMintSession({ adapter: simulated, journal: createDemoJournal(storage),
      onChange: value => { if (alive) setState(value); } });
    adapter.current = simulated; session.current = controller;
    setConfirmation(null); void controller.refresh();
    return () => { alive = false; controller.dispose(); };
  }, [scenario, reset]);
  useEffect(() => {
    if (state.phase !== 'pending') return undefined;
    const controller = session.current;
    const timer = setTimeout(() => void controller.check(), 1800);
    return () => clearTimeout(timer);
  }, [state.phase]);
  useLayoutEffect(() => {
    if (confirmation) { hadConfirmation.current = true; return; }
    // Closing the dialog precedes the asynchronous cancellation result. Restore
    // focus after the action becomes usable, not while it is still disabled.
    if (!hadConfirmation.current || ['wallet', 'checking'].includes(state.phase)) return;
    hadConfirmation.current = false;
    mintButton.current?.focus();
  }, [confirmation, state.phase]);

  function resetPreview() {
    try {
      // Only this prototype's versioned records are reset, never user drafts.
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('inscape:prototype:visitor-mint:')) localStorage.removeItem(key);
      }
      setResetError(''); setReset(value => value + 1);
    } catch { setResetError('Preview storage could not be reset.'); }
  }
  const { phase, offer, buyer, record, message } = state;
  const unavailable = phase === 'unavailable';
  const locked = ['loading', 'checking', 'wallet', 'pending', 'recovery', 'confirmed'].includes(phase);
  const actionLabel = phase === 'loading' ? 'Loading mint details…' : phase === 'checking' ? 'Checking…'
    : offer && !offer.open ? 'Mint paused' : offer?.remaining === 0 ? 'Sold out'
      : buyer && offer && !offer.eligible ? 'Profile limit reached' : buyer ? 'Mint one creature' : 'Connect demo profile';
  return <div className="mint-preview" data-lattice-menu-surface data-menu-surface="mist">
    <header className="mint-topbar"><img src="/assets/inscape-wordmark.svg" alt="INSCAPE" />
      <span>Visitor mint / interaction preview</span><a href="/">Return to INSCAPE</a></header>
    <aside className="mint-demo-notice">Local simulation · Example price and supply · No real wallet or transactions</aside>
    <main>
      <section className="mint-surface" aria-labelledby="mint-title">
        <div className="mint-artwork" data-lattice-menu-surface>
          {artFailed ? <div role="status"><p>Artwork preview unavailable.</p><button onClick={() => { setArtFailed(false); setArtAttempt(value => value + 1); }}>Retry artwork</button></div>
            : <img key={artAttempt} src={CREATURE_URL} alt="Purple one-eyed creature from Human Underneath" onError={() => setArtFailed(true)} />}
          <span>Human Underneath · artwork reference</span>
        </div>
        <div className="mint-details">
          <header><p className="mint-secondary">Human Underneath</p><h1 id="mint-title">A creature of your own.</h1>
            <p>Mint a new edition into your Universal Profile.</p></header>
          <dl className="mint-facts">
            <div><dt>Example mint price</dt><dd>{offer ? price(offer) : 'Unavailable'}</dd></div>
            <div><dt>Example availability</dt><dd>{offer ? `${offer.remaining} / ${offer.cap} remaining` : 'Unavailable'}</dd></div>
            <div><dt>Example limit</dt><dd>{offer ? `${offer.perProfile} per profile` : 'Unavailable'}</dd></div>
            <div><dt>Network fee</dt><dd>Shown by wallet before approval</dd></div>
          </dl>
          <div className="mint-recipient"><span className="mint-secondary">Receiving profile</span>
            <strong>{buyer ? `${buyerName(buyer)} · demo profile` : 'Connect your profile to continue'}</strong>
            {buyer && <button onClick={() => void session.current.setBuyer(null)}>Disconnect demo profile</button>}</div>
          <div className="mint-progress" role="status" aria-live="polite" aria-atomic="true">
            {phase === 'confirmed' ? <><strong>Simulation confirmed</strong><p>One new edition was minted to {buyerName(buyer)} in this preview.</p>
              <code>{record.tokenId}</code></> : <><strong>{phase === 'pending' ? 'Waiting for confirmation'
                : phase === 'recovery' ? 'Check your previous mint' : phase === 'wallet' ? 'Review the confirmation' : ''}</strong>
              {message && <p>{message}</p>}</>}
          </div>
          {['pending', 'recovery'].includes(phase) ? <button ref={mintButton} className="mint-primary mint-action" onClick={() => void session.current.check()}>Check mint status</button>
            : unavailable ? <button ref={mintButton} className="mint-primary mint-action" onClick={() => void session.current.refresh()}>Retry mint details</button>
              : phase !== 'confirmed' && <button ref={mintButton} className="mint-primary mint-action"
                disabled={locked || !offer?.open || offer?.remaining === 0 || Boolean(buyer && !offer?.eligible)}
                onClick={() => void (buyer ? session.current.mint() : session.current.setBuyer('visitor-a'))}>{actionLabel}</button>}
          <p className="mint-secondary mint-footnote">Artwork shown from an existing token. This preview does not offer that token for sale.
            {' '}<a href={SOURCE_URL} target="_blank" rel="noreferrer">View original artwork ↗</a></p>
        </div>
      </section>
      <section className="mint-test-controls" aria-label="Preview controls">
        <div><label htmlFor="mint-scenario">Try a scenario</label><select id="mint-scenario" value={scenario} onChange={event => setScenario(event.target.value)}>
          {SCENARIOS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        <div><label htmlFor="mint-visitor">Demo visitor</label><select id="mint-visitor" value={buyer || ''} onChange={event => void session.current.setBuyer(event.target.value || null)}>
          <option value="">Disconnected</option><option value="visitor-a">Visitor A</option><option value="visitor-b">Visitor B</option></select></div>
        <button onClick={resetPreview}>Reset preview</button>
        {resetError && <p role="alert">{resetError}</p>}
      </section>
      <p className="mint-development-note">Preview controls are for reviewing the flow. Price, edition size and limits are examples, not saved collection settings.</p>
    </main>
    {confirmation && <Confirmation request={confirmation} adapter={adapter.current} returnFocus={mintButton.current} />}
  </div>;
}

createRoot(document.getElementById('root')).render(<Preview />);
