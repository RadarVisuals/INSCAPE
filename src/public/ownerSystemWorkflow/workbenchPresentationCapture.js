import { createDefaultWorkbenchPresentation, createMiniAppPresentation, createTextPresentation } from '../../profileDocument/domain/workbenchPresentation.js';
import { createProfileDocumentV9AssetResolver } from '../../profileDocument/domain/profileDocumentV9Asset.js';
import { createImagePresentation } from '../../imageModule/imageModule.js';

// Pure projection for Preview and Prepare Publication. The host supplies live
// presentation inputs; only the existing authoring session saves the result.
// The current draft's module lists determine membership, never cached layouts.
export function captureWorkbenchPresentation({
  layout, shortcut, assetRecords, displayOpen, identityOpen, hasPrimaryDisplay = true,
  displays, miniApps, texts, displayPresentations = {}, miniAppPresentations = {}, textPresentations = {},
  imageModules, imagePresentations = {},
}) {
  try {
    if (displays?.some(({ id }) => displayPresentations[id] === null)) {
      throw new Error('A Display shortcut is unresolved');
    }

    let capturedShortcut = layout.display.shortcut;
    if (shortcut && hasPrimaryDisplay) {
      const existing = capturedShortcut.icon;
      const sameMedia = !shortcut.iconMedia || existing
        && shortcut.iconMedia.url === existing.media.url
        && shortcut.iconMedia.width === existing.media.width
        && shortcut.iconMedia.height === existing.media.height;
      const icon = !shortcut.iconAssetId ? null
        : existing?.stableAssetId === shortcut.iconAssetId && sameMedia ? existing
          : createProfileDocumentV9AssetResolver(assetRecords, { compactContentReference: false })(shortcut.iconAssetId, shortcut.iconMedia);
      capturedShortcut = { position: shortcut.position, visible: shortcut.visible, icon, iconPresentation: shortcut.iconPresentation };
    }

    // Optional collections are rebuilt from authored membership. Saved layouts
    // and live reports are fallbacks for those IDs only, including after Undo.
    const { displays: savedDisplays, miniApps: savedMiniApps, texts: savedTexts, imageModules: savedImages, ...base } = layout;
    return { error: null, value: {
      ...base,
      ...(imageModules ? { imageModules: imageModules.map((item, index) => imagePresentations[item.id]
        || savedImages?.find(p => p.id === item.id) || createImagePresentation(item.id, index)) } : {}),
      ...(texts ? { texts: texts.map((text, index) => textPresentations[text.id]
        || savedTexts?.find(item => item.id === text.id) || createTextPresentation(text.id, index)) } : {}),
      ...(miniApps ? { miniApps: miniApps.map((app, index) => miniAppPresentations[app.id]
        || savedMiniApps?.find(item => item.id === app.id) || createMiniAppPresentation(app.id, index)) } : {}),
      ...(displays ? { displays: displays.map(({ id }) => ({ id, ...(displayPresentations[id]
        || savedDisplays?.find(item => item.id === id) || createDefaultWorkbenchPresentation().display) })) } : {}),
      display: hasPrimaryDisplay ? { ...layout.display, shortcut: capturedShortcut, open: displayOpen }
        : { ...createDefaultWorkbenchPresentation().display, open: false },
      identity: { ...layout.identity, open: identityOpen },
    } };
  } catch {
    return { error: 'The Display shortcut artwork is still unavailable. Open Library to resolve it, or reset its icon before publishing.', value: null };
  }
}
