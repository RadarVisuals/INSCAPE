import { useEffect, useRef, useState } from 'react';
import './inscapeScramblePrototype.css';

const WORDMARK = 'INSCAPE';
const SCRAMBLE_GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/\\[]<>+-';
const TICK_MS = 28;
const REPLAY_TICK_MS = 18;
const REVEAL_AT = [34, 0, 37, 40, 43, 46, 49];
const LOCK_AT = [65, 60, 68, 71, 74, 77, 80];
const READY_AT = 86;

const randomGlyph = () => SCRAMBLE_GLYPHS[Math.floor(Math.random() * SCRAMBLE_GLYPHS.length)];

function LockedN() {
  return <span className="inscape-scramble__split-n" aria-hidden="true">
    <span data-half="upper">N</span>
    <span data-half="lower">N</span>
  </span>;
}

export default function InscapeScramblePrototype() {
  const [run, setRun] = useState(0);
  const [tick, setTick] = useState(0);
  const [glyphs, setGlyphs] = useState(() => Array.from(WORDMARK, randomGlyph));
  const [closing, setClosing] = useState(false);
  const [closed, setClosed] = useState(false);
  const [idleGlitch, setIdleGlitch] = useState(null);
  const previousIdleIndex = useRef(-1);
  const ready = tick >= READY_AT && !closing && !closed;

  const enterInscape = () => {
    if (!ready) return;
    setClosing(true);
  };

  useEffect(() => {
    let currentTick = 0;
    setTick(0);
    setClosing(false);
    setClosed(false);
    setGlyphs(Array.from(WORDMARK, randomGlyph));

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setTick(READY_AT);
      setGlyphs([...WORDMARK]);
      return undefined;
    }

    const tickMs = run === 0 ? TICK_MS : REPLAY_TICK_MS;
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
    }, tickMs);

    return () => window.clearInterval(timer);
  }, [run]);

  useEffect(() => {
    if (!closing) return undefined;
    let elapsed = 0;
    const scrambleTimer = window.setInterval(() => {
      elapsed += TICK_MS;
      setGlyphs((current) => current.map((glyph, index) => {
        const exitAt = 10 + Math.min(index, WORDMARK.length - 1 - index) * 31;
        return elapsed >= Math.max(0, exitAt - 33) && elapsed < exitAt ? randomGlyph() : glyph;
      }));
    }, TICK_MS);
    const timer = window.setTimeout(() => setClosed(true), 210);
    return () => {
      window.clearInterval(scrambleTimer);
      window.clearTimeout(timer);
    };
  }, [closing]);

  useEffect(() => {
    if (!ready) {
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
          .sort(() => Math.random() - .5);
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
        const variant = Math.random() < .5 ? 'a' : 'b';
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
          if (fullWord) {
            localEventsUntilFull = 6 + Math.floor(Math.random() * 4);
          } else {
            localEventsUntilFull -= 1;
          }
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
  }, [ready]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (ready && ['Enter', 'Space'].includes(event.code)) {
        event.preventDefault();
        setClosing(true);
      } else if (closed && ['KeyR', 'Space'].includes(event.code)) {
        event.preventDefault();
        setRun((current) => current + 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closed, ready]);

  return <main
    className="inscape-scramble"
    data-assembling={tick >= 28 || undefined}
    data-settling={tick >= 80 && tick < READY_AT || undefined}
    data-replay={run > 0 || undefined}
    data-ready={ready || undefined}
    data-idle-glitch={Boolean(idleGlitch) || undefined}
    data-full-glitch={idleGlitch?.all || undefined}
    data-closing={closing || undefined}
    data-closed={closed || undefined}
    aria-busy={!ready && !closed}
    onClick={enterInscape}
  >
    <div className="inscape-scramble__grain" aria-hidden="true" />
    <div className="inscape-scramble__scan" aria-hidden="true" />
    <div className="inscape-scramble__grid" aria-hidden="true">
      <i data-band="one" /><i data-band="two" /><i data-band="three" />
    </div>

    <section className="inscape-scramble__lockup" aria-label="INSCAPE">
      <h1>
        {glyphs.map((glyph, index) => {
          const locked = tick >= LOCK_AT[index] && !closing;
          const isIdleGlitch = ready && (idleGlitch?.all || idleGlitch?.index === index);
          const shownGlyph = isIdleGlitch && idleGlitch.swapsGlyph
            ? (idleGlitch.all ? idleGlitch.replacements[index] : idleGlitch.replacement)
            : glyph;
          const idleVariant = idleGlitch?.all && index % 2
            ? (idleGlitch.variant === 'a' ? 'b' : 'a')
            : idleGlitch?.variant;
          return <span
            className="inscape-scramble__cell"
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
            key={`${index}-${run}`}
          >
            <i className="inscape-scramble__glyph">{locked && index === 1 && !(isIdleGlitch && idleGlitch.swapsGlyph) ? <LockedN /> : shownGlyph}</i>
          </span>;
        })}
      </h1>
      <button
        className="inscape-scramble__enter"
        type="button"
        disabled={!ready}
        onClick={(event) => {
          event.stopPropagation();
          enterInscape();
        }}
      >
        <span>−</span> ENTER <span>−</span>
      </button>
    </section>

    <span className="inscape-scramble__status" aria-live="polite">
      {ready ? 'INSCAPE resolved. Press Enter to continue.' : closed ? 'INSCAPE entered.' : 'Resolving INSCAPE.'}
    </span>
    {closed && <button type="button" className="inscape-scramble__replay" onClick={(event) => {
      event.stopPropagation();
      setRun((current) => current + 1);
    }}>[ REPLAY / R ]</button>}
  </main>;
}
