export const PROFILE_DOCUMENT_TYPE = 'OS_UNDERNEATH_PROFILE';
export const PROFILE_DOCUMENT_PUBLICATION_VERSION = 7;
export const PROFILE_DOCUMENT_VERSION = PROFILE_DOCUMENT_PUBLICATION_VERSION;
export const PROFILE_DOCUMENT_VERSION_8 = 8;
export function assertProfileDocumentPublicationVersion(document) {
  if (document?.version !== PROFILE_DOCUMENT_PUBLICATION_VERSION) {
    throw new TypeError(`Profile document version ${String(document?.version)} is readable but not publishable`);
  }
  return document;
}
export const PROFILE_DOCUMENT_LIMITS = Object.freeze({
  maxJsonBytes: 512 * 1024, maxDepth: 10, maxSpaces: 24, maxAssetsPerSpace: 200,
  maxTotalAssetReferences: 1000, maxLabelLength: 80, maxNameLength: 80,
  maxIdLength: 200, maxUrlLength: 2048, maxCanvasObjects: 48
});
export const KNOWN_KEEPER_IDS = Object.freeze(['abyssal_eye', 'skull_reaper']);
export const KNOWN_STAGE_IDS = Object.freeze(['beige', 'black', 'darkblue', 'darkgrey', 'hotpink', 'lightblue', 'lightgrey', 'orange', 'pastelpurple', 'purple', 'moonpurple']);
export const KNOWN_ENVIRONMENT_TYPES = Object.freeze(['illustrated', 'shader']);
export const KNOWN_SHADER_ENVIRONMENT_IDS = Object.freeze(['neural-field']);
export const PROFILE_DOCUMENT_NETWORK = Object.freeze({ name: 'lukso-mainnet', chainId: 42 });
