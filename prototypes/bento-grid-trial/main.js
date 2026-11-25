import { createLayerScene } from './layers.js';
import { createTrialStore } from './model.js';
import { projectDocument, dropTarget, moveCell, setRatio, leaves } from './partition.js';
const root = document.getElementById('root');
const LIBRARY = 'https://esm.sh/react-grid-layout@2.3.0?bundle&external=react,react-dom&target=es2022';
const sideName = { left: 'links', right: 'rechts', top: 'boven', bottom: 'onder' };
async function startTrial() {
try {
  const [React, { createRoot }, library] = await Promise.all([
    import('https://esm.sh/react@18.3.1'),
    import('https://esm.sh/react-dom@18.3.1/client?external=react'),
    import(/* @vite-ignore */ LIBRARY),
  ]);
  const h = React.createElement, Grid = library.default, LayerScene = createLayerScene(React);
  // RGL owns drag mechanics/rendering. Our explicit partition planner owns drops.
  const movementOnly = { ...library.noCompactor, allowOverlap: true };
  const storage = { getItem: k => localStorage.getItem(k), setItem: (k, v) => localStorage.setItem(k, v), removeItem: k => localStorage.removeItem(k) };
  const store = createTrialStore(storage);
  const ruler = document.createElement('div'); ruler.className = 'text-measure'; ruler.setAttribute('aria-hidden', 'true'); document.body.append(ruler);
  const measureText = (text, width) => { ruler.style.width = `${width}px`; ruler.textContent = text; return ruler.getBoundingClientRect().height; };
  function Trial() {
    const [state, setState] = React.useState(store.read), [message, setMessage] = React.useState('Midden: wisselen. Celrand: invoegen. Kaartrand: hele rij of kolom.'),
      [selected, setSelected] = React.useState('quote'), [target, setTarget] = React.useState('artwork'), [size, setSize] = React.useState(null),
      [epoch, setEpoch] = React.useState(0), [preview, setPreview] = React.useState(null), [weight, setWeight] = React.useState('Librarygrootte meten...'),
      [dragSource, setDragSource] = React.useState(null), [layerTest, setLayerTest] = React.useState(false), [layerMode, setLayerMode] = React.useState('relative'),
      [layerFit, setLayerFit] = React.useState('contain'), [layerAnchor, setLayerAnchor] = React.useState('bottom'), [layerOutlines, setLayerOutlines] = React.useState(true),
      [theme, setTheme] = React.useState('dark'), [fontRevision, setFontRevision] = React.useState(0);
    const host = React.useRef(null), gesture = React.useRef(null), resize = React.useRef(null), previewRef = React.useRef(null), draftText = React.useRef({}), restoreFocus = React.useRef(null);
    const { document: doc } = state, ids = leaves(doc.tree), currentId = ids.includes(selected) ? selected : ids[0];
    const targetId = ids.includes(target) ? target : ids.find(id => id !== currentId);
    const width = Math.max(1, (size || 960) - 2);
    const projection = React.useMemo(() => projectDocument(doc, width, measureText), [doc, width, fontRevision]);
    const displayed = preview?.projection || projection;
    const showPreview = value => { previewRef.current = value; setPreview(value); };
    const cancel = () => { setDragSource(null); gesture.current = null; resize.current = null; showPreview(null); setEpoch(n => n + 1); };
    const refresh = () => { setState(store.read()); setEpoch(n => n + 1); };
    const run = (action, success) => {
      cancel();
      try { action(); refresh(); if (success) setMessage(success); }
      catch (error) { setMessage(error.message); }
    };
    React.useEffect(() => {
      let previousWidth = null;
      const observer = new ResizeObserver(([entry]) => {
        const nextWidth = Math.floor(entry.contentRect.width);
        if (nextWidth === previousWidth) return;
        previousWidth = nextWidth;
        gesture.current = null; resize.current = null; showPreview(null); setSize(nextWidth);
      });
      observer.observe(host.current);
      let live = true;
      const fontChange = () => { if (live) { cancel(); setFontRevision(n => n + 1); } };
      document.fonts.ready.then(fontChange); document.fonts.addEventListener('loadingdone', fontChange);
      const escape = event => { if (event.key === 'Escape') { cancel(); setMessage('Sleepvoorbeeld geannuleerd.'); } };
      const blur = () => cancel();
      window.addEventListener('keydown', escape); window.addEventListener('blur', blur);
      return () => { live = false; observer.disconnect(); window.removeEventListener('keydown', escape); window.removeEventListener('blur', blur); document.fonts.removeEventListener('loadingdone', fontChange); };
    }, []);
    React.useEffect(() => {
      if (restoreFocus.current) host.current.querySelector(`[data-cell="${restoreFocus.current}"] .cell-grip`)?.focus();
      restoreFocus.current = null;
    }, [epoch]);
    React.useEffect(() => {
      let active = true;
      measureLibrary().then(value => { if (active) setWeight(value); }).catch(() => { if (active) setWeight('Groottemeting niet beschikbaar.'); });
      return () => { active = false; };
    }, []);
    const label = destination => destination.kind === 'swap' ? `Wisselen met ${doc.content[destination.target].name}`
      : `${destination.kind === 'root' ? 'Hele kaart' : doc.content[destination.target].name}: ${sideName[destination.side]} invoegen`;
    const plan = (source, destination, origin = doc) => {
      const tree = moveCell(origin.tree, source, destination);
      return { tree, source, destination, label: label(destination), projection: projectDocument({ ...origin, tree }, width, measureText) };
    };
    const beginDrag = (_layout, oldItem) => {
      setSelected(oldItem.i); setDragSource(oldItem.i);
      gesture.current = { source: oldItem.i, revision: state.revision, projection, doc, width };
    };
    const drag = (_layout, _old, _next, _placeholder, event) => {
      const origin = gesture.current;
      if (!origin || origin.width !== width || origin.revision !== store.read().revision) return;
      const pointer = event.touches?.[0] || event.changedTouches?.[0] || event;
      const bounds = host.current.querySelector('.card').getBoundingClientRect();
      const destination = dropTarget(origin.projection, origin.source, { x: pointer.clientX - bounds.left - 1, y: pointer.clientY - bounds.top - 1 });
      if (JSON.stringify(destination) === JSON.stringify(previewRef.current?.destination || null)) return;
      try { showPreview(destination ? plan(origin.source, destination, origin.doc) : null); }
      catch (error) { showPreview(null); setMessage(error.message); }
    };
    const endDrag = () => {
      const origin = gesture.current, accepted = previewRef.current;
      restoreFocus.current = origin?.source;
      if (origin && accepted) run(() => store.tree(accepted.tree, origin.revision), `${accepted.label}. Opgeslagen als één Undo-stap.`);
      else cancel();
    };
    const place = destination => {
      restoreFocus.current = currentId;
      run(() => store.move(currentId, destination, state.revision), `${label(destination)}. Opgeslagen.`);
    };
    const flushText = id => {
      if (draftText.current[id] === undefined) return;
      const text = draftText.current[id];
      try { store.content(id, { text }); delete draftText.current[id]; refresh(); setMessage('Tekst opgeslagen.'); }
      catch (error) { setMessage(error.message); }
    };
    React.useEffect(() => {
      const move = event => {
        const active = resize.current; if (!active) return;
        const rect = host.current.querySelector('.card').getBoundingClientRect(), d = active.divider;
        const position = d.axis === 'x' ? event.clientX - rect.left - 1 : event.clientY - rect.top - 1;
        const ratio = (position - (d.axis === 'x' ? d.rect.left : d.rect.top)) / (d.axis === 'x' ? d.rect.width : d.rect.height);
        const tree = setRatio(active.doc.tree, d.path, ratio);
        showPreview({ tree, source: null, label: 'Gedeelde rand verplaatsen', projection: projectDocument({ ...active.doc, tree }, active.width, measureText) });
      };
      const finish = () => {
        const active = resize.current, accepted = previewRef.current;
        if (active && accepted) run(() => store.tree(accepted.tree, active.revision), 'Gedeelde rand opgeslagen als één Undo-stap.');
        else if (active) cancel();
      };
      const stop = () => { if (resize.current) cancel(); };
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', finish); window.addEventListener('pointercancel', stop);
      return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', finish); window.removeEventListener('pointercancel', stop); };
    }, []);
    const body = (id, ghost = false) => {
      const c = doc.content[id];
      return h('div', { className: `cell-body${c.image ? ' has-artwork' : ''}`, style: { background: c.color } },
        ghost ? h('span', { className: 'cell-name' }, c.name) : h('button', { className: 'cell-grip', 'aria-label': `Verplaats ${c.name}`, onFocus: () => setSelected(id),
          onKeyDown: event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(id); document.getElementById('keyboard-placement')?.focus(); } } }, h('span', {}, '⠿'), c.name),
        c.image && layerTest ? h(LayerScene, { mode: layerMode, fit: layerFit, anchor: layerAnchor, outlines: layerOutlines })
          : c.image ? h('div', { className: 'artwork' }, h('img', { src: c.image, alt: 'Bestaande illustratielaag uit Inscape', draggable: false }), h('p', {}, c.text))
          : ghost ? h('p', { className: 'preview-text' }, c.text) : h('textarea', { className: 'cell-text', 'aria-label': `${c.name} inhoud`, defaultValue: draftText.current[id] ?? c.text,
            onChange: event => { draftText.current[id] = event.target.value; }, onBlur: () => flushText(id) }));
    };
    const button = (text, onClick, disabled = false) => h('button', { type: 'button', onClick, disabled: disabled || !!state.notice }, text);
    const placementButton = (text, destination) => h('button', {
      type: 'button', disabled: !!state.notice || destination.target === currentId,
      onFocus: () => {
        try { showPreview(plan(currentId, destination)); }
        catch (error) { setMessage(error.message); }
      },
      onBlur: () => { if (!gesture.current && !resize.current) showPreview(null); },
      onClick: () => place(destination),
    }, text);
    return h('main', { className: 'trial', 'data-theme': theme },
      h('header', { className: 'trial-header' }, h('div', {}, h('p', { className: 'eyebrow' }, 'INSCAPE / RESPONSIEVE PROEF'), h('h1', {}, 'Wisselen, invoegen, herschikken'),
        h('p', { className: 'intro' }, 'Minder ruimte → cellen onder elkaar. Tekst blijft 16 px.')),
        h('div', { className: 'actions' }, button('Undo', () => run(() => store.undo(), 'Vorige bewerking hersteld.'), !state.canUndo),
          button('Redo', () => run(() => store.redo(), 'Bewerking opnieuw toegepast.'), !state.canRedo),
          h('button', { onClick: () => setTheme(t => t === 'dark' ? 'light' : 'dark') }, theme === 'dark' ? 'Light' : 'Dark'),
          h('button', { onClick: () => { setSelected('quote'); setTarget('artwork'); run(() => store.reset(), 'Proef opnieuw begonnen.'); } }, 'Reset proef'))),
      h('section', { className: 'sample-bar', 'aria-label': 'Voorbeeldindeling' },
        button('3 cellen', () => { setSelected('quote'); setTarget('artwork'); run(() => store.sample(3), 'Drie cellen geladen.'); }),
        button('49 cellen · 7 × 7', () => { setSelected('cell-1'); setTarget('cell-2'); run(() => store.sample(49), '49 cellen geladen. Verklein het venster om ze te laten stapelen.'); }),
        h('span', { className: 'viewport-status' }, `${Math.round(width)} px beschikbaar · ${projection.stacked ? 'groepen gestapeld' : 'brede indeling'} · ${Math.round(projection.height)} px hoog`)),
      h('section', { className: 'layer-controls', 'aria-label': 'Beeldgedrag testen' },
        h('label', {}, h('input', { type: 'checkbox', checked: layerTest, onChange: e => { cancel(); setLayerTest(e.target.checked); } }), ' Lagenproef in Artwork-cel'),
        layerTest && h(React.Fragment, {},
          h('label', {}, 'Plaatsing ', h('select', { 'aria-label': 'Laagplaatsing', value: layerMode, onChange: e => setLayerMode(e.target.value) },
            h('option', { value: 'relative' }, 'Meeschalen met cel'), h('option', { value: 'anchored' }, 'Vaste grootte + ankers'))),
          h('label', {}, 'Beeld ', h('select', { 'aria-label': 'Beeldvulling', value: layerFit, onChange: e => setLayerFit(e.target.value) },
            h('option', { value: 'contain' }, 'Fit · volledig zichtbaar'), h('option', { value: 'cover' }, 'Cover · vak vullen / uitsnijden'))),
          h('label', {}, 'Nomad-anker ', h('select', { 'aria-label': 'Nomad-anker', value: layerAnchor, disabled: layerMode !== 'anchored', onChange: e => setLayerAnchor(e.target.value) },
            ...['top', 'center', 'bottom'].map((v, i) => h('option', { key: v, value: v }, ['Boven', 'Midden', 'Onder'][i])))),
          h('label', {}, h('input', { type: 'checkbox', checked: layerOutlines, onChange: e => setLayerOutlines(e.target.checked) }), ' Laagkaders'),
          h('p', {}, 'Nomad + Abyssal Eye + achtergrond. Versleep een scheiding of wissel de Artwork-cel met een kleiner vak. Fit houdt het beeld heel binnen zijn laagkader; Cover snijdt af. Vaste lagen kunnen buiten een kleine cel vallen en worden daar afgeknipt. Testinstellingen gelden tot herladen; de celindeling blijft opgeslagen.'),
          !ids.includes('artwork') && h('p', {}, 'Kies “3 cellen” om de Artwork-cel terug te laden.'))),
      h('p', { className: 'scope' }, 'Midden = wisselen · celrand = lokaal invoegen · buitenrand = hele rij/kolom · Escape = annuleren'),
      h('div', { className: 'stage-host', ref: host }, h('div', { className: `card${preview ? ' is-preview' : ''}`, style: { height: displayed.height + 2 } },
        size && h(Grid, { key: `${epoch}:${width}:${fontRevision}`, width, layout: projection.frames.map(r => ({ i: r.id, x: r.left / width * 1000, y: r.top / 10, w: r.width / width * 1000, h: r.height / 10 })),
          autoSize: false, style: { height: projection.height }, compactor: movementOnly,
          gridConfig: { cols: 1000, rowHeight: 10, margin: [0, 0], containerPadding: [0, 0] },
          dragConfig: { handle: '.cell-grip', enabled: !state.notice, bounded: false, enableUserSelectHack: false }, resizeConfig: { enabled: false },
          onDragStart: beginDrag, onDrag: drag, onDragStop: endDrag,
        }, ...projection.frames.map(r => h('div', { key: r.id, 'data-cell': r.id, className: `cell-shell${currentId === r.id ? ' selected' : ''}`, onPointerDown: () => setSelected(r.id) }, body(r.id)))),
        preview && h('div', { className: 'drop-preview', 'aria-hidden': 'true' }, ...preview.projection.frames.map(r => h('div', { key: r.id, className: `cell-shell preview-cell${r.id === preview.source ? ' incoming' : ''}`,
          style: { left: r.left, top: r.top, width: r.width, height: r.height } }, body(r.id, true)))),
        dragSource && h('div', { className: 'card-edge-targets', 'aria-hidden': 'true', style: { height: projection.height } },
          ...Object.entries(sideName).map(([side, name]) => h('div', {
            key: side, className: 'card-edge-target edge-' + side + (preview?.destination?.kind === 'root' && preview.destination.side === side ? ' active' : ''),
          }, h('span', {}, (side === 'left' || side === 'right' ? 'Hele kolom ' : 'Hele rij ') + name)))),
        !preview && projection.dividers.map((d, index) => h('button', { key: d.path.join('.'), type: 'button', role: 'separator', className: `divider divider-${d.axis}`,
          'aria-label': `Scheiding ${index + 1}`, 'aria-orientation': d.axis === 'x' ? 'vertical' : 'horizontal', 'aria-valuemin': 15, 'aria-valuemax': 85, 'aria-valuenow': Math.round(d.ratio * 100),
          disabled: !!state.notice, style: d.axis === 'x' ? { left: d.position - 5, top: d.rect.top + 6, height: d.rect.height - 12 } : { top: d.position - 5, left: d.rect.left + 6, width: d.rect.width - 12 },
          onPointerDown: event => { if (event.button !== 0) return; event.preventDefault(); resize.current = { divider: d, doc, revision: state.revision, width }; },
          onKeyDown: event => { const sign = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : 0;
            if (sign) { event.preventDefault(); run(() => store.ratio(d.path, d.ratio + sign * .05), 'Gedeelde rand verplaatst.'); } },
        })))),
      h('p', { className: 'notice', role: 'status', 'aria-live': 'polite' }, preview ? `VOORBEELD — ${preview.label}${preview.projection.stacked ? ' · smalle groepen stapelen' : ''}` : state.notice || message),
      preview && h('div', { className: 'drag-hint', 'aria-hidden': 'true' }, preview.label),
      h('section', { className: 'trial-controls', 'aria-label': 'Geselecteerde cel' }, h('strong', {}, doc.content[currentId].name),
        h('label', {}, 'Celkleur ', h('input', { type: 'color', 'aria-label': 'Celkleur', value: doc.content[currentId].color, disabled: !!state.notice,
          onChange: event => run(() => store.content(currentId, { color: event.target.value }), 'Celkleur opgeslagen.') })),
        h('span', {}, 'Sleep via de celnaam. Voor de grote afbeelding rechts en beide tekstcellen links: sleep Artwork naar de uiterste rechterrand van de kaart (Hele kolom rechts).')),
      h('details', { className: 'keyboard-controls' }, h('summary', { id: 'keyboard-placement', tabIndex: 0 }, 'Plaatsen zonder slepen'),
        h('label', {}, 'Doelcel ', h('select', { 'aria-label': 'Doelcel', value: targetId, onChange: event => setTarget(event.target.value) },
          ...ids.map(id => h('option', { key: id, value: id }, doc.content[id].name)))),
        h('p', {}, 'Tab naar een actie toont hetzelfde voorbeeld als slepen. Enter past toe; Escape annuleert.'),
        h('div', { className: 'actions' }, placementButton('Wisselen', { kind: 'swap', target: targetId }),
          ...Object.entries(sideName).map(([side, name]) => h(React.Fragment, { key: side }, placementButton(`Cel: ${name}`, { kind: 'cell', target: targetId, side }),
            placementButton(`Kaart: ${name}`, { kind: 'root', side }))))),
      h('details', { className: 'inspection' }, h('summary', {}, 'Posities en pakketgrootte'), h('p', { id: 'bundle-weight' }, weight),
        h('p', {}, 'RGL verzorgt slepen en rendering. Invoegregels en responsieve onderverdeling zijn maatwerk in deze proef. De meting hierboven betreft alleen de CDN-library.'),
        h('pre', { 'aria-label': 'Actuele celposities' }, JSON.stringify(projection.frames.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'number' ? Math.round(v) : v]))), null, 2))),
      h('footer', {}, 'Losse proef met eigen opslag. Composition, native artworktools, publicatie en scèneanimatie zijn niet gekoppeld.'),
    );
  }
  createRoot(root).render(h(Trial));
} catch (error) {
  root.replaceChildren(Object.assign(document.createElement('p'), { textContent: `De proef kon niet laden: ${error.message}. Deze CDN-proef heeft internet nodig.`, role: 'alert' }));
}
}
startTrial();

async function measureLibrary() {
  const wrapper = await fetch(LIBRARY);
  if (!wrapper.ok) throw Error('CDN unavailable');
  const source = await wrapper.text();
  const path = source.match(/from\s*["']([^"']+\.mjs)["']/)?.[1];
  if (!path) throw Error('Bundle path unavailable');
  const response = await fetch(new URL(path, wrapper.url));
  if (!response.ok) throw Error('Bundle unavailable');
  const bytes = new Uint8Array(await response.arrayBuffer());
  const zipped = await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
  const css = await Promise.all([
    'https://cdn.jsdelivr.net/npm/react-grid-layout@2.3.0/css/styles.css',
    'https://cdn.jsdelivr.net/npm/react-resizable@3.2.0/css/styles.css',
  ].map(async url => {
    const result = await fetch(url);
    if (!result.ok) throw Error('CSS unavailable');
    const data = await result.arrayBuffer();
    const zip = await new Response(new Blob([data]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
    return { raw: data.byteLength, gzip: zip.byteLength };
  }));
  const cssRaw = css.reduce((n, item) => n + item.raw, 0), cssGzip = css.reduce((n, item) => n + item.gzip, 0);
  return `React Grid Layout 2.3.0: ${(bytes.length / 1024).toFixed(1)} KiB minified JS · ${(zipped.byteLength / 1024).toFixed(1)} KiB gzip. CSS: ${(cssRaw / 1024).toFixed(1)} KiB raw · ${(cssGzip / 1024).toFixed(1)} KiB gzip. Totaal circa ${((zipped.byteLength + cssGzip) / 1024).toFixed(1)} KiB gzip.`;
}

