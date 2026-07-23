import { useEffect, useRef, useState } from 'react';
import { STARTVEIL_STATES } from './startveilMachine.js';
import { useStartveil } from './useStartveil.js';
import './inscapeStartveil.css';

const WORDMARK = 'INSCAPE';
const SCRAMBLE_GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/\\[]<>+-';
const TICK_MS = 28;
const REVEAL_AT = [34, 0, 37, 40, 43, 46, 49];
const LOCK_AT = [65, 60, 68, 71, 74, 77, 80];
const READY_AT = 86;

const randomGlyph = () => SCRAMBLE_GLYPHS[Math.floor(Math.random() * SCRAMBLE_GLYPHS.length)];

function LockedN() {
  return (
    <span className="startveil__split-n" aria-hidden="true">
      <span data-half="upper">N</span>
      <span data-half="lower">N</span>
    </span>
  );
}

export default function Startveil(props) {
  const [tick, setTick] = useState(0);
  const [glyphs, setGlyphs] = useState(() => Array.from(WORDMARK, randomGlyph));
  const [idleGlitch, setIdleGlitch] = useState(null);
  const previousIdleIndex = useRef(-1);
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
      setGlyphs([...WORDMARK]);
      return undefined;
    }

    let currentTick = 0;
    const timer = window.setInterval(() => {
      currentTick += 1;
      setTick(currentTick);
      setGlyphs((current) => current.map((glyph, index) => (
        currentTick >= LOCK_AT[index] ? WORDMARK[index] : randomGlyph()
      )));

      if (currentTick >= READY_AT) {
        window.clearInterval(timer);
        setGlyphs([...WORDMARK]);
      }
    }, TICK_MS);

    return () => window.clearInterval(timer);
  }, [reducedMotionPreferred]);

  useEffect(() => {
    if (!ready || reducedMotion) {
      setIdleGlitch(null);
      return undefined;
    }

    let glitchTimer = 0;
    let settleTimer = 0;
    let scrambleTimer = 0;
    let letterOrder = [];
    let localEventsUntilFull = 5 + Math.floor(Math.random() * 4);

    const nextLetter = () => {
      if (letterOrder.length === 0) {
        letterOrder = Array.from({ length: WORDMARK.length }, (_, index) => index)
          .sort(() => Math.random() - 0.5);
        if (letterOrder[0] === previousIdleIndex.current) {
          [letterOrder[0], letterOrder[1]] = [letterOrder[1], letterOrder[0]];
        }
      }
      const index = letterOrder.shift();
      previousIdleIndex.current = index;
      return index;
    };

    const schedule = () => {
      glitchTimer = window.setTimeout(() => {
        const fullWord = localEventsUntilFull <= 0;
        const index = fullWord ? -1 : nextLetter();
        const variant = Math.random() < 0.5 ? 'a' : 'b';
        const scramble = () => {
          if (fullWord) {
            setIdleGlitch({
              all: true,
              replacements: Array.from(WORDMARK, randomGlyph),
              swapsGlyph: true,
              variant
            });
            return;
          }
          let replacement = randomGlyph();
          while (replacement === WORDMARK[index]) replacement = randomGlyph();
          setIdleGlitch({ index, replacement, swapsGlyph: true, variant });
        };

        scramble();
        scrambleTimer = window.setInterval(scramble, 27);
        settleTimer = window.setTimeout(() => {
          window.clearInterval(scrambleTimer);
          setIdleGlitch(null);
          localEventsUntilFull = fullWord
            ? 6 + Math.floor(Math.random() * 4)
            : localEventsUntilFull - 1;
          schedule();
        }, fullWord ? 125 + Math.random() * 55 : 92 + Math.random() * 58);
      }, 1700 + Math.random() * 2200);
    };

    schedule();
    return () => {
      window.clearTimeout(glitchTimer);
      window.clearTimeout(settleTimer);
      window.clearInterval(scrambleTimer);
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
      data-idle-glitch={Boolean(idleGlitch) || undefined}
      data-full-glitch={idleGlitch?.all || undefined}
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
        <h1 aria-label="INSCAPE">
          {glyphs.map((glyph, index) => {
            const locked = tick >= LOCK_AT[index] && !exiting;
            const isIdleGlitch = ready && (idleGlitch?.all || idleGlitch?.index === index);
            const shownGlyph = isIdleGlitch && idleGlitch.swapsGlyph
              ? (idleGlitch.all ? idleGlitch.replacements[index] : idleGlitch.replacement)
              : glyph;
            const idleVariant = idleGlitch?.all && index % 2
              ? (idleGlitch.variant === 'a' ? 'b' : 'a')
              : idleGlitch?.variant;

            return (
              <span
                className="startveil__cell"
                data-visible={tick >= REVEAL_AT[index] || undefined}
                data-locked={locked || undefined}
                data-n={index === 1 || undefined}
                data-final-glyph={WORDMARK[index]}
                data-idle-glitch={isIdleGlitch || undefined}
                data-idle-variant={isIdleGlitch ? idleVariant : undefined}
                style={{
                  '--exit-delay': `${10 + Math.min(index, WORDMARK.length - 1 - index) * 31}ms`,
                  '--exit-pull': `${Math.sign(3 - index) * 0.42}em`
                }}
                key={index}
              >
                <i className="startveil__glyph">
                  {locked && index === 1 && !(isIdleGlitch && idleGlitch.swapsGlyph)
                    ? <LockedN />
                    : shownGlyph}
                </i>
              </span>
            );
          })}
        </h1>

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
