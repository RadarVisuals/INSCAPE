import { useEffect, useState } from 'react';
import { STARTVEIL_STATES } from './startveilMachine.js';
import { useStartveil } from './useStartveil.js';
import './inscapeStartveil.css';

const TICK_MS = 28;
const READY_AT = 86;

const WORDMARK_SLICES = Object.freeze([
  { band: 'one', x: '-8.5%', y: '-34%', delay: '0ms' },
  { band: 'two', x: '6%', y: '22%', delay: '76ms' },
  { band: 'three', x: '-4%', y: '-12%', delay: '148ms' },
  { band: 'four', x: '7.5%', y: '31%', delay: '42ms' },
  { band: 'five', x: '-5.5%', y: '16%', delay: '112ms' }
]);

export default function Startveil(props) {
  const [tick, setTick] = useState(0);
  const [signalPulse, setSignalPulse] = useState(false);
  const reducedMotionPreferred = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  const sequenceReady = reducedMotionPreferred || tick >= READY_AT;
  const { state, enter, reducedMotion, shortened, canEnter } = useStartveil({
    ...props,
    entryReady: sequenceReady
  });

  const dormant = state === STARTVEIL_STATES.DORMANT;
  const ready = dormant && canEnter && sequenceReady;
  const exiting = state === STARTVEIL_STATES.ENTERING;
  const handoff = ![
    STARTVEIL_STATES.LOADING,
    STARTVEIL_STATES.DORMANT,
    STARTVEIL_STATES.ENTERING
  ].includes(state);

  useEffect(() => {
    if (reducedMotionPreferred) {
      setTick(READY_AT);
      return undefined;
    }

    let currentTick = 0;
    const timer = window.setInterval(() => {
      currentTick += 1;
      setTick(currentTick);

      if (currentTick >= READY_AT) {
        window.clearInterval(timer);
      }
    }, TICK_MS);

    return () => window.clearInterval(timer);
  }, [reducedMotionPreferred]);

  useEffect(() => {
    if (!ready || reducedMotion) {
      setSignalPulse(false);
      return undefined;
    }

    let pulseTimer = 0;
    let settleTimer = 0;

    const schedule = () => {
      pulseTimer = window.setTimeout(() => {
        setSignalPulse(true);
        settleTimer = window.setTimeout(() => {
          setSignalPulse(false);
          schedule();
        }, 170);
      }, 2800 + Math.random() * 3200);
    };

    schedule();
    return () => {
      window.clearTimeout(pulseTimer);
      window.clearTimeout(settleTimer);
    };
  }, [ready, reducedMotion]);

  if (state === STARTVEIL_STATES.COMPLETE) return null;

  const handleEntry = () => {
    if (ready) enter();
  };

  return (
    <section
      className="startveil"
      data-state={state}
      data-sequence={shortened ? 'short' : 'full'}
      data-reduced-motion={reducedMotion || undefined}
      data-assembling={tick >= 28 || undefined}
      data-settling={tick >= 80 && tick < READY_AT || undefined}
      data-ready={ready || undefined}
      data-signal-pulse={signalPulse || undefined}
      data-exiting={exiting || undefined}
      data-handoff={handoff || undefined}
      aria-label="INSCAPE entry"
      aria-busy={!ready && !handoff}
      onClick={handleEntry}
    >
      <div className="startveil__grain" aria-hidden="true" />
      <div className="startveil__scan" aria-hidden="true" />
      <div className="startveil__grid" aria-hidden="true">
        <i data-band="one" /><i data-band="two" /><i data-band="three" />
      </div>

      <div className="startveil__lockup">
        <div className="startveil__wordmark-stage" role="img" aria-label="INSCAPE">
          <span className="startveil__resolved-wordmark" aria-hidden="true" />
          {WORDMARK_SLICES.map((slice) => (
            <span
              className="startveil__wordmark-slice"
              data-band={slice.band}
              style={{
                '--slice-x': slice.x,
                '--slice-y': slice.y,
                '--slice-delay': slice.delay
              }}
              aria-hidden="true"
              key={slice.band}
            />
          ))}
          <span className="startveil__wordmark-transfer" aria-hidden="true" />
          <span className="startveil__coordinate-lock" aria-hidden="true">
            <i data-axis="horizontal" />
            <i data-axis="vertical" />
            <i data-node="origin" />
          </span>
        </div>

        <button
          className="startveil__entry"
          type="button"
          disabled={!ready}
          onClick={(event) => {
            event.stopPropagation();
            handleEntry();
          }}
        >
          <span>−</span> ENTER <span>−</span>
        </button>
      </div>

      <span className="startveil__status" aria-live="polite">
        {handoff
          ? 'Entering INSCAPE.'
          : ready
            ? 'INSCAPE resolved. Press Enter to continue.'
            : props.ready
              ? 'Resolving INSCAPE.'
              : 'Preparing INSCAPE.'}
      </span>
    </section>
  );
}
