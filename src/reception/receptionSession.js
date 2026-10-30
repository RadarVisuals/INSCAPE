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
  const regions = value.regions.map(r => r.id === regionId ? { ...r, content } : r);
  const used = new Set(regions.map(region => region.content));
  if (value.branding.logo) used.add(value.branding.logo);
  return assertReception({ ...value, regions, imageModules: value.imageModules.filter(item => used.has(item.id)),
    texts: value.texts.filter(item => used.has(item.id)), ...(value.links ? { links: value.links.filter(item => used.has(item.id)) } : {}) });
}
export function placeReceptionLink(value, regionId, link) {
  if (!value.regions.some(region => region.id === regionId)) throw new Error('Select an available Reception cell.');
  const links = [...(value.links || []).filter(item => item.id !== link.id), link];
  return assignReceptionContent({ ...value, links }, regionId, link.id);
}
export function addReceptionText(store, expected, regionId, initial = expected) {
  const value = initial, id = `text:${crypto.randomUUID()}`;
  if (!value?.regions.some(r => r.id === regionId)) throw new Error('Select an available Reception region.');
  const current = value.regions.find(region => region.id === regionId)?.content;
  if (value.texts.filter(item => item.id !== current).length >= MAX_TEXT_MODULES) throw new Error(`Reception holds up to ${MAX_TEXT_MODULES} texts. Delete a text cell before adding another.`);
  const article = createArticle();
  // New content starts on its existing readable surface. From this point the
  // Reception region owns that surface; Text keeps only its content controls.
  const regions = value.regions.map(r => r.id === regionId ? { ...r, surface: r.surface ?? article.appearance.background,
    padding: 24 } : r);
  const next = assignReceptionContent({ ...value, regions, texts: [...value.texts, { id, article, visibility: 'PUBLIC' }] }, regionId, id);
  saveReception(store, expected, next, 'Add Reception Text'); return id;
}
// Capture the profile scope, exact generation and region before media work.
// Cancel/unmount revokes the request; completion cannot retarget newer selection.
export function prepareReceptionImage(store, expected, regionId, initial = expected) {
  let active = true;
  const generation = store.getGeneration();
  return { cancel: () => { active = false; }, async choose(input, decoded, isCurrent = () => true) {
    const side = await resolveImageLibrarySide(input, decoded);
    if (!active || !isCurrent() || !store.isCurrent() || store.getGeneration() !== generation || store.getSnapshot().reception !== expected) return false;
    const value = initial, region = value?.regions.find(r => r.id === regionId);
    if (!region) return false;
    if (value.imageModules.filter(item => item.id !== region.content || item.id === value.branding.logo).length >= MAX_IMAGE_MODULES)
      throw new Error(`Reception holds up to ${MAX_IMAGE_MODULES} images. Delete an image cell before adding another.`);
    const id = `image:${crypto.randomUUID()}`;
    const record = { id, name: (side.asset.name || 'Image').slice(0, 48), width: 800, height: 600, sides: [{ ...side, crop: { x: .5, y: .5, zoom: 1 } }], visibility: 'PUBLIC' };
    const regions = value.regions.map(r => r.id === regionId ? { ...r, padding: 0 } : r);
    const next = assignReceptionContent({ ...value, regions, imageModules: [...value.imageModules, record] }, regionId, id);
    saveReception(store, expected, next, 'Add Reception Image', generation); active = false; return id;
  } };
}
const receptionTexts = { read: draft => draft.reception?.texts, replace: (draft, texts) => ({ ...draft, reception: { ...draft.reception, texts } }) };
export const saveReceptionTextResult = (store, scope, expected, article, options) =>
  saveTextRecordResult(store, scope.profile, expected, { ...expected, article }, options, receptionTexts);
