// Historical v2 samples for saved-document, publication and recovery tests.
// Production Reception authoring uses the native Editor scope.
import { assertReception } from '../../src/profileDocument/domain/receptionPresentation.js';
import { resolveImageLibraryArtwork } from '../../src/imageModule/imageLibraryArtwork.js';
import { MAX_IMAGE_MODULES } from '../../src/imageModule/imageModule.js';
import { createArticle, MAX_TEXT_MODULES } from '../../src/text/domain/article.js';
import { saveTextRecordResult } from '../../src/text/textSession.js';
import { addReceptionScenePlacement, pruneReceptionContent } from '../../src/reception/receptionLayers.js';
import { MAX_SHAPES } from '../../src/shapes/shapes.js';

export function saveReception(store, expected, value, label = 'Edit Reception', generation = store.getGeneration()) {
  const draft = store.getSnapshot();
  if (!store.isCurrent() || draft.reception !== expected || generation !== store.getGeneration()) throw new Error('Reception changed. Repeat this action on the current layout.');
  assertReception(value);
  if (!store.commitCompletedOperation({ ...draft, reception: value }, { expectedGeneration: generation, historyLabel: label }))
    throw new Error('Reception could not be saved. Your accepted layout is unchanged. Retry the edit; browser storage may be full or blocked.');
  return value;
}
export function assignReceptionContent(value, regionId, content) {
  const regions = value.regions.map(r => {
    if (r.id !== regionId) return r;
    const { scene: _scene, ...region } = r;
    return { ...region, content };
  });
  return assertReception(pruneReceptionContent({ ...value, regions }));
}
export function placeReceptionLink(value, regionId, link) {
  if (!value.regions.some(region => region.id === regionId)) throw new Error('Select an available Reception cell.');
  const links = [...(value.links || []).filter(item => item.id !== link.id), link];
  return assignReceptionContent({ ...value, links }, regionId, link.id);
}
export function addReceptionText(store, expected, regionId, initial = expected, options = {}) {
  const value = initial, id = `text:${crypto.randomUUID()}`;
  if (!value?.regions.some(r => r.id === regionId)) throw new Error('Select an available Reception region.');
  const region = value.regions.find(item => item.id === regionId), layered = options.layer || Boolean(region.scene);
  if (value.texts.filter(item => layered || item.id !== region.content).length >= MAX_TEXT_MODULES) throw new Error(`Reception holds up to ${MAX_TEXT_MODULES} texts. Delete a text before adding another.`);
  const article = createArticle();
  // New content starts on its existing readable surface. From this point the
  // Reception region owns that surface; Text keeps only its content controls.
  const regions = value.regions.map(r => !layered && r.id === regionId ? { ...r, surface: r.surface ?? article.appearance.background,
    padding: 24 } : r);
  const content = { ...value, regions, texts: [...value.texts, { id, article, visibility: 'PUBLIC' }] };
  const next = layered ? addReceptionScenePlacement(content, regionId, id, options.geometry) : assignReceptionContent(content, regionId, id);
  saveReception(store, expected, next, layered ? 'Add Text layer' : 'Add Reception Text'); return id;
}
export function addReceptionShape(store, expected, regionId, initial = expected, options = {}) {
  const shapes = initial?.shapes || [];
  if (!initial?.regions.some(region => region.id === regionId)) throw new Error('Select an available Reception cell.');
  if (shapes.length >= MAX_SHAPES) throw new Error(`Reception holds up to ${MAX_SHAPES} shapes. Delete a shape before adding another.`);
  const id = `shape:${crypto.randomUUID()}`;
  const record = { id, name: `Shape ${shapes.length + 1}`, color: '#101111', opacity: 1, visibility: 'PUBLIC' };
  const next = addReceptionScenePlacement({ ...initial, shapes: [...shapes, record] }, regionId, id, options.geometry);
  saveReception(store, expected, next, 'Add Shape layer'); return id;
}
// Capture the profile scope, exact generation and region before media work.
// Cancel/unmount revokes the request; completion cannot retarget newer selection.
export function prepareReceptionImage(store, expected, regionId, initial = expected, options = {}) {
  let active = true;
  const generation = store.getGeneration();
  return { cancel: () => { active = false; }, async choose(input, decoded, isCurrent = () => true) {
    const side = await resolveImageLibraryArtwork(input, decoded);
    if (!active || !isCurrent() || !store.isCurrent() || store.getGeneration() !== generation || store.getSnapshot().reception !== expected) return false;
    const value = initial, region = value?.regions.find(r => r.id === regionId);
    if (!region) return false;
    const layered = options.layer || Boolean(region.scene);
    if (value.imageModules.filter(item => layered || item.id !== region.content || item.id === value.branding.logo).length >= MAX_IMAGE_MODULES)
      throw new Error(`Reception holds up to ${MAX_IMAGE_MODULES} images. Delete an image before adding another.`);
    const id = `image:${crypto.randomUUID()}`;
    const record = { id, name: (side.asset.name || 'Image').slice(0, 48), width: 800, height: 600, artwork: { ...side, crop: { x: .5, y: .5, zoom: 1 } }, visibility: 'PUBLIC' };
    const regions = value.regions.map(r => !layered && r.id === regionId ? { ...r, padding: 0 } : r);
    const content = { ...value, regions, imageModules: [...value.imageModules, record] };
    const next = layered ? addReceptionScenePlacement(content, regionId, id, options.geometry) : assignReceptionContent(content, regionId, id);
    saveReception(store, expected, next, layered ? 'Add Image layer' : 'Add Reception Image', generation); active = false; return id;
  } };
}
const receptionTexts = { read: draft => draft.reception?.texts, replace: (draft, texts) => ({ ...draft, reception: { ...draft.reception, texts } }) };
export const saveReceptionTextResult = (store, scope, expected, article, options) =>
  saveTextRecordResult(store, scope.profile, expected, { ...expected, article }, options, receptionTexts);
