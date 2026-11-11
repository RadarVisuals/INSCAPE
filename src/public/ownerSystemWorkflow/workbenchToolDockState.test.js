import test from 'node:test';
import assert from 'node:assert/strict';
import { changeToolDock, consolidateCurrentToolDockLayout, createToolDockLayout, createToolDockStore, toolIsVisible, dockTabs, toolPane, validToolDockLayout, WORKBENCH_TOOL_TABS } from './workbenchToolDockState.js';

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
  assert.deepEqual(joined.groups[0].panes[0].tabs, ['Layers', 'Inspector']);
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
  assert.deepEqual(state.hidden, ['Layers']);
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
  assert.deepEqual(state.groups[0].panes[0].tabs, ['Inspector', 'Layers']);
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

test('the current seven-tab preference consolidates without replacing retained host identities or frames', () => {
  const layerFrame = { left: 20, top: 100, width: 340, height: 480 };
  const imageFrame = { left: 800, top: 120, width: 300, height: 600 };
  const before = { nextId: 4, activeGroup: 'tools-2', hidden: ['FX'], groups: [
    { id: 'tools', frame: layerFrame, panes: [{ id: 'layers', tabs: ['Layers'], active: 'Layers', share: 1 }] },
    { id: 'tools-2', frame: imageFrame, panes: [{ id: 'selection', tabs: ['Image', 'Transform', 'Color', 'Shape', 'FX', 'Info'], active: 'Image', share: 1 }] },
  ] };
  const after = consolidateCurrentToolDockLayout(before);
  assert.ok(validToolDockLayout(after));
  assert.deepEqual(after.groups[0], before.groups[0]);
  assert.equal(after.groups[1].id, 'tools-2');
  assert.equal(after.groups[1].panes[0].id, 'selection');
  assert.deepEqual(after.groups[1].frame, imageFrame);
  assert.deepEqual(after.groups[1].panes[0].tabs, ['Inspector']);
  assert.equal(after.inspectorSection, 'Image');
  assert.deepEqual(before.groups[1].panes[0].tabs, ['Image', 'Transform', 'Color', 'Shape', 'FX', 'Info']);
  assert.equal(consolidateCurrentToolDockLayout(after), after);
});

test('a combined current seven-tab host retains Layers and closed selection tools remain closed', () => {
  const frame = { left: 900, top: 90, width: 320, height: 480 };
  const hidden = ['Transform', 'Color', 'Image', 'Shape', 'FX', 'Info'];
  const before = { nextId: 1, activeGroup: null, hidden, groups: [
    { id: 'tools', frame, panes: [{ id: 'tools', tabs: ['Layers', ...hidden], active: 'Layers', share: 1 }] },
  ] };
  const after = consolidateCurrentToolDockLayout(before);
  assert.ok(validToolDockLayout(after));
  assert.equal(after.groups[0].id, 'tools');
  assert.deepEqual(after.groups[0].frame, frame);
  assert.equal(after.groups.length, 2);
  assert.deepEqual(after.hidden, ['Inspector']);
  assert.equal(consolidateCurrentToolDockLayout({ ...before, hidden: ['Unknown'] }), null);
});
