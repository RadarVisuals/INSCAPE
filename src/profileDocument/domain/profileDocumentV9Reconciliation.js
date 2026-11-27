import { COMPOSITION_LAYOUT_KEYS, projectCompositionEditorDocument, pruneCellMembers, restoreCompositionEditorDocument } from '../../composition/compositionEditorDocument.js';
import { assignSlide, slideOf, slideCount, pruneSwipeLinks } from '../../composition/cellSlides.js';
import { currentStudioDraft } from '../../systemWorkflow/domain/studioComposition.js';
import { restoreWorkbenchIndex } from '../../systemWorkflow/domain/workbenchIndex.js';
import { artworkLayers, artworkRecords, projectArtworkLayers, reconcileArtworkLayers } from '../../systemWorkflow/domain/artworkLayers.js';
import { restorePublishedWorkbenchGroups } from './publishedWorkbenchGroups.js';
import { reconcileRemovedWorkbenchMembers } from '../../systemWorkflow/domain/workbenchGroups.js';
import {
  createBlankWorkbenchDraft,
  assertValidSystemWorkflowDraft,
} from '../../systemWorkflow/domain/systemWorkflowDraft.js';
import { assertValidProfileDocumentV9 } from './profileDocumentV9Validation.js';
import { restoreImageModules } from '../../imageModule/imageModule.js';
import { restoreShapes } from '../../shapes/shapes.js';
import { restoreKeeperDocks } from '../../keeper/keeper.js';
import { restoreTextModules } from '../../text/domain/article.js';
import { createDefaultWorkbenchPresentation } from './workbenchPresentation.js';

function restoredIdentity(identity) {
  return {
    ...(identity.card ? { card: structuredClone(identity.card) } : {}),
    alias: identity.alias,
    avatar: {
      mode: identity.avatar.mode,
      stableAssetId: identity.avatar.asset?.stableAssetId || null,
      shape: identity.avatar.shape,
      ...(identity.avatar.asset?.media?.url && identity.avatar.asset.media.type === 'image' ? { selectedMedia: {
        url: identity.avatar.asset.media.url, width: identity.avatar.asset.media.width, height: identity.avatar.asset.media.height,
      } } : {}),
    },
    bio: { ...identity.bio },
    tags: structuredClone(identity.tags),
    visibility: { ...identity.visibility },
  };
}

// Public content restores through the same module boundaries while local private work is retained.
export function reconcileSystemWorkflowDraftFromProfileDocumentV9(documentInput, currentDraftInput = null) {
  const document = assertValidProfileDocumentV9(documentInput);
  if (currentDraftInput !== null) {
    const current = assertValidSystemWorkflowDraft(currentDraftInput);
    if (current.profileAddress !== document.profile.address) {
      throw new TypeError('The local draft and published document belong to different profiles');
    }
  }
  const hidden = new Set((currentDraftInput?.cells || []).filter(cell =>
    currentDraftInput.shapes.find(shape => shape.id === cell.id)?.visibility === 'PRIVATE').flatMap(cell => [cell.id, ...cell.members]));
  const keepHidden = (restored, current = [], published = []) => restored.map(item => hidden.has(item.id) && !published.some(value => value.id === item.id)
    ? structuredClone(current.find(value => value.id === item.id)) : item);
  const shapes = keepHidden(restoreShapes(document.shapes, currentDraftInput?.shapes), currentDraftInput?.shapes, document.shapes);
  const keeperDocks = restoreKeeperDocks(document.keeperDocks, currentDraftInput?.keeperDocks);
  const imageModules = keepHidden(restoreImageModules(document.imageModules, currentDraftInput?.imageModules), currentDraftInput?.imageModules, document.imageModules);
  const texts = keepHidden(restoreTextModules(document.texts, currentDraftInput?.texts), currentDraftInput?.texts, document.texts);
  let workbench = document.workbench ? { ...createDefaultWorkbenchPresentation(), ...structuredClone(document.workbench) } : null;
  const privateTextWindows = (currentDraftInput?.workbench?.texts || []).filter(w => texts.some(t => t.id === w.id && (t.visibility === 'PRIVATE' || hidden.has(t.id))));
  if (privateTextWindows.length) {
    workbench ||= createDefaultWorkbenchPresentation();
    workbench.texts = [...(workbench.texts || []), ...structuredClone(privateTextWindows)];
  }
  const privateShapeWindows = (currentDraftInput?.workbench?.shapes || []).filter(w => shapes.some(shape => shape.id === w.id && (shape.visibility === 'PRIVATE' || hidden.has(shape.id))));
  if (privateShapeWindows.length) {
    workbench ||= createDefaultWorkbenchPresentation();
    workbench.shapes = [...(workbench.shapes || []), ...structuredClone(privateShapeWindows)];
  }
  const privateImageWindows = (currentDraftInput?.workbench?.imageModules || []).filter(w => imageModules.some(image => image.id === w.id && (image.visibility === 'PRIVATE' || hidden.has(image.id))));
  if (workbench) delete workbench.keeperDocks;
  if (privateImageWindows.length) {
    workbench ||= createDefaultWorkbenchPresentation();
    workbench.imageModules = [...(workbench.imageModules || []), ...structuredClone(privateImageWindows)];
  }
  const restored = {
    ...createBlankWorkbenchDraft(document.profile.address),
    ...Object.fromEntries(COMPOSITION_LAYOUT_KEYS.filter(key => Object.hasOwn(document, key)).map(key => [key, structuredClone(document[key])])),
    identityPresentation: restoredIdentity(document.identityPresentation),
    ...(document.composition ? { composition: restoreCompositionEditorDocument(document.composition) } : {}),
    ...(workbench ? { workbench } : {}),
    ...((document.shapes || currentDraftInput?.shapes) ? { shapes } : {}),
    ...((document.keeperDocks || currentDraftInput?.keeperDocks) ? { keeperDocks } : {}),
    ...((document.imageModules || currentDraftInput?.imageModules) ? { imageModules } : {}),
    ...((document.texts || currentDraftInput?.texts) ? { texts } : {}),
  };
  const workbenchGroups = restorePublishedWorkbenchGroups(document, currentDraftInput, restored);
  if (workbenchGroups) restored.workbenchGroups = workbenchGroups;
  const workbenchIndex = restoreWorkbenchIndex(document.workbenchIndex, currentDraftInput?.workbenchIndex);
  if (workbenchIndex) restored.workbenchIndex = workbenchIndex;
  if (document.artworkLayers || currentDraftInput?.artworkLayers) {
    if (currentDraftInput?.artworkLayers && JSON.stringify(projectArtworkLayers(currentDraftInput, document)) === JSON.stringify(artworkLayers(document))) {
      restored.artworkLayers = reconcileArtworkLayers(currentDraftInput, { ...restored, artworkLayers: currentDraftInput.artworkLayers }).artworkLayers;
    } else {
      const publicIds = new Set(artworkRecords(document).map(item => item.id));
      const available = new Set(artworkRecords(restored).map(item => item.id));
      const privateLayers = artworkLayers(currentDraftInput).flatMap(layer => {
        if (typeof layer === 'string') return !publicIds.has(layer) && available.has(layer) ? [layer] : [];
        const children = layer.children.filter(id => !publicIds.has(id) && available.has(id));
        return children.length ? [{ ...layer, children }] : [];
      });
      restored.artworkLayers = [...artworkLayers(document), ...privateLayers];
    }
  }
  if (restored.cells && currentDraftInput?.cells) {
    const available = new Set(artworkRecords(restored).map(item => item.id));
    const published = new Set(artworkRecords(document).map(item => item.id));
    const previousPublic = projectCompositionEditorDocument(currentDraftInput);
    restored.cells = pruneSwipeLinks([
      ...restored.cells.map(cell => {
        const previous = currentDraftInput.cells.find(item => item.id === cell.id);
        if (!previous) return cell;
        if (JSON.stringify(previousPublic.cells.find(item => item.id === cell.id)) === JSON.stringify(cell))
          return pruneCellMembers(structuredClone(previous), available);
        const privateMembers = previous.members.filter(id => available.has(id) && !published.has(id));
        let merged = { ...cell, members: [...cell.members, ...privateMembers] };
        const privateLayout = pruneCellMembers(previous, new Set(privateMembers));
        for (const key of ['fitText', 'memberAnchors']) if (privateLayout[key]?.length) merged[key] = [...(cell[key] || []), ...privateLayout[key]];
        if (privateLayout.mobile.placements?.length) merged.mobile = { ...cell.mobile,
          placements: [...(cell.mobile.placements || []), ...privateLayout.mobile.placements] };
        const requiredSlides = Math.max(slideCount(merged), ...privateMembers.map(id => slideOf(previous, id) + 1));
        if (requiredSlides > slideCount(merged)) merged.slides = [...(merged.slides || []), ...Array.from({ length: requiredSlides - slideCount(merged) }, () => [])];
        for (const id of privateMembers) merged = assignSlide(merged, [id], slideOf(previous, id));
        if (previous.lockedMembers) merged.lockedMembers = previous.lockedMembers.filter(id => merged.members.includes(id));
        return merged;
      }),
      ...currentDraftInput.cells.filter(cell => !restored.cells.some(item => item.id === cell.id) && available.has(cell.id) && !published.has(cell.id))
        .map(cell => pruneCellMembers(structuredClone(cell), available)),
    ]);
    if (JSON.stringify(previousPublic.cells.map(cell => cell.id)) === JSON.stringify(document.cells.map(cell => cell.id))) {
      const order = currentDraftInput.cells.map(cell => cell.id);
      restored.cells.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    }
    const retainedLinks = (currentDraftInput.links || []).filter(link => restored.cells.some(cell => cell.content === link.id)
      && !restored.links?.some(item => item.id === link.id));
    if (retainedLinks.length) restored.links = [...(restored.links || []), ...structuredClone(retainedLinks)];
    if (currentDraftInput.workbench?.lockedLayerIds)
      restored.workbench.lockedLayerIds = currentDraftInput.workbench.lockedLayerIds.filter(id => available.has(id));
  }
  if (currentDraftInput?.workbench?.keeperDocks) {
    restored.workbench ||= createDefaultWorkbenchPresentation();
    restored.workbench.keeperDocks = structuredClone(currentDraftInput.workbench.keeperDocks);
  }
  return currentStudioDraft(reconcileRemovedWorkbenchMembers(currentDraftInput, restored));
}
