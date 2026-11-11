import test from 'node:test';
import assert from 'node:assert/strict';
import { createArticle, validTextModules, projectTextModules, restoreTextModules, assertArticle } from './domain/article.js';
import { passageArticle, editPassage } from './scenePassages.js';
import { createSystemWorkflowDraftStore } from '../systemWorkflow/systemWorkflowDraftStore.js';
import { addTextModule, saveTextModuleResult } from './textSession.js';
import { buildProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Builder.js';
import { articleSections, joinArticleSections, sectionArticle } from './articleSections.js';
import { reconcileSystemWorkflowDraftFromProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Reconciliation.js';

const paragraph = text => ({ type: 'paragraph', content: [{ type: 'text', text, marks: [{ type: 'bold' }] }] });
const sectionRecord = () => ({ id: 'text:story', visibility: 'PUBLIC', article: { ...createArticle('Story'),
  content: joinArticleSections([[paragraph('Private beginning')], [paragraph('Public second')], [paragraph('Unmapped ending')]]) },
  sceneLink: { mode: 'sections', displayId: 'display:primary' } });
test('section links use explicit breaks and Display order, regardless of the Grid selected when linking', () => {
  const item = sectionRecord(), before = structuredClone(item);
  assert.match(JSON.stringify(passageArticle(item, 'second', ['first', 'second'])), /Public second/);
  assert.doesNotMatch(JSON.stringify(passageArticle(item, 'second', ['first', 'second'])), /Private beginning/);
  assert.match(JSON.stringify(passageArticle(item, 'second', ['second', 'first'])), /Private beginning/);
  assert.equal(sectionArticle(item.article, 1).title, '');
  assert.deepEqual(item, before);
  assert.ok(validTextModules([item]));
  assert.equal(validTextModules([{ ...item, pagination: 'pages' }]), false);
  assert.equal(validTextModules([{ ...item, sceneLink: { ...item.sceneLink, gridId: 'second' } }]), false);
  assert.deepEqual(editPassage(item, 'second', createArticle('Edited full article')).article, createArticle('Edited full article'));
});
test('blank and nested sections preserve structure and formatting', () => {
  const article = { ...createArticle(), content: { type: 'doc', content: [{ type: 'pageBreak' },
    { type: 'bulletList', content: [{ type: 'listItem', content: [paragraph('First'), { type: 'pageBreak' },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Second' }] }] }] }, { type: 'pageBreak' }] } };
  assert.equal(articleSections(article).length, 4);
  for (let index = 0; index < 4; index++) assert.doesNotThrow(() => assertArticle(sectionArticle(article, index)));
  assert.deepEqual(sectionArticle(article, 1).content.content[0].content[0].content[0], paragraph('First'));
  assert.doesNotThrow(() => assertArticle(sectionArticle(article, 99)));
});
test('section publication omits private and unmapped text, restore preserves both locally', () => {
  const item = sectionRecord();
  const previous = [{ id: 'display:primary', grids: [{ id: 'first', visibility: 'PRIVATE' }, { id: 'second', visibility: 'PUBLIC' }] }];
  const publishedDisplays = [{ id: 'display:primary', grids: [previous[0].grids[1]] }];
  const published = projectTextModules([item], previous);
  assert.doesNotMatch(JSON.stringify(published), /Private beginning|Unmapped ending|Story/);
  assert.match(JSON.stringify(published), /Public second/);
  assert.ok(validTextModules(published, true));
  const restoredDisplays = [{ id: 'display:primary', grids: [...publishedDisplays[0].grids, previous[0].grids[0]] }];
  const restored = restoreTextModules(published, [item], { previous, published: publishedDisplays, restored: restoredDisplays });
  assert.match(JSON.stringify(passageArticle(restored[0], 'first', ['second', 'first'])), /Private beginning/);
  assert.match(JSON.stringify(restored), /Unmapped ending/);
  assert.match(JSON.stringify(passageArticle(restored[0], 'first', ['second', 'first'])), /Story/);
  assert.deepEqual(projectTextModules(restored, restoredDisplays), published);
  assert.deepEqual(projectTextModules([item], []), []);
});
test('new section link replaces pagination and persists through reload and publication', () => {
  const entries = new Map(), storage = { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) };
  const profile = `0x${'1'.repeat(40)}`, store = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  addTextModule(store, profile);
  let before = store.getDraft().texts[0];
  assert.ok(saveTextModuleResult(store, profile, before, { ...before, pagination: 'pages' }).saved);
  before = store.getDraft().texts[0];
  const next = { ...sectionRecord(), id: before.id };
  assert.ok(saveTextModuleResult(store, profile, before, next).saved);
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress: profile, storage }).getDraft().texts[0], next);
  const published = buildProfileDocumentV9({ systemWorkflowDraft: store.getDraft(), profileAddress: profile, assetRecords: [] });
  assert.equal(published.texts[0].sceneLink.mode, 'sections');
  const draft = store.getDraft(), first = draft.grids.find(g => g.visibility === 'PUBLIC');
  first.visibility = 'PRIVATE';
  draft.grids.push({ ...structuredClone(first), id: 'grid:public-second', visibility: 'PUBLIC' });
  const document = buildProfileDocumentV9({ systemWorkflowDraft: draft, profileAddress: profile, assetRecords: [] });
  assert.match(JSON.stringify(document.texts), /Public second/);
  assert.doesNotMatch(JSON.stringify(document.texts), /Private beginning|Unmapped ending|Story/);
  const restored = reconcileSystemWorkflowDraftFromProfileDocumentV9(document, draft);
  assert.match(JSON.stringify(restored.texts), /Private beginning/);
  assert.match(JSON.stringify(restored.texts), /Unmapped ending/);
  assert.deepEqual(buildProfileDocumentV9({ systemWorkflowDraft: restored, profileAddress: profile, assetRecords: [] }).texts, document.texts);
});

const record = () => ({ id: 'text:story', visibility: 'PUBLIC', article: createArticle('Arrival'), pagination: 'pages',
  sceneLink: { displayId: 'display:primary', gridId: 'first', passages: [{ gridId: 'second', article: createArticle('Silence') }] } });
test('passages follow Grid identity when moving forward, backward, and around the story', () => {
  let item = record();
  assert.deepEqual(['first', 'second', 'first'].map(id => passageArticle(item, id).title), ['Arrival', 'Silence', 'Arrival']);
  assert.equal(passageArticle(item, 'third').title, '');
  assert.deepEqual(passageArticle(item, 'third').appearance, item.article.appearance);
  item = editPassage(item, 'third', createArticle('Looking around'));
  assert.equal(passageArticle(item, 'second').title, 'Silence');
  assert.equal(passageArticle(item, 'third').title, 'Looking around');
  assert.ok(validTextModules([item]));
});
test('publication removes private and missing scene passages, including the original article', () => {
  const item = record(), displays = [{ id: 'display:primary', grids: [{ id: 'second', visibility: 'PUBLIC' }] }];
  const published = projectTextModules([item], displays);
  assert.equal(published[0].article.title, 'Silence');
  assert.equal(published[0].sceneLink.gridId, 'second');
  assert.ok(!JSON.stringify(published).includes('Arrival'));
  assert.deepEqual(projectTextModules([item], []), []);
  assert.ok(validTextModules(published, true));
  const restored = restoreTextModules(published, [item]);
  assert.equal(passageArticle(restored[0], 'first').title, 'Arrival');
  assert.deepEqual(projectTextModules(restored, displays), published);
});
test('old articles remain readable; page breaks and scene links are strictly validated', () => {
  assert.ok(validTextModules([{ id: 'text:old', article: createArticle(), visibility: 'PRIVATE' }]));
  const item = record(); item.article.content.content.push({ type: 'pageBreak' }, { type: 'paragraph' });
  assert.doesNotThrow(() => assertArticle(item.article));
  item.sceneLink.passages.push({ gridId: 'first', article: createArticle() });
  assert.equal(validTextModules([item]), false);
});
test('scene edits persist, recover failed saves, undo, and publish through the existing draft store', () => {
  const entries = new Map(); let broken = false;
  const storage = { getItem: key => entries.get(key) ?? null, setItem: (key, value) => { if (broken) throw Error('full'); entries.set(key, value); } };
  const profile = `0x${'1'.repeat(40)}`, store = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  addTextModule(store, profile);
  const before = store.getDraft().texts[0], gridId = store.getDraft().grids.find(g => g.visibility === 'PUBLIC').id;
  const next = { ...before, visibility: 'PUBLIC', pagination: 'pages', sceneLink: { displayId: 'display:primary', gridId, passages: [] } };
  broken = true; assert.equal(saveTextModuleResult(store, profile, before, next).saved, false);
  assert.deepEqual(store.getDraft().texts[0], before);
  broken = false; assert.ok(saveTextModuleResult(store, profile, before, next, { retry: true }).saved);
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress: profile, storage }).getDraft().texts[0], next);
  const published = buildProfileDocumentV9({ systemWorkflowDraft: store.getDraft(), profileAddress: profile, assetRecords: [] });
  assert.equal(published.texts[0].sceneLink.gridId, gridId);
  assert.ok(store.undo()); assert.deepEqual(store.getDraft().texts[0], before);
});
