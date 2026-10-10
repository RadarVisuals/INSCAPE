import { createProfileDocumentV9AssetResolver } from '../../profileDocument/domain/profileDocumentV9Asset.js';

// Published image media also contains a type. The editable shortcut accepts the
// strict placement-media shape, so project it explicitly when restoring a view.
export function restoreDisplayPresentation(presentation) {
  const icon = presentation.shortcut.icon;
  const media = icon?.media;
  return { ...presentation, shortcut: { ...presentation.shortcut, open: presentation.open,
    iconAssetId: icon?.stableAssetId || null,
    iconMedia: media?.type === 'image' ? { url: media.url, width: media.width, height: media.height } : null } };
}

// Every Display resolves its own shortcut before reporting a presentation to
// the host. null means unresolved artwork, not an absent or empty Display.
export function captureDisplayPresentation(presentation, shortcut, assetRecords) {
  if (!shortcut) return presentation;
  try {
    const existing = presentation.shortcut.icon;
    const sameMedia = !shortcut.iconMedia || existing
      && shortcut.iconMedia.url === existing.media.url
      && shortcut.iconMedia.width === existing.media.width
      && shortcut.iconMedia.height === existing.media.height;
    const icon = !shortcut.iconAssetId ? null
      : existing?.stableAssetId === shortcut.iconAssetId && sameMedia ? existing
        : createProfileDocumentV9AssetResolver(assetRecords, { compactContentReference: false })(shortcut.iconAssetId, shortcut.iconMedia);
    return { ...presentation, shortcut: { position: shortcut.position, visible: shortcut.visible, icon, iconPresentation: shortcut.iconPresentation } };
  } catch { return null; }
}
