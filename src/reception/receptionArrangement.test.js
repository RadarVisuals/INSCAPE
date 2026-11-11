import test from 'node:test';
import assert from 'node:assert/strict';
import { createReception, validReception, projectReception } from '../profileDocument/domain/receptionPresentation.js';
import { addReceptionFrame, changeReceptionFrame, changeReceptionGroup, coupleReceptionFrames, detachReceptionFrames,
  pruneReceptionArrangement, receptionFrameBounds, receptionFrameGroup, receptionGroupGapMaximum, unlinkReceptionFrames,
  validReceptionArrangement, reflowReceptionGroups } from './receptionArrangement.js';

const blank = () => {
  const value = createReception();
  value.regions[0].id = 'region:first'; value.mobile[0].id = 'region:first';
  return value;
};
const pair = () => addReceptionFrame(blank(), { width: 1000, height: 900 }, 'region:second');
const copy = value => structuredClone(value);

test('free placement preserves current content and painted partition gaps; mobile starts in reading order', () => {
  const value = blank();
  value.regions[0] = { ...value.regions[0], width: 5000, content: 'profile' };
  value.regions.push({ ...value.regions[0], id: 'region:second', x: 5000, content: 'introduction' });
  value.mobile = value.regions.map(region => ({ id: region.id, columns: 1, height: 320 }));
  const before = copy(value), next = detachReceptionFrames(value, { width: 1000, height: 900 });
  assert.deepEqual(value, before, 'input never mutated');
  assert.equal(next.regions[0].width, 4960);
  assert.equal(next.regions[1].x, 5040);
  assert.equal(next.regions[1].width, 4960);
  assert.deepEqual(next.regions.map(region => region.content), ['profile', 'introduction']);
  assert.deepEqual(next.mobile.map(item => item.columns), [2, 2]);
  assert.ok(validReception(next));
  assert.equal(detachReceptionFrames(next), next, 'conversion is explicit and idempotent');
});

test('free frames may overlap but remain bounded', () => {
  const value = pair();
  assert.ok(validReception(value));
  const next = changeReceptionFrame(value, 'region:second', { x: 9999, y: -50, width: 4500, height: 3500 });
  assert.deepEqual(receptionFrameBounds(next, 'region:second'), { x: 5500, y: 0, width: 4500, height: 3500 });
  assert.ok(validReception(next));
});

test('coupling retains content, spreads to both edges and unlink keeps every visible coordinate', () => {
  let value = pair();
  value = coupleReceptionFrames(value, value.regions.map(region => region.id), 'row', 'group:pair');
  const maximum = receptionGroupGapMaximum(value, value.arrangement.groups[0]);
  value = changeReceptionGroup(value, 'group:pair', { gapX: maximum });
  assert.equal(maximum, 9600);
  assert.equal(value.regions[0].x, 0);
  assert.equal(value.regions[0].width, 200);
  assert.equal(value.regions[1].x, 9800);
  assert.equal(value.regions[1].width, 200);
  assert.ok(validReception(value));
  const free = unlinkReceptionFrames(value, 'region:first');
  assert.deepEqual(free.regions, value.regions);
  assert.deepEqual(free.arrangement.groups, []);
});

test('moving an unequal coupled group changes position without distorting its members', () => {
  let value = pair();
  value = changeReceptionFrame(value, 'region:first', { width: 3000, height: 3000 });
  value = changeReceptionFrame(value, 'region:second', { x: 4000, y: 0, width: 2000, height: 3000 });
  value = coupleReceptionFrames(value, ['region:first', 'region:second'], 'row', 'group:unequal');
  value = changeReceptionGroup(value, 'group:unequal', { gapX: 500 });
  const before = copy(value), moved = changeReceptionFrame(value, 'region:second', { x: 2000, y: 1000 });
  for (let i = 0; i < 2; i++) {
    assert.equal(moved.regions[i].width, before.regions[i].width);
    assert.equal(moved.regions[i].height, before.regions[i].height);
    assert.equal(moved.regions[i].x, before.regions[i].x + 2000);
    assert.equal(moved.regions[i].y, before.regions[i].y + 1000);
  }
  assert.deepEqual(value, before);
});

test('row and column spacing have independent saved values and reject impossible edits atomically', () => {
  let value = coupleReceptionFrames(pair(), ['region:first', 'region:second'], 'row', 'group:pair');
  value = changeReceptionGroup(value, 'group:pair', { gapX: 1200 });
  value = changeReceptionGroup(value, 'group:pair', { axis: 'column', gapY: 1500 });
  assert.equal(value.regions[1].y - value.regions[0].height, 1500);
  assert.equal(receptionFrameGroup(value, 'region:first').gapX, 1200);
  const before = copy(value);
  assert.throws(() => changeReceptionGroup(value, 'group:pair', { gapY: 10000 }), /too little room/);
  assert.deepEqual(value, before);
  value = changeReceptionGroup(value, 'group:pair', { axis: 'row' });
  assert.equal(value.regions[1].x - value.regions[0].width, 1200);
});

test('new frame limit does not trim larger current layouts', () => {
  let value = blank();
  for (let index = 1; index < 8; index++) value = addReceptionFrame(value, undefined, `region:${index}`);
  assert.throws(() => addReceptionFrame(value), /up to 8/);
  const existing = blank();
  existing.regions = Array.from({ length: 32 }, (_, index) => ({ ...existing.regions[0], id: `region:${index}`,
    x: Math.round(index * 10000 / 32), width: Math.round((index + 1) * 10000 / 32) - Math.round(index * 10000 / 32) }));
  existing.mobile = existing.regions.map(region => ({ id: region.id, columns: 2, height: 320 }));
  const detached = detachReceptionFrames(existing);
  assert.equal(detached.regions.length, 32); assert.ok(validReception(detached));
});

test('group validation rejects missing, duplicate or multiply-owned members', () => {
  const value = coupleReceptionFrames(pair(), ['region:first', 'region:second'], 'row', 'group:pair');
  assert.ok(validReceptionArrangement(value.arrangement, value.regions));
  const group = value.arrangement.groups[0];
  for (const members of [['region:first', 'region:first'], ['region:first', 'region:missing']])
    assert.equal(validReceptionArrangement({ groups: [{ ...group, members }] }, value.regions), false);
  assert.equal(validReceptionArrangement({ groups: [group, { ...group, id: 'group:other' }] }, value.regions), false);
  assert.deepEqual(pruneReceptionArrangement(value.arrangement, ['region:first']), { groups: [] });
});

test('public projection preserves authored free positions and group relationships', () => {
  const value = coupleReceptionFrames(pair(), ['region:first', 'region:second'], 'column', 'group:pair');
  const published = projectReception(value);
  assert.deepEqual(published.arrangement, value.arrangement);
  assert.deepEqual(published.regions, value.regions);
  assert.ok(validReception(published, true));
});

test('removing a middle group member retains the saved spacing between survivors', () => {
  let value = addReceptionFrame(pair(), undefined, 'region:third');
  value = coupleReceptionFrames(value, value.regions.map(region => region.id), 'row', 'group:triple');
  value = changeReceptionGroup(value, 'group:triple', { gapX: 300 });
  const ids = ['region:first', 'region:third'];
  const pruned = { ...value, regions: value.regions.filter(region => ids.includes(region.id)),
    mobile: value.mobile.filter(region => ids.includes(region.id)), arrangement: pruneReceptionArrangement(value.arrangement, ids) };
  const next = reflowReceptionGroups(pruned);
  assert.equal(next.regions[1].x - next.regions[0].x - next.regions[0].width, 300);
  assert.equal(next.regions[1].x + next.regions[1].width, 10000);
  assert.ok(validReception(next));
});
