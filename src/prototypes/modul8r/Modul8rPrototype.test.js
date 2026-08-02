import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  deduplicateAssets, filterLibrary, MODULE_ORDER, moveLayer, scenarioItems, toggleContentModule, toggleLayers,
} from './modul8rModel.js';
import { INITIAL_LAYERS, LIBRARY_ASSETS, MODUL8R_THEMES, MODUL8R_VIEWPORTS } from './modul8rFixtures.js';

const entry = readFileSync(new URL('../../main.jsx', import.meta.url), 'utf8');
const source = readFileSync(new URL('./Modul8rPrototype.jsx', import.meta.url), 'utf8');
const fixtures = readFileSync(new URL('./modul8rFixtures.js', import.meta.url), 'utf8');
const model = readFileSync(new URL('./modul8rModel.js', import.meta.url), 'utf8');
const styles = readFileSync(new URL('./modul8rPrototype.css', import.meta.url), 'utf8');
const prototypeGraph = `${source}\n${fixtures}\n${model}\n${styles}`;

test('MODUL-8R is one development-only lazy route', () => {
  assert.match(entry, /import\.meta\.env\.DEV && prototypePath === '\/prototype\/modul-8r'/);
  assert.match(entry, /import\.meta\.env\.DEV\s*\? React\.lazy\(\(\) => import\('\.\/prototypes\/modul8r\/Modul8rPrototype\.jsx'\)\)/);
  assert.doesNotMatch(entry, /^import .*Modul8rPrototype/m);
});

test('prototype graph stays fixture-only and has no storage, network, wallet, publication, or owner dependencies', () => {
  assert.doesNotMatch(prototypeGraph, /localStorage|sessionStorage|indexedDB|document\.cookie|fetch\s*\(|XMLHttpRequest|WebSocket/iu);
  assert.doesNotMatch(source, /from ['"][^'"]*(?:wallet|profileDocument|publication|pinata|ipfs|OwnerLattice|useLibraryStore|repository|visitor)[^'"]*['"]/iu);
  for (const imported of source.matchAll(/from ['"]([^'"]+)['"]/g)) {
    assert.ok(imported[1] === 'react' || imported[1] === 'lucide-react' || imported[1].startsWith('./modul8r'), `unexpected prototype import ${imported[1]}`);
  }
});

test('exclusive content modules and independent Layers preserve stable order', () => {
  assert.deepEqual(MODULE_ORDER, ['library', 'activity', 'people', 'layers']);
  assert.equal(toggleContentModule('library', 'activity'), 'activity');
  assert.equal(toggleContentModule('activity', 'people'), 'people');
  assert.equal(toggleContentModule('people', 'people'), null);
  assert.equal(toggleContentModule(null, 'library'), 'library');
  assert.equal(toggleLayers(true), false);
  assert.equal(toggleLayers(false), true);
  const positions = MODULE_ORDER.map((id) => source.indexOf(`id="${id}"`));
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
});

test('Library stable union and relationship filters are honest', () => {
  const all = deduplicateAssets(LIBRARY_ASSETS);
  assert.equal(all.length, 6);
  assert.deepEqual(all.find((asset) => asset.id === 'asset-01').relationships, ['OWNED', 'CREATED']);
  assert.deepEqual(filterLibrary(LIBRARY_ASSETS, 'created', '').map((asset) => asset.id), ['asset-01', 'asset-03', 'asset-04', 'asset-06']);
  assert.deepEqual(filterLibrary(LIBRARY_ASSETS, 'unsorted', '').map((asset) => asset.id), ['asset-02', 'asset-05', 'asset-06']);
  assert.deepEqual(filterLibrary(LIBRARY_ASSETS, 'all', 'glass').map((asset) => asset.id), ['asset-04']);
});

test('scenario harness includes progressive, empty, failure and unresolved states', () => {
  assert.deepEqual(scenarioItems(LIBRARY_ASSETS, 'empty'), []);
  assert.ok(scenarioItems(LIBRARY_ASSETS, 'loading').every((item) => item.state === 'loading'));
  assert.ok(scenarioItems([{ id: 1, state: 'failed' }], 'failed').length === 1);
  assert.ok(scenarioItems([{ id: 1, state: 'unresolved' }], 'unresolved').length === 1);
  assert.ok(scenarioItems([{ id: 'a', name: 'A' }], 'stress').length === 2);
});

test('Layers reorders one position while retaining repeated stable asset references', () => {
  assert.equal(INITIAL_LAYERS.filter((layer) => layer.assetId === 'asset-01').length, 2);
  const moved = moveLayer(INITIAL_LAYERS, 'placement-b', 1);
  assert.deepEqual(moved.map((layer) => layer.id), ['placement-a', 'placement-c', 'placement-b', 'placement-d']);
  assert.equal(moveLayer(INITIAL_LAYERS, 'placement-a', -1), INITIAL_LAYERS);
});

test('contextual Search and Size are owned only by expanded content faceplates', () => {
  assert.match(source, /expanded && accessory/);
  for (const module of ['library', 'activity', 'people']) assert.match(source, new RegExp(`accessory=\\{accessory\\('${module}'\\)\\}`));
  assert.doesNotMatch(source, /accessory\('layers'\)/);
  assert.match(source, /data-density=\{density\}/);
});

test('every visible master control has a local state action and collapse retains module state', () => {
  for (const control of ['ARRANGE', 'Rotate selected placement', 'Duplicate selected placement', 'Mirror horizontal', 'Mirror vertical', 'Close Modulator']) assert.match(source, new RegExp(control));
  assert.match(source, /setTransform/); assert.match(source, /setArrange/); assert.match(source, /setInstrumentOpen/); assert.match(source, /setMasterExpanded/);
  assert.doesNotMatch(source, /setContentOpen\('library'\).*setMasterExpanded/s);
  assert.match(source, /requestAnimationFrame/);
  assert.doesNotMatch(source, /onPointerMove=\{\(event\).*setPosition/s);
});

test('native buttons provide keyboard activation and Escape clears owned search before closing', () => {
  assert.match(source, /active\?\.matches\?\.\('\.m8-accessory input'\).*setQuery/s);
  assert.match(source, /if \(instrumentOpen\) setInstrumentOpen\(false\)/);
  assert.match(source, /<button aria-controls=/);
  assert.match(styles, /button:focus-visible/);
});

test('all six themes define conceptual roles and reduced motion removes spatial timing', () => {
  assert.deepEqual(MODUL8R_THEMES, ['carbon', 'graphite', 'slate', 'ash', 'mist', 'paper']);
  for (const theme of MODUL8R_THEMES.slice(1)) assert.match(styles, new RegExp(`data-theme="${theme}"`));
  for (const role of ['--panel', '--ink', '--muted', '--faint', '--line', '--strong-line', '--selected', '--active-rail', '--focus']) assert.match(styles, new RegExp(role));
  assert.match(styles, /data-motion="reduced"/); assert.match(styles, /prefers-reduced-motion:reduce/); assert.match(styles, /transition-duration:1ms!important/);
});

test('theme ink, muted text, and focus colors meet readable contrast against every panel', () => {
  const luminance = (hex) => {
    const channels = hex.slice(1).match(/../g).map((part) => parseInt(part, 16) / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const ratio = (one, two) => { const values = [luminance(one), luminance(two)].sort((a, b) => b - a); return (values[0] + 0.05) / (values[1] + 0.05); };
  for (const theme of MODUL8R_THEMES) {
    const selector = theme === 'carbon' ? '\\.m8-prototype \\{' : `data-theme="${theme}"\\] \\{`;
    const body = styles.match(new RegExp(`${selector}([^}]+)`))[1];
    const token = (name) => body.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, 'i'))[1];
    assert.ok(ratio(token('--ink'), token('--panel')) >= 4.5, `${theme} ink contrast`);
    assert.ok(ratio(token('--muted'), token('--panel')) >= 4.5, `${theme} muted contrast`);
    assert.ok(ratio(token('--focus'), token('--panel')) >= 3, `${theme} focus contrast`);
  }
});

test('required responsive presets and bounded narrow rules are present', () => {
  assert.deepEqual(Object.values(MODUL8R_VIEWPORTS).map(({ width }) => width), [1280, 760, 520, 900, 640, 390]);
  assert.match(styles, /width:min\(var\(--m8-width\),100%\)/); assert.match(styles, /@media \(max-width:520px\)/);
  assert.match(source, /clamp\(gesture\.size\.width \+ dx, 320, stage\.width\)/);
});
