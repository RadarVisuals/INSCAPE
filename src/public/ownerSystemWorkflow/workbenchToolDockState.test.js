import test from 'node:test';
import assert from 'node:assert/strict';
import { changeToolDock, createToolDockLayout, toolIsVisible, dockTabs, toolPane, WORKBENCH_TOOL_TABS } from './workbenchToolDockState.js';

const names = state => state.groups.flatMap(dockTabs).sort();
test('tools detach, reorder and rejoin without duplicates or changes to the original layout', () => {
  const original = createToolDockLayout();
  const separate = changeToolDock(original, { type: 'place', tabs: ['Layers'], frame: { left: 20, top: 90, width: 320, height: 400 } });
  assert.equal(separate.groups.length, 2);
  assert.equal(original.groups.length, 1);
  assert.deepEqual(original.groups[0].panes[0].tabs, WORKBENCH_TOOL_TABS);
  const joined = changeToolDock(separate, { type: 'place', tabs: ['Layers'], target: 'tools', before: 'Color' });
  assert.deepEqual(joined.groups[0].panes[0].tabs, ['Transform', 'Layers', 'Color', 'Image', 'Shape', 'FX', 'Info']);
  assert.deepEqual(names(joined), [...WORKBENCH_TOOL_TABS].sort());
  assert.equal(joined.groups[0].panes[0].active, 'Layers');
});
test('closing and reopening a tab retains its dock and frame, including an entirely closed dock', () => {
  let state = createToolDockLayout();
  const frame = state.groups[0].frame;
  for (const tab of WORKBENCH_TOOL_TABS) state = changeToolDock(state, { type: 'close', tab });
  assert.equal(WORKBENCH_TOOL_TABS.some(tab => toolIsVisible(state, tab)), false);
  state = changeToolDock(state, { type: 'open', tab: 'Color' });
  assert.equal(toolIsVisible(state, 'Color'), true);
  assert.deepEqual(state.groups[0].frame, frame);
  assert.deepEqual(names(state), [...WORKBENCH_TOOL_TABS].sort());
});
test('whole docks move and merge; hidden tabs retain one owner', () => {
  let state = changeToolDock(createToolDockLayout(), { type: 'place', tabs: ['Layers'] });
  state = changeToolDock(state, { type: 'close', tab: 'Color' });
  const detached = state.groups.find(group => dockTabs(group).includes('Layers'));
  state = changeToolDock(state, { type: 'place', tabs: WORKBENCH_TOOL_TABS.filter(tab => tab !== 'Layers'), target: detached.panes[0].id });
  assert.equal(state.groups.length, 1);
  assert.deepEqual(names(state), [...WORKBENCH_TOOL_TABS].sort());
  assert.deepEqual(state.hidden, ['Color']);
  state = changeToolDock(state, { type: 'frame', group: detached.id, frame: current => ({ ...current, left: 50 }) });
  assert.equal(state.groups[0].frame.left, 50);
  assert.equal(changeToolDock(state, { type: 'place', tabs: ['Unknown'] }), state);
});

test('stacking keeps both active panels visible, can rejoin tabs, and never duplicates a tool', () => {
  const original = createToolDockLayout();
  const stacked = changeToolDock(original, { type: 'place', tabs: ['Color'], target: 'tools', side: 'below' });
  assert.equal(stacked.groups.length, 1);
  assert.deepEqual(stacked.groups[0].panes.map(pane => pane.active), ['Layers', 'Color']);
  assert.ok(toolIsVisible(stacked, 'Layers') && toolIsVisible(stacked, 'Color'));
  assert.equal(original.groups[0].panes.length, 1);
  let state = changeToolDock(stacked, { type: 'place', tabs: ['Transform'], target: toolPane(stacked, 'Color').id, side: 'above' });
  assert.deepEqual(state.groups[0].panes.map(pane => pane.active), ['Layers', 'Transform', 'Color']);
  state = changeToolDock(state, { type: 'place', tabs: ['Color'], target: 'tools', before: 'Layers' });
  assert.equal(state.groups[0].panes.length, 2);
  assert.equal(toolIsVisible(state, 'Layers'), false);
  assert.equal(toolIsVisible(state, 'Transform'), true);
  assert.deepEqual(names(state), [...WORKBENCH_TOOL_TABS].sort());
});

test('closed stacked panes retain their position and share; resizing is presentation only', () => {
  let state = changeToolDock(createToolDockLayout(), { type: 'place', tabs: ['Color'], target: 'tools', side: 'below' });
  const paneId = toolPane(state, 'Color').id, frame = state.groups[0].frame;
  state = changeToolDock(state, { type: 'shares', group: 'tools', shares: { tools: .3, [paneId]: .7 } });
  state = changeToolDock(state, { type: 'close', tab: 'Color' });
  assert.equal(toolIsVisible(state, 'Color'), false);
  state = changeToolDock(state, { type: 'open', tab: 'Color' });
  assert.equal(toolPane(state, 'Color').id, paneId);
  assert.equal(toolPane(state, 'Color').share, .7);
  assert.deepEqual(state.groups[0].frame, frame);
  assert.equal(changeToolDock(state, { type: 'shares', group: 'tools', shares: { [paneId]: NaN } }), state);
});

test('a stacked dock moves and stacks as a unit; detaching one pane leaves its neighbours intact', () => {
  let state = changeToolDock(createToolDockLayout(), { type: 'place', tabs: ['Color'], target: 'tools', side: 'below' });
  state = changeToolDock(state, { type: 'place', tabs: ['Transform'] });
  const transform = toolPane(state, 'Transform'), source = state.groups.find(group => dockTabs(group).includes('Layers'));
  state = changeToolDock(state, { type: 'place', tabs: dockTabs(source), target: transform.id, side: 'below' });
  assert.equal(state.groups.length, 1);
  assert.deepEqual(state.groups[0].panes.map(pane => pane.active), ['Transform', 'Layers', 'Color']);
  state = changeToolDock(state, { type: 'place', tabs: ['Color'] });
  assert.equal(state.groups.length, 2);
  assert.deepEqual(state.groups[0].panes.map(pane => pane.active), ['Transform', 'Layers']);
  assert.deepEqual(names(state), [...WORKBENCH_TOOL_TABS].sort());
  const unchanged = changeToolDock(state, { type: 'place', tabs: ['Color'], target: 'missing', side: 'below' });
  assert.equal(unchanged, state);
});
