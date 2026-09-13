import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { defaults, labels, limits, validate } from '../../packages/mirror/core.js';

// No profile, Library, wallet or persistence imports: the host owns those facts.
export default forwardRef(function MirrorSurface({ settings, source, onSettingsChange, onAssetAccepted, suspended = false }, ref) {
  const node = useRef(null), runtime = useRef(null), latest = useRef(null), lifetime = useRef(0);
  const [ready, setReady] = useState(false), [status, setStatus] = useState('Opening renderer…');
  const [error, setError] = useState(null), [retry, setRetry] = useState(0);
  const [paused, setPaused] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [helpers, setHelpers] = useState({ perspective: false, grid: false, guides: false });
  latest.current = { settings, source, onAssetAccepted };
  useEffect(() => {
    const generation = ++lifetime.current;
    let owned;
    setReady(false);
    const container = node.current;
    import('../../packages/mirror/module.js').then(({ createMirrorModule }) => generation !== lifetime.current ? null : createMirrorModule(container, {
      onStatus: value => { if (lifetime.current === generation) setStatus(value.message); },
    })).then(instance => {
      if (!instance) return;
      owned = instance;
      if (generation !== lifetime.current) { instance.destroy(); return; }
      runtime.current = instance;
      setReady(true);
    }).catch(e => { if (generation === lifetime.current) setError(`Renderer unavailable: ${e.message}`); });
    return () => { lifetime.current++; runtime.current = null; owned?.destroy(); };
  }, [retry]);
  useEffect(() => { if (ready) runtime.current?.loadSettings(settings); }, [ready, settings]);
  useEffect(() => {
    if (!ready) return;
    if (source) void runtime.current?.setAsset({ source, reference: null });
    else runtime.current?.clearAsset();
  }, [ready, source]);
  useEffect(() => {
    const instance = runtime.current;
    if (ready && instance) { if (paused || suspended) instance.pause(); else instance.resume(); }
  }, [ready, paused, suspended]);
  useEffect(() => { if (ready) runtime.current?.setHelpers(helpers); }, [ready, helpers]);
  useImperativeHandle(ref, () => ({
    get node() { return node.current; },
    async acceptAsset(asset, url) {
      const instance = runtime.current, generation = lifetime.current;
      if (!instance || !onSettingsChange) return false;
      const accepted = await instance.setAsset({ source: url, reference: null });
      if (!accepted || generation !== lifetime.current) return false;
      if (latest.current.onAssetAccepted?.(asset) === false) {
        setRetry(value => value + 1);
        setError('Artwork could not be saved. Reload the profile before trying again.');
        return false;
      }
      return true;
    },
  }), [onSettingsChange]);
  function change(next) {
    try {
      if (onSettingsChange(validate(next)) === false) throw new Error('Settings could not be saved. Your saved configuration is unchanged.');
      setError(null);
    } catch (e) { setError(e.message); }
  }
  function parameter(key, field, value) {
    change({ ...settings, parameters: { ...settings.parameters, [key]: { ...settings.parameters[key], [field]: value } } });
  }
  return <div className="mirror-surface">
    <div className="mirror-surface__stage" ref={node} aria-label="Mirror artwork stage" />
    <div className="mirror-surface__transport">
      <button type="button" disabled={!ready} onClick={() => setPaused(value => !value)}>{paused ? 'Play' : 'Pause'}</button>
      {onSettingsChange && <button type="button" onClick={() => change(defaults())}>Reset settings</button>}
      <span role="status">{!source && ready ? 'Drag an image from Library into this module.' : status}</span>
    </div>
    {error && <p role="alert">{error} <button type="button" onClick={() => { setError(null); setRetry(value => value + 1); }}>Reload renderer</button></p>}
    {onSettingsChange && <details className="mirror-surface__controls" open><summary>Animation settings</summary>
      <div className="mirror-surface__options">
        <label>Stage<select value={settings.format} onChange={e => change({ ...settings, format: e.target.value })}>
          <option value="landscape">16:9</option><option value="portrait">9:16</option><option value="square">1:1</option></select></label>
        <label>Mirror axis<select aria-label="Mirror axis" value={settings.axis} onChange={e => change({ ...settings, axis: e.target.value })}>
          <option value="vertical">Left / right</option><option value="horizontal">Above / below</option></select></label>
        <label><input type="checkbox" checked={settings.flipHorizontal} onChange={e => change({ ...settings, flipHorizontal: e.target.checked })} />Flip horizontal</label>
      </div>
      {Object.entries(settings.parameters).map(([key, p]) => <fieldset key={key}><legend>{labels[key]}</legend>
        <div className="mirror-surface__options">
          <input aria-label={`${key} slider`} type="range" min={limits[key][0]} max={limits[key][1]} step={['distance','rotation'].includes(key) ? 1 : .01}
            value={p.base} onChange={e => parameter(key, 'base', e.target.valueAsNumber)} />
          <label>Base<input aria-label={`${key} base`} type="number" min={limits[key][0]} max={limits[key][1]} step="any" value={p.base} onChange={e => parameter(key, 'base', e.target.valueAsNumber)} /></label>
          <label><input aria-label={`${key} automation`} type="checkbox" checked={p.enabled} onChange={e => parameter(key, 'enabled', e.target.checked)} />Automate</label>
          <label>Amplitude<input type="number" aria-label={`${key} amplitude`} min="0" step="any" value={p.amplitude} onChange={e => parameter(key, 'amplitude', e.target.valueAsNumber)} /></label>
          <label>Speed / second<input type="number" aria-label={`${key} speed`} min="0.001" max="2" step="0.001" value={p.speed} onChange={e => parameter(key, 'speed', e.target.valueAsNumber)} /></label>
          <label>Movement<select value={p.wave} aria-label={`${key} movement`} onChange={e => parameter(key, 'wave', e.target.value)}><option value="sine">Sine</option><option value="noise">Smooth noise</option></select></label>
        </div>
      </fieldset>)}
      <fieldset><legend>Editor guides</legend><div className="mirror-surface__options">{[['perspective','Perspective box'],['grid','Flat grid'],['guides','Axis and bounds']].map(([key,label]) =>
        <label key={key}><input type="checkbox" checked={helpers[key]} onChange={e => setHelpers({ ...helpers, [key]: e.target.checked })} />{label}</label>)}</div></fieldset>
    </details>}
  </div>;
});
