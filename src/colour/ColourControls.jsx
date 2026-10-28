import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import NumberField from './NumberField.jsx';
import {
  CENTRE,
  RING_RADIUS,
  TRIANGLE,
  trianglePoints,
  triangleClip,
  normaliseHex,
  hsvHex,
  hexHsv,
  hsvHsl,
  hslHsv,
  hsvPoint,
  pointHsv,
  ringPoint,
  pointHue,
  wrapHue,
  paintTriangle,
} from './colourModel.js';
import './colourControls.css';

function HexField({ value, onChange, disabled, labelPrefix }) {
  const id = useId();
  const [edit, setEdit] = useState({
    source: value,
    text: value.toUpperCase(),
    invalid: false,
  });
  if (edit.source !== value)
    setEdit({ source: value, text: value.toUpperCase(), invalid: false });
  const commit = () => {
    const hex = normaliseHex(edit.text);
    if (!hex) {
      setEdit((current) => ({ ...current, invalid: true }));
      return;
    }
    setEdit({ source: hex, text: hex.toUpperCase(), invalid: false });
    onChange(hex);
  };
  return (
    <label className="ds-colour-hex">
      Hex
      <input
        aria-label={`${labelPrefix} colour`}
        type="text"
        value={edit.text}
        disabled={disabled}
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="characters"
        aria-invalid={edit.invalid || undefined}
        aria-describedby={edit.invalid ? id : undefined}
        onChange={(event) => {
          const text = event.target.value,
            hex = normaliseHex(text, false);
          setEdit({ source: hex || value, text, invalid: false });
          if (hex) onChange(hex);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            setEdit({ source: value, text: value.toUpperCase(), invalid: false });
          }
        }}
      />
      {edit.invalid && (
        <small id={id} role="alert">
          Use 3 or 6 hex digits, such as #A8B5C2.
        </small>
      )}
    </label>
  );
}

export default function ColourControls({ item, update, beginGesture, labelPrefix = 'Studio', showOpacity = true, wheelAccessory }) {
  const instructions = useId(),
    canvas = useRef(null),
    drag = useRef(null),
    latest = useRef(null);
  // Keep interaction precision and undefined hue/saturation at white, grey and black.
  // The source tag invalidates this UI projection whenever the selected object's hex changes elsewhere.
  const [model, setModel] = useState(() => ({ source: item.color, ...hexHsv(item.color) }));
  if (model.source !== item.color)
    setModel({ source: item.color, ...hexHsv(item.color, model.h, model.s) });
  const [dragging, setDragging] = useState(null);
  const [pointerFocus, setPointerFocus] = useState(false);
  const hsv = model,
    hsl = hsvHsl(hsv);
  const hueMarker = ringPoint(hsv.h),
    triangleMarker = hsvPoint(hsv);
  latest.current = { item, update, hsv, model };
  useLayoutEffect(() => paintTriangle(canvas.current, hsv.h), [hsv.h]);

  function changeColour(next) {
    const current = latest.current;
    if (current.item.locked) return;
    const color = hsvHex(next.h, next.s, next.v);
    const projected = { ...next, h: wrapHue(next.h), source: color };
    latest.current = { ...current, hsv: projected, model: projected };
    setModel(projected);
    (drag.current?.transaction?.update || current.update)({ color });
  }
  function finish(cancelled, mounted = true) {
    const active = drag.current;
    if (!active) return;
    drag.current = null;
    if (mounted) setDragging(null);
    if (active.transaction) {
      active.transaction.finish(cancelled);
      if (cancelled && mounted) setModel(active.model);
    } else if (cancelled) {
      // Retargeting/unmount uses the action captured for the originating selection.
      active.restore({ color: active.color });
      if (mounted) setModel(active.model);
    }
    if (active.element.hasPointerCapture(active.pointerId))
      active.element.releasePointerCapture(active.pointerId);
  }
  useEffect(() => {
    const blur = () => finish(true);
    const visibility = () => {
      if (document.hidden) finish(true);
    };
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', visibility);
      finish(true, false);
    };
  }, []);
  useEffect(() => {
    if (item.locked) finish(true);
  }, [item.locked]);

  function move(event) {
    const active = drag.current,
      current = latest.current;
    if (!active || active.pointerId !== event.pointerId || current.item.locked) return;
    const rect = active.element.getBoundingClientRect();
    const point = {
      x: ((event.clientX - rect.left) / rect.width) * 200,
      y: ((event.clientY - rect.top) / rect.height) * 200,
    };
    if (active.mode === 'hue') {
      if (Math.hypot(point.x - CENTRE, point.y - CENTRE) > 1)
        changeColour({ ...current.hsv, h: pointHue(point) });
    } else changeColour(pointHsv(point, current.hsv.h, current.hsv.s));
  }
  function start(event, mode) {
    if (item.locked || event.button !== 0 || !event.isPrimary || drag.current) return;
    event.preventDefault();
    const element = event.currentTarget.ownerSVGElement;
    drag.current = {
      mode,
      element,
      pointerId: event.pointerId,
      color: item.color,
      model,
      restore: update,
      transaction: beginGesture?.(),
    };
    // Programmatic SVG focus can inherit :focus-visible from an editable field.
    // Pointer paint stays quiet; focus still supports Escape and arrow keys.
    setPointerFocus(true);
    event.currentTarget.focus({ preventScroll: true });
    element.setPointerCapture(event.pointerId);
    setDragging(mode);
    move(event);
  }
  const setHex = (color) => {
    if (item.locked) return;
    const next = hexHsv(color, hsv.h, hsv.s);
    setModel({ source: color, ...next });
    if (color !== item.color) update({ color });
  };
  return (
    <>
      <div className="ds-studio-colour-heading">
        <span
          className="ds-colour-swatch"
          style={{ backgroundColor: item.color }}
          aria-hidden="true"
        />
        <HexField labelPrefix={labelPrefix} value={item.color} onChange={setHex} disabled={item.locked} />
      </div>
      <div className="ds-colour-wheel-row" data-accessory={Boolean(wheelAccessory) || undefined}>
      <div className="ds-studio-colour-wheel" data-dragging={dragging || undefined} data-pointer-focus={pointerFocus || undefined}
        onKeyDownCapture={event => {
          if (['Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) setPointerFocus(false);
        }}
        onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setPointerFocus(false); }}>
        <div className="ds-colour-ring-paint" aria-hidden="true" />
        <canvas
          ref={canvas}
          width={400}
          height={400}
          className="ds-colour-triangle-paint"
          style={{ clipPath: triangleClip }}
          aria-hidden="true"
        />
        <svg
          viewBox="0 0 200 200"
          className="ds-colour-controls"
          onPointerMove={(event) => {
            if (drag.current?.pointerId !== event.pointerId) return;
            if (!(event.buttons & 1)) {
              finish(false);
              return;
            }
            move(event);
          }}
          onPointerUp={(event) => {
            if (drag.current?.pointerId === event.pointerId) {
              move(event);
              finish(false);
            }
          }}
          onPointerCancel={(event) => {
            if (drag.current?.pointerId === event.pointerId) finish(true);
          }}
          onLostPointerCapture={(event) => {
            if (drag.current?.pointerId === event.pointerId) finish(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && drag.current) {
              event.preventDefault();
              finish(true);
            }
          }}
        >
          <circle
            className="ds-colour-hue"
            cx={CENTRE}
            cy={CENTRE}
            r={RING_RADIUS}
            fill="none"
            stroke="transparent"
            strokeWidth={20}
            role="slider"
            tabIndex={item.locked ? -1 : 0}
            aria-disabled={item.locked}
            aria-label="Colour hue"
            aria-valuemin={0}
            aria-valuemax={359}
            aria-valuenow={Math.floor(hsv.h)}
            aria-valuetext={`${Math.round(hsv.h)} degrees`}
            onPointerDown={(event) => start(event, 'hue')}
            onKeyDown={(event) => {
              if (
                item.locked ||
                !['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp', 'Home', 'End'].includes(
                  event.key,
                )
              )
                return;
              event.preventDefault();
              finish(false);
              const h =
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? 359
                    : hsv.h +
                      (['ArrowLeft', 'ArrowDown'].includes(event.key) ? -1 : 1) *
                        (event.shiftKey ? 15 : 5);
              changeColour({ ...hsv, h });
            }}
          />
          <polygon
            className="ds-colour-triangle"
            points={trianglePoints}
            fill="transparent"
            role="group"
            aria-label="Colour triangle"
            aria-roledescription="two-dimensional colour selector"
            aria-describedby={instructions}
            aria-disabled={item.locked}
            tabIndex={item.locked ? -1 : 0}
            onPointerDown={(event) => start(event, 'triangle')}
            onKeyDown={(event) => {
              if (
                item.locked ||
                !['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp', 'Home', 'End'].includes(
                  event.key,
                )
              )
                return;
              event.preventDefault();
              finish(false);
              const step = event.shiftKey ? 10 : 2;
              const point =
                event.key === 'Home'
                  ? TRIANGLE.white
                  : event.key === 'End'
                    ? TRIANGLE.black
                    : {
                        x:
                          triangleMarker.x +
                          (event.key === 'ArrowLeft'
                            ? -step
                            : event.key === 'ArrowRight'
                              ? step
                              : 0),
                        y:
                          triangleMarker.y +
                          (event.key === 'ArrowUp'
                            ? -step
                            : event.key === 'ArrowDown'
                              ? step
                              : 0),
                      };
              changeColour(pointHsv(point, hsv.h, hsv.s));
            }}
          />
          <circle
            className="ds-colour-marker"
            cx={hueMarker.x}
            cy={hueMarker.y}
            r={6}
            aria-hidden="true"
          />
          <circle
            className="ds-colour-marker"
            cx={triangleMarker.x}
            cy={triangleMarker.y}
            r={5}
            aria-hidden="true"
          />
        </svg>
      </div>
      {wheelAccessory}
      </div>
      <span id={instructions} className="ds-colour-instructions">
        Drag or use arrow keys to move between white, colour and black. Shift moves faster. Home
        selects white; End selects black. Current colour {item.color.toUpperCase()}.
      </span>
      <div className="ds-studio-field-row ds-colour-fields">
        <NumberField
          label="Saturation" labelPrefix={labelPrefix} disabled={item.locked}
          value={Math.round(hsl.s * 100)}
          max={100}
          onChange={(value) => changeColour(hslHsv(hsv.h, value / 100, hsl.l))}
        />
        <NumberField
          label="Lightness" labelPrefix={labelPrefix} disabled={item.locked}
          value={Math.round(hsl.l * 100)}
          max={100}
          onChange={(value) => changeColour(hslHsv(hsv.h, hsl.s, value / 100))}
        />
      </div>
      {showOpacity && <label className="ds-studio-range">
        Opacity
        <input
          aria-label={`${labelPrefix} opacity`} disabled={item.locked}
          type="range"
          min="0"
          max="100"
          value={item.opacity}
          onChange={(event) => update({ opacity: Number(event.target.value) })}
        />
        <output>{item.opacity}%</output>
      </label>}
    </>
  );
}
