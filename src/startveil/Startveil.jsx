import { STARTVEIL_STATES } from './startveilMachine.js';
import { useStartveil } from './useStartveil.js';
import './startveil.css';

const BOOT_LINES = ['KERNEL / VEIL ........ OPEN', 'SIGNAL ARRAY ......... SYNC', 'RESIDENT CHANNEL ..... FOUND'];

export default function Startveil(props) {
  const { state, enter, reducedMotion, shortened, canEnter } = useStartveil(props);
  if (state === STARTVEIL_STATES.COMPLETE) return null;
  const ready = state !== STARTVEIL_STATES.LOADING;
  const active = ![STARTVEIL_STATES.LOADING, STARTVEIL_STATES.DORMANT].includes(state);

  return (
    <section className="startveil" data-state={state} data-sequence={shortened ? 'short' : 'full'} data-reduced-motion={reducedMotion || undefined} aria-label="OS_UNDERNEATH system entry">
      <div className="startveil__texture" aria-hidden="true" />
      <div className="startveil__boot" aria-hidden="true">
        {BOOT_LINES.map((line) => <span key={line}>{line}</span>)}
      </div>
      <div className="startveil__mark" aria-hidden="true">
        <span className="startveil__ghost startveil__ghost--top"><img src="/assets/logo/underneath_os.webp" alt="" /></span>
        <img className="startveil__logo" src="/assets/logo/underneath_os.webp" alt="" />
        <span className="startveil__ghost startveil__ghost--bottom"><img src="/assets/logo/underneath_os.webp" alt="" /></span>
      </div>
      <div className="startveil__scan" aria-hidden="true" />
      <div className="startveil__sync" aria-hidden="true" />
      <div className="startveil__terminal" aria-live="polite">
        <header><p>OS_UNDERNEATH</p><span>SYSTEM STATE: {active ? 'AWAKENING' : ready ? 'DORMANT' : 'SEALED'}</span></header>
        <dl>
          <div><dt>RESIDENT LINK</dt><dd>{active ? 'SYNC' : 'STANDBY'}</dd></div>
          <div><dt>AUDIO CHANNEL</dt><dd>{active ? 'GESTURE' : 'LOCKED'}</dd></div>
          <div><dt>WORLD PROCESS</dt><dd>{ready ? 'READY' : 'INITIALIZING'}</dd></div>
        </dl>
        <button className="startveil__entry" type="button" disabled={!canEnter} onClick={enter}>
          <span>&gt; {ready ? 'ENTER SYSTEM' : 'INITIALIZING'}</span>
          {active && <strong>ACCESS ACCEPTED</strong>}
        </button>
      </div>
    </section>
  );
}
