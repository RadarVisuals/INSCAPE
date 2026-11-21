import test from 'node:test';
import assert from 'node:assert/strict';
import { changeToolDock, integrateLibraryDockLayout, createToolDockLayout, createToolDockStore, toolIsVisible, dockTabs, toolPane, validToolDockLayout, WORKBENCH_TOOL_TABS } from './workbenchToolDockState.js';

const names = state => state.groups.flatMap(dockTabs).sort();
const joinedLayout = () => changeToolDock(createToolDockLayout(), { type: 'place', tabs: ['Inspector'], target: 'tools' });

test('Layers and Inspector start separately; tools can detach, reorder and rejoin without duplicate owners', () => {
  const defaults = createToolDockLayout();
  assert.equal(defaults.groups.length, 2);
  assert.ok(toolIsVisible(defaults, 'Layers') && toolIsVisible(defaults, 'Inspector'));
  const original = joinedLayout();
  const separate = changeToolDock(original, { type: 'place', tabs: ['Layers'], frame: { left: 20, top: 90, width: 320, height: 400 } });
  assert.equal(separate.groups.length, 2);
  assert.equal(original.groups.length, 1);
  assert.deepEqual(original.groups[0].panes[0].tabs, WORKBENCH_TOOL_TABS);
  const joined = changeToolDock(separate, { type: 'place', tabs: ['Layers'], target: toolPane(separate, 'Inspector').id, before: 'Inspector' });
  assert.deepEqual(joined.groups[0].panes[0].tabs, ['Library', 'Layers', 'Inspector']);
  assert.deepEqual(names(joined), [...WORKBENCH_TOOL_TABS].sort());
  assert.equal(joined.groups[0].panes[0].active, 'Layers');
  assert.ok(validToolDockLayout(joined));
});

test('closing and reopening the inspector retains its dock and frame', () => {
  let state = createToolDockLayout();
  const frame = state.groups[1].frame;
  for (const tab of WORKBENCH_TOOL_TABS) state = changeToolDock(state, { type: 'close', tab });
  assert.equal(WORKBENCH_TOOL_TABS.some(tab => toolIsVisible(state, tab)), false);
  state = changeToolDock(state, { type: 'open', tab: 'Inspector', section: 'Image' });
  assert.equal(toolIsVisible(state, 'Inspector'), true);
  assert.deepEqual(state.groups[1].frame, frame);
  assert.deepEqual(names(state), [...WORKBENCH_TOOL_TABS].sort());
});

test('explicit section requests repeat without creating tabs or changing selection geometry', () => {
  const original = createToolDockLayout();
  const first = changeToolDock(original, { type: 'open', tab: 'Inspector', section: 'Transform' });
  const second = changeToolDock(first, { type: 'open', tab: 'Inspector', section: 'Transform' });
  assert.equal(first.inspectorRequest, 1);
  assert.equal(second.inspectorRequest, 2);
  assert.equal(second.inspectorSection, 'Transform');
  assert.deepEqual(second.groups.map(group => group.frame), original.groups.map(group => group.frame));
  const selected = changeToolDock(second, { type: 'select', tab: 'Inspector' });
  assert.equal(selected.inspectorRequest, 2, 'ordinary tab selection is not another section request');
  assert.equal(changeToolDock(second, { type: 'open', tab: 'Color' }), second, 'old selection-tool windows cannot reopen');
  assert.equal(changeToolDock(second, { type: 'open', tab: 'Inspector', section: 'Unknown' }), second);
});

test('metadata availability follows Inspector visibility, independent of the last requested section', () => {
  const store = createToolDockStore();
  store.change({ type: 'open', tab: 'Inspector', section: 'Image' });
  assert.equal(store.infoVisible(), true);
  store.change({ type: 'close', tab: 'Inspector' });
  assert.equal(store.infoVisible(), false);
  store.change({ type: 'open', tab: 'Inspector', section: 'Info' });
  assert.equal(store.infoVisible(), true);
});

test('whole docks move and merge; a closed Layers tab retains one owner', () => {
  let state = createToolDockLayout();
  state = changeToolDock(state, { type: 'close', tab: 'Layers' });
  const layers = state.groups[0];
  state = changeToolDock(state, { type: 'place', tabs: ['Inspector'], target: layers.panes[0].id });
  assert.equal(state.groups.length, 1);
  assert.deepEqual(names(state), [...WORKBENCH_TOOL_TABS].sort());
  assert.deepEqual(state.hidden, ['Library', 'Layers']);
  state = changeToolDock(state, { type: 'frame', group: layers.id, frame: current => ({ ...current, left: 50 }) });
  assert.equal(state.groups[0].frame.left, 50);
  assert.equal(changeToolDock(state, { type: 'place', tabs: ['Unknown'] }), state);
});

test('stacking keeps both panels visible and can rejoin the whole inspector', () => {
  const original = createToolDockLayout();
  let state = changeToolDock(original, { type: 'place', tabs: ['Inspector'], target: 'tools', side: 'below' });
  assert.equal(state.groups.length, 1);
  assert.deepEqual(state.groups[0].panes.map(pane => pane.active), ['Layers', 'Inspector']);
  assert.ok(toolIsVisible(state, 'Layers') && toolIsVisible(state, 'Inspector'));
  assert.equal(original.groups.length, 2);
  state = changeToolDock(state, { type: 'place', tabs: ['Inspector'], target: 'tools', before: 'Layers' });
  assert.equal(state.groups[0].panes.length, 1);
  assert.deepEqual(state.groups[0].panes[0].tabs, ['Inspector', 'Layers', 'Library']);
  assert.equal(toolIsVisible(state, 'Layers'), false);
  assert.equal(toolIsVisible(state, 'Inspector'), true);
  assert.deepEqual(names(state), [...WORKBENCH_TOOL_TABS].sort());
});

test('closed stacked panes retain their position and share; resizing is presentation only', () => {
  let state = changeToolDock(createToolDockLayout(), { type: 'place', tabs: ['Inspector'], target: 'tools', side: 'below' });
  const paneId = toolPane(state, 'Inspector').id, frame = state.groups[0].frame;
  state = changeToolDock(state, { type: 'shares', group: 'tools', shares: { tools: .3, [paneId]: .7 } });
  state = changeToolDock(state, { type: 'close', tab: 'Inspector' });
  assert.equal(toolIsVisible(state, 'Inspector'), false);
  state = changeToolDock(state, { type: 'open', tab: 'Inspector' });
  assert.equal(toolPane(state, 'Inspector').id, paneId);
  assert.equal(toolPane(state, 'Inspector').share, .7);
  assert.deepEqual(state.groups[0].frame, frame);
  assert.equal(changeToolDock(state, { type: 'shares', group: 'tools', shares: { [paneId]: NaN } }), state);
  state = changeToolDock(state, { type: 'place', tabs: ['Inspector'] });
  assert.equal(state.groups.length, 2);
  assert.deepEqual(names(state), [...WORKBENCH_TOOL_TABS].sort());
  assert.equal(changeToolDock(state, { type: 'place', tabs: ['Inspector'], target: 'missing', side: 'below' }), state);
});

test('Library detaches, joins Inspector and reopens without a second tab or moving its host', () => {
  let state = changeToolDock(createToolDockLayout(), { type: 'open', tab: 'Library' });
  assert.ok(toolIsVisible(state, 'Library'));
  assert.equal(toolIsVisible(state, 'Layers'), false);
  const frame = { left: 400, top: 100, width: 420, height: 560 };
  state = changeToolDock(state, { type: 'place', tabs: ['Library'], frame });
  assert.deepEqual(toolPane(state, 'Layers').tabs, ['Layers']);
  assert.ok(toolIsVisible(state, 'Layers'));
  const owner = state.groups.find(group => dockTabs(group).includes('Library')).id;
  state = changeToolDock(state, { type: 'close', tab: 'Library' });
  state = changeToolDock(state, { type: 'open', tab: 'Library', focus: true });
  assert.deepEqual(state.groups.find(group => group.id === owner).frame, frame);
  assert.equal(state.focusRequest.tab, 'Library');
  const request = state.focusRequest;
  state = changeToolDock(state, { type: 'open', tab: 'Library', focus: true });
  assert.notEqual(state.focusRequest, request, 'repeat opens can focus the current panel');
  state = changeToolDock(state, { type: 'place', tabs: ['Library'], target: toolPane(state, 'Inspector').id });
  assert.deepEqual(toolPane(state, 'Inspector').tabs, ['Inspector', 'Library']);
  assert.equal(names(state).filter(tab => tab === 'Library').length, 1);
  assert.ok(validToolDockLayout(state));
});

test('current Library window placement joins the layout without discarding existing hosts', () => {
  const current = createToolDockLayout();
  const before = { ...current, hidden: [], groups: current.groups.map(group => ({ ...group,
    panes: group.panes.map(pane => ({ ...pane, tabs: pane.tabs.filter(tab => tab !== 'Library') })) })) };
  const frame = { left: 400, top: 120, width: 500, height: 600 };
  const floating = integrateLibraryDockLayout(before, { detached: true, frame });
  assert.ok(validToolDockLayout(floating));
  assert.deepEqual(floating.groups.slice(0, 2), before.groups);
  assert.deepEqual(floating.groups[2].frame, frame);
  assert.deepEqual(floating.hidden, ['Library']);
  const docked = integrateLibraryDockLayout(before, { detached: false, frame });
  assert.deepEqual(toolPane(docked, 'Layers').tabs, ['Layers', 'Library']);
  assert.equal(integrateLibraryDockLayout(floating), floating);
  assert.equal(integrateLibraryDockLayout({ ...before, hidden: ['Unknown'] }), null);
});
