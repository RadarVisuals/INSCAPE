export const INSCAPE_PROFILE_DOCUMENT_TYPE = 'INSCAPE_PROFILE';
export const INSCAPE_PROFILE_DOCUMENT_VERSION = 9;

export const GALLERY_PUBLICATION_CAPABILITY = 'v9-gallery-placements';

// A v9 service can support multiple named canvases without supporting Studio
// placements. Check the shape of the verified artifact being uploaded.
export function requiresGalleryPublicationCapability(document) {
  return document.canvas === null || Object.hasOwn(document, 'receptionDestinations')
    || Object.hasOwn(document, 'composition') || Boolean(document.canvas?.destinations)
    || (document.canvases || []).some(item => Object.hasOwn(item, 'destinations') || Object.hasOwn(item.content, 'composition'));
}

export const PROFILE_DOCUMENT_PUBLICATION_VERSIONS = Object.freeze([
  INSCAPE_PROFILE_DOCUMENT_VERSION,
]);
export function assertProfileDocumentPublicationVersion(document) {
  if (!PROFILE_DOCUMENT_PUBLICATION_VERSIONS.includes(document?.version)) {
    throw new TypeError(`Profile document version ${String(document?.version)} is readable but not publishable`);
  }
  return document;
}
export const PROFILE_DOCUMENT_LIMITS = Object.freeze({
  maxJsonBytes: 512 * 1024, maxDepth: 10, maxSpaces: 24, maxAssetsPerSpace: 200,
  maxTotalAssetReferences: 1000, maxLabelLength: 80, maxNameLength: 80,
  maxIdLength: 200, maxUrlLength: 2048, maxCanvasObjects: 48
});
export const PROFILE_DOCUMENT_NETWORK = Object.freeze({ name: 'lukso-mainnet', chainId: 42 });
