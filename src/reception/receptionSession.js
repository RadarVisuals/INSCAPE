import { assertReception } from '../profileDocument/domain/receptionPresentation.js';
import { resolveImageLibrarySide } from '../imageModule/imageLibrarySide.js';
import { MAX_IMAGE_MODULES } from '../imageModule/imageModule.js';
import { createArticle, MAX_TEXT_MODULES } from '../text/domain/article.js';
import { saveTextRecordResult } from '../text/textSession.js';

export function saveReception(store, expected, value, label = 'Edit Reception', generation = store.getGeneration()) {
  const draft = store.getSnapshot();
  if (!store.isCurrent() || draft.reception !== expected || generation !== store.getGeneration()) throw new Error('Reception changed. Repeat this action on the current layout.');
  assertReception(value);
  if (!store.commitCompletedOperation({ ...draft, reception: value }, { expectedGeneration: generation, historyLabel: label }))
    throw new Error('Reception could not be saved. Your accepted layout is unchanged. Retry the edit; browser storage may be full or blocked.');
  return value;
}
export function assignReceptionContent(value, regionId, content) {
  return assertReception({ ...value, regions: value.regions.map(r => r.id === regionId ? { ...r, content } : r) });
}
export function addReceptionText(store, expected, regionId, initial = expected) {
  const value = initial, id = `text:${crypto.randomUUID()}`;
  if (!value?.regions.some(r => r.id === regionId)) throw new Error('Select an available Reception region.');
  if (value.texts.length >= MAX_TEXT_MODULES) throw new Error(`Reception holds up to ${MAX_TEXT_MODULES} Text records. Choose an existing record from Retained content.`);
  const article = createArticle();
  // New content starts on its existing readable surface. From this point the
  // Reception region owns that surface; Text keeps only its content controls.
  const regions = value.regions.map(r => r.id === regionId && r.surface === null ? { ...r, surface: article.appearance.background } : r);
  const next = assignReceptionContent({ ...value, regions, texts: [...value.texts, { id, article, visibility: 'PUBLIC' }] }, regionId, id);
  saveReception(store, expected, next, 'Add Reception Text'); return id;
}
// Capture the profile scope, exact generation and region before media work.
// Cancel/unmount revokes the request; completion cannot retarget newer selection.
export function prepareReceptionImage(store, expected, regionId, initial = expected) {
  let active = true;
  const generation = store.getGeneration();
  return { cancel: () => { active = false; }, async choose(input, decoded) {
    const side = await resolveImageLibrarySide(input, decoded);
    if (!active || !store.isCurrent() || store.getGeneration() !== generation || store.getSnapshot().reception !== expected) return false;
    const value = initial, region = value?.regions.find(r => r.id === regionId);
    if (!region) return false;
    if (value.imageModules.length >= MAX_IMAGE_MODULES) throw new Error(`Reception holds up to ${MAX_IMAGE_MODULES} Images. Choose an existing record from Retained content.`);
    const id = `image:${crypto.randomUUID()}`;
    const record = { id, name: (side.asset.name || 'Image').slice(0, 48), width: 800, height: 600, sides: [side], visibility: 'PUBLIC' };
    const next = assignReceptionContent({ ...value, imageModules: [...value.imageModules, record] }, regionId, id);
    saveReception(store, expected, next, 'Add Reception Image', generation); active = false; return id;
  } };
}
const receptionTexts = { read: draft => draft.reception?.texts, replace: (draft, texts) => ({ ...draft, reception: { ...draft.reception, texts } }) };
export const saveReceptionTextResult = (store, scope, expected, article, options) =>
  saveTextRecordResult(store, scope.profile, expected, { ...expected, article }, options, receptionTexts);
