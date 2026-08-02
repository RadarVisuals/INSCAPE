import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown, ChevronUp, Copy, FlipHorizontal2, FlipVertical2, Folder, Grid2X2,
  Layers3, MoreVertical, NotebookTabs, Palette, RotateCw, Search, SquareStack, WalletCards, X,
} from 'lucide-react';
import {
  ACTIVITY_EVENTS, INITIAL_LAYERS, LIBRARY_ASSETS, LIBRARY_CATEGORIES, MODUL8R_SCENARIOS,
  MODUL8R_THEMES, MODUL8R_VIEWPORTS, PEOPLE, USED_ELSEWHERE,
} from './modul8rFixtures.js';
import { filterLibrary, filterText, moveLayer, scenarioItems } from './modul8rModel.js';
import './modul8rPrototype.css';

const MODULE_LABELS = { library: 'LIBRARY', activity: 'ACTIVITY', people: 'PEOPLE', layers: 'LAYERS' };
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

function IconButton({ label, children, ...props }) {
  return <button aria-label={label} title={label} type="button" {...props}>{children}</button>;
}

function Accessory({ density, module, query, setDensity, setQuery }) {
  return <div className="m8-accessory" data-module-accessory={module} onClick={(event) => event.stopPropagation()}>
    <label className="m8-accessory__search"><Search aria-hidden="true" size={14} strokeWidth={2} /><input aria-label={`Search ${MODULE_LABELS[module]}`} onChange={(event) => setQuery(event.target.value)} placeholder={`SEARCH ${MODULE_LABELS[module]}`} value={query} /></label>
    <label><span>SIZE</span><input aria-label={`${MODULE_LABELS[module]} size`} max="3" min="1" onChange={(event) => setDensity(Number(event.target.value))} type="range" value={density} /></label>
  </div>;
}

function Module({ accessory, children, expanded, id, onToggle }) {
  const [transitioning, setTransitioning] = useState(false);
  const previousExpandedRef = useRef(expanded);
  useEffect(() => {
    if (previousExpandedRef.current === expanded) return undefined;
    previousExpandedRef.current = expanded;
    setTransitioning(true);
    const timeout = window.setTimeout(() => setTransitioning(false), 260);
    return () => window.clearTimeout(timeout);
  }, [expanded]);
  const toggle = () => { setTransitioning(true); onToggle(id); };
  return <section className="m8-module" data-expanded={expanded || undefined} data-module={id} data-transitioning={transitioning || undefined}>
    <header className="m8-faceplate" onClick={toggle}>
      <button aria-controls={`m8-${id}-body`} aria-expanded={expanded} className="m8-faceplate__toggle" onClick={(event) => { event.stopPropagation(); toggle(); }} type="button">
        <span className="m8-faceplate__identity"><strong>{MODULE_LABELS[id]}</strong><MoreVertical aria-hidden="true" className="m8-grip" size={14} strokeWidth={2} /></span>
        <span aria-hidden="true" className="m8-faceplate__state">{expanded ? <ChevronUp size={13} strokeWidth={2} /> : <ChevronDown size={13} strokeWidth={2} />}</span>
      </button>
      {expanded && accessory}
    </header>
    <div aria-hidden={!expanded} className="m8-module__reveal" inert={!expanded ? '' : undefined} onTransitionEnd={(event) => { if (event.target === event.currentTarget && event.propertyName === 'grid-template-rows') setTransitioning(false); }}>
      <div className="m8-module__body" id={`m8-${id}-body`}>{children}</div>
    </div>
  </section>;
}

function StateMessage({ label, scenario }) {
  const copy = scenario === 'empty' ? `NO ${label} IN THIS FIXTURE` : scenario === 'loading' ? `LOADING ${label}` : scenario === 'failed' ? `${label} FAILED / RETRY` : scenario === 'unresolved' ? `${label} UNRESOLVED` : `NO MATCHING ${label}`;
  return <div className="m8-state" data-state={scenario}><span className="m8-state__mark" />{copy}</div>;
}

function LibraryBody({ category, density, query, resizeHandle, scenario, setCategory }) {
  const [sidebarWidth, setSidebarWidth] = useState(174);
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('az');
  const [showLabels, setShowLabels] = useState(true);
  const sidebarResizeRef = useRef(null);
  const beginSidebarResize = (event) => {
    event.stopPropagation();
    sidebarResizeRef.current = { pointerId: event.pointerId, startWidth: sidebarWidth, startX: event.clientX };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const updateSidebarResize = (event) => {
    const gesture = sidebarResizeRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    setSidebarWidth(Math.round(clamp(gesture.startWidth + event.clientX - gesture.startX, 44, 240)));
  };
  const finishSidebarResize = (event) => {
    if (sidebarResizeRef.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    sidebarResizeRef.current = null;
  };
  const matchingAssets = filterLibrary(LIBRARY_ASSETS, category, query)
    .filter((asset) => filter === 'all' || asset.relationships.includes(filter.toUpperCase()) || asset.ratio === filter)
    .sort((left, right) => (sort === 'za' ? -1 : 1) * left.name.localeCompare(right.name));
  const assets = scenarioItems(matchingAssets, scenario);
  const categoryIcons = { all: Layers3, owned: WalletCards, created: Palette, unsorted: SquareStack, afterimages: Folder, 'field-notes': NotebookTabs };
  return <div className="m8-library" data-sidebar-icons={sidebarWidth <= 64 || undefined} style={{ '--m8-library-sidebar-width': `${sidebarWidth}px` }}>
    <nav aria-label="Library views" className="m8-library__nav">{LIBRARY_CATEGORIES.map((item) => { const Icon = categoryIcons[item.id] || Folder; return <button aria-current={category === item.id ? 'page' : undefined} key={item.id} onClick={() => setCategory(item.id)} title={item.label} type="button"><Icon aria-hidden="true" size={14} strokeWidth={2} /><span>{item.label}</span></button>; })}</nav>
    <button aria-label="Resize Library navigation" className="m8-library__nav-resize" onLostPointerCapture={finishSidebarResize} onPointerCancel={finishSidebarResize} onPointerDown={beginSidebarResize} onPointerMove={updateSidebarResize} onPointerUp={finishSidebarResize} title="Resize Library navigation" type="button" />
    <div className="m8-assets-viewport">
      <div className="m8-library-toolbar">
        <label><select aria-label="Filter Library" onChange={(event) => setFilter(event.target.value)} value={filter}><option value="all">ALL</option><option value="owned">OWNED</option><option value="created">CREATED</option><option value="landscape">LANDSCAPE</option><option value="portrait">PORTRAIT</option><option value="square">SQUARE</option><option value="transparent">TRANSPARENT</option></select></label>
        <label><select aria-label="Sort Library" onChange={(event) => setSort(event.target.value)} value={sort}><option value="az">TITLE A-Z</option><option value="za">TITLE Z-A</option></select></label>
        <label className="m8-library-labels"><input checked={showLabels} onChange={(event) => setShowLabels(event.target.checked)} type="checkbox" /><span>LABELS</span></label>
      </div>
      <div aria-live="polite" className="m8-assets" data-density={density} data-labels={showLabels || undefined}>
        {assets.length ? assets.map((asset, index) => <article className="m8-asset" data-state={asset.state} key={`${asset.id}-${index}`}>
          <div aria-label={`${asset.name}, ${asset.ratio} artwork fixture`} className={`m8-art m8-art--${asset.visual}`} data-ratio={asset.ratio}><span>{asset.state ? asset.state.toUpperCase() : asset.ratio.toUpperCase()}</span></div>
          <div className="m8-card-copy"><strong>{asset.name}</strong><span>{asset.relationships.join(' + ')}</span><small>{asset.provenance}</small></div>
        </article>) : <StateMessage label="ASSETS" scenario={scenario} />}
      </div>
    </div>
    {resizeHandle}
  </div>;
}

function ActivityBody({ density, query, scenario }) {
  const events = scenarioItems(filterText(ACTIVITY_EVENTS, query, ['kind', 'title', 'detail']), scenario);
  return <div aria-live="polite" className="m8-activity" data-density={density}>
    <div className="m8-context-note">INDEXED EVENT HISTORY / FIXTURE DATA</div>
    {events.length ? events.map((event) => <article className="m8-event" data-state={event.state} key={event.id}><time>{event.time}</time><span className="m8-event__visual" aria-hidden="true" /><div><small>{event.kind}</small><strong>{event.title}</strong><span>{event.detail}</span></div></article>) : <StateMessage label="EVENTS" scenario={scenario} />}
  </div>;
}

function PeopleBody({ density, query, scenario }) {
  const people = scenarioItems(filterText(PEOPLE, query, ['name', 'address', 'note']), scenario);
  return <div aria-live="polite" className="m8-people" data-density={density}>
    <div className="m8-context-note">PUBLIC INSCAPE DIRECTORY / READ-ONLY FIXTURES</div>
    {people.length ? people.map((person) => <article className="m8-person" data-state={person.state} key={person.id}><div aria-hidden="true" className={`m8-avatar m8-avatar--${person.visual}`} /><div><strong>{person.name}</strong><span>{person.address}</span><small>{person.note}</small></div></article>) : <StateMessage label="PROFILES" scenario={scenario} />}
  </div>;
}

function LayersBody({ layers, selected, setLayers, setSelected }) {
  const index = layers.findIndex((layer) => layer.id === selected);
  const shift = (direction) => setLayers((current) => moveLayer(current, selected, direction));
  return <div className="m8-layers">
    <div className="m8-layer-heading"><span>ACTIVE TABLE Z-ORDER / LOCAL FIXTURE</span><div><button aria-disabled={index <= 0} aria-label="Move selected layer down" onClick={() => index > 0 && shift(-1)} title="Move selected layer down" type="button"><ChevronDown aria-hidden="true" size={14} strokeWidth={2} /></button><button aria-disabled={index < 0 || index >= layers.length - 1} aria-label="Move selected layer up" onClick={() => index >= 0 && index < layers.length - 1 && shift(1)} title="Move selected layer up" type="button"><ChevronUp aria-hidden="true" size={14} strokeWidth={2} /></button></div></div>
    <ol>{layers.map((layer, position) => { const asset = LIBRARY_ASSETS.find((entry) => entry.id === layer.assetId); return <li key={layer.id}><button aria-pressed={selected === layer.id} onClick={() => setSelected(layer.id)} type="button"><span aria-hidden="true" className={`m8-layer-thumb m8-layer-thumb--${asset?.visual || 6}`} /><span className="m8-layer-copy"><strong>{layer.name}</strong><small>LAYER {String(layers.length - position).padStart(2, '0')}</small></span></button></li>; })}</ol>
    <div className="m8-elsewhere"><span>USED ELSEWHERE / REFERENCE ONLY</span>{USED_ELSEWHERE.map((item) => <div key={item.id}><strong>{item.label}</strong><small>{item.table} · {item.assetId}</small></div>)}</div>
  </div>;
}

function Harness({ motion, scenario, setMotion, setScenario, setTheme, setViewport, theme, viewport }) {
  return <aside aria-label="Prototype state harness" className="m8-harness">
    <div><strong>MODUL-8R / M0.5 HARNESS</strong><span>SESSION ONLY · FIXTURES</span></div>
    <label>THEME<select onChange={(event) => setTheme(event.target.value)} value={theme}>{MODUL8R_THEMES.map((item) => <option key={item}>{item}</option>)}</select></label>
    <label>VIEWPORT<select onChange={(event) => setViewport(event.target.value)} value={viewport}>{Object.entries(MODUL8R_VIEWPORTS).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}</select></label>
    <label>STATE<select onChange={(event) => setScenario(event.target.value)} value={scenario}>{MODUL8R_SCENARIOS.map((item) => <option key={item}>{item}</option>)}</select></label>
    <label>MOTION<select onChange={(event) => setMotion(event.target.value)} value={motion}><option value="normal">normal</option><option value="reduced">reduced</option></select></label>
  </aside>;
}

export default function Modul8rPrototype() {
  const [theme, setTheme] = useState('carbon'); const [viewport, setViewport] = useState('desktop'); const [scenario, setScenario] = useState('ready'); const [motion, setMotion] = useState('normal');
  const [harnessVisible, setHarnessVisible] = useState(false); const [instrumentOpen, setInstrumentOpen] = useState(true); const [masterExpanded, setMasterExpanded] = useState(true); const [masterTransitioning, setMasterTransitioning] = useState(false);
  const [contentOpen, setContentOpen] = useState('library'); const [arrange, setArrange] = useState(false);
  const [rackMenuOpen, setRackMenuOpen] = useState(false); const [visibleModules, setVisibleModules] = useState({ library: true, activity: true, people: true, layers: true });
  const [transform, setTransform] = useState({ rotation: 0, mirrorX: false, mirrorY: false, duplicates: 0 }); const [position, setPosition] = useState({ x: 150, y: 66 }); const [size, setSize] = useState({ width: 980, height: 440 });
  const [queries, setQueries] = useState({ library: '', activity: '', people: '' }); const [densities, setDensities] = useState({ library: 2, activity: 1, people: 2 }); const [category, setCategory] = useState('all');
  const [layers, setLayers] = useState(() => INITIAL_LAYERS.map((layer) => ({ ...layer }))); const [selected, setSelected] = useState('placement-b');
  const rackRef = useRef(null); const gestureRef = useRef(null); const frameRef = useRef(0); const suppressMasterClickRef = useRef(false);
  const viewportPreset = MODUL8R_VIEWPORTS[viewport];
  const setQuery = (module, value) => setQueries((current) => ({ ...current, [module]: value }));
  const setDensity = (module, value) => setDensities((current) => ({ ...current, [module]: value }));
  const accessory = (module) => <Accessory density={densities[module]} module={module} query={queries[module]} setDensity={(value) => setDensity(module, value)} setQuery={(value) => setQuery(module, value)} />;
  const toggleModule = (id) => setContentOpen((current) => current === id ? null : id);
  const toggleMaster = () => { setMasterTransitioning(true); setMasterExpanded((value) => !value); };
  const action = (kind) => {
    const copyId = kind === 'duplicate' ? `placement-copy-${transform.duplicates + 1}` : null;
    setLayers((current) => {
      const source = current.find((layer) => layer.id === selected);
      if (!source) return current;
      if (kind === 'duplicate') {
        const copy = { ...source, id: copyId, name: `${source.name} / COPY` };
        return [...current, copy];
      }
      return current.map((layer) => layer.id !== selected ? layer : kind === 'rotate'
        ? { ...layer, rotation: ((layer.rotation || 0) + 90) % 360 }
        : kind === 'mirrorX' ? { ...layer, mirrorX: !layer.mirrorX } : { ...layer, mirrorY: !layer.mirrorY });
    });
    if (copyId) setSelected(copyId);
    setTransform((current) => kind === 'rotate' ? { ...current, rotation: (current.rotation + 90) % 360 } : kind === 'mirrorX' ? { ...current, mirrorX: !current.mirrorX } : kind === 'mirrorY' ? { ...current, mirrorY: !current.mirrorY } : { ...current, duplicates: current.duplicates + 1 });
  };
  const bounds = () => ({ width: Math.max(320, Math.min(viewportPreset.width, window.innerWidth)), height: Math.max(420, Math.min(viewportPreset.height, window.innerHeight)) });
  const startGesture = (event, kind, allowControl = false) => {
    if (event.button !== 0 || (!allowControl && event.target.closest('button,input,select,label'))) return;
    const node = rackRef.current; if (!node) return; event.currentTarget.setPointerCapture?.(event.pointerId);
    gestureRef.current = { kind, moved: false, startX: event.clientX, startY: event.clientY, position, size, pointerId: event.pointerId, node };
  };
  const updateGesture = (event) => {
    const gesture = gestureRef.current; if (!gesture || gesture.pointerId !== event.pointerId) return;
    const dx = event.clientX - gesture.startX; const dy = event.clientY - gesture.startY; const stage = bounds();
    if (Math.abs(dx) + Math.abs(dy) > 3) gesture.moved = true;
    cancelAnimationFrame(frameRef.current); frameRef.current = requestAnimationFrame(() => {
      if (gesture.kind === 'move') { const x = Math.round(clamp(gesture.position.x + dx, 0, Math.max(0, stage.width - gesture.size.width))); const y = Math.round(clamp(gesture.position.y + dy, 0, Math.max(0, stage.height - gesture.node.offsetHeight))); gesture.node.style.setProperty('--m8-x', `${x}px`); gesture.node.style.setProperty('--m8-y', `${y}px`); }
      else if (gesture.kind === 'width') { const width = Math.round(clamp(gesture.size.width + dx, 320, stage.width - gesture.position.x)); gesture.node.style.setProperty('--m8-width', `${width}px`); }
      else { const width = Math.round(clamp(gesture.size.width + dx, 320, stage.width)); const height = Math.round(clamp(gesture.size.height + dy, 220, Math.max(220, stage.height - 190))); gesture.node.style.setProperty('--m8-width', `${width}px`); gesture.node.style.setProperty('--m8-height', `${height}px`); }
    });
  };
  const finishGesture = (event) => {
    const gesture = gestureRef.current; if (!gesture || (event.pointerId != null && gesture.pointerId !== event.pointerId)) return;
    const style = getComputedStyle(gesture.node); if (gesture.kind === 'move') { setPosition({ x: Math.round(parseFloat(style.getPropertyValue('--m8-x')) || 0), y: Math.round(parseFloat(style.getPropertyValue('--m8-y')) || 0) }); suppressMasterClickRef.current = gesture.moved; } else setSize({ width: Math.round(parseFloat(style.getPropertyValue('--m8-width')) || 320), height: Math.round(parseFloat(style.getPropertyValue('--m8-height')) || 220) }); gestureRef.current = null;
  };
  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);
  useEffect(() => {
    const onKey = (event) => { if ((event.key === 'h' || event.key === 'H') && !event.target?.matches?.('input,select,textarea')) { setHarnessVisible((value) => !value); return; } if (event.key !== 'Escape') return; const active = document.activeElement; if (active?.matches?.('.m8-accessory input') && active.value) { setQuery(active.closest('[data-module-accessory]').dataset.moduleAccessory, ''); return; } if (instrumentOpen) setInstrumentOpen(false); };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [instrumentOpen]);
  useEffect(() => { const stage = bounds(); setSize((current) => ({ width: clamp(current.width, 320, stage.width), height: clamp(current.height, 220, Math.max(220, stage.height - 190)) })); setPosition((current) => ({ x: clamp(current.x, 0, Math.max(0, stage.width - Math.min(size.width, stage.width))), y: clamp(current.y, 0, stage.height - 54) })); }, [viewport]);
  useEffect(() => {
    if (!rackMenuOpen) return undefined;
    const close = (event) => { if (!event.target.closest?.('.m8-master-menu,.m8-master__menu-button')) setRackMenuOpen(false); };
    window.addEventListener('pointerdown', close, true);
    return () => window.removeEventListener('pointerdown', close, true);
  }, [rackMenuOpen]);
  const toggleVisibleModule = (id) => setVisibleModules((current) => ({ ...current, [id]: !current[id] }));
  return <main className="m8-prototype" data-motion={motion} data-theme={theme}>
    {harnessVisible && <Harness {...{ motion, scenario, setMotion, setScenario, setTheme, setViewport, theme, viewport }} />}
    <button aria-label={harnessVisible ? 'Hide prototype harness' : 'Show prototype harness'} className="m8-harness-toggle" onClick={() => setHarnessVisible((value) => !value)} title="Prototype harness · H" type="button">H</button>
    <div className="m8-stage-wrap"><div aria-label={`${viewportPreset.label} prototype viewport`} className="m8-stage" style={{ '--stage-width': `${viewportPreset.width}px`, '--stage-height': `${viewportPreset.height}px` }}>
      {!instrumentOpen && <button className="m8-reopen" onClick={() => setInstrumentOpen(true)} type="button">OPEN MODUL-8R</button>}
      {instrumentOpen && <section aria-label="Modulator" className="m8-instrument" data-collapsed={!masterExpanded || undefined} data-master-transitioning={masterTransitioning || undefined} onTransitionEnd={(event) => { if (event.target === event.currentTarget && event.propertyName === 'grid-template-rows') setMasterTransitioning(false); }} ref={rackRef} style={{ '--m8-height': `${size.height}px`, '--m8-width': `${size.width}px`, '--m8-x': `${position.x}px`, '--m8-y': `${position.y}px` }}>
        <header aria-expanded={masterExpanded} className="m8-master" onPointerDown={(event) => startGesture(event, 'move')} onPointerMove={updateGesture} onPointerUp={finishGesture} onPointerCancel={finishGesture}>
          <span className="m8-master__rail" /><button aria-label={masterExpanded ? 'Collapse Modulator' : 'Restore Modulator'} className="m8-master__collapse" onClick={() => { if (suppressMasterClickRef.current) { suppressMasterClickRef.current = false; return; } toggleMaster(); }} onPointerDown={(event) => startGesture(event, 'move', true)} type="button"><span>MODUL-8R</span></button>
          <div className="m8-master__tools">
            <button aria-label="Arrange" aria-pressed={arrange} className="m8-tool-arrange" onClick={() => setArrange((value) => !value)} type="button"><span>ARRANGE</span><Grid2X2 aria-hidden="true" size={14} strokeWidth={2} /></button>
            <IconButton label="Rotate selected placement" onClick={() => action('rotate')}><RotateCw aria-hidden="true" size={14} strokeWidth={2} /></IconButton>
            <IconButton label="Mirror horizontal" onClick={() => action('mirrorX')}><FlipHorizontal2 aria-hidden="true" size={14} strokeWidth={2} /></IconButton><IconButton label="Mirror vertical" onClick={() => action('mirrorY')}><FlipVertical2 aria-hidden="true" size={14} strokeWidth={2} /></IconButton><IconButton label="Duplicate selected placement" onClick={() => action('duplicate')}><Copy aria-hidden="true" size={14} strokeWidth={2} /></IconButton>
          </div>
          <IconButton className="m8-master__menu-button" label="Modulator options" onClick={() => setRackMenuOpen((open) => !open)}><MoreVertical aria-hidden="true" size={14} strokeWidth={2} /></IconButton>
          <IconButton className="m8-master__close" label="Close Modulator" onClick={() => setInstrumentOpen(false)}><X aria-hidden="true" size={16} strokeWidth={2} /></IconButton>
          {rackMenuOpen && <div aria-label="Modulator options" className="m8-master-menu" onPointerDown={(event) => event.stopPropagation()} role="menu">
            <button onClick={() => { toggleMaster(); setRackMenuOpen(false); }} role="menuitem" type="button"><i />{masterExpanded ? 'COLLAPSE MODUL-8R' : 'EXPAND MODUL-8R'}</button>
            {Object.keys(visibleModules).map((id) => <button data-selected={visibleModules[id] || undefined} key={id} onClick={() => { toggleVisibleModule(id); setRackMenuOpen(false); }} role="menuitemcheckbox" type="button"><i />{MODULE_LABELS[id]} MODULE<b>{visibleModules[id] ? '·' : ''}</b></button>)}
            <button onClick={() => { setVisibleModules({ library: true, activity: true, people: true, layers: true }); setRackMenuOpen(false); }} role="menuitem" type="button"><i />SHOW ALL MODULES</button>
          </div>}
        </header>
        <div className="m8-modules" aria-hidden={!masterExpanded} inert={!masterExpanded ? '' : undefined}>
          {visibleModules.library && <Module accessory={accessory('library')} expanded={contentOpen === 'library'} id="library" onToggle={toggleModule}><LibraryBody category={category} density={densities.library} query={queries.library} resizeHandle={<div aria-label="Resize Library" className="m8-resize" onPointerDown={(event) => startGesture(event, 'resize')} onPointerMove={updateGesture} onPointerUp={finishGesture} onPointerCancel={finishGesture} role="separator" />} scenario={scenario} setCategory={setCategory} /></Module>}
          {visibleModules.activity && <Module accessory={accessory('activity')} expanded={contentOpen === 'activity'} id="activity" onToggle={toggleModule}><ActivityBody density={densities.activity} query={queries.activity} scenario={scenario} /></Module>}
          {visibleModules.people && <Module accessory={accessory('people')} expanded={contentOpen === 'people'} id="people" onToggle={toggleModule}><PeopleBody density={densities.people} query={queries.people} scenario={scenario} /></Module>}
          {visibleModules.layers && <Module expanded={contentOpen === 'layers'} id="layers" onToggle={toggleModule}><LayersBody layers={layers} selected={selected} setLayers={setLayers} setSelected={setSelected} /></Module>}
        </div>
        {masterExpanded && <button aria-label="Resize Modulator width" className="m8-rack-width-resize" onPointerCancel={finishGesture} onPointerDown={(event) => startGesture(event, 'width', true)} onPointerMove={updateGesture} onPointerUp={finishGesture} title="Drag to resize MODUL-8R horizontally" type="button" />}
      </section>}
    </div></div>
  </main>;
}
